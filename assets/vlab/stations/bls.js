// BLS setup: Brillouin light scattering. Thermal spectra (wavevector-resolved and micro-focused),
// micro-BLS maps of simulated spin waves, parametric pumping and magnon condensation, and the
// squeezed vacuum of a magnon mode.

import * as THREE from '../vendor/three.js';
import { el, slider, select, segmented, button, checkbox, group, readout, canvasBox, note, fmtNum } from '../ui/widgets.js';
import { Plot, screenPlot, COLORS, SERIES, colormap } from '../ui/plot.js';
import { sampleEditor } from '../ui/sample.js';
import * as bls from '../physics/bls.js';
import * as disp from '../physics/dispersion.js';
import { MU0, material } from '../physics/materials.js';
import { engine } from '../sim/engine.js';
import { PRESETS } from '../sim/presets.js';
import { lab } from '../state.js';
import * as T from '../world/textures.js';

const S = { B: 0.1, geom: 'DE', micro: false, theta: 45, lambda: 532e-9, NA: 0.75, T: 300, metal: null, modes: 1, res: 0.2e9,
  fp: 14e9, pump: 3, Tq: 0.01, kq: 0, mapF: null, spot: 300e-9 };
// metallic films are opaque (light sees the top ~15 nm); garnets are transparent
const isMetal = () => (S.metal === null ? lab.sample.key !== 'yig' : S.metal);
lab.onSample(() => { S.metal = null; });
const subs = new Set();
const changed = () => { for (const fn of subs) fn(); };
lab.onSample(() => changed());
let hw = null, lastSpec = null;

const params = (over = {}) => ({ Ms: lab.sample.Ms, A: lab.sample.A, gamma: lab.sample.gamma, alpha: lab.sample.alpha, d: lab.sample.d, Kp: lab.sample.Kp || 0, D: lab.sample.D || 0,
  B: S.B, inPlane: S.geom !== 'FV', phi: S.geom === 'BV' ? 0 : 90, ...over });

// ------------------------------------------------------------------------------------- 3D
function build3D(w) {
  const { scene, M, K, spots } = w, t = spots.tableB, top = t.top;
  // tandem Fabry–Pérot interferometer
  K.boxB(M.blackMatte, 7.72, top, 8.55, 8.28, top + 0.32, 9.25);
  const tfp = T.canvas(512, 256), g = tfp.getContext('2d');
  g.fillStyle = '#1D2329'; g.fillRect(0, 0, 512, 256); g.fillStyle = 'rgba(230,240,250,0.85)'; g.font = '600 34px "Plex", sans-serif'; g.fillText('TANDEM FABRY–PÉROT', 24, 70);
  g.font = '500 24px "Plex", sans-serif'; g.fillText('interferometer', 24, 110); g.fillStyle = '#3CFF9A'; g.fillRect(24, 170, 14, 14); g.fillStyle = '#FF3B2F'; g.fillRect(50, 170, 14, 14);
  const tfpMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.31), w.faceMaterial(tfp)); tfpMesh.rotation.y = -Math.PI / 2; tfpMesh.position.set(7.715, top + 0.16, 8.9); scene.add(tfpMesh);
  // laser
  K.boxB(M.whitePlastic, 8.42, top, 10.35, 8.58, top + 0.11, 10.75);
  K.cylP(M.black, [8.5, top + 0.06, 10.35], [8.5, top + 0.06, 10.31], 0.02);
  // microscope column with objective, sample stage and a small magnet
  K.boxB(M.aluminium, 8.5, top, 9.62, 8.56, top + 0.62, 9.68);
  K.boxB(M.aluminium, 8.22, top + 0.42, 9.62, 8.56, top + 0.46, 9.68);
  K.cylY(M.black, 8.3, 9.65, 0.032, top + 0.2, top + 0.42);
  K.cylY(M.steel, 8.3, 9.65, 0.018, top + 0.14, top + 0.2);
  K.boxB(M.black, 8.24, top + 0.46, 9.6, 8.36, top + 0.56, 9.7);                 // camera
  K.boxB(M.blackMatte, 8.18, top, 9.55, 8.42, top + 0.08, 9.75);                   // xyz stage
  K.boxB(M.aluminium, 8.22, top + 0.08, 9.6, 8.38, top + 0.1, 9.7);
  const coilMat = new THREE.MeshStandardMaterial({ color: 0xC0733F, roughness: 0.33, metalness: 0.9 });
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 24), coilMat); c.rotation.x = Math.PI / 2; c.position.set(8.3, top + 0.12, 9.65 + s * 0.09); scene.add(c); }
  // mirrors and the green beam: laser → two mirrors → objective; return beam to the interferometer
  const mirror = (x, z) => { K.cylY(M.black, x, z, 0.012, top, top + 0.06, 'cyl8'); K.box(M.steel, x, top + 0.075, z, 0.04, 0.04, 0.012, Math.PI / 4); };
  mirror(8.5, 10.1); mirror(8.3, 10.1); mirror(8.0, 9.65);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x3DFF6E, transparent: true, opacity: 0.85, toneMapped: false });
  const beam = (a, b) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, L, 6), beamMat);
    m.position.copy(A).add(Bv).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); scene.add(m);
  };
  const yb = top + 0.075;
  beam([8.5, yb, 10.31], [8.5, yb, 10.1]); beam([8.5, yb, 10.1], [8.3, yb, 10.1]); beam([8.3, yb, 10.1], [8.3, yb, 9.72]);
  beam([8.3, top + 0.42, 9.65], [8.3, top + 0.1, 9.65]);
  beam([8.3, yb, 9.65], [8.0, yb, 9.65]); beam([8.0, yb, 9.65], [8.0, yb, 9.25]);
  // controller with a live spectrum
  K.boxB(M.black, 7.62, top, 7.78, 7.98, top + 0.26, 10.42);
  const scr = T.canvas(512, 256), sm = w.screenMaterial(scr);
  const sMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), sm); sMesh.rotation.y = -Math.PI / 2; sMesh.position.set(7.618, top + 0.15, 10.1); scene.add(sMesh);
  w.proxy(api, 7.55, top, 8.5, 8.75, top + 0.7, 10.8);
  hw = { scr, g: scr.getContext('2d'), tex: sm.map, invalidate: w.invalidate };
  subs.add(paintScreen); paintScreen();
  return { anchor: [8.15, 1.62, 9.6], view: { pos: [6.55, 1.62, 10.75], target: [8.15, 0.95, 9.6] } };
}
let scrPending = false;
function paintScreen() {
  if (!hw || scrPending) return; scrPending = true;
  requestAnimationFrame(() => {
    scrPending = false;
    const r = lastSpec || spectrumNow();
    screenPlot(hw.g, 512, 256, { series: [{ x: Array.from(r.f, (f) => f / 1e9), y: Array.from(r.I), color: '#7CFFB2', width: 2 }], xlabel: 'Frequency shift (GHz)', ylabel: 'Counts', pad: { l: 50, r: 10, t: 12, b: 42 } });
    hw.tex.needsUpdate = true; hw.invalidate();
  });
}
function spectrumNow() {
  const p = params();
  const fmax = Math.min(60e9, Math.max(8e9, 1.6 * Math.abs(disp.curves(p, [4 * Math.PI / S.lambda * Math.max(0.2, Math.sin(S.theta * Math.PI / 180))]).f[0] || 10e9)));
  lastSpec = bls.thermalSpectrum(p, { lambda: S.lambda, theta: S.theta, T: S.T, delta: isMetal() ? 15e-9 : Infinity, res: S.res, fmax: S.micro ? Math.max(fmax, 25e9) : fmax, modes: S.modes, micro: S.micro, NA: S.NA });
  return lastSpec;
}

