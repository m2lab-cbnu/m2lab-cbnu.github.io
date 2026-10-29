// Simulation PC: a micromagnetic simulator on the graphics card (see sim/llg-gl.js), with presets,
// live view, probes, spectra and dispersion maps, and a small mumax3-style script language.

import * as THREE from '../vendor/three.js';
import { el, slider, select, segmented, button, checkbox, group, readout, canvasBox, note, fmtNum } from '../ui/widgets.js';
import { Plot, COLORS, SERIES } from '../ui/plot.js';
import { sampleEditor } from '../ui/sample.js';
import { engine } from '../sim/engine.js';
import { PRESETS, antennaProfile } from '../sim/presets.js';
import { runScript, EXAMPLES } from '../sim/script.js';
import { fft, nextPow2 } from '../physics/fft.js';
import * as disp from '../physics/dispersion.js';
import * as T from '../world/textures.js';
import { lab } from '../state.js';
import { tr, trf } from '../i18n.js';

const VIEWS = [
  { value: 0, label: 'Direction (mumax colors)' }, { value: 1, label: 'm_x' }, { value: 2, label: 'm_y' }, { value: 3, label: 'm_z' },
  { value: 4, label: 'Spin waves (δm_z)' }, { value: 5, label: 'Spin-wave intensity' },
];
const st = {
  preset: 'waveguide', opts: {}, trace: [], tMax: 0, result: null, monitor: null, script: EXAMPLES[0].code,
  arrows: false, core: [], lastAvg: [0, 0, 0], loaded: false,
};
for (const p of PRESETS) st.opts[p.id] = { ...p.options };
const subs = new Set();
const notify = () => { for (const fn of subs) fn(); };

// ------------------------------------------------------------------------------------- analysis helpers
export function spectrum(sig, dt) {
  const n = sig.length, N = nextPow2(n) * 4, re = new Float64Array(N), im = new Float64Array(N);
  let mean = 0; for (const v of sig) mean += v; mean /= n;
  for (let i = 0; i < n; i++) re[i] = (sig[i] - mean) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  fft(re, im);
  const f = [], p = [];
  for (let i = 1; i < N / 2; i++) { f.push(i / (N * dt)); p.push(re[i] * re[i] + im[i] * im[i]); }
  let ip = 0; for (let i = 1; i < p.length; i++) if (p[i] > p[ip]) ip = i;
  let fpk = f[ip];
  if (ip > 0 && ip < p.length - 1) { const a = Math.log(p[ip - 1] + 1e-300), b = Math.log(p[ip] + 1e-300), c = Math.log(p[ip + 1] + 1e-300); const off = 0.5 * (a - c) / (a - 2 * b + c); if (Number.isFinite(off)) fpk = f[ip] + off * (f[1] - f[0]); }
  return { f, p, peak: fpk };
}

function dispersionMap(rec, Nx, dx, comp) {
  const ns = rec.n, re = new Float64Array(Nx * ns), im = new Float64Array(Nx * ns);
  for (let t = 0; t < ns; t++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / (ns - 1)); for (let x = 0; x < Nx; x++) re[t * Nx + x] = rec.data[4 * (t * Nx + x) + comp] * w; }
  const rr = new Float64Array(Nx), ri = new Float64Array(Nx);
  for (let t = 0; t < ns; t++) { for (let x = 0; x < Nx; x++) { rr[x] = re[t * Nx + x]; ri[x] = im[t * Nx + x]; } fft(rr, ri); for (let x = 0; x < Nx; x++) { re[t * Nx + x] = rr[x]; im[t * Nx + x] = ri[x]; } }
  const M = nextPow2(ns), cr = new Float64Array(M), ci = new Float64Array(M);
  const nf = M / 2, out = new Float32Array(Nx * nf);
  for (let x = 0; x < Nx; x++) {
    cr.fill(0); ci.fill(0);
    for (let t = 0; t < ns; t++) { cr[t] = re[t * Nx + x]; ci[t] = im[t * Nx + x]; }
    fft(cr, ci);
    // spatial transform uses e^{-ikx}, temporal e^{-iωt}: waves e^{i(kx-ωt)} land at (k, -ω) → mirror f
    const xs = (x + Nx / 2) % Nx;            // fftshift in k
    for (let j = 1; j < nf; j++) { const a = (M - j) % M; out[j * Nx + xs] = Math.log10(cr[a] * cr[a] + ci[a] * ci[a] + 1e-30); }
  }
  const kmax = Math.PI / dx, fmax = 1 / (2 * rec.dtSample);
  return { data: out, nx: Nx, ny: nf, kmax, fmax };
}

