// 2F · Magnet and pipes. Drop a strong magnet down a metal pipe and it drifts down slowly: as it
// falls, the changing magnetic flux drives rings of current round the pipe (eddy currents),
// and those currents push back. The braking is computed properly for a magnet of finite size,
// from the mutual inductance of coaxial rings, and compared with the textbook point-dipole result.

import { el, slider, button, group, readout, canvasBox, note, checkbox, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas, fmtNum } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { tr, trf } from '../i18n.js';

const MU0 = 4e-7 * Math.PI, G = 9.81, LP = 1.0;   // pipe length, m

const bench = {
  id: 'pipe', title: 'Magnet and pipes', kicker: '2F · Physics Playground', icon: '⤓', floor: 2,
  blurb: 'A magnet falls through a copper pipe, very slowly.',
  slots: [
    { id: 'magnet', label: 'Falling thing', options: ['magnet-n42', 'magnet-stack', 'magnet-n52', 'magnet-ferrite', 'magnet-tiny', 'slug-steel'], def: 'magnet-n42' },
    { id: 'pipe', label: 'Pipe', options: ['pipe-cu', 'pipe-al', 'pipe-brass', 'pipe-steel', 'pipe-pvc', 'pipe-slot', 'pipe-thick'], def: 'pipe-cu' },
    { id: 'temp', label: 'Temperature', options: ['warm', 'ln2'], def: 'warm' },
    { id: 'timer', label: 'Timing', options: ['stopwatch', 'photogate', 'camera'], def: 'stopwatch' },
  ],
};
bench.header = rigStrip(bench);

// ---------------------------------------------------------------- the physics
// complete elliptic integrals K and E of parameter m = k^2, by the arithmetic-geometric mean
function ellip(m) {
  let a = 1, b = Math.sqrt(1 - m), sum = m / 2, pow = 0.5;
  for (let i = 0; i < 40; i++) {
    const an = (a + b) / 2, bn = Math.sqrt(a * b), cn = (a - b) / 2;
    pow *= 2; sum += pow * cn * cn; a = an; b = bn;
    if (Math.abs(cn) < 1e-16) break;
  }
  const K = Math.PI / (2 * a);
  return [K, K * (1 - sum)];
}
// mutual inductance of two coaxial circular loops (radii r1, r2, axial distance d)
export function mutual(r1, r2, d) {
  const m = 4 * r1 * r2 / ((r1 + r2) ** 2 + d * d), k = Math.sqrt(m);
  const [K, E] = ellip(Math.min(m, 1 - 1e-15));
  return MU0 * Math.sqrt(r1 * r2) * ((2 / k - k) * K - (2 / k) * E);
}

// braking coefficient b(z) (N s/m) for the magnet centre at depth z below the top of the pipe
export function brakeTable(mag, pipe, cold) {
  const M = mag.Br / MU0, R = mag.R, len = mag.len;
  let sigma = pipe.sigma * (cold ? pipe.cold : 1);
  if (pipe.slot) sigma *= 0.04;   // the cut stops the currents going round
  const shells = 6, U = 0.25, du = 0.0002, n = Math.round(2 * U / du) + 1;
  const g = new Float64Array(n);
  if (sigma > 0 && M > 0) {
    for (let s = 0; s < shells; s++) {
      const rho = pipe.a + (s + 0.5) * pipe.w / shells, w = pipe.w / shells;
      const pre = sigma * w / (2 * Math.PI * rho) * M * M;
      for (let i = 0; i < n; i++) {
        const u = -U + i * du;
        const dPhi = mutual(rho, R, u + len / 2) - mutual(rho, R, u - len / 2);   // dΦ/dz per unit magnetisation
        g[i] += pre * dPhi * dPhi;
      }
    }
  }
  // cumulative integral, so b(z) = C(L - z) - C(-z)
  const C = new Float64Array(n);
  for (let i = 1; i < n; i++) C[i] = C[i - 1] + 0.5 * (g[i] + g[i - 1]) * du;
  const at = (u) => { if (u <= -U) return 0; if (u >= U) return C[n - 1]; const x = (u + U) / du, i = Math.floor(x), f = x - i; return C[i] + (C[Math.min(n - 1, i + 1)] - C[i]) * f; };
  const b = (z) => Math.max(0, at(LP - z) - at(-z));
  const mass = mag.rho * Math.PI * R * R * len;
  // the textbook result for a point dipole in a thin-walled pipe
  const mdip = M * Math.PI * R * R * len, am = pipe.a + pipe.w / 2;
  const kDip = 45 * MU0 * MU0 * mdip * mdip * sigma * pipe.w / (1024 * am ** 4);
  const ring = (u) => { const i = Math.round((u + U) / du); return i < 0 || i >= n ? 0 : g[i]; };
  return { b, mass, kDip, bMid: b(LP / 2), ring, sigma, fits: R < pipe.a - 0.2e-3 };
}