// ------------------------------------------------------------------------------------- spectrum tab
function geomCtl() {
  const geo = segmented({ label: 'Geometry', options: [{ value: 'DE', label: 'k ⟂ M (DE)' }, { value: 'BV', label: 'k ∥ M (BV)' }, { value: 'FV', label: 'M along normal' }], value: S.geom,
    onChange: (v) => { S.geom = v; if (v === 'FV') { const need = MU0 * lab.sample.Ms - 2 * (lab.sample.Kp || 0) / lab.sample.Ms; if (S.B < need + 0.05) S.B = need + 0.1; } changed(); } });
  const B = slider({ label: 'Applied field', unit: 'mT', min: 1, max: 3000, step: 0.5, value: S.B * 1e3, digits: 5, onInput: (v) => { S.B = v / 1e3; changed(); } });
  subs.add(() => { geo.set(S.geom); B.set(S.B * 1e3, false); });
  return { geo, B };
}
function tabSpectrum(pane) {
  const g = geomCtl();
  const mode = segmented({ label: 'Measurement', options: [{ value: 'k', label: 'Wavevector-resolved' }, { value: 'micro', label: 'Micro-focused' }], value: S.micro ? 'micro' : 'k', onChange: (v) => { S.micro = v === 'micro'; th.hidden = S.micro; na.hidden = !S.micro; changed(); } });
  const th = slider({ label: 'Angle of incidence', unit: '°', min: 0, max: 75, step: 0.5, value: S.theta, digits: 3, onInput: (v) => { S.theta = v; changed(); } });
  const na = slider({ label: 'Numerical aperture of the objective', unit: '', min: 0.1, max: 0.95, step: 0.01, value: S.NA, digits: 3, onInput: (v) => { S.NA = v; changed(); } });
  th.hidden = S.micro; na.hidden = !S.micro;
  const lam = select({ label: 'Laser', options: [{ value: '532', label: '532 nm (green)' }, { value: '473', label: '473 nm (blue)' }, { value: '660', label: '660 nm (red)' }], value: String(Math.round(S.lambda * 1e9)), onChange: (v) => { S.lambda = +v * 1e-9; changed(); } });
  const temp = slider({ label: 'Temperature', unit: 'K', min: 1, max: 600, log: true, value: S.T, digits: 3, onInput: (v) => { S.T = v; changed(); } });
  const metal = checkbox({ label: 'Opaque metallic film (light sees only the top 15 nm)', checked: isMetal(), onChange: (v) => { S.metal = v; changed(); } });
  subs.add(() => metal.set(isMetal()));
  const modes = slider({ label: 'Thickness modes shown', unit: '', min: 0, max: 3, step: 1, value: S.modes, digits: 1, onInput: (v) => { S.modes = Math.round(v); changed(); } });
  const res = slider({ label: 'Instrument resolution', unit: 'GHz', min: 0.02, max: 1, step: 0.01, value: S.res / 1e9, digits: 3, onInput: (v) => { S.res = v * 1e9; changed(); } });
  const box = canvasBox('', '16 / 9', 'BLS spectrum');
  const plot = new Plot(box.canvas, { xlabel: 'Frequency shift (GHz)', ylabel: 'Counts (normalized)', hover: true });
  const ro = { q: readout('Wavevector transferred'), s: readout('Stokes peak'), a: readout('Anti-Stokes peak'), df: readout('Frequency difference'), r: readout('Intensity ratio Stokes / anti-Stokes'), D: readout('DMI you would infer') };
  const quick = el('div', { class: 'vp-row' },
    button('Thin CoFeB/Pt with DMI', () => { lab.setSample({ ...material('cofeb'), d: 1.5e-9, D: 1.2e-3, edited: true }); S.geom = 'DE'; S.B = 0.3; changed(); }, 'quiet'),
    button('Thick YIG', () => { lab.setSample({ ...material('yig'), d: 5e-6, D: 0, edited: true }); S.geom = 'DE'; S.B = 0.1; changed(); }, 'quiet'));
  pane.append(
    el('p', { class: 'vp-intro', html: 'Laser light scatters off thermal magnons and comes back shifted by their frequency: down for magnon creation (Stokes), up for annihilation (anti-Stokes). A tandem Fabry–Pérot interferometer measures the shift. The angle of incidence fixes the magnon wavevector; a microscope objective collects a whole range of wavevectors instead.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'alpha', 'Kp', 'D'] }), group('Field', g.geo, g.B), group('Optics', mode, th, na, lam, metal), group('Conditions', temp, modes, res), group('Try', quick)),
      el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ...Object.values(ro)),
        note('The shaded band at zero is the elastic line, which a shutter blocks in a real measurement. With interfacial DMI the Stokes and anti-Stokes peaks sit at different frequencies; that difference is how BLS measures D.'))));
  function draw() {
    const r = spectrumNow();
    const fs = Array.from(r.f, (f) => f / 1e9);
    plot.setSeries([{ x: fs, y: Array.from(r.I), color: COLORS.signal, width: 2.2 }]);
    const hw0 = 0.35;
    plot.setVLines([{ x: -hw0, color: 'rgba(0,169,214,0.25)', width: 2 }, { x: hw0, color: 'rgba(0,169,214,0.25)', width: 2 }]);
    plot.setTexts([{ x: 0, y: 1.02, text: 'elastic', align: 'center', color: COLORS.signal }]);
    plot.draw();
    // shade the elastic region
    const ctx = plot.ctx, [x0] = plot.toPx(-hw0, 0), [x1] = plot.toPx(hw0, 0), p = plot.pad();
    ctx.fillStyle = 'rgba(0,212,255,0.14)'; ctx.fillRect(x0, p.t, x1 - x0, plot.H - p.t - p.b);
    const q = S.micro ? 4 * Math.PI / S.lambda * S.NA : 4 * Math.PI / S.lambda * Math.sin(S.theta * Math.PI / 180);
    ro.q.set(S.micro ? `up to ${fmtNum(q / 1e6, 4)} rad/µm` : `${fmtNum(q / 1e6, 4)} rad/µm`);
    ro.s.set(Number.isFinite(r.stokes) && !S.micro ? `−${fmtNum(r.stokes / 1e9, 5)} GHz` : '–');
    ro.a.set(Number.isFinite(r.anti) && !S.micro ? `+${fmtNum(r.anti / 1e9, 5)} GHz` : '–');
    const df = r.stokes - r.anti;
    ro.df.set(!S.micro && Number.isFinite(df) ? `${fmtNum(df / 1e6, 4)} MHz` : '–');
    ro.r.set(!S.micro && Number.isFinite(r.ratio) ? fmtNum(r.ratio, 3) : '–');
    // Δf = 2γ D q / (π Ms)  ->  D = π Ms Δf / (2 γ q)
    ro.D.set(!S.micro && S.geom === 'DE' && Number.isFinite(df) ? `${fmtNum(Math.PI * lab.sample.Ms * df / (2 * lab.sample.gamma * q) * 1e3, 3)} mJ/m²` : '–');
    paintScreen();
  }
  subs.add(() => { if (!pane.hidden) draw(); });
  return { show: draw, resize: draw };
}