// ------------------------------------------------------------------------------------- 3D
let hw = null;
function build3D(w) {
  const { scene, M, K, spots } = w, d = spots.simDesk;
  const monitor = (x, z, yaw, cw, ch) => {
    const g = new THREE.Group(); g.position.set(x, d.top, z); g.rotation.y = yaw; scene.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.22), M.black); base.position.y = 0.008; g.add(base);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.32, 0.05), M.black); neck.position.set(-0.03, 0.17, 0); g.add(neck);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.37, 0.62), M.black); panel.position.set(0, 0.38, 0); panel.castShadow = true; g.add(panel);
    const c = T.canvas(cw, ch); const mat = w.screenMaterial(c);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.335), mat); scr.position.set(0.0155, 0.385, 0); scr.rotation.y = Math.PI / 2; g.add(scr);
    w.pickable(panel, api);
    return { c, g: c.getContext('2d'), tex: mat.map };
  };
  const main = monitor(0.36, 3.4, 0, 640, 360);
  const code = monitor(0.38, 4.08, -0.35, 640, 360);
  K.boxB(M.blackMatte, 0.52, d.top, 3.45, 0.66, d.top + 0.018, 3.95);       // keyboard
  K.boxB(M.blackMatte, 0.55, d.top, 4.08, 0.62, d.top + 0.02, 4.13);         // mouse
  K.boxB(M.paper, 0.6, d.top, 2.98, 0.8, d.top + 0.01, 3.25);                // notes
  w.proxy(api, 0.08, 0.75, 2.95, 0.85, 1.25, 4.45);
  hw = { main, code, invalidate: w.invalidate, last: 0 };
  paintCode();
  paintMain();
  w.onTick((dt, t) => {
    if (!engine.running || t - hw.last < 0.2) return false;
    hw.last = t; paintMain(); return true;
  });
  engine.on('load', () => { paintMain(); });
  engine.on('relaxed', () => { paintMain(); });
  return { anchor: [0.4, 1.55, 3.7], view: { pos: [2.25, 1.45, 3.72], target: [0.3, 1.05, 3.72] } };
}
function paintCode() {
  if (!hw) return;
  T.paintCodeScreen(hw.code.g, 640, 360, st.script.split('\n').slice(0, 16));
  hw.code.tex.needsUpdate = true; hw.invalidate();
}
function paintMain() {
  if (!hw) return;
  const g = hw.main.g, W = 640, H = 360;
  g.fillStyle = '#0B1D30'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#12304F'; g.fillRect(0, 0, W, 30);
  g.fillStyle = '#A8ECFF'; g.font = '600 17px "Plex", sans-serif'; g.textBaseline = 'middle';
  if (engine.sim && engine.cfg) {
    g.fillText(engine.cfg.name || 'Simulation', 12, 15);
    g.textAlign = 'right'; g.fillText(`t = ${fmtNum(engine.sim.t * 1e9, 4)} ns`, W - 12, 15); g.textAlign = 'left';
    const c = engine.canvas, ar = c.width / c.height, bw = W - 40, bh = Math.min(H - 70, bw / Math.max(ar, 1e-3));
    const dw = Math.min(bw, bh * ar);
    g.imageSmoothingEnabled = false;
    g.drawImage(c, (W - dw) / 2, 40 + (H - 60 - bh) / 2, dw, Math.max(bh, 24));
  } else {
    g.fillText('Micromagnetic simulator', 12, 15);
    g.fillStyle = '#E6F8FF'; g.font = '500 20px "Plex", sans-serif'; g.fillText('Open the Simulation PC to start a simulation.', 30, 180);
  }
  hw.main.tex.needsUpdate = true; hw.invalidate();
}