// ---------------------------------------------------------------- state
const S = { z: -0.05, v: 0, t: 0, run: false, trace: [], tTop: null, tBot: null, watch: { on: false, t0: 0, acc: 0 }, ff: 1, table: null, key: '' };
function setup() {
  const mag = phys(bench, 'magnet'), pipe = phys(bench, 'pipe'), cold = current(bench, 'temp') === 'ln2';
  const key = mag.id + pipe.id + cold;
  if (key !== S.key) { S.table = brakeTable(mag, pipe, cold); S.key = key; S.mag = mag; S.pipe = pipe; S.cold = cold; }
  return S.table;
}
function drop() { S.z = -0.05; S.v = 0; S.t = 0; S.run = true; S.trace = []; S.tTop = null; S.tBot = null; S.done = false; }

const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'mag', label: 'Falling thing', fmt: (v) => ITEMS[v].name },
  { key: 'pipe', label: 'Pipe', fmt: (v) => ITEMS[v].name },
  { key: 'cold', label: 'Cooled', fmt: (v) => (v ? 'yes' : 'no') },
  { key: 'how', label: 'Timed with' },
  { key: 't', label: 'Time through the pipe (s)', fmt: (v) => v.toFixed(v < 2 ? 3 : 2) },
], { caption: 'Your drops' });
let nDrop = 0;

