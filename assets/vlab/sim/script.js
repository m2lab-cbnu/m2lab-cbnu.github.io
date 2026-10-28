// A small interpreter for mumax3-style scripts. It parses its own expression language (no eval),
// builds the simulation, and drives the shared engine for Run and Relax.

import { MU0 } from '../physics/materials.js';
import { blank, setVortex, setRandom, antennaProfile } from './presets.js';

export const EXAMPLES = [
  { name: 'Standard problem 4 (start)', code: `// muMAG standard problem 4: a permalloy strip, 500 x 125 x 3 nm
SetGridSize(128, 32, 1)
SetCellSize(500e-9/128, 125e-9/32, 3e-9)
Msat  = 800e3
Aex   = 13e-12
alpha = 0.02
m = Uniform(1, 0.1, 0)
Relax()          // the S-state
TableAutoSave(10e-12)
B_ext = vector(-24.6e-3, 4.3e-3, 0)
Run(1e-9)` },
  { name: 'Vortex gyration', code: `// a permalloy disk and a short field pulse
SetGridSize(64, 64, 1)
SetCellSize(500e-9/64, 500e-9/64, 30e-9)
SetGeom(Circle(500e-9))
Msat = 800e3; Aex = 13e-12; alpha = 0.01
m = Vortex(1, 1)
Relax()
TableAutoSave(20e-12)
B_ext = vector(3e-3*exp(-pow((t-0.1e-9)/0.04e-9, 2)), 0, 0)
Run(5e-9)` },
  { name: 'Spin waves in a YIG waveguide', code: `// a YIG strip with an antenna at the left
SetGridSize(512, 64, 1)
SetCellSize(40e-9, 40e-9, 100e-9)
Msat = 140e3; Aex = 3.7e-12; alpha = 2e-4
B_ext = vector(0, 0.02, 0)        // across the strip: Damon-Eshbach
m = Uniform(0, 1, 0)
Antenna(-5e-6, 160e-9)
f := 2.6e9
B_ant = 0.5e-3*sin(2*pi*f*t)
Run(15e-9)` },
  { name: 'Perpendicular dot from a random state', code: `// a perpendicular Co/Pt dot relaxing from a random state
SetGridSize(64, 64, 1)
SetCellSize(2e-9, 2e-9, 1e-9)
SetGeom(Circle(120e-9))
Msat = 1.1e6; Aex = 15e-12; alpha = 0.3
Ku1 = 1.1e6; AnisU = vector(0, 0, 1)
m = RandomMag()
Relax()
Print("average m:", m_avg)` },
];

// ---------------------------------------------------------------- tokenizer and parser
function tokenize(src) {
  const toks = []; let i = 0;
  const re = { space: /\s/, digit: /[0-9.]/, id: /[A-Za-z_]/, idc: /[A-Za-z_0-9]/ };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '\n' || c === ';') { toks.push({ t: 'nl' }); i++; continue; }
    if (re.space.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      toks.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
    }
    if (re.id.test(c)) { let j = i; while (j < src.length && re.idc.test(src[j])) j++; toks.push({ t: 'id', v: src.slice(i, j) }); i = j; continue; }
    if (c === '"') { let j = i + 1; while (j < src.length && src[j] !== '"') j++; toks.push({ t: 'str', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    if (src.startsWith(':=', i)) { toks.push({ t: 'op', v: ':=' }); i += 2; continue; }
    if ('+-*/^(),.='.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw new Error(`I don't understand the character "${c}"`);
  }
  toks.push({ t: 'nl' }, { t: 'eof' });
  return toks;
}

export function parse(src) {
  const T = tokenize(src); let p = 0, line = 1;
  const peek = () => T[p], next = () => T[p++];
  const isOp = (v) => T[p].t === 'op' && T[p].v === v;
  const expect = (v) => { if (!isOp(v)) throw new Error(`Line ${line}: expected "${v}"`); p++; };
  function primary() {
    const t = next();
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'op' && t.v === '(') { const e = expr(); expect(')'); return e; }
    if (t.t === 'id') {
      if (isOp('(')) { p++; const args = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && ++p); } expect(')'); return { k: 'call', name: t.v, args }; }
      return { k: 'var', name: t.v };
    }
    throw new Error(`Line ${line}: unexpected ${t.t === 'op' ? '"' + t.v + '"' : t.t}`);
  }
  function postfix() {
    let e = primary();
    while (isOp('.')) {
      p++; const id = next(); if (id.t !== 'id') throw new Error(`Line ${line}: expected a method name after "."`);
      expect('('); const args = []; if (!isOp(')')) { do { args.push(expr()); } while (isOp(',') && ++p); } expect(')');
      e = { k: 'method', obj: e, name: id.v, args };
    }
    return e;
  }
  function power() { const b = postfix(); if (isOp('^')) { p++; return { k: 'bin', op: '^', a: b, b: unary() }; } return b; }
  function unary() { if (isOp('-')) { p++; return { k: 'neg', a: unary() }; } if (isOp('+')) { p++; return unary(); } return power(); }
  function term() { let a = unary(); while (isOp('*') || isOp('/')) { const op = next().v; a = { k: 'bin', op, a, b: unary() }; } return a; }
  function expr() { let a = term(); while (isOp('+') || isOp('-')) { const op = next().v; a = { k: 'bin', op, a, b: term() }; } return a; }
  const stmts = [];
  while (peek().t !== 'eof') {
    if (peek().t === 'nl') { p++; line++; continue; }
    const start = p;
    if (peek().t === 'id' && T[p + 1].t === 'op' && (T[p + 1].v === '=' || T[p + 1].v === ':=')) {
      const name = next().v; p++; stmts.push({ k: 'assign', name, e: expr(), line });
    } else stmts.push({ k: 'expr', e: expr(), line });
    if (peek().t !== 'nl' && peek().t !== 'eof') throw new Error(`Line ${line}: unexpected text after the statement`);
    if (p === start) p++;
  }
  return stmts;
}