// ------------------------------------------------------------------------------------- map tab
function tabMap(pane) {
  if (!engine.available()) { pane.append(el('p', { class: 'note', text: 'The spatial map uses the micromagnetic simulator, which needs WebGL 2. This browser does not offer it.' })); return {}; }
  const o = { geometry: 'DE', B: 0.02, f: null, amp: 0.5e-3 };
  const geo = segmented({ label: 'Geometry', options: [{ value: 'DE', label: 'Field across (DE)' }, { value: 'BV', label: 'Field along (BV)' }], value: o.geometry, onChange: (v) => { o.geometry = v; } });
  const Bs = slider({ label: 'Bias field', unit: 'mT', min: 1, max: 300, step: 0.5, value: o.B * 1e3, digits: 4, onInput: (v) => { o.B = v / 1e3; } });
  const fq = slider({ label: 'Microwave frequency (0 = automatic)', unit: 'GHz', min: 0, max: 40, step: 0.01, value: 0, digits: 4, onInput: (v) => { o.f = v > 0 ? v * 1e9 : null; } });
  const spot = slider({ label: 'Laser spot size (FWHM)', unit: 'nm', min: 50, max: 2000, step: 10, value: S.spot * 1e9, digits: 4, onInput: (v) => { S.spot = v * 1e-9; if (lastMap) showMap(lastMap, false); } });
  const logc = checkbox({ label: 'Logarithmic color scale', checked: true, onChange: () => { if (lastMap) showMap(lastMap, false); } });
  const go = button('Run the scan', () => scan(), 'go');
  const status = el('span', { class: 'sim-status', 'aria-live': 'polite' });
  const live = el('div', { class: 'sim-view' });
  const box = canvasBox('', '16 / 5', 'Micro-BLS intensity map');
  const plot = new Plot(box.canvas, { xlabel: 'x (µm)', ylabel: 'y (µm)', colorbar: { label: 'BLS intensity', ticks: false } });
  const box2 = canvasBox('', '16 / 6', 'Intensity along the waveguide');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Distance from the antenna (µm)', ylabel: 'ln(intensity)' });
  const ro = { f: readout('Microwave frequency'), L: readout('Decay length from the map (fit)'), Lt: readout('Decay length from theory'), k: readout('Wavenumber from theory') };
  const tip = note('These waves live longer than the guide is long, so instead of a decay the map shows <b>width modes beating</b>: the antenna drives several standing waves across the guide, with slightly different wavelengths along it. Pick permalloy for the film to see the waves fade.');
  tip.hidden = true;
  pane.append(
    el('p', { class: 'vp-intro', html: 'Micro-focused BLS scans a laser spot over a sample and records the local spin-wave intensity. Here it scans the waveguide from the Simulation PC: an antenna drives spin waves at one frequency, the intensity map shows where they go, and the profile along the guide gives their decay length.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'alpha'] }), group('Waveguide', geo, Bs, fq), group('Scan', spot, logc, el('div', { class: 'vp-row' }, go, status))),
      el('div', { class: 'vp-main' }, live, box, box2, el('div', { class: 'ros' }, ...Object.values(ro)), tip)));
  let lastMap = null, busy = false;
  async function scan() {
    if (busy) return; busy = true; go.disabled = true;
    const P = PRESETS.find((p) => p.id === 'waveguide'), cfg = P.build({ ...o, amp: o.amp, antenna: 'strip' });
    live.replaceChildren(engine.canvas); live.style.aspectRatio = `${cfg.grid.Nx * cfg.grid.dx / (cfg.grid.Ny * cfg.grid.dy)} / 1`;
    status.textContent = 'Starting the simulation…';
    try { if (!(await engine.load(cfg))) { busy = false; go.disabled = false; return; } } catch (e) { status.textContent = e.message; busy = false; go.disabled = false; return; }
    if (cfg.relaxFirst && (await engine.relax()) < 0) { busy = false; go.disabled = false; status.textContent = 'Stopped: the simulator was given another job.'; return; }
    const sim = engine.sim, p = { ...cfg.mat, d: lab.sample.d, B: o.B, inPlane: true, phi: o.geometry === 'DE' ? 90 : 0 };
    // time to fill the guide: length / group velocity at the driven k, but at least 5 ns
    const kT = findK(p, cfg.rf.f), c = disp.curves(p, [kT]);
    const L = sim.g.Nx * sim.g.dx, tFill = Math.min(80e-9, Math.max(5e-9, 0.75 * L / Math.max(100, Math.abs(c.vg[0])) + 1e-9));
    ro.f.set(`${fmtNum(cfg.rf.f / 1e9, 4)} GHz`); ro.k.set(`${fmtNum(kT / 1e6, 4)} rad/µm (λ = ${fmtNum(2 * Math.PI / kT * 1e6, 3)} µm)`);
    ro.Lt.set(`${fmtNum(c.Ldec[0] * 1e6, 4)} µm`);
    const tAvg = Math.max(8 / cfg.rf.f, 1.5e-9);   // a few periods are enough to average |δm|²
    try {
      await runUntil(tFill, (t) => { status.textContent = `Driving the antenna: ${fmtNum(t * 1e9, 3)} of ${fmtNum(tFill * 1e9, 3)} ns`; });
      sim.blsReset(); sim.blsOn = true;
      await runUntil(tFill + tAvg, (t) => { status.textContent = `Collecting light: ${fmtNum((t - tFill) * 1e9, 3)} of ${fmtNum(tAvg * 1e9, 3)} ns`; });
    } catch (e) { sim.blsOn = false; status.textContent = 'Stopped: ' + e.message; busy = false; go.disabled = false; return; }
    sim.blsOn = false; engine.pause();
    const raw = sim.readBLS();
    lastMap = { raw, Nx: sim.g.Nx, Ny: sim.g.Ny, dx: sim.g.dx, x0: cfg.antennaX, edges: 26 };
    status.textContent = 'Scanning…';
    await showMap(lastMap, true);
    status.textContent = 'Done';
    busy = false; go.disabled = false;
  }
  function runUntil(t1, onProgress) {
    return new Promise((resolve, reject) => {
      const cfg = engine.cfg; cfg.stopAt = t1;
      let off, off2, off3;
      const fin = (ok) => { off(); off2(); off3(); cfg.stopAt = null; ok ? resolve() : reject(new Error('The simulator was given another job.')); };
      off = engine.on('frame', () => onProgress(engine.sim.t));
      off2 = engine.on('done', () => fin(true));
      off3 = engine.on('load', () => fin(false));
      engine.play();
    });
  }
  async function showMap(m, animate) {
    const { Nx, Ny, dx } = m, sig = S.spot / 2.355 / dx;
    // Gaussian blur with the laser spot (separable)
    const I = new Float32Array(Nx * Ny); for (let i = 0; i < Nx * Ny; i++) I[i] = m.raw[4 * i] / Math.max(1, m.raw[4 * i + 2]);
    const R = Math.max(1, Math.ceil(3 * sig)), ker = []; let ks = 0;
    for (let i = -R; i <= R; i++) { const v = Math.exp(-i * i / (2 * sig * sig)); ker.push(v); ks += v; }
    const tmp = new Float32Array(Nx * Ny), out = new Float32Array(Nx * Ny);
    for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) { let s = 0; for (let q = -R; q <= R; q++) { const ii = Math.min(Nx - 1, Math.max(0, i + q)); s += I[j * Nx + ii] * ker[q + R]; } tmp[j * Nx + i] = s / ks; }
    for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) { let s = 0; for (let q = -R; q <= R; q++) { const jj = Math.min(Ny - 1, Math.max(0, j + q)); s += tmp[jj * Nx + i] * ker[q + R]; } out[j * Nx + i] = s / ks; }
    // exclude the absorbing frames from the colour range
    let mx = 0; for (let j = 0; j < Ny; j++) for (let i = m.edges; i < Nx - m.edges; i++) mx = Math.max(mx, out[j * Nx + i]);
    const disp2 = new Float32Array(Nx * Ny);
    for (let i = 0; i < Nx * Ny; i++) disp2[i] = logc.get() ? Math.log10(Math.max(out[i] / mx, 1e-4)) : out[i] / mx;
    const W = Nx * dx * 1e6, Hh = Ny * dx * 1e6;
    const vmin = logc.get() ? -4 : 0, vmax = logc.get() ? 0 : 1;
    if (animate) {   // raster scan: reveal column by column with the laser spot
      const shown = new Float32Array(Nx * Ny).fill(vmin);
      for (let c = 0; c <= Nx; c += 8) {
        for (let j = 0; j < Ny; j++) for (let i = Math.max(0, c - 8); i < Math.min(Nx, c); i++) shown[j * Nx + i] = disp2[j * Nx + i];
        plot.setHeatmap({ data: shown, nx: Nx, ny: Ny, x0: -W / 2, x1: W / 2, y0: -Hh / 2, y1: Hh / 2, colormap: 'heat', vmin, vmax });
        plot.setMarkers([{ x: -W / 2 + c / Nx * W, y: 0, color: '#3DFF6E', r: 6 }]).draw();
        await new Promise((r) => requestAnimationFrame(r));
      }
      plot.setMarkers([]);
    }
    plot.setHeatmap({ data: disp2, nx: Nx, ny: Ny, x0: -W / 2, x1: W / 2, y0: -Hh / 2, y1: Hh / 2, colormap: 'heat', vmin, vmax }).draw();
    // profile along the centre line, fit ln I against x beyond the antenna
    const jc = Math.floor(Ny / 2), xa = (m.x0 / dx + Nx / 2) | 0, xs = [], ys = [];
    for (let i = xa + 2; i < Nx - m.edges; i++) { const v = out[jc * Nx + i]; if (v > 0) { xs.push((i - xa) * dx * 1e6); ys.push(Math.log(v / mx)); } }
    const i0 = Math.floor(xs.length * 0.15), fitX = xs.slice(i0), fitY = ys.slice(i0);
    let L = NaN;
    if (fitX.length > 5) {
      const n = fitX.length, sx = fitX.reduce((a, b) => a + b, 0), sy = fitY.reduce((a, b) => a + b, 0), sxx = fitX.reduce((a, b) => a + b * b, 0), sxy = fitX.reduce((a, b, i) => a + b * fitY[i], 0);
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
      L = -2 / slope;   // intensity decays as exp(-2x/L)
      plot2.setSeries([{ x: xs, y: ys, color: COLORS.signal, width: 2, label: 'map' }, { x: [fitX[0], fitX[n - 1]], y: [icpt + slope * fitX[0], icpt + slope * fitX[n - 1]], color: COLORS.pink, width: 2, dash: [6, 4], label: 'straight-line fit' }]).draw();
    }
    const span = (Nx - m.edges) * dx * 1e6 - (m.x0 / dx + Nx / 2) * dx * 1e6;
    ro.L.set(Number.isFinite(L) && L > 0 && L < 1.5 * span ? `${fmtNum(L, 4)} µm` : `longer than the guide (${fmtNum(span, 3)} µm)`);
    m.longLived = !(Number.isFinite(L) && L > 0 && L < 1.5 * span);
    tip.hidden = !m.longLived;
  }
  return { show() { if (lastMap) showMap(lastMap, false); }, resize() { if (lastMap) showMap(lastMap, false); } };
}
function findK(p, f) {
  let lo = 1e3, hi = 3e8; const fk = (k) => disp.curves(p, [k]).f[0], rising = fk(5e6) > fk(1e4);
  for (let i = 0; i < 70; i++) { const mid = Math.sqrt(lo * hi); if ((fk(mid) < f) === rising) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}

// ------------------------------------------------------------------------------------- pumping & BEC
function tabPump(pane) {
  const fp = slider({ label: 'Pump frequency', unit: 'GHz', min: 1, max: 40, step: 0.01, value: S.fp / 1e9, digits: 4, onInput: (v) => { S.fp = v * 1e9; draw(); } });
  const B = slider({ label: 'Applied field (in plane)', unit: 'mT', min: 1, max: 500, step: 0.5, value: S.B * 1e3, digits: 4, onInput: (v) => { S.B = v / 1e3; draw(); } });
  const pump = slider({ label: 'Pump strength (× threshold)', unit: '×', min: 0, max: 10, step: 0.05, value: S.pump, digits: 3, onInput: (v) => { S.pump = v; drawBEC(); } });
  const yig = button('Use a 5 µm YIG film', () => { lab.setSample({ ...material('yig'), d: 5e-6, edited: true }); S.B = 0.1; S.fp = 14e9; changed(); }, 'quiet');
  const box = canvasBox('', '16 / 7', 'Parametric threshold against field');
  const plot = new Plot(box.canvas, { xlabel: 'Applied field (mT)', ylabel: 'Threshold pump field (mT)' });
  const box2 = canvasBox('', '16 / 8', 'Magnon distribution');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Frequency (GHz)', ylabel: 'Extra magnons (arb., log)' });
  const box3 = canvasBox('', '16 / 7', 'Magnon distribution over time');
  const plot3 = new Plot(box3.canvas, { xlabel: 'Time after the pump turns on (ns)', ylabel: 'Frequency (GHz)', colorbar: { label: 'log magnons', ticks: false } });
  const tsl = slider({ label: 'Time after the pump turns on', unit: 'ns', min: 0, max: 800, step: 1, value: 800, digits: 4, onInput: () => frame() });
  const play = button('Play', () => animate(), 'secondary');
  const ro = { th: readout('Threshold at this field'), k: readout('First magnons to grow'), fmin: readout('Bottom of the spin-wave band'), mu: readout('Chemical potential below the bottom'), c: readout('Fraction in the condensate') };
  pane.append(
    el('p', { class: 'vp-intro', html: 'A strong microwave field along M (parallel pumping) splits each pump photon into two magnons at half its frequency. Above a threshold their number grows exponentially. The extra magnons then scatter, cool toward the bottom of the band, and if there are enough of them they gather there as a <b>Bose–Einstein condensate</b>, as seen in YIG films by BLS.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'alpha'] }), group('Pumping', fp, B, pump, yig), group('Time', tsl, el('div', { class: 'vp-row' }, play)),
        note('The condensation part is a teaching model: rate equations with a Bose–Einstein target distribution at room temperature, a 60 ns thermalization time and a 300 ns lifetime.')),
      el('div', { class: 'vp-main' }, box, box2, box3, el('div', { class: 'ros' }, ...Object.values(ro)))));
  let M = null, bf = null, raf = 0;
  function draw() {
    const p = params({ inPlane: true });
    const Bmax = Math.max(0.05, Math.min(1, S.fp / 2 / lab.sample.gamma * 1.2 + 0.02));
    bf = bls.butterfly(p, S.fp, Bmax, 70);
    plot.setSeries([{ x: bf.Bs.map((b) => b * 1e3), y: bf.th.map((t) => t * 1e3), color: COLORS.signal, width: 2.5 }]).setVLines([{ x: S.B * 1e3, color: COLORS.gold, dash: [5, 4] }]);
    const fin = bf.th.filter(Number.isFinite).map((t) => t * 1e3);
    plot.ylim = fin.length ? [0, Math.min(Math.max(...fin), Math.min(...fin) * 6) * 1.08] : null;
    plot.xlim = [0, Bmax * 1e3];
    plot.draw();
    const r = bls.pumpThreshold(p, S.fp, S.B);
    ro.th.set(r ? `${fmtNum(r.bth * 1e3, 4)} mT` : 'no magnons at f_p/2 at this field');
    ro.k.set(r ? `${fmtNum(r.k / 1e6, 4)} rad/µm at ${fmtNum(r.phi, 3)}° to M` : '–');
    drawBEC();
  }
  function drawBEC() {
    cancelAnimationFrame(raf);
    const p = params({ inPlane: true, phi: 0 });
    M = bls.becModel(p, { fp: S.fp, pump: S.pump, T: 300, tmax: 800e-9 });
    ro.fmin.set(`${fmtNum(M.fmin / 1e9, 4)} GHz`);
    const nt = M.frames.length, nf = M.fb.length, data = new Float32Array(nt * nf);
    let mx = 1e-30; for (const fr of M.frames) for (const v of fr) mx = Math.max(mx, v);
    for (let j = 0; j < nf; j++) for (let i = 0; i < nt; i++) data[j * nt + i] = Math.log10(Math.max(M.frames[i][j] / mx, 1e-5));
    plot3.setHeatmap({ data, nx: nt, ny: nf, x0: 0, x1: M.times[nt - 1] * 1e9, y0: M.fb[0] / 1e9, y1: M.fb[nf - 1] / 1e9, colormap: 'heat', vmin: -5, vmax: 0, smooth: true }).draw();
    frame();
  }
  function frame() {
    if (!M) return;
    const t = tsl.get() * 1e-9; let i = 0; while (i < M.times.length - 1 && M.times[i] < t) i++;
    const fr = M.frames[i]; let mx = 1e-30; for (const f of M.frames) for (const v of f) mx = Math.max(mx, v);
    plot2.ylim = [-5, 0.2];
    plot2.setSeries([{ x: Array.from(M.fb, (f) => f / 1e9), y: fr.map((v) => Math.log10(Math.max(v / mx, 1e-5))), color: COLORS.violet, width: 2.5 }])
      .setVLines([{ x: M.fpHalf / 1e9, color: COLORS.gold, dash: [5, 4] }, { x: M.fmin / 1e9, color: COLORS.cyan, dash: [3, 4] }])
      .setTexts([{ x: M.fpHalf / 1e9, y: 0.05, text: '  f_p/2', color: COLORS.gold }, { x: M.fmin / 1e9, y: 0.05, text: '  bottom of the band', color: COLORS.signal }]).draw();
    ro.mu.set(`${fmtNum((M.fmin - M.mus[i]) / 1e6, 4)} MHz`);
    ro.c.set(`${fmtNum(M.conds[i] * 100, 3)} %`);
  }
  function animate() {
    cancelAnimationFrame(raf);
    let t = 0;
    const step = () => { t += 6; tsl.set(Math.min(800, t), false); frame(); if (t < 800 && !pane.hidden) raf = requestAnimationFrame(step); };
    step();
  }
  subs.add(() => { if (!pane.hidden) draw(); B.set(S.B * 1e3, false); fp.set(S.fp / 1e9, false); });
  return { show: draw, hide: () => cancelAnimationFrame(raf), resize: () => { plot.draw(); plot3.draw(); frame(); } };
}

// ------------------------------------------------------------------------------------- squeezing
function tabSqueeze(pane) {
  const g = geomCtl();
  const k = slider({ label: 'Magnon wavenumber (0 = uniform mode)', unit: 'rad/µm', min: 0, max: 50, step: 0.05, value: S.kq / 1e6, digits: 4, onInput: (v) => { S.kq = v * 1e6; draw(); } });
  const temp = slider({ label: 'Temperature', unit: 'K', min: 0.005, max: 300, log: true, value: S.Tq, digits: 3, onInput: (v) => { S.Tq = v; draw(); } });
  const box = canvasBox('square', '1 / 1', 'Wigner function of the magnon mode');
  const plot = new Plot(box.canvas, { xlabel: 'In-plane quadrature (vacuum = 1)', ylabel: 'Out-of-plane quadrature', colorbar: { label: 'W', ticks: false } });
  const box2 = canvasBox('', '16 / 7', 'Squeezing against field');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Applied field (mT)', ylabel: 'Squeezing (dB)' });
  const ro = { r: readout('Squeezing parameter r'), dB: readout('Below vacuum noise'), n: readout('Thermal magnons in the mode'), v: readout('Noise in the squeezed quadrature') };
  pane.append(
    el('p', { class: 'vp-intro', html: 'A magnon in a film is a <b>squeezed</b> spin flip: the demagnetizing field makes the precession elliptical, and the same ellipticity squeezes the quantum vacuum of the mode, with less noise out of the plane and more in the plane. At room temperature thermal magnons swamp the effect; in a dilution refrigerator the squeezed vacuum shows.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'Kp'] }), group('Mode', g.geo, g.B, k), group('Temperature', temp),
        note('The dashed circle is the vacuum of an unsqueezed mode. Axes are in units of the vacuum noise, so a circle of radius 1 is the quantum limit.')),
      el('div', { class: 'vp-main' }, box, box2, el('div', { class: 'ros' }, ...Object.values(ro)))));
  function draw() {
    const p = params(), st = bls.modeStiffness(p, Math.max(S.kq, 1), p.phi);
    if (!(st.w > 0)) { ro.r.set('no stable mode here'); return; }
    const q = bls.squeezing(st.a1, st.a2, st.w / 2 / Math.PI, S.Tq);
    const s1 = Math.sqrt(2 * q.V1), s2 = Math.sqrt(2 * q.V2), R = Math.max(2.2, 3.2 * Math.max(s1, s2));
    const n = 141, data = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -R + 2 * R * i / (n - 1), y = -R + 2 * R * j / (n - 1); data[j * n + i] = Math.exp(-x * x / (2 * s1 * s1) - y * y / (2 * s2 * s2)); }
    plot.setHeatmap({ data, nx: n, ny: n, x0: -R, x1: R, y0: -R, y1: R, colormap: 'lab', vmin: 0, vmax: 1 });
    const circ = (r, dash, col) => ({ x: Array.from({ length: 121 }, (_, i) => r * Math.cos(i / 120 * 2 * Math.PI)), y: Array.from({ length: 121 }, (_, i) => r * Math.sin(i / 120 * 2 * Math.PI)), color: col, width: 2, dash });
    const ell = { x: Array.from({ length: 121 }, (_, i) => s1 * Math.cos(i / 120 * 2 * Math.PI)), y: Array.from({ length: 121 }, (_, i) => s2 * Math.sin(i / 120 * 2 * Math.PI)), color: '#FFD84A', width: 2 };
    plot.setSeries([circ(1, [6, 5], '#FFFFFF'), ell]).draw();
    ro.r.set(fmtNum(q.r, 3));
    ro.dB.set(q.V2 < 0.5 ? `${fmtNum(-10 * Math.log10(2 * q.V2), 3)} dB` : `not below vacuum (thermal noise ×${fmtNum(2 * q.V2, 3)})`);
    ro.n.set(fmtNum(q.nth, 3));
    ro.v.set(`${fmtNum(2 * q.V2, 3)} × vacuum`);
    const Bs = [], dBs = [];
    for (let i = 1; i <= 80; i++) {
      const B = (S.geom === 'FV' ? 0.3 + 1.5 * i / 80 : 0.5 * i / 80), st2 = bls.modeStiffness(params({ B }), Math.max(S.kq, 1), p.phi);
      Bs.push(B * 1e3); dBs.push(st2.w > 0 ? 20 * 0.25 * Math.log(st2.a2 / st2.a1) / Math.LN10 : NaN);
    }
    plot2.setSeries([{ x: Bs, y: dBs, color: COLORS.violet, width: 2.5 }]).setVLines([{ x: S.B * 1e3, color: COLORS.gold, dash: [5, 4] }]).draw();
  }
  subs.add(() => { if (!pane.hidden) draw(); });
  return { show: draw, resize: draw };
}

const api = {
  id: 'bls', title: 'BLS setup', kicker: 'Brillouin light scattering', icon: 'BLS',
  blurb: 'Thermal BLS spectra and DMI, micro-BLS maps, parametric pumping, magnon condensation, squeezing.',
  build3D,
  tabs: [
    { id: 'spectrum', label: 'Spectrum', build: tabSpectrum },
    { id: 'map', label: 'Spatial map', build: tabMap },
    { id: 'pump', label: 'Pumping and BEC', build: tabPump },
    { id: 'squeeze', label: 'Squeezing', build: tabSqueeze },
  ],
};
export default api;