function tabDrop(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Hold the magnet over the top of the 1 m pipe and let go. In plastic it simply falls. In metal it slows down at once and drifts to the bottom at a steady speed. Try the steel slug, the different pipes, the slotted pipe, and liquid nitrogen.' }));
  const box = canvasBox('', '5 / 6', 'The pipe, cut open so you can see inside');
  const go = button('Drop it', () => { setup(); if (!S.table.fits) return; drop(); watchReset(); }, 'go');
  const ff = segmented({ label: 'Playback speed', options: [{ value: 1, label: 'Real time' }, { value: 5, label: '×5' }, { value: 20, label: '×20' }], value: 1, onChange: (v) => { S.ff = +v; } });
  const rings = checkbox({ label: 'Show the eddy currents', checked: true, onChange: (v) => { S.rings = v; } }); S.rings = true;
  const wDisp = el('div', { class: 'watch', text: '0.00 s' });
  const wBtn = button('Start', () => watchToggle(), 'go', { class: 'vbtn vbtn-go watch-btn' });
  const wRec = button('Record', () => { const t = watchTime(); if (t > 0) addRow(t, 'stopwatch'); }, 'secondary');
  const wGrp = group('Stopwatch', wDisp, el('div', { class: 'vp-row' }, wBtn, wRec), el('p', { class: 'ctl-hint', text: 'Start when the magnet enters the top, stop when it drops out of the bottom.' }));
  const gTop = readout('Top gate'), gBot = readout('Bottom gate'), gDur = readout('Time between the gates');
  const gGrp = group('Photogates', gTop, gBot, gDur);
  const vRo = readout('Speed now'), bRo = readout('Steady speed inside (calculated)'), dRo = readout('Point-dipole estimate'), fRo = readout('Fall without a pipe');
  const fitNote = note('This magnet does not fit in this pipe!');
  pane.append(el('div', { class: 'vp-cols' },
    el('div', { class: 'vp-side' }, group('Drop', go, ff, rings), wGrp, gGrp),
    el('div', { class: 'vp-main' }, fitNote, box, el('div', { class: 'ros' }, vRo, bRo, dRo, fRo))), table.el);

  function addRow(t, how) {
    table.add({ n: ++nDrop, mag: current(bench, 'magnet'), pipe: current(bench, 'pipe'), cold: S.cold, how, t });
    rig.note({ bench: 'pipe', time: t, mag: current(bench, 'magnet'), pipe: current(bench, 'pipe'), cold: S.cold, how });
  }
  function watchTime() { return S.watch.acc + (S.watch.on ? (performance.now() - S.watch.t0) / 1000 * S.ff : 0); }
  function watchToggle() { if (S.watch.on) { S.watch.acc = watchTime(); S.watch.on = false; wBtn.textContent = 'Start'; } else { S.watch.t0 = performance.now(); S.watch.on = true; wBtn.textContent = 'Stop'; } }
  function watchReset() { S.watch = { on: false, t0: 0, acc: 0 }; wBtn.textContent = 'Start'; wDisp.textContent = '0.00 s'; }

  function sync() {
    const T = setup(), tm = current(bench, 'timer');
    wGrp.hidden = tm !== 'stopwatch'; gGrp.hidden = tm !== 'photogate';
    fitNote.hidden = T.fits; go.disabled = !T.fits;
    const vt = T.bMid > 0 ? T.mass * G / T.bMid : Infinity;
    bRo.set(Number.isFinite(vt) && vt < 4.4 ? `${fmtNum(vt * 100, 3)} cm/s` : 'no braking');
    const vd = T.kDip > 0 ? T.mass * G / T.kDip : Infinity;
    dRo.set(Number.isFinite(vd) && vd < 4.4 ? `${fmtNum(vd * 100, 3)} cm/s` : '–');
    fRo.set(`${Math.sqrt(2 * (LP + 0.05) / G).toFixed(2)} s for the drop`);
    draw();
  }
  onRig(bench, sync);

  const anim = loop((dt) => {
    const T = setup();
    if (S.run) {
      let left = dt * S.ff;
      while (left > 1e-9) {
        const h = Math.min(0.0005, left); left -= h;
        const b = T.b(S.z), k = b / T.mass;
        const zPrev = S.z;
        if (k * h > 1e-6) { const vt = G / k, e = Math.exp(-k * h); const vNew = vt + (S.v - vt) * e; S.z += vt * h + (S.v - vt) * (1 - e) / k; S.v = vNew; }
        else { S.z += S.v * h + 0.5 * G * h * h; S.v += G * h; }
        S.t += h;
        // the gates sit at the two ends of the pipe; the beam is cut when the magnet's centre passes
        if (zPrev < 0 && S.z >= 0) S.tTop = S.t - h * (S.z / (S.z - zPrev));
        if (zPrev < LP && S.z >= LP) {
          S.tBot = S.t - h * ((S.z - LP) / (S.z - zPrev));
          if (current(bench, 'timer') === 'photogate') addRow(S.tBot - S.tTop, 'photogates');
          else if (current(bench, 'timer') === 'camera') addRow(S.tBot - S.tTop, 'camera');
          rig.note({ bench: 'pipe', time: S.tBot - S.tTop, mag: current(bench, 'magnet'), pipe: current(bench, 'pipe'), cold: S.cold, auto: true });
        }
        if (S.z > LP + 0.12) { S.run = false; S.z = LP + 0.12; S.v = 0; break; }
      }
      if (!S.trace.length || S.t - S.trace[S.trace.length - 1][0] > 0.01) S.trace.push([S.t, S.z, S.v]);
      if (bench._graph) bench._graph();
    }
    if (S.watch.on) wDisp.textContent = watchTime().toFixed(2) + ' s';
    draw();
  });

  function draw() {
    const T = S.table || setup();
    const { g, w, h } = fitCanvas(box.canvas);
    const cold = S.cold;
    g.fillStyle = cold ? '#E3F4FF' : '#F1ECFF'; g.fillRect(0, 0, w, h);
    const top = h * 0.07, bot = h * 0.86, sc = (bot - top) / LP;
    const cx = w * 0.42, pw = Math.max(26, Math.min(60, w * 0.12));
    const p = S.pipe, item = ITEMS[current(bench, 'pipe')];
    const [col, hi] = item.icon.slice(1, 3);
    // stand
    g.fillStyle = '#6B5BE6'; g.fillRect(cx - pw - 18, top - 10, 6, bot - top + 40); g.fillRect(cx + pw + 12, top - 10, 6, bot - top + 40);
    g.fillStyle = '#4A3A8C'; g.fillRect(cx - pw - 30, bot + 26, 2 * pw + 60, 8);
    // the pipe, cut open: back wall and two edges
    g.fillStyle = col; g.fillRect(cx - pw / 2 - 6, top, 6, LP * sc); g.fillRect(cx + pw / 2, top, 6, LP * sc);
    g.fillStyle = hi; g.fillRect(cx - pw / 2 - 5, top, 2, LP * sc);
    g.fillStyle = 'rgba(27,36,64,0.10)'; g.fillRect(cx - pw / 2, top, pw, LP * sc);
    if (p.slot) { g.fillStyle = '#1B2440'; g.fillRect(cx - 1, top, 2, LP * sc); }
    if (cold) { g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 26; i++) { const y = top + ((i * 53 + performance.now() / 30) % (LP * sc)); g.fillRect(cx + pw / 2 + 8 + (i % 3) * 5, y, 3, 2); } }
    // eddy currents: rings that circulate one way above the magnet and the other way below
    if (S.rings && T.sigma > 0) {
      for (let k = 0; k <= 50; k++) {
        const z = k / 50 * LP, u = z - S.z;
        const J = Math.sqrt(T.ring(u)) * Math.abs(S.v) * Math.sign(u || 1);
        const a = Math.min(1, Math.abs(J) / (T.ringMax || (T.ringMax = Math.sqrt(Math.max(...[0, 0.002, 0.004, 0.006, 0.008, 0.01].map((x) => T.ring(x)))) * 0.3 + 1e-12)));
        if (a < 0.03) continue;
        g.strokeStyle = J > 0 ? `rgba(229,83,75,${a})` : `rgba(61,111,182,${a})`; g.lineWidth = 2;
        g.beginPath(); g.ellipse(cx, top + z * sc, pw / 2 + 3, 4, 0, 0, 7); g.stroke();
      }
    }
    // gates
    if (current(bench, 'timer') === 'photogate') for (const z of [0, LP]) { g.fillStyle = '#2E4A7D'; g.fillRect(cx - pw / 2 - 26, top + z * sc - 4, 14, 8); g.fillRect(cx + pw / 2 + 12, top + z * sc - 4, 14, 8); g.strokeStyle = 'rgba(229,83,75,0.6)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx - pw / 2 - 12, top + z * sc); g.lineTo(cx + pw / 2 + 12, top + z * sc); g.stroke(); g.setLineDash([]); }
    // catch box
    g.fillStyle = '#FFE07A'; g.fillRect(cx - pw, bot + 6, 2 * pw, 20); g.fillStyle = '#E8C25A'; g.fillRect(cx - pw, bot + 6, 2 * pw, 4);
    // the falling thing (drawn to scale across the pipe)
    const mag = S.mag, mh = Math.max(8, mag.len * sc * 1.0), mw = pw * (mag.R / p.a) * 0.95;
    const mz = top + Math.min(S.z, LP + 0.1) * sc;
    const mi = current(bench, 'magnet');
    if (mi === 'slug-steel') { g.fillStyle = '#9DB8D3'; g.fillRect(cx - mw / 2, mz - mh / 2, mw, mh); }
    else if (mi === 'magnet-ferrite') { g.fillStyle = '#22325C'; g.fillRect(cx - mw / 2, mz - mh / 2, mw, mh); }
    else { g.fillStyle = '#3D6FB6'; g.fillRect(cx - mw / 2, mz - mh / 2, mw, mh / 2); g.fillStyle = '#E5534B'; g.fillRect(cx - mw / 2, mz, mw, mh / 2); }
    g.strokeStyle = '#1B2440'; g.lineWidth = 1.2; g.strokeRect(cx - mw / 2, mz - mh / 2, mw, mh);
    // ruler
    g.fillStyle = '#12243A'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    for (let cm = 0; cm <= 100; cm += 10) { const y = top + cm / 100 * LP * sc; g.fillRect(cx + pw + 22, y, cm % 50 ? 6 : 10, 1); if (cm % 50 === 0) g.fillText(`${cm} cm`, cx + pw + 36, y); }
    vRo.set(`${(Math.abs(S.v) * 100).toFixed(1)} cm/s`);
    const tm = current(bench, 'timer');
    if (tm === 'photogate') { gTop.set(S.tTop !== null ? `${S.tTop.toFixed(4)} s` : '–'); gBot.set(S.tBot !== null ? `${S.tBot.toFixed(4)} s` : '–'); gDur.set(S.tTop !== null && S.tBot !== null ? `${(S.tBot - S.tTop).toFixed(4)} s` : '–'); }
  }
  sync();
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- speed against time
function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Filmed from the side through the slot: the magnet speeds up for a moment, then the braking force (proportional to the speed) balances its weight and it falls at a steady <b>terminal speed</b>.' }));
  const box = canvasBox('', '16 / 9', 'Speed against time');
  const plot = new Plot(box.canvas, { xlabel: 'Time (s)', ylabel: 'Speed (cm/s)' });
  const box2 = canvasBox('', '16 / 7', 'Braking along the pipe');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Depth of the magnet’s center (cm)', ylabel: 'Braking b (N s/m)' });
  const need = note('The speed graph needs the <b>high-speed camera</b>. You can always see the braking calculated along the pipe below.');
  pane.append(el('div', { class: 'vp-main' }, need, box, box2));
  function draw() {
    const cam = current(bench, 'timer') === 'camera';
    need.hidden = cam; box.hidden = !cam;
    if (cam && S.trace.length) plot.setSeries([{ x: S.trace.map((q) => q[0]), y: S.trace.map((q) => q[2] * 100), color: COLORS.signal, width: 2.2 }]).draw();
    const T = setup(), xs = [], ys = [];
    for (let z = -0.08; z <= LP + 0.08; z += 0.004) { xs.push(z * 100); ys.push(T.b(z)); }
    plot2.setSeries([{ x: xs, y: ys, color: COLORS.violet, width: 2.2, label: 'full calculation' }, { x: [0, LP * 100], y: [T.kDip, T.kDip], color: COLORS.gold, dash: [5, 4], width: 1.6, label: 'point-dipole formula' }]).draw();
  }
  let last = 0;
  bench._graph = () => { const now = performance.now(); if (now - last > 200) { last = now; draw(); } };
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
const PIPE_MAT = { 'pipe-cu': 'copper', 'pipe-slot': 'copper', 'pipe-thick': 'copper', 'pipe-al': 'alu', 'pipe-brass': 'brass', 'pipe-steel': 'steel', 'pipe-pvc': 'white' };
const TABLES = new Map();
function laneOf(magId, pipeId, cold, label = '') {
  const mag = { id: magId, ...ITEMS[magId].phys }, pipe = { id: pipeId, ...ITEMS[pipeId].phys };
  const key = `${magId}|${pipeId}|${cold}`;
  if (!TABLES.has(key)) TABLES.set(key, brakeTable(mag, pipe, cold));
  const T = TABLES.get(key);
  let rm = 1e-12; for (const x of [0.002, 0.004, 0.006, 0.008, 0.01, 0.012]) rm = Math.max(rm, Math.sqrt(T.ring(x)));
  return { mag, pipe, cold, T, ringMax: rm, z: -0.07, v: 0, t: 0, run: false, done: false, tTop: null, tBot: null, heat: new Float32Array(60), label, vt: T.bMid > 0 ? T.mass * G / T.bMid : Infinity };
}
function stepLane(L, dt, onExit) {
  if (!L.run) return;
  let left = dt;
  while (left > 1e-12) {
    const h = Math.min(0.0005, left); left -= h;
    const b = L.T.b(L.z), k = b / L.T.mass, zPrev = L.z;
    if (k * h > 1e-6) { const vt = G / k, e = Math.exp(-k * h); const vNew = vt + (L.v - vt) * e; L.z += vt * h + (L.v - vt) * (1 - e) / k; L.v = vNew; }
    else { L.z += L.v * h + 0.5 * G * h * h; L.v += G * h; }
    L.t += h;
    // the power that goes into the pipe warms it where the magnet is
    if (b > 0 && L.z > 0 && L.z < LP) { const i = Math.min(59, Math.floor(L.z / LP * 60)); L.heat[i] += b * L.v * L.v * h; }
    if (zPrev < 0 && L.z >= 0) L.tTop = L.t;
    if (zPrev < LP && L.z >= LP) { L.tBot = L.t; if (onExit) onExit(L); }
    if (L.z > LP + 0.13) { L.run = false; L.done = true; L.z = LP + 0.13; L.v = 0; break; }
  }
}

function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'pip', label: 'A tall metal pipe, cut open so you can see inside, with a magnet ready above it.',
    hello: 'Grab the **magnet**, hold it over the pipe and **let go**. In metal it drifts down slowly, as if through honey. Turn on the race to drop one through plastic at the same time.',
    aspect: 16 / 10, speeds: [[1, '1×', 'Real time'], [4, '4×', 'Four times faster'], [20, '20×', 'Twenty times faster'], [0.25, '¼×', 'Slow motion']],
    onReset: () => { lanes = mkLanes(); },
  });
  st.tool('currents', 'Eddy currents', { icon: K.COL.mag, on: true }).tool('forces', 'Forces', { icon: K.COL.gravity }).tool('field', 'Magnet’s field', { icon: K.COL.string })
    .tool('heat', 'Heat in the pipe', { icon: K.COL.heat }).tool('race', 'Race a plastic pipe', { icon: '#C3B4FF', onChange: () => { lanes = mkLanes(); } }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('v', 'Speed now').readout('vt', 'Steady speed inside').readout('t', 'Time through the pipe').readout('free', 'Free fall would take');
  const graph = st.liveGraph({ series: [{ id: 'v', label: 'speed (cm/s)', color: K.COL.vel }], window: 8, ylabel: 'cm/s' });
  let held = false, heldY = 0, Lay = { w: 800, h: 500, top: 70, bot: 440, sc: 370 }, pending = null, demo = null, first = true;
  const mkLanes = (cfg) => {
    if (cfg) return cfg.map((c) => laneOf(c.mag, c.pipe, !!c.cold, c.label));
    const L = [laneOf(current(bench, 'magnet'), current(bench, 'pipe'), current(bench, 'temp') === 'ln2', ITEMS[current(bench, 'pipe')].name)];
    if (st.on('race') && current(bench, 'pipe') !== 'pipe-pvc') L.push(laneOf(current(bench, 'magnet'), 'pipe-pvc', false, 'Plastic pipe'));
    return L;
  };
  let lanes = mkLanes();
  onRig(bench, () => { if (!demo) lanes = mkLanes(); });
  const dropBtn = el('button', { type: 'button', class: 'stg-act', text: 'Drop it' });
  dropBtn.addEventListener('click', () => dropAll());
  st.controls(el('div', { class: 'stg-row' }, dropBtn));
  function dropAll() { lanes = demo ? mkLanes(demo) : mkLanes(); for (const L of lanes) { if (!L.T.fits) continue; L.run = true; } graph.clear(); first = false; st.hint(null); sound.play('swing'); }
  function onExit(L) {
    const tt = L.tBot - L.tTop;
    if (!demo) rig.note({ bench: 'pipe', time: tt, mag: L.mag.id, pipe: L.pipe.id, cold: L.cold, auto: true });
    if (tt > 5) st.flash(`${tt.toFixed(1)} s!`);
  }

  // ---------- physics
  st.onStep((dt) => {
    for (const L of lanes) {
      const wasRun = L.run;
      stepLane(L, dt, onExit);
      if (wasRun && !L.run && L.done) sound.play('clink', { vol: Math.min(1, 0.3 + L.v) });
    }
    if (dt > 0 && lanes[0].run) graph.push(lanes[0].t, { v: lanes[0].v * 100 });
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- drawing
  st.onResize((w, h) => { Lay = { w, h, top: 76, bot: h - 64, sc: (h - 64 - 76) / LP }; });
  const laneX = (i, n) => Lay.w * (n === 1 ? 0.5 : n === 2 ? [0.38, 0.66][i] : [0.26, 0.5, 0.74][i]);
  const pw = () => Math.max(46, Math.min(74, Lay.w * 0.07));

  function drawPipe(g, L, cx) {
    const top = Lay.top, len = LP * Lay.sc, w = pw(), mat = K.MAT[PIPE_MAT[L.pipe.id]] || K.MAT.copper;
    // back wall of the pipe (we see the inside through a window cut in the front)
    g.save();
    const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    gr.addColorStop(0, K.mixHex(mat[2], '#132447', 0.35)); gr.addColorStop(0.5, K.mixHex(mat[0], '#132447', 0.25)); gr.addColorStop(1, K.mixHex(mat[2], '#132447', 0.45));
    g.fillStyle = gr; g.fillRect(cx - w / 2, top, w, len);
    g.restore();
    // heat glow
    if (st.on('heat')) {
      let mx = 1e-9; for (const q of L.heat) mx = Math.max(mx, q);
      for (let i = 0; i < 60; i++) { const a = Math.min(0.75, L.heat[i] / mx * 0.75); if (a < 0.02) continue; g.fillStyle = `rgba(242,138,60,${a})`; g.fillRect(cx - w / 2 - 8, top + i / 60 * len, w + 16, len / 60 + 1); }
    }
    // the two cut edges of the front wall
    K.box(g, cx - w / 2 - 9, top, 9, len, mat, { r: 2, vertical: true });
    K.box(g, cx + w / 2, top, 9, len, mat, { r: 2, vertical: true });
    if (L.pipe.slot) K.lineSeg(g, cx + w / 2 + 4, top, cx + w / 2 + 4, top + len, K.LINE, 2.5);
    if (L.cold) { for (let i = 0; i < 20; i++) { const y = top + ((i * 53 + st.t * 40) % len); g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(cx + w / 2 + 14 + (i % 3) * 5, y, 2.2, 0, Math.PI * 2); g.fill(); } }
    // mouth and foot
    g.save(); g.beginPath(); g.ellipse(cx, top, w / 2 + 9, 7, 0, 0, Math.PI * 2); g.fillStyle = mat[1]; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    g.beginPath(); g.ellipse(cx, top, w / 2, 4.5, 0, 0, Math.PI * 2); g.fillStyle = '#1B2440'; g.fill(); g.restore();
    // a catch cup at the bottom
    K.box(g, cx - w * 0.8, Lay.bot + 14, w * 1.6, 26, K.MAT.yellow, { r: 6 });
    K.tag(g, L.label, cx, Lay.bot + 54, { size: 11.5, bg: '#FFFDF6' });
  }

  function drawCurrents(g, L, cx) {
    if (!(L.T.sigma > 0) || !st.on('currents')) return;
    const w = pw(), mz = Lay.top + L.z * Lay.sc;
    // the rings sit within a couple of centimetres of the magnet: drawn spread out five times, so you can see them
    for (let k = -7; k <= 7; k++) {
      if (!k) continue;
      const u = k * 0.003, z = L.z + u;
      if (z < 0 || z > LP) continue;
      const J = Math.sqrt(L.T.ring(u)) / L.ringMax * Math.min(1, Math.abs(L.v) / Math.max(0.02, Math.min(L.vt, 3)));
      if (J < 0.06) continue;
      const y = mz + u * Lay.sc * 5;
      g.save(); g.lineWidth = 2.5 + 2 * J; g.strokeStyle = k < 0 ? `rgba(224,69,123,${Math.min(1, J)})` : `rgba(61,127,214,${Math.min(1, J)})`;
      g.beginPath(); g.ellipse(cx, y, w / 2 + 4, 6, 0, 0, Math.PI * 2); g.stroke();
      // which way the current goes round: a little arrowhead on the front
      const dir = k < 0 ? 1 : -1;
      g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(cx + dir * 8, y + 6); g.lineTo(cx - dir * 4, y + 1); g.lineTo(cx - dir * 4, y + 11); g.closePath(); g.fill();
      g.restore();
    }
    if (Math.abs(L.v) > 0.01 && L.z > 0.05 && L.z < LP - 0.05) {
      K.tag(g, 'currents above: pull it back', cx + w / 2 + 24, mz - 26, { align: 'left', size: 11, bg: '#FFD0DC' });
      K.tag(g, 'currents below: push it up', cx + w / 2 + 24, mz + 26, { align: 'left', size: 11, bg: '#BFE6FF' });
    }
  }

  function drawMagnet(g, L, cx, y) {
    const w = pw(), mw = w * (L.mag.R / L.pipe.a) * 0.92, mh = Math.max(24, L.mag.len * Lay.sc * 2.2);
    if (st.on('field') && L.mag.Br > 0) {
      g.save(); g.strokeStyle = 'rgba(61,111,182,0.55)'; g.lineWidth = 1.5;
      for (const k of [1, 1.8, 2.8]) { g.beginPath(); g.ellipse(cx - mw * 0.7 * k, y, mw * 0.7 * k, mh * 0.9 * k, 0, -Math.PI / 2, Math.PI / 2, true); g.stroke(); g.beginPath(); g.ellipse(cx + mw * 0.7 * k, y, mw * 0.7 * k, mh * 0.9 * k, 0, Math.PI / 2, Math.PI * 1.5, true); g.stroke(); }
      g.restore();
    }
    if (L.mag.id === 'slug-steel') K.box(g, cx - mw / 2, y - mh / 2, mw, mh, K.MAT.steel, { r: 3 });
    else if (L.mag.id === 'magnet-ferrite') K.box(g, cx - mw / 2, y - mh / 2, mw, mh, K.MAT.ferrite, { r: 3 });
    else {
      K.box(g, cx - mw / 2, y - mh / 2, mw, mh / 2, K.MAT.magnetS, { r: 3 });
      K.box(g, cx - mw / 2, y, mw, mh / 2, K.MAT.magnetN, { r: 3 });
      K.text(g, 'S', cx, y - mh / 4 + 4, { size: 10, weight: 700, align: 'center', color: '#FFFFFF' });
      K.text(g, 'N', cx, y + mh / 4 + 4, { size: 10, weight: 700, align: 'center', color: '#FFFFFF' });
    }
    return mh;
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[2], { floorH: 0.1 });
      // a ruler up the side
      K.rulerV(gg, 16, Lay.top, Lay.top + LP * Lay.sc, (v) => Lay.top + v / 100 * LP * Lay.sc, 0, 100, 5, { major: 2, fmt: (v) => String(v) });
      K.text(gg, 'cm', 20, Lay.top - 14, { size: 11, weight: 600 });
    });
    lanes.forEach((L, i) => {
      const cx = laneX(i, lanes.length);
      drawPipe(g, L, cx);
      const y = held && i === 0 ? heldY : Math.min(Lay.top + L.z * Lay.sc, Lay.bot + 18);
      drawCurrents(g, L, cx);
      // the magnet is drawn inside the pipe (between the back wall and the front edges)
      const mh = drawMagnet(g, L, cx, y);
      if (st.on('forces') && L.run && L.z > -0.02) {
        const F = 46, b = L.T.b(L.z) * L.v / (L.T.mass * G);
        K.arrow(g, cx - pw() - 30, y, cx - pw() - 30, y + F, K.COL.gravity, { label: 'weight', size: 11 });
        if (b > 0.02) K.arrow(g, cx - pw() - 52, y, cx - pw() - 52, y - F * Math.min(2, b), K.COL.mag, { label: 'magnetic braking', size: 11 });
      }
      if (!L.T.fits) K.tag(g, 'too big for this pipe!', cx, Lay.top - 30, { size: 12, bg: '#FFD0DC' });
      if (L.run || L.done) { const tt = (L.tBot ?? L.t) - (L.tTop ?? 0); K.tag(g, L.tTop === null ? 'falling…' : `${tt.toFixed(2)} s`, cx, Lay.top - 22 - (i % 2) * 0, { size: 12, bg: L.done ? '#E6FBF1' : '#FFF1B0' }); }
      void mh;
    });
    if (first && !held) { const k = (Math.sin(st.t * 3) + 1) / 2; const cx = laneX(0, lanes.length); K.arrow(g, cx + 80, Lay.top - 60 - k * 6, cx + 26, Lay.top - 46, K.COL.normal, { lw: 3.5, head: 11 }); }
  });
  st.onOver(() => {
    const L = lanes[0];
    st.set('v', `${(Math.abs(L.v) * 100).toFixed(1)} cm/s`);
    st.set('vt', Number.isFinite(L.vt) && L.vt < 4.4 ? `${(L.vt * 100).toFixed(1)} cm/s` : 'no braking');
    st.set('t', L.tTop !== null ? `${((L.tBot ?? L.t) - L.tTop).toFixed(2)} s` : '–');
    st.set('free', `${Math.sqrt(2 * LP / G).toFixed(2)} s`);
    graph.draw();
  });

  // ---------- hands: lift the magnet and drop it in
  st.handle({
    id: 'magnet', cursor: 'grab',
    hit: (x, y) => { const L = lanes[0], cx = laneX(0, lanes.length), my = Lay.top + L.z * Lay.sc; return !L.run && Math.abs(x - cx) < pw() && Math.abs(y - my) < 40 ? 0 : false; },
    down: (x, y) => { held = true; heldY = y; first = false; st.hint(null); for (const L of lanes) { L.done = false; L.z = -0.07; } },
    move: (x, y) => { heldY = Math.max(16, Math.min(Lay.top - 6, y)); },
    up: () => { held = false; lanes = demo ? mkLanes(demo) : mkLanes(); for (const L of lanes) { L.z = Math.min(-0.01, (heldY - Lay.top) / Lay.sc); if (L.T.fits) L.run = true; } graph.clear(); sound.play('swing'); },
  });
  st.hint('Lift the magnet above the pipe and let it go', { sticky: true });

  // ---------- why
  const race = (cfg, speed = 1) => { demo = cfg; lanes = mkLanes(cfg); st.setSpeed(speed); dropAll(); };
  st.tour({
    title: 'Why does it fall so slowly?',
    steps: [
      { say: 'Two identical magnets, one in plastic and one in copper. Neither pipe is magnetic, and the magnet does not touch the walls. Yet…', tools: { currents: false, forces: false, field: false, heat: false }, enter: () => race([{ mag: 'magnet-n42', pipe: 'pipe-pvc', label: 'plastic' }, { mag: 'magnet-n42', pipe: 'pipe-cu', label: 'copper' }]) },
      { say: 'As the magnet falls, the magnetic field through each ring of copper **keeps changing**: it grows in the rings ahead of the magnet and shrinks in the rings behind.', tools: { field: true }, enter: () => race([{ mag: 'magnet-n42', pipe: 'pipe-cu', label: 'copper' }], 1) },
      { say: 'A changing magnetic field drives an electric current round each ring (that is how generators work). These swirls are **eddy currents**: pink above the magnet, blue below, going round opposite ways.', tools: { currents: true, field: false } },
      { say: 'Each current ring is itself a little magnet. The one below **pushes** the falling magnet up, the one above **pulls** it back. Both brake it. The faster it falls, the stronger they get, until braking equals weight: a slow steady drift.', tools: { forces: true } },
      { say: 'The energy goes into **warming the pipe** a tiny bit. Cold copper conducts much better, so in liquid nitrogen it falls even more slowly. Cut a slot along the pipe and the currents cannot go round: it falls fast.', tools: { forces: false, heat: true }, enter: () => race([{ mag: 'magnet-n42', pipe: 'pipe-cu', label: 'copper' }, { mag: 'magnet-n42', pipe: 'pipe-slot', label: 'slotted copper' }, { mag: 'magnet-n42', pipe: 'pipe-cu', cold: true, label: 'cold copper' }], 4) },
    ],
    onEnd: () => { demo = null; lanes = mkLanes(); st.setSpeed(1); },
  });

  // ---------- challenges
  const until = (cond, then) => { pending = { until: cond, then }; };
  const after = () => { pending = null; demo = null; lanes = mkLanes(); st.setSpeed(1); };
  const allDone = () => lanes.every((L) => L.done || !L.T.fits);
  const times = () => lanes.map((L) => trf('{0}: {1} s', tr(L.label), (L.tBot - L.tTop).toFixed(1))).join(', ') + '.';
  const skip = () => { for (let i = 0; i < 4000 && !allDone(); i++) for (const L of lanes) stepLane(L, 0.05); };
  st.setChallenges([
    {
      id: 'metals', title: 'Which metal brakes best?', card: 'pipe.metal', lock: true, after, skip,
      q: 'Copper, aluminum and stainless steel pipes, none of them magnetic. In which does the magnet fall slowest?', choices: ['Copper', 'Aluminum', 'Stainless steel'], answer: 0,
      run: (s, finish) => { race([{ mag: 'magnet-n42', pipe: 'pipe-cu', label: 'copper' }, { mag: 'magnet-n42', pipe: 'pipe-al', label: 'aluminum' }, { mag: 'magnet-n42', pipe: 'pipe-steel', label: 'stainless' }], 4); until(allDone, () => finish(times())); },
      explain: 'The better the metal conducts, the bigger the eddy currents and the harder they brake. Copper conducts best of the three, stainless steel worst.',
    },
    {
      id: 'slot', title: 'A slot in the pipe', card: 'pipe.slot', lock: true, after, skip,
      q: 'Cut a thin slot all along a copper pipe. Now the magnet falls…', choices: ['even more slowly', 'about the same', 'much faster'], answer: 2,
      run: (s, finish) => { race([{ mag: 'magnet-n42', pipe: 'pipe-cu', label: 'copper' }, { mag: 'magnet-n42', pipe: 'pipe-slot', label: 'slotted copper' }], 4); until(allDone, () => finish(times())); },
      explain: 'Eddy currents need to flow all the way round the pipe. The slot breaks every ring, so only weak little loops are left and the braking nearly vanishes.',
    },
    {
      id: 'cold', title: 'Cold copper', card: 'pipe.cold', lock: true, after, skip,
      q: 'Cool the copper pipe in liquid nitrogen (−196 °C). The magnet falls…', choices: ['faster', 'the same', 'more slowly'], answer: 2,
      run: (s, finish) => { race([{ mag: 'magnet-n42', pipe: 'pipe-cu', label: 'room temperature' }, { mag: 'magnet-n42', pipe: 'pipe-cu', cold: true, label: 'in liquid nitrogen' }], 20); until(allDone, () => finish(times())); },
      explain: 'Cold copper conducts about eight times better, because its atoms jiggle less and get in the electrons’ way less. Eight times the currents, eight times slower.',
    },
  ]);

  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'drop', label: 'Measure', build: tabDrop },
  { id: 'graph', label: 'Speed and braking', build: tabGraph },
];

export default bench;