// ---------------------------------------------------------------- values
const isVec = (v) => Array.isArray(v) && v.vec;
const vec = (x, y, z) => { const a = [x, y, z]; a.vec = true; return a; };
const usesT = (e) => !e ? false : e.k === 'var' ? e.name === 't' : ['bin'].includes(e.k) ? usesT(e.a) || usesT(e.b) : e.k === 'neg' ? usesT(e.a) : e.k === 'call' || e.k === 'method' ? (e.args || []).some(usesT) || usesT(e.obj) : false;

class Shape { constructor(fn) { this.fn = fn; } }
const SHAPES = {
  Rect: (w, h) => new Shape((x, y) => Math.abs(x) <= w / 2 && Math.abs(y) <= h / 2),
  Square: (a) => new Shape((x, y) => Math.abs(x) <= a / 2 && Math.abs(y) <= a / 2),
  Cuboid: (w, h) => new Shape((x, y) => Math.abs(x) <= w / 2 && Math.abs(y) <= h / 2),
  Circle: (d) => new Shape((x, y) => x * x + y * y <= d * d / 4),
  Cylinder: (d) => new Shape((x, y) => x * x + y * y <= d * d / 4),
  Ellipse: (a, b) => new Shape((x, y) => (2 * x / a) ** 2 + (2 * y / b) ** 2 <= 1),
  Ellipsoid: (a, b) => new Shape((x, y) => (2 * x / a) ** 2 + (2 * y / b) ** 2 <= 1),
  Universe: () => new Shape(() => true),
  XRange: (a, b) => new Shape((x) => x >= a && x < b),
  YRange: (a, b) => new Shape((x, y) => y >= a && y < b),
};
const METHODS = {
  Add: (s, o) => new Shape((x, y) => s.fn(x, y) || o.fn(x, y)),
  Sub: (s, o) => new Shape((x, y) => s.fn(x, y) && !o.fn(x, y)),
  Intersect: (s, o) => new Shape((x, y) => s.fn(x, y) && o.fn(x, y)),
  Xor: (s, o) => new Shape((x, y) => s.fn(x, y) !== o.fn(x, y)),
  Transl: (s, dx, dy) => new Shape((x, y) => s.fn(x - dx, y - (dy || 0))),
  RotZ: (s, a) => new Shape((x, y) => { const c = Math.cos(-a), n = Math.sin(-a); return s.fn(c * x - n * y, n * x + c * y); }),
  Scale: (s, sx, sy) => new Shape((x, y) => s.fn(x / sx, y / (sy || sx))),
  Inverse: (s) => new Shape((x, y) => !s.fn(x, y)),
};
const MATHS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs, log: Math.log, pow: Math.pow, atan2: Math.atan2, atan: Math.atan, tanh: Math.tanh,
  sinc: (x) => (Math.abs(x) < 1e-12 ? 1 : Math.sin(x) / x), min: Math.min, max: Math.max, floor: Math.floor, heaviside: (x) => (x >= 0 ? 1 : 0), sign: Math.sign };