// ------------------------------------------------------------------------------------- simulate tab
function tabSimulate(pane) {
  if (!engine.available()) {
    pane.append(el('p', { class: 'note', html: trf('The simulator needs WebGL 2 with floating-point render targets, which this browser does not offer ({0}). The other instruments still work.', engine.error ? engine.error.message : '') }));
    return {};
  }
  const presetSel = select({ label: 'Simulation', options: PRESETS.map((p) => ({ value: p.id, label: p.name })), value: st.preset, onChange: (v) => { st.preset = v; buildOptions(); load(); } });
  const blurb = el('p', { class: 'ctl-hint', style: { fontSize: '.8125rem' } });
  const optBox = el('div', { class: 'vp-side' });
  // live controls
  const Bx = slider({ label: 'Field B_x', unit: 'mT', min: -500, max: 500, step: 0.1, value: 0, digits: 4, onInput: () => setField() });
  const By = slider({ label: 'Field B_y', unit: 'mT', min: -500, max: 500, step: 0.1, value: 0, digits: 4, onInput: () => setField() });
  const Bz = slider({ label: 'Field B_z', unit: 'mT', min: -2000, max: 2000, step: 0.5, value: 0, digits: 4, onInput: () => setField() });
  const rfOn = checkbox({ label: 'Microwave drive on', checked: false, onChange: (v) => { if (!engine.sim) return; engine.sim.rf.on = v; if (v) engine.sim.rf.t0 = engine.sim.t; } });
  const rfF = slider({ label: 'Drive frequency', unit: 'GHz', min: 0.05, max: 60, step: 0.001, value: 2, digits: 4, onInput: (v) => { if (engine.sim) engine.sim.rf.f = v * 1e9; } });
  const rfA = slider({ label: 'Drive amplitude', unit: 'mT', min: 0.01, max: 20, log: true, value: 0.5, digits: 3, onInput: (v) => { if (engine.sim) engine.sim.rf.amp = v * 1e-3; } });
  const alpha = slider({ label: 'Damping α', unit: '', min: 1e-5, max: 1, log: true, value: 0.01, digits: 3, onInput: (v) => { if (engine.sim) engine.sim.setMaterial({ alpha: v }); } });
  const viewSel = select({ label: 'Show', options: VIEWS.map((v) => ({ value: String(v.value), label: v.label })), value: '0', onChange: (v) => { engine.view.mode = +v; engine.render(); drawOverlay(); legend(); } });
  const gain = slider({ label: 'Brightness of spin waves', unit: '×', min: 1, max: 5000, log: true, value: 40, digits: 3, onInput: (v) => { engine.view.gain = v; engine.render(); } });
  const arrows = checkbox({ label: 'Arrows', checked: st.arrows, onChange: (v) => { st.arrows = v; drawOverlay(); } });
  // view
  const view = el('div', { class: 'sim-view' });
  const overlay = el('canvas', { class: 'overlay', 'aria-hidden': 'true' });
  const lg = el('div', { class: 'sim-legend' });
  const run = button('Run', () => { engine.toggle(); }, 'go');
  const relax = button('Relax', () => { engine.relax(); }, 'secondary');
  const reset = button('Start again', () => load(), 'quiet');
  const kick = button('Field pulse', () => kickIt(), 'quiet');
  const status = el('span', { class: 'sim-status', 'aria-live': 'polite' });
  const ro = { t: readout('Simulated time'), rate: readout('Speed'), m: readout('Average m'), x: readout(''), y: readout('') };
  const trBox = canvasBox('', '16 / 6', 'Average magnetization against time');
  const trace = new Plot(trBox.canvas, { xlabel: 'Time (ns)', ylabel: '⟨m⟩', tightY: false });
  const resultBox = el('div', { class: 'vp-main' });
  pane.append(
    el('p', { class: 'vp-intro', html: 'A micromagnetic simulator that solves the Landau–Lifshitz–Gilbert equation on your graphics card, with exchange, anisotropy, Zeeman and the full magnetostatic field, the same physics as mumax3 for a single layer of cells. Pick a simulation, press <b>Run</b>, and change things while it runs.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, group('Simulation', presetSel, blurb, optBox), sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'alpha', 'Kp'], title: 'Film on the bench' }),
        group('Field', Bx, By, Bz), group('Microwave drive', rfOn, rfF, rfA), group('Damping', alpha), group('View', viewSel, gain, arrows)),
      el('div', { class: 'vp-main' }, view, lg, el('div', { class: 'sim-bar' }, run, relax, kick, reset, status), el('div', { class: 'ros' }, ...Object.values(ro)), trBox, resultBox)));
  view.append(engine.canvas, overlay);

  function setField() { if (engine.sim) { engine.sim.setField([Bx.get() / 1e3, By.get() / 1e3, Bz.get() / 1e3]); engine.fieldFn = null; } }
  function kickIt() {
    const sim = engine.sim; if (!sim) return;
    if (!engine.cfg.antenna || st.preset === 'vortex' || st.preset === 'filmfmr') {
      const N = sim.g.Nx * sim.g.Ny, a = new Float32Array(N * 4); for (let k = 0; k < a.length; k += 4) { a[k] = 0.8; a[k + 1] = 0.6; }
      sim.setAntennaProfile(a);
    }
    sim.rf = { ...sim.rf, on: true, kind: 'pulse', amp: 4e-3, width: 80e-12, t0: sim.t, fn: null };
    rfOn.set(true);
    if (!engine.running) engine.play();
  }
  function legend() {
    const mode = engine.view.mode;
    const html = mode === 0 ? '<span class="wheel" aria-hidden="true"></span><span>Color shows the in-plane direction, as in mumax3: red along +x, green +y, cyan −x, purple −y; white points up (+z), black down.</span>'
      : mode < 4 ? `<span>Blue −1 · white 0 · red +1 for ${['', 'm_x', 'm_y', 'm_z'][mode]}.</span>`
      : mode === 4 ? '<span>Blue and red: the out-of-plane part of the spin waves, δm_z, against the state at the start.</span>'
      : '<span>Brightness: the size of the spin-wave precession.</span>';
    const t = tr(html);   // translated whole, markup and all
    lg.innerHTML = t;
    if (t !== html) lg.dataset.tr = 'no'; else delete lg.dataset.tr;
    gain.hidden = mode < 4;
  }
  // per-preset option controls
  function buildOptions() {
    const P = PRESETS.find((p) => p.id === st.preset), o = st.opts[st.preset];
    blurb.textContent = P.blurb;
    optBox.replaceChildren();
    kick.hidden = !['vortex', 'filmfmr', 'wall', 'draw'].includes(st.preset);
    if (st.preset === 'waveguide') {
      optBox.append(
        segmented({ label: 'Geometry', options: [{ value: 'DE', label: 'Field across (Damon–Eshbach)' }, { value: 'BV', label: 'Field along (backward volume)' }], value: o.geometry, onChange: (v) => { o.geometry = v; o.f = null; load(); } }),
        slider({ label: 'Bias field', unit: 'mT', min: 1, max: 300, step: 0.5, value: o.B * 1e3, digits: 4, onInput: (v) => { o.B = v / 1e3; } }),
        button('Apply field and restart', () => { o.f = null; load(); }, 'secondary'));
    }
    if (st.preset === 'vortex') {
      optBox.append(
        segmented({ label: 'Core polarity', options: [{ value: 1, label: 'Up' }, { value: -1, label: 'Down' }], value: o.p, onChange: (v) => { o.p = +v; load(); } }),
        segmented({ label: 'Circulation', options: [{ value: 1, label: 'Counter-clockwise' }, { value: -1, label: 'Clockwise' }], value: o.c, onChange: (v) => { o.c = +v; load(); } }),
        button('Kick it and record a spectrum (10 ns)', async () => { await engine.whenIdle(); kickIt(); recordSpectrum(10e-9, 'x'); }, 'secondary'));
    }
    if (st.preset === 'wall') {
      optBox.append(note('Use <b>Field B_x</b> below to push the wall. Try 1 mT, then 5 mT and 10 mT: past the Walker field the wall turns over and moves more slowly on average.'));
    }
    if (st.preset === 'filmfmr') {
      optBox.append(
        slider({ label: 'Field', unit: 'mT', min: 1, max: 2000, step: 1, value: o.B * 1e3, digits: 4, onInput: (v) => { o.B = v / 1e3; } }),
        slider({ label: 'Field angle from the normal', unit: '°', min: 0, max: 90, step: 1, value: o.thetaH, digits: 3, onInput: (v) => { o.thetaH = v; } }),
        button('Measure the spectrum', async () => { if (await load()) recordSpectrum(null, 'auto'); }, 'go'));
    }
    if (st.preset === 'dispersion') {
      optBox.append(
        segmented({ label: 'Geometry', options: [{ value: 'DE', label: 'DE' }, { value: 'BV', label: 'BV' }, { value: 'FV', label: 'FV (field along z)' }], value: o.geometry, onChange: (v) => { o.geometry = v; if (v === 'FV' && o.B < 0.5) o.B = Math.max(0.3, 4e-7 * Math.PI * lab.sample.Ms + 0.1); } }),
        slider({ label: 'Field', unit: 'mT', min: 1, max: 3000, step: 1, value: o.B * 1e3, digits: 4, onInput: (v) => { o.B = v / 1e3; } }),
        button('Run and analyze', async () => { if (await load()) startDispersion(); }, 'go'));
    }
    if (st.preset === 'draw') {
      let tool = 'draw';
      const tools = segmented({ label: 'Mouse', options: [{ value: 'draw', label: 'Draw' }, { value: 'erase', label: 'Erase' }, { value: 'antenna', label: 'Antenna' }], value: tool, onChange: (v) => { tool = v; view.dataset.tool = v; } });
      const size = slider({ label: 'Brush', unit: 'cells', min: 1, max: 24, step: 1, value: 6, digits: 2 });
      optBox.append(tools, size, el('div', { class: 'vp-row' }, button('Clear', () => paint(null, 'clear'), 'quiet'), button('Fill all', () => paint(null, 'fill'), 'quiet')),
        note('Draw the magnet, click <b>Antenna</b> and tap where the antenna should go, then switch on the microwave drive and press Run.'));
      st.drawTool = () => tool; st.drawSize = () => size.get();
    }
  }
  // drawing on the sim view
  let drawing = false;
  overlay.addEventListener('pointerdown', (e) => { if (st.preset !== 'draw') return; drawing = true; try { overlay.setPointerCapture(e.pointerId); } catch (_) {} paint(e); });
  overlay.addEventListener('pointermove', (e) => { if (drawing) paint(e); });
  overlay.addEventListener('pointerup', () => { drawing = false; });
  function paint(e, op) {
    const sim = engine.sim; if (!sim) return;
    const { Nx, Ny, dx } = sim.g, m = sim.readState();
    if (op === 'clear' || op === 'fill') { for (let k = 0; k < m.length; k += 4) { m[k + 3] = op === 'fill' ? 1 : 0; if (op === 'fill') { const b = sim.Bext, n = Math.hypot(...b) || 1; m[k] = b[0] / n || 1; m[k + 1] = b[1] / n; m[k + 2] = b[2] / n; } } sim.setState(m); engine.render(); return; }
    const r = overlay.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = 1 - (e.clientY - r.top) / r.height;
    const ci = Math.floor(u * Nx), cj = Math.floor(v * Ny), tool = st.drawTool ? st.drawTool() : 'draw';
    if (tool === 'antenna') {
      const x0 = (ci + 0.5 - Nx / 2) * dx;
      sim.setAntennaProfile(antennaProfile(Nx, Ny, dx, dx, { x0, w: 3 * dx, s: Math.max(sim.g.dz / 2 + dx / 2, 30e-9) }));
      engine.cfg.antennaX = x0; drawOverlay(); return;
    }
    const R = st.drawSize ? st.drawSize() : 6, b = sim.Bext, n = Math.hypot(...b) || 1, dir = n > 1e-9 ? b.map((q) => q / n) : [1, 0, 0];
    for (let j = Math.max(0, cj - R); j <= Math.min(Ny - 1, cj + R); j++) for (let i = Math.max(0, ci - R); i <= Math.min(Nx - 1, ci + R); i++) {
      if ((i - ci) ** 2 + (j - cj) ** 2 > R * R) continue;
      const k = 4 * (j * Nx + i);
      if (tool === 'draw') { if (!m[k + 3]) { m[k] = dir[0]; m[k + 1] = dir[1]; m[k + 2] = dir[2]; } m[k + 3] = 1; } else m[k + 3] = 0;
    }
    sim.setState(m); engine.render(); engine.emit('frame');
  }

  let seq = 0;
  async function load() {
    const my = ++seq;
    const P = PRESETS.find((p) => p.id === st.preset), cfg = P.build(st.opts[st.preset]);
    st.trace = []; st.core = []; st.result = null; st.resultPlots = []; resultBox.replaceChildren();
    try { if (!(await engine.load(cfg))) return false; }
    catch (err) { status.textContent = 'Could not start: ' + err.message; console.error(err); return false; }
    if (my !== seq) return false;
    const b = cfg.B || [0, 0, 0];
    Bx.set(b[0] * 1e3, false); By.set(b[1] * 1e3, false); Bz.set(b[2] * 1e3, false);
    rfOn.set(!!(cfg.rf && cfg.rf.on)); rfF.set((cfg.rf ? cfg.rf.f || 2e9 : 2e9) / 1e9, false); rfA.set((cfg.rf ? cfg.rf.amp : 1e-3) * 1e3, false);
    alpha.set(cfg.mat.alpha, false);
    viewSel.set(String(engine.view.mode)); gain.set(engine.view.gain, false); legend();
    const { Nx, Ny, dx, dy } = cfg.grid, ar = Nx * dx / (Ny * dy);
    view.style.aspectRatio = `${Math.min(ar, 14)} / 1`;
    ro.x.set('–'); ro.x.hidden = !['waveguide', 'vortex', 'wall'].includes(st.preset); ro.y.hidden = true; st.refRow = null;
    ro.x.querySelector('.ro-label').textContent = st.preset === 'vortex' ? 'Core position (x, y)' : st.preset === 'wall' ? 'Wall position, speed' : '';
    if (cfg.info && cfg.info.f && st.preset === 'waveguide') {
      const p = { ...cfg.mat, d: lab.sample.d, B: st.opts.waveguide.B, inPlane: true, phi: st.opts.waveguide.geometry === 'DE' ? 90 : 0 };
      // wavelength at the drive frequency from the dispersion (bisection on k)
      let lo = 1e3, hi = 2e8, f0 = cfg.rf.f, fk = (k) => disp.curves(p, [k]).f[0];
      const rising = fk(5e6) > fk(1e4);
      for (let i = 0; i < 60; i++) { const mid = Math.sqrt(lo * hi); if ((fk(mid) < f0) === rising) lo = mid; else hi = mid; }
      ro.x.querySelector('.ro-label').textContent = 'Expected wavelength at the drive frequency';
      ro.x.set(`${fmtNum(2 * Math.PI / lo * 1e6, 3)} µm`);
      ro.y.hidden = false; ro.y.querySelector('.ro-label').textContent = 'Expected decay length (amplitude)';
      ro.y.set(`${fmtNum(disp.curves(p, [lo]).Ldec[0] * 1e6, 3)} µm`);
    }
    if (cfg.relaxFirst && (await engine.relax()) < 0) return false;
    if (my !== seq) return false;
    if ((st.preset === 'waveguide' || st.preset === 'dispersion') && engine.sim) st.refRow = engine.sim.readRow(Math.floor(engine.sim.g.Ny / 2), 'ref');
    drawOverlay(); notify();
    paintMain();
    return true;
  }

  // probe trace and readouts each frame
  let frameN = 0;
  const offFrame = engine.on('frame', () => {
    if (pane.hidden && !st.recordingSpectrum) return;
    const sim = engine.sim; if (!sim) return;
    frameN++;
    if (frameN % 2 === 0) {
      const a = sim.average(); st.lastAvg = a;
      st.trace.push([sim.t * 1e9, a[0], a[1], a[2]]); if (st.trace.length > 800) st.trace.shift();
      if (st.preset === 'vortex' && frameN % 4 === 0) trackCore();
      if (st.preset === 'wall') { const L = sim.g.Nx * sim.g.dx; st.wallX = (1 + a[0]) / 2 * L; }
    }
    if (frameN % 3 === 0) refresh();
    if (st.arrows && frameN % 4 === 0) drawOverlay();
  });
  const offStatus = engine.on('status', () => refreshStatus());
  function refreshStatus() {
    run.textContent = engine.running ? 'Pause' : 'Run';
    run.className = 'vbtn ' + (engine.running ? 'vbtn-primary' : 'vbtn-go');
    status.textContent = engine.busy || (engine.running ? 'Running' : engine.sim && engine.cfg ? 'Paused' : '');
  }
  function refresh() {
    const sim = engine.sim; if (!sim || !engine.cfg) return;
    ro.t.set(`${fmtNum(sim.t * 1e9, 4)} ns`);
    ro.rate.set(`${fmtNum(engine.stepRate, 3)} steps/s, ${fmtNum(engine.stepRate * sim.dt * 1e9, 3)} ns/s`);
    const a = st.lastAvg; ro.m.set(`(${a.map((v) => v.toFixed(3)).join(', ')})`);
    if (st.preset === 'wall' && st.trace.length > 10) {
      const L = sim.g.Nx * sim.g.dx, tr = st.trace, i0 = Math.max(0, tr.length - 40), t0 = tr[i0][0], t1 = tr[tr.length - 1][0];
      const v = t1 > t0 ? ((1 + tr[tr.length - 1][1]) - (1 + tr[i0][1])) / 2 * L / ((t1 - t0) * 1e-9) : 0;
      ro.x.querySelector('.ro-label').textContent = 'Wall position, speed';
      ro.x.set(`${fmtNum(st.wallX * 1e9, 4)} nm, ${fmtNum(v, 3)} m/s`);
    }
    const tr = st.trace;
    if ((st.preset === 'waveguide' || st.preset === 'dispersion') && st.refRow) {
      // live profile of the spin waves along the middle of the guide
      const { Nx, Ny, dx } = sim.g, row = sim.readRow(Math.floor(Ny / 2)), xs = [], ys = [];
      for (let i = 0; i < Nx; i++) { xs.push((i + 0.5 - Nx / 2) * dx * 1e6); ys.push(row[4 * i + 2] - st.refRow[4 * i + 2]); }
      const amp = Math.max(1e-6, ...ys.map(Math.abs));
      if (st.preset === 'dispersion' && st.opts.dispersion.geometry === 'FV') for (let i = 0; i < Nx; i++) ys[i] = row[4 * i] - st.refRow[4 * i];
      trace.o.xlabel = st.preset === 'waveguide' ? 'Position along the guide (µm)' : 'Position along the line (µm)'; trace.o.ylabel = st.preset === 'dispersion' && st.opts.dispersion.geometry === 'FV' ? 'δm_x' : 'δm_z';
      trace.ylim = [-amp * 1.1, amp * 1.1];
      trace.setSeries([{ x: xs, y: ys, color: COLORS.signal, width: 2 }]).setVLines(engine.cfg.antennaX !== undefined ? [{ x: engine.cfg.antennaX * 1e6, color: COLORS.gold, width: 4 }] : []).draw();
    } else if (tr.length > 1) {
      trace.o.xlabel = 'Time (ns)'; trace.o.ylabel = '⟨m⟩'; trace.ylim = null;
      trace.setVLines([]).setSeries([0, 1, 2].map((c) => ({ x: tr.map((r) => r[0]), y: tr.map((r) => r[c + 1]), color: SERIES[c], width: 2, label: ['⟨m_x⟩', '⟨m_y⟩', '⟨m_z⟩'][c] }))).draw();
    }
    if (engine.cfg.dispersionRun && sim.recCfg) status.textContent = `Recording ${sim.recCfg.n} of ${sim.recCfg.samples} frames`;
    if (engine.cfg.dispersionRun && !sim.recording && sim.recCfg && sim.recCfg.n >= sim.recCfg.samples && !st.result) finishDispersion();
    if (st.spectrumRun && !sim.recording && sim.recCfg && sim.recCfg.n >= sim.recCfg.samples && st.spectrumRun.pending) finishSpectrum();
  }
  function trackCore() {
    const sim = engine.sim, { Nx, Ny, dx } = sim.g, m = sim.readState();
    let best = -1, bi = 0, bj = 0, p = st.opts.vortex.p;
    for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) { const k = 4 * (j * Nx + i); if (!m[k + 3]) continue; const v = m[k + 2] * p; if (v > best) { best = v; bi = i; bj = j; } }
    st.core.push([bi + 0.5, bj + 0.5]); if (st.core.length > 400) st.core.shift();
    ro.x.querySelector('.ro-label').textContent = 'Core position (x, y)';
    ro.x.set(`${fmtNum((bi + 0.5 - Nx / 2) * dx * 1e9, 3)}, ${fmtNum((bj + 0.5 - Ny / 2) * dx * 1e9, 3)} nm`);
    drawOverlay();
  }
  function drawOverlay() {
    const sim = engine.sim; if (!sim || !sim.g) return;
    const dpr = Math.min(devicePixelRatio || 1, 2), W = overlay.clientWidth, H = overlay.clientHeight;
    if (!W || !H) return;
    if (overlay.width !== Math.round(W * dpr)) { overlay.width = Math.round(W * dpr); overlay.height = Math.round(H * dpr); }
    const g = overlay.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const { Nx, Ny, dx } = sim.g;
    if (engine.cfg && engine.cfg.antennaX !== undefined && Ny > 1) {
      const x = (engine.cfg.antennaX / (Nx * dx) + 0.5) * W;
      g.fillStyle = 'rgba(217,164,65,0.55)'; g.fillRect(x - 3, 0, 6, H);
      g.fillStyle = '#7A5410'; g.font = '600 12px "Plex", sans-serif'; g.fillText('antenna', x + 6, 14);
    }
    if (st.arrows && Ny > 1) {
      let b = 1; while ((W / Nx) * b < 22 && b < 16) b *= 2;
      const cd = sim.readCoarse(b), cw = W / cd.w, ch = H / cd.h;
      for (let j = 0; j < cd.h; j++) for (let i = 0; i < cd.w; i++) {
        const k = 4 * (j * cd.w + i); if (cd.data[k + 3] < 0.5) continue;
        const mx = cd.data[k], my = cd.data[k + 1], L = Math.min(cw, ch) * 0.42 * Math.hypot(mx, my);
        const cx = (i + 0.5) * cw, cy = H - (j + 0.5) * ch, a = Math.atan2(-my, mx);
        g.strokeStyle = '#0E2A4D'; g.fillStyle = '#0E2A4D'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(cx - L * Math.cos(a), cy - L * Math.sin(a)); g.lineTo(cx + L * Math.cos(a), cy + L * Math.sin(a)); g.stroke();
        g.beginPath(); g.moveTo(cx + L * Math.cos(a), cy + L * Math.sin(a)); g.lineTo(cx + L * Math.cos(a) - 5 * Math.cos(a - 0.5), cy + L * Math.sin(a) - 5 * Math.sin(a - 0.5)); g.lineTo(cx + L * Math.cos(a) - 5 * Math.cos(a + 0.5), cy + L * Math.sin(a) - 5 * Math.sin(a + 0.5)); g.fill();
      }
    }
    if (st.preset === 'vortex' && st.core.length > 1) {
      g.strokeStyle = 'rgba(14,42,77,0.8)'; g.lineWidth = 1.5; g.beginPath();
      st.core.forEach(([i, j], q) => { const x = i / Nx * W, y = H - j / Ny * H; q ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    }
  }

  // spectra from the average magnetization
  async function recordSpectrum(duration, comp) {
    await engine.whenIdle();
    const sim = engine.sim; if (!sim) return;
    let fGuess = engine.cfg.info && engine.cfg.info.fTheory ? engine.cfg.info.fTheory : 3e9;
    const fNyq = Math.max(3 * fGuess, 2e9), dtS = 1 / (2 * fNyq);
    const every = Math.max(1, Math.floor(dtS / sim.dt));
    const samples = duration ? Math.min(4096, Math.ceil(duration / (every * sim.dt))) : 1024;
    sim.startRecording({ kind: 'avg', every, samples });
    st.spectrumRun = { comp, pending: true };
    status.textContent = 'Recording…';
    if (!engine.running) engine.play();
  }
  function finishSpectrum() {
    const sim = engine.sim, rec = sim.readRecording(), run = st.spectrumRun; run.pending = false;
    engine.pause();
    const comps = [0, 1, 2].map((c) => Array.from({ length: rec.n }, (_, i) => rec.data[4 * i + c]));
    let c = run.comp === 'x' ? 0 : 0, best = -1;
    if (run.comp === 'auto') comps.forEach((s, i) => { const v = Math.max(...s) - Math.min(...s); if (v > best) { best = v; c = i; } });
    const S = spectrum(comps[c], rec.dtSample);
    resultBox.replaceChildren();
    const box = canvasBox('', '16 / 7', 'Spectrum of the average magnetization');
    const pl = new Plot(box.canvas, { xlabel: 'Frequency (GHz)', ylabel: 'Power (arb. units)' });
    const fT = engine.cfg.info && engine.cfg.info.fTheory;
    const ymax = Math.max(...S.p);
    pl.xlim = [0, Math.min(S.f[S.f.length - 1], (fT || S.peak) * 2.5) / 1e9];
    pl.setSeries([{ x: S.f.map((f) => f / 1e9), y: S.p.map((p) => p / ymax), color: COLORS.cyan, width: 2.5, label: 'simulation' }]);
    if (fT) pl.setVLines([{ x: fT / 1e9, color: COLORS.pink, dash: [6, 4], width: 2 }]);
    const r1 = readout('Peak in the simulation'), r2 = readout(fT ? 'Kittel / Smit–Beljers' : 'Period');
    r1.set(`${fmtNum(S.peak / 1e9, 5)} GHz`);
    r2.set(fT ? `${fmtNum(fT / 1e9, 5)} GHz` : `${fmtNum(1e9 / S.peak, 4)} ns`);
    resultBox.append(el('h3', { class: 'ctl-label', text: 'Result' }), box, el('div', { class: 'ros' }, r1, r2),
      note(fT ? 'The pink line is the macrospin formula for the same film and field. The simulation includes the full magnetostatic field of a periodic film, so the two should agree closely.' : 'The peak is the gyrotropic frequency of the vortex core. Bigger or thinner disks turn more slowly.'));
    st.resultPlots = [pl];
    requestAnimationFrame(() => pl.draw());
    status.textContent = 'Done';
  }
  // dispersion map
  function startDispersion() {
    const sim = engine.sim, cfg = engine.cfg, fTop = cfg.dispersion.fTop;
    const every = Math.max(1, Math.floor(1 / (2.2 * fTop) / sim.dt));
    sim.startRecording({ kind: 'row', row: 0, every, samples: 512 });
    cfg.dispersionRun = true; st.result = null;
    engine.play();
  }
  function finishDispersion() {
    engine.pause();
    const sim = engine.sim, cfg = engine.cfg, rec = sim.readRecording();
    const comp = st.opts.dispersion.geometry === 'FV' ? 0 : 2;
    const D = dispersionMap(rec, sim.g.Nx, sim.g.dx, comp);
    st.result = D;
    resultBox.replaceChildren();
    const box = canvasBox('', '16 / 10', 'Dispersion from the simulation');
    const pl = new Plot(box.canvas, { xlabel: 'Wavenumber k (rad/µm)', ylabel: 'Frequency (GHz)', colorbar: { label: 'log power', ticks: false } });
    const kshow = Math.min(D.kmax, cfg.dispersion.kShow || 0.6 / sim.g.dx) / 1e6;
    // limits: show up to the excited band
    const fshow = Math.min(D.fmax, cfg.dispersion.fTop * 0.96) / 1e9;
    const sorted = Array.from(D.data).filter(Number.isFinite).sort((a, b) => a - b);
    pl.setHeatmap({ data: D.data, nx: D.nx, ny: D.ny, x0: -D.kmax / 1e6, x1: D.kmax / 1e6, y0: 0, y1: D.fmax / 1e9, colormap: 'heat', vmin: sorted[Math.floor(sorted.length * 0.5)], vmax: sorted[sorted.length - 1], smooth: false });
    pl.xlim = [-kshow, kshow]; pl.ylim = [0, fshow];
    const ks = disp.linspace(-kshow * 1e6, kshow * 1e6, 400), c = disp.curves(cfg.dispersion.p, ks);
    pl.setSeries([{ x: Array.from(ks, (k) => k / 1e6), y: Array.from(c.f, (f) => f / 1e9), color: '#00D4FF', width: 1.6, dash: [6, 5], label: 'Kalinikos–Slavin, n = 0' }]);
    resultBox.append(el('h3', { class: 'ctl-label', text: 'Result' }), box,
      note('Bright bands are where the simulated film has spin waves; the dashed line is the analytic theory for the same film. They should agree to a few percent. The simulation is cut off where the cells become too coarse for shorter waves.'));
    st.resultPlots = [pl];
    requestAnimationFrame(() => pl.draw());
    status.textContent = 'Done';
    cfg.dispersionRun = false;
  }

  buildOptions(); legend(); refreshStatus();
  let first = true;
  return {
    show() {
      if (!view.contains(engine.canvas)) view.prepend(engine.canvas);
      if (first || !engine.cfg) { first = false; load().then((ok) => { if (ok && st.preset === 'waveguide') engine.play(); }); }
      else if (st.resumeOnShow) { st.resumeOnShow = false; engine.play(); }
      drawOverlay(); refresh();
    },
    hide() {
      // leaving the PC: pause so the room stays smooth, unless a measurement is being recorded
      const busyRecording = engine.sim && (engine.sim.recording || engine.sim.blsOn);
      if (engine.running && !busyRecording) { st.resumeOnShow = true; engine.pause(); }
    },
    resize() { drawOverlay(); trace.draw(); (st.resultPlots || []).forEach((p) => p.draw()); },
  };
}

// ------------------------------------------------------------------------------------- script tab
function tabScript(pane) {
  if (!engine.available()) { pane.append(el('p', { class: 'note', text: 'The simulator needs WebGL 2, which this browser does not offer.' })); return {}; }
  const ex = select({ label: 'Example', options: EXAMPLES.map((e, i) => ({ value: String(i), label: e.name })), value: '0', onChange: (v) => { ta.value = EXAMPLES[+v].code; st.script = ta.value; paintCode(); } });
  const ta = el('textarea', { class: 'script', spellcheck: 'false', 'aria-label': 'Simulation script' });
  ta.value = st.script;
  ta.addEventListener('input', () => { st.script = ta.value; });
  ta.addEventListener('change', () => paintCode());
  const log = el('div', { class: 'log', role: 'log', 'aria-live': 'polite' });
  const view = el('div', { class: 'sim-view' });
  const tb = canvasBox('', '16 / 6', 'Table of the average magnetization');
  const table = new Plot(tb.canvas, { xlabel: 'Time (ns)', ylabel: '⟨m⟩', tightY: false });
  let runner = null;
  const runBtn = button('Run script', async () => {
    if (runner) { runner.stop(); return; }
    log.replaceChildren();
    const rows = [];
    view.prepend(engine.canvas);
    runBtn.textContent = 'Stop'; runBtn.className = 'vbtn vbtn-primary';
    runner = runScript(ta.value, {
      engine,
      print: (s, err) => { const p = el('div', { class: err ? 'err' : '', text: s }); log.append(p); log.scrollTop = log.scrollHeight; },
      onLoad: (cfg) => { const { Nx, Ny, dx, dy } = cfg.grid; view.style.aspectRatio = `${Math.min(Nx * dx / (Ny * dy), 14)} / 1`; },
      onRow: (r) => { rows.push(r); if (rows.length % 3 === 0 || rows.length < 3) table.setSeries([0, 1, 2].map((c) => ({ x: rows.map((q) => q[0] * 1e9), y: rows.map((q) => q[c + 1]), color: SERIES[c], width: 2, label: ['⟨m_x⟩', '⟨m_y⟩', '⟨m_z⟩'][c] }))).draw(); },
    });
    try { await runner.done; } catch (e) { log.append(el('div', { class: 'err', text: String(e.message || e) })); }
    runner = null; runBtn.textContent = 'Run script'; runBtn.className = 'vbtn vbtn-go';
    paintMain();
  }, 'go');
  pane.append(
    el('p', { class: 'vp-intro', html: 'Write a simulation the way you would for mumax3. The script runs line by line: set up the grid and the material, draw the geometry, set the magnetization, then <b>Run</b> or <b>Relax</b>. The commands that work here are listed under the editor.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, ex, ta, el('div', { class: 'vp-row' }, runBtn), log),
      el('div', { class: 'vp-main' }, view, tb,
        el('details', { class: 'sample-more' }, el('summary', { text: 'Commands you can use' }),
          el('div', { class: 'note', html: `<b>Grid</b>: SetGridSize(Nx, Ny, 1) with powers of two, SetCellSize(dx, dy, dz), SetPBC(px, py, 0).<br>
<b>Material</b>: Msat, Aex, alpha, GammaLL (rad/s/T), Ku1 with AnisU = vector(...) (in-plane axis, or z for perpendicular), Kp.<br>
<b>Field</b>: B_ext = vector(bx, by, bz). Expressions may use t, pi, sin, cos, exp, sqrt, sinc, so B_ext = vector(0, 0.02, 0.001*sin(2*pi*3e9*t)) drives the film.<br>
<b>Antenna</b> (an extra here): Antenna(x0, width) puts a strip line across the sample; B_ant = 1e-3*sin(2*pi*f*t) drives it.<br>
<b>Geometry</b>: SetGeom(shape) with Rect(w, h), Square(a), Circle(d), Ellipse(a, b), Universe(), and shape.Add / Sub / Intersect / Transl(x, y, z) / RotZ(θ) / Inverse().<br>
<b>Magnetization</b>: m = Uniform(x, y, z), Vortex(c, p), TwoDomain(...), RandomMag().<br>
<b>Running</b>: Run(t), Relax(), Minimize(), TableAutoSave(dt), Print(...). Variables: f := 3e9.` })))));
  return { show() { if (!view.contains(engine.canvas)) view.prepend(engine.canvas); }, resize() { table.draw(); } };
}

const api = {
  id: 'micromag', title: 'Simulation PC', kicker: 'Micromagnetics on your graphics card', icon: 'PC',
  blurb: 'Spin waves, vortices, domain walls, FMR and dispersion, simulated live, plus mumax-style scripts.',
  build3D,
  tabs: [
    { id: 'simulate', label: 'Simulate', build: tabSimulate },
    { id: 'script', label: 'Script', build: tabScript },
  ],
};
export default api;