// ---------------------------------------------------------------- runner
export function runScript(src, { engine, print, onLoad, onRow }) {
  let stopped = false;
  const stop = () => { stopped = true; engine.pause(); if (wake) wake(); };
  let wake = null;
  const S = { Nx: 0, Ny: 0, dx: 0, dy: 0, dz: 0, pbc: [0, 0], Msat: 800e3, Aex: 13e-12, alpha: 0.01, gammaLL: 1.7595e11, Ku1: 0, anisU: vec(1, 0, 0), Kp: 0,
    geom: null, mInit: null, Bext: vec(0, 0, 0), BextFn: null, antenna: null, BantFn: null, tableDt: 0, dirtyGrid: true, dirtyM: true };
  const vars = { pi: Math.PI, mu0: MU0, t: 0 };

  function evalE(e, env) {
    switch (e.k) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 'var': {
        if (e.name in env) return env[e.name];
        if (e.name in vars) return vars[e.name];
        if (e.name === 'm_avg' || e.name === 'm') return engine.sim ? vec(...engine.sim.average()) : vec(0, 0, 0);
        if (e.name === 'Msat') return S.Msat; if (e.name === 'Aex') return S.Aex; if (e.name === 'alpha') return S.alpha;
        throw new Error(`"${e.name}" is not defined`);
      }
      case 'neg': { const a = evalE(e.a, env); return isVec(a) ? vec(-a[0], -a[1], -a[2]) : -a; }
      case 'bin': {
        const a = evalE(e.a, env), b = evalE(e.b, env);
        if (e.op === '^') return Math.pow(a, b);
        if (isVec(a) || isVec(b)) {
          if (e.op === '+' || e.op === '-') { if (!isVec(a) || !isVec(b)) throw new Error('You can only add a vector to a vector'); const s = e.op === '+' ? 1 : -1; return vec(a[0] + s * b[0], a[1] + s * b[1], a[2] + s * b[2]); }
          if (e.op === '*') { const [v, s] = isVec(a) ? [a, b] : [b, a]; return vec(v[0] * s, v[1] * s, v[2] * s); }
          if (e.op === '/' && isVec(a)) return vec(a[0] / b, a[1] / b, a[2] / b);
          throw new Error('That vector operation is not supported');
        }
        return e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : a / b;
      }
      case 'call': {
        const args = e.args.map((x) => evalE(x, env));
        if (e.name === 'vector') return vec(args[0] || 0, args[1] || 0, args[2] || 0);
        if (MATHS[e.name]) return MATHS[e.name](...args);
        if (SHAPES[e.name]) return SHAPES[e.name](...args);
        if (e.name === 'Uniform') return { mInit: 'uniform', v: [args[0], args[1], args[2]] };
        if (e.name === 'Vortex') return { mInit: 'vortex', c: args[0], p: args[1] };
        if (e.name === 'TwoDomain') return { mInit: 'twodomain', a: args.slice(0, 3), w: args.slice(3, 6), b: args.slice(6, 9) };
        if (e.name === 'RandomMag') return { mInit: 'random', seed: 7 };
        if (e.name === 'RandomMagSeed') return { mInit: 'random', seed: args[0] | 0 || 7 };
        throw new Error(`${e.name}() is not available here`);
      }
      case 'method': {
        const o = evalE(e.obj, env), args = e.args.map((x) => evalE(x, env));
        if (o instanceof Shape && METHODS[e.name]) return METHODS[e.name](o, ...args);
        throw new Error(`.${e.name}() is not available here`);
      }
    }
    throw new Error('Cannot evaluate that');
  }
  const fnOfT = (e) => (t) => evalE(e, { t });

  function buildM() {
    const { Nx, Ny, dx, dy } = S, m = blank(Nx, Ny), shape = S.geom || SHAPES.Universe();
    for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) {
      const x = (i + 0.5 - Nx / 2) * dx, y = (j + 0.5 - Ny / 2) * dy;
      m[4 * (j * Nx + i) + 3] = shape.fn(x, y) ? 1 : 0;
    }
    const mi = S.mInit || { mInit: 'uniform', v: [1, 0, 0] };
    if (mi.mInit === 'uniform') { const n = Math.hypot(...mi.v) || 1; for (let k = 0; k < m.length; k += 4) { m[k] = mi.v[0] / n; m[k + 1] = mi.v[1] / n; m[k + 2] = mi.v[2] / n; } }
    if (mi.mInit === 'vortex') setVortex(m, Nx, Ny, dx, dy, mi.c, mi.p, Math.max(8e-9, 2 * dx));
    if (mi.mInit === 'random') setRandom(m, mi.seed);
    if (mi.mInit === 'twodomain') {
      for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) {
        const k = 4 * (j * Nx + i), x = i - Nx / 2, v = Math.abs(x) < 2 ? mi.w : x < 0 ? mi.a : mi.b, n = Math.hypot(...v) || 1;
        m[k] = v[0] / n; m[k + 1] = v[1] / n; m[k + 2] = v[2] / n;
      }
    }
    return m;
  }
  function material() {
    const u = S.anisU, un = Math.hypot(...u) || 1, perp = Math.abs(u[2]) / un > 0.7;
    return { Ms: S.Msat, A: S.Aex, alpha: S.alpha, gamma: S.gammaLL / (2 * Math.PI), Ku: perp ? 0 : S.Ku1, phiU: Math.atan2(u[1], u[0]) * 180 / Math.PI, Kp: (perp ? S.Ku1 : 0) + S.Kp };
  }
  async function ensureLoaded() {
    if (!S.Nx || !S.dx) throw new Error('Call SetGridSize and SetCellSize first');
    const sim = engine.sim;
    if (S.dirtyGrid || S.dirtyM || !sim || !engine.cfg || engine.cfg.fromScript !== runId) {
      const { Nx, Ny, dx, dy, dz } = S;
      const ant = S.antenna ? antennaProfile(Nx, Ny, dx, dy, { x0: S.antenna.x0, w: S.antenna.w, s: S.antenna.s || Math.max(dz / 2 + dx / 2, 30e-9) }) : null;
      let m = buildM();
      if (!S.dirtyGrid && !S.dirtyM && sim && sim.g && sim.g.Nx === Nx && sim.g.Ny === Ny) m = sim.readState();
      const cfg = { name: 'Script', grid: { Nx, Ny, dx, dy, dz, pbc: S.pbc }, mat: material(), m, B: S.BextFn ? S.BextFn(0) : [...S.Bext], antenna: ant,
        rf: S.BantFn ? { on: true, kind: 'fn', fn: S.BantFn, amp: 1 } : { on: false }, view: { mode: S.antenna ? 4 : 0, gain: S.antenna ? 400 : 1 }, fieldFn: S.BextFn, fromScript: runId };
      onLoad && onLoad(cfg);
      if (!(await engine.load(cfg))) throw new Error('Stopped');
      S.dirtyGrid = false; S.dirtyM = false;
      print(`Grid ${Nx} × ${Ny}, cells ${fmt(dx * 1e9)} × ${fmt(dy * 1e9)} × ${fmt(dz * 1e9)} nm, time step ${fmt(engine.sim.dt * 1e12)} ps`);
    } else {
      sim.setMaterial(material());
      engine.fieldFn = S.BextFn; if (!S.BextFn) sim.setField([...S.Bext]);
      if (S.BantFn) { sim.rf = { ...sim.rf, on: true, fn: S.BantFn }; }
    }
  }
  const fmt = (v) => (+v.toPrecision(4)).toString();
  const runId = Math.random();

  async function exec(stmts) {
    for (const s of stmts) {
      if (stopped) throw new Error('Stopped');
      try {
        if (s.k === 'assign') {
          const n = s.name;
          if (n === 'B_ext') { if (usesT(s.e)) { S.BextFn = fnOfT(s.e); } else { S.Bext = evalE(s.e, {}); S.BextFn = null; } if (!isVec(S.BextFn ? S.BextFn(0) : S.Bext)) throw new Error('B_ext needs a vector'); if (engine.cfg && engine.cfg.fromScript === runId && !S.dirtyGrid && !S.dirtyM) { engine.fieldFn = S.BextFn; if (!S.BextFn) engine.sim.setField([...S.Bext]); } continue; }
          if (n === 'B_ant') { S.BantFn = usesT(s.e) ? fnOfT(s.e) : ((v) => () => v)(evalE(s.e, {})); if (engine.cfg && engine.cfg.fromScript === runId && engine.sim) engine.sim.rf = { ...engine.sim.rf, on: true, fn: S.BantFn }; continue; }
          const v = evalE(s.e, {});
          if (n === 'm') { if (!v || !v.mInit) throw new Error('m needs Uniform(...), Vortex(...), TwoDomain(...) or RandomMag()'); S.mInit = v; S.dirtyM = true; continue; }
          if (n === 'Msat') S.Msat = v; else if (n === 'Aex') S.Aex = v; else if (n === 'alpha') S.alpha = v;
          else if (n === 'GammaLL') S.gammaLL = v; else if (n === 'Ku1') S.Ku1 = v; else if (n === 'Kp') S.Kp = v;
          else if (n === 'AnisU') { if (!isVec(v)) throw new Error('AnisU needs a vector'); S.anisU = v; }
          else if (['Dind', 'Dbulk', 'Temp', 'EdgeSmooth', 'Kc1', 'Ku2', 'Xi', 'Pol', 'J'].includes(n)) print(`${n} is not part of this simulator yet; ignored.`, true);
          else vars[n] = v;
          if (engine.cfg && engine.cfg.fromScript === runId && engine.sim && ['Msat', 'Aex', 'alpha', 'GammaLL', 'Ku1', 'AnisU', 'Kp'].includes(n)) engine.sim.setMaterial(material());
          continue;
        }
        const e = s.e;
        if (e.k !== 'call') { const v = evalE(e, {}); print(String(v)); continue; }
        const args = () => e.args.map((x) => evalE(x, {}));
        switch (e.name) {
          case 'SetGridSize': { const [a, b, c] = args(); if (c > 1) print('Only one layer of cells (Nz = 1) is simulated; using Nz = 1.', true);
            const pow2 = (n) => n > 0 && (n & (n - 1)) === 0; if (!pow2(a) || !pow2(b)) throw new Error('Grid sizes must be powers of two here (for example 64, 128, 256, 512)');
            if (a * b > 1024 * 256) throw new Error('That grid is too large for a browser; keep Nx × Ny at or below 262144'); S.Nx = a; S.Ny = b; S.dirtyGrid = true; break; }
          case 'SetCellSize': { const [a, b, c] = args(); S.dx = a; S.dy = b; S.dz = c; S.dirtyGrid = true; break; }
          case 'SetPBC': { const [a, b] = args(); S.pbc = [a | 0, b | 0]; S.dirtyGrid = true; break; }
          case 'SetGeom': { const [g] = args(); if (!(g instanceof Shape)) throw new Error('SetGeom needs a shape'); S.geom = g; S.dirtyM = true; break; }
          case 'Antenna': { const [x0, w, s2] = args(); S.antenna = { x0, w, s: s2 }; S.dirtyM = true; break; }
          case 'TableAutoSave': { const [dt] = args(); S.tableDt = dt; break; }
          case 'TableAdd': case 'TableSave': case 'Save': case 'SaveAs': case 'AutoSave': case 'SnapshotFormat': case 'OutputFormat': print(`${e.name}: results stay in your browser here, nothing is written to files.`); break;
          case 'Print': print(args().map((a) => (isVec(a) ? `(${a.map((q) => (+q.toPrecision(4))).join(', ')})` : typeof a === 'number' ? (+a.toPrecision(6)).toString() : String(a))).join(' ')); break;
          case 'Relax': case 'Minimize': {
            await ensureLoaded(); const n = await engine.relax(); if (n < 0) throw new Error('Stopped');
            print(engine.relaxInfo && !engine.relaxInfo.converged ? `Relax stopped after ${n} iterations without fully converging (time limit); call Relax() again to continue` : `Relaxed in ${n} iterations`);
            break;
          }
          case 'Run': case 'RunWhile': {
            const [tt] = args(); await ensureLoaded();
            const sim = engine.sim, tEnd = sim.t + tt;
            if (S.tableDt > 0) {
              const every = Math.max(1, Math.round(S.tableDt / sim.dt)), samples = Math.min(8192, Math.ceil(tt / (every * sim.dt)) + 1);
              sim.startRecording({ kind: 'avg', every, samples });
            }
            const t0 = sim.t;
            engine.cfg.stopAt = tEnd;
            await new Promise((resolve) => {
              let off = null, off2 = null;
              const fin = () => { if (off) off(); if (off2) off2(); wake = null; resolve(); };
              wake = fin;
              off = engine.on('done', fin);
              off2 = engine.on('frame', () => { if (stopped) fin(); });
              engine.play();
            });
            if (S.tableDt > 0 && sim.recCfg) {
              const rec = sim.readRecording();
              for (let i = 0; i < rec.n; i++) onRow && onRow([t0 + (i + 1) * rec.dtSample, rec.data[4 * i], rec.data[4 * i + 1], rec.data[4 * i + 2]]);
              sim.recording = false;
            }
            engine.cfg.stopAt = null;
            print(`Ran to t = ${fmt(sim.t * 1e9)} ns`);
            break;
          }
          case 'Steps': { const [n] = args(); await ensureLoaded(); engine.stepN(n | 0); engine.render(); break; }
          default: throw new Error(`${e.name}() is not available here`);
        }
      } catch (err) {
        if (err.message === 'Stopped') throw err;
        throw new Error(`Line ${s.line}: ${err.message}`);
      }
    }
  }
  const done = (async () => {
    const stmts = parse(src);
    await exec(stmts);
    print('Done.');
  })().catch((e) => { if (e.message !== 'Stopped') print(e.message, true); else print('Stopped.', true); });
  return { stop, done };
}
