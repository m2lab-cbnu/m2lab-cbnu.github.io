// Blackboard: spin-wave dispersion of the film on the bench (Kalinikos–Slavin), what an antenna
// excites, and isofrequency curves in k-space. The board in the room shows the current curves in chalk.

import { el, slider, segmented, group, readout, canvasBox, note, fmtNum, checkbox, button } from '../ui/widgets.js';
import { Plot, screenPlot, COLORS, SERIES } from '../ui/plot.js';
import { contour } from '../ui/contour.js';
import { sampleEditor } from '../ui/sample.js';
import * as disp from '../physics/dispersion.js';
import { MU0 } from '../physics/materials.js';
import { lab } from '../state.js';
import * as T from '../world/textures.js';

const S = { inPlane: true, phi: 90, B: 0.02, modes: [true, false, false, false], qty: 'f', kmax: 30e6, f0: 3.0e9,
  ant: { type: 'cpw', w: 2e-6, g: 1.4e-6, wg: 2e-6, s: 0.1e-6 } };
const subs = new Set();
const changed = () => { for (const fn of subs) fn(); };
lab.onSample(() => changed());
let board = null;

const params = (over = {}) => ({ Ms: lab.sample.Ms, A: lab.sample.A, gamma: lab.sample.gamma, alpha: lab.sample.alpha, d: lab.sample.d,
  Kp: lab.sample.Kp || 0, D: lab.sample.D || 0, B: S.B, inPlane: S.inPlane, phi: S.phi, ...over });
const geomName = () => (!S.inPlane ? 'forward volume' : S.phi >= 89.5 ? 'Damon–Eshbach' : S.phi <= 0.5 ? 'backward volume' : `k at ${fmtNum(S.phi, 3)}° to M`);
const QTY = {
  f: { label: 'Frequency (GHz)', get: (c, i) => c.f[i] / 1e9 },
  vg: { label: 'Group velocity (km/s)', get: (c, i) => c.vg[i] / 1e3 },
  L: { label: 'Decay length (µm)', get: (c, i) => c.Ldec[i] * 1e6 },
  tau: { label: 'Lifetime (ns)', get: (c, i) => c.tau[i] * 1e9 },
};

function curvesFor(n, N = 401) {
  const ks = disp.linspace(-S.kmax, S.kmax, N);
  return { ks, c: disp.curves(params(), ks, n) };
}

// ------------------------------------------------------------------------------------- 3D
function build3D(w) {
  board = { ...w.spots.blackboard, invalidate: w.invalidate };
  w.proxy(api, 0, 0.8, 4.5, 0.25, 2.5, 8.7);
  subs.add(drawBoard);
  drawBoard();
  return { anchor: [0.1, 2.75, 6.6], view: { pos: [3.15, 1.62, 7.35], target: [0, 1.62, 7.35] } };
}

let boardPending = false;
function drawBoard() {
  if (!board || boardPending) return; boardPending = true;
  requestAnimationFrame(() => {
    boardPending = false;
    const c = board.canvas, g = c.getContext('2d');
    T.paintBlackboard(g, c.width, c.height);
    const series = [];
    const cols = ['rgba(250,248,236,0.95)', 'rgba(255,214,120,0.95)', 'rgba(150,215,255,0.95)', 'rgba(255,170,190,0.95)'];
    S.modes.forEach((on, n) => { if (!on) return; const { ks, c: cv } = curvesFor(n, 241); series.push({ x: Array.from(ks, (k) => k / 1e6), y: Array.from(cv.f, (f) => f / 1e9), color: cols[n], width: 4 }); });
    g.save(); g.translate(40, 40);
    screenPlot(g, 900, 560, { theme: 'chalk', series, xlabel: 'k (rad/µm)', ylabel: 'f (GHz)', pad: { l: 70, r: 20, t: 20, b: 60 } });
    g.restore();
    T.chalk(g, (q) => {
      q.font = '600 40px "Plex", sans-serif'; q.textAlign = 'left';
      q.fillText('Spin waves in a film', 1000, 90);
      q.font = '500 30px "Plex", sans-serif';
      const s = lab.sample;
      q.fillText(`${s.name ? s.name.split(' (')[0] : 'film'}, ${fmtNum(s.d * 1e9, 3)} nm`, 1000, 150);
      q.fillText(`B = ${fmtNum(S.B * 1e3, 4)} mT, ${geomName()}`, 1000, 195);
      q.font = '500 28px "Plex", sans-serif';
      q.fillText('ω² = (ω_H + ω_M λk²)', 1000, 280);
      q.fillText('       × (ω_H + ω_M λk² + ω_M F)', 1000, 322);
      q.fillText('v_g = ∂ω/∂k', 1000, 390);
      q.fillText('decay length  L = v_g τ', 1000, 440);
      q.lineWidth = 3; q.beginPath(); q.moveTo(1000, 480); q.quadraticCurveTo(1150, 455, 1300, 500); q.stroke();
      q.font = '500 26px "Plex", sans-serif'; q.fillText('Kalinikos & Slavin (1986)', 1000, 540);
    });
    board.texture.needsUpdate = true; board.invalidate();
  });
}

// ------------------------------------------------------------------------------------- shared controls
function geometryControls() {
  const ori = segmented({ label: 'Magnetization', options: [{ value: 'ip', label: 'In the plane' }, { value: 'oop', label: 'Out of the plane' }], value: S.inPlane ? 'ip' : 'oop',
    onChange: (v) => { S.inPlane = v === 'ip'; if (!S.inPlane && S.B < MU0 * lab.sample.Ms - 2 * (lab.sample.Kp || 0) / lab.sample.Ms + 0.02) S.B = Math.max(0.02, MU0 * lab.sample.Ms - 2 * (lab.sample.Kp || 0) / lab.sample.Ms + 0.1); changed(); } });
  const phi = slider({ label: 'Angle between k and M', unit: '°', min: 0, max: 90, step: 0.5, value: S.phi, digits: 3, onInput: (v) => { S.phi = v; changed(); } });
  const quick = el('div', { class: 'vp-row' },
    button('Damon–Eshbach (90°)', () => { S.phi = 90; changed(); }, 'quiet'),
    button('Backward volume (0°)', () => { S.phi = 0; changed(); }, 'quiet'));
  const B = slider({ label: 'Applied field', unit: 'mT', min: 0, max: 3000, step: 0.5, value: S.B * 1e3, digits: 5, onInput: (v) => { S.B = v / 1e3; changed(); } });
  subs.add(() => { ori.set(S.inPlane ? 'ip' : 'oop'); phi.set(S.phi, false); B.set(S.B * 1e3, false); phi.hidden = !S.inPlane; quick.hidden = !S.inPlane; });
  return { ori, phi, quick, B };
}

// ------------------------------------------------------------------------------------- tab: dispersion
function tabDispersion(pane) {
  const g = geometryControls();
  const modeChecks = [0, 1, 2, 3].map((n) => checkbox({ label: n === 0 ? 'n = 0 (uniform across the thickness)' : `n = ${n} (standing wave across the thickness)`, checked: S.modes[n], onChange: (v) => { S.modes[n] = v || n === 0; changed(); } }));
  const qty = segmented({ label: 'Plot', options: [{ value: 'f', label: 'Frequency' }, { value: 'vg', label: 'Group velocity' }, { value: 'L', label: 'Decay length' }, { value: 'tau', label: 'Lifetime' }], value: S.qty, onChange: (v) => { S.qty = v; draw(); } });
  const km = slider({ label: 'Largest wavenumber', unit: 'rad/µm', min: 0.5, max: 300, log: true, value: S.kmax / 1e6, digits: 3, onInput: (v) => { S.kmax = v * 1e6; changed(); } });
  const box = canvasBox('', '16 / 10', 'Spin-wave dispersion');
  const plot = new Plot(box.canvas, { xlabel: 'Wavenumber k (rad/µm)', ylabel: 'Frequency (GHz)', hover: true });
  const ro = { k: readout('Wavenumber, wavelength'), f: readout('Frequency'), vg: readout('Group velocity'), L: readout('Decay length'), tau: readout('Lifetime'), nr: readout('f(+k) − f(−k)') };
  let kc = S.kmax / 3;
  plot.onCursor((k) => { kc = k * 1e6; readouts(); draw(true); });
  pane.append(
    el('p', { class: 'vp-intro', html: 'Spin waves in a magnetic film, from the long-wavelength magnetostatic waves to exchange spin waves. <b>Damon–Eshbach</b> waves (k ⟂ M) are fast surface waves; <b>backward volume</b> waves (k ∥ M) lose frequency as k grows at first; <b>forward volume</b> waves appear when the film is magnetized along its normal. Hover over the plot to read off a point.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'alpha', 'Kp', 'D'] }), group('Geometry', g.ori, g.phi, g.quick, g.B), group('Thickness modes', ...modeChecks), group('Plot', qty, km)),
      el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ...Object.values(ro)),
        note('Interfacial DMI (in the film editor) shifts waves going one way up and the other way down, so f(+k) ≠ f(−k) for Damon–Eshbach waves. The blackboard in the room follows these settings.'))));
  function readouts() {
    const p = params(), s = disp.setup(p), k = kc;
    const c = disp.curves(p, [k]);
    ro.k.set(`${fmtNum(k / 1e6, 4)} rad/µm, λ = ${fmtNum(2 * Math.PI / Math.abs(k) * 1e6, 4)} µm`);
    ro.f.set(`${fmtNum(c.f[0] / 1e9, 5)} GHz`);
    ro.vg.set(`${fmtNum(c.vg[0] / 1e3, 4)} km/s`);
    ro.L.set(`${fmtNum(c.Ldec[0] * 1e6, 4)} µm`);
    ro.tau.set(`${fmtNum(c.tau[0] * 1e9, 4)} ns`);
    ro.nr.set(`${fmtNum((disp.omegaOf(s, Math.abs(k)) - disp.omegaOf(s, -Math.abs(k))) / 2 / Math.PI / 1e6, 4)} MHz`);
  }
  function draw(cursorOnly) {
    const q = QTY[S.qty], series = [];
    S.modes.forEach((on, n) => {
      if (!on) return;
      const { ks, c } = curvesFor(n);
      const y = Array.from(ks, (_, i) => q.get(c, i));
      series.push({ x: Array.from(ks, (k) => k / 1e6), y, color: SERIES[n], width: 2.5, label: `n = ${n}` });
    });
    plot.o.ylabel = q.label;
    plot.ylim = null;
    if (S.qty === 'L' || S.qty === 'tau') { // long tails near k = 0: cap the axis at the 97th percentile
      const all = series.flatMap((s) => s.y.filter(Number.isFinite)).sort((a, b) => a - b);
      if (all.length) plot.ylim = [0, all[Math.floor(all.length * 0.97)] * 1.05];
    }
    plot.setSeries(series).setVLines([{ x: kc / 1e6, color: COLORS.gold, dash: [4, 4], width: 1.2 }]).draw();
    if (!cursorOnly) readouts();
  }
  subs.add(() => { if (!pane.hidden) draw(); });
  return { show: () => draw(), resize: () => draw(true) };
}

// ------------------------------------------------------------------------------------- tab: antenna
function tabAntenna(pane) {
  const g = geometryControls();
  const A = S.ant;
  const type = segmented({ label: 'Antenna', options: [{ value: 'strip', label: 'Single strip' }, { value: 'cpw', label: 'Coplanar waveguide' }], value: A.type, onChange: (v) => { A.type = v; gw.hidden = gg.hidden = v !== 'cpw'; draw(); } });
  const w = slider({ label: 'Signal line width', unit: 'µm', min: 0.1, max: 100, log: true, value: A.w * 1e6, digits: 3, onInput: (v) => { A.w = v * 1e-6; draw(); } });
  const gg = slider({ label: 'Gap', unit: 'µm', min: 0.1, max: 100, log: true, value: A.g * 1e6, digits: 3, onInput: (v) => { A.g = v * 1e-6; draw(); } });
  const gw = slider({ label: 'Ground line width', unit: 'µm', min: 0.1, max: 100, log: true, value: A.wg * 1e6, digits: 3, onInput: (v) => { A.wg = v * 1e-6; draw(); } });
  const sp = slider({ label: 'Distance from antenna to film', unit: 'nm', min: 0, max: 5000, step: 5, value: A.s * 1e9, digits: 4, onInput: (v) => { A.s = v * 1e-9; draw(); } });
  gg.hidden = gw.hidden = A.type !== 'cpw';
  const box = canvasBox('', '16 / 8', 'Antenna excitation against wavenumber');
  const plot = new Plot(box.canvas, { xlabel: 'Wavenumber k (rad/µm)', ylabel: 'Excitation (arb. units)' });
  const box2 = canvasBox('', '16 / 8', 'Excited spin waves against frequency');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Frequency (GHz)', ylabel: 'Excitation (arb. units)' });
  const ro = { kp: readout('Main wavenumber'), k0: readout('First zero of the antenna'), band: readout('Band excited above half maximum'), ratio: readout('Power ratio, +k against −k') };
  pane.append(
    el('p', { class: 'vp-intro', html: 'A microwave antenna excites spin waves whose wavelength matches its shape: narrower lines reach larger k. In the Damon–Eshbach geometry the field of the antenna turns the same way as the precession on one side only, so more power leaves in one direction, as in our spin-wave transmission measurements.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'alpha', 'Kp', 'D'] }), group('Geometry', g.ori, g.phi, g.quick, g.B), group('Antenna', type, w, gg, gw, sp)),
      el('div', { class: 'vp-main' }, box, box2, el('div', { class: 'ros' }, ...Object.values(ro)))));
  function draw() {
    const p = params(), s = disp.setup(p), kmax = Math.min(S.kmax, 8 * Math.PI / A.w * 1.2);
    const N = 600, ks = disp.linspace(kmax / N, kmax, N);
    const plus = [], minus = [], fP = [], fM = [];
    for (const k of ks) {
      const e = S.inPlane && Math.abs(Math.sin(S.phi * Math.PI / 180)) > 0.01 ? Math.min(1, disp.ellipticity(s, k)) : 1;
      // in DE geometry the ellipticity of the n = 0 mode sets the asymmetry; elsewhere both directions are equal
      const ex = S.inPlane && S.phi > 45 ? disp.excitation(A, k, e) : (() => { const J = disp.antennaJ(A, k) * Math.exp(-k * (A.s || 0)) / 2, P = 2 * J * J; return { plus: P, minus: P }; })();
      plus.push(ex.plus); minus.push(ex.minus);
      fP.push(disp.omegaOf(s, k) / 2 / Math.PI / 1e9); fM.push(disp.omegaOf(s, -k) / 2 / Math.PI / 1e9);
    }
    const kx = Array.from(ks, (k) => k / 1e6);
    plot.setSeries([{ x: kx, y: plus, color: COLORS.cyan, width: 2.5, label: '+k' }, { x: kx, y: minus, color: COLORS.pink, width: 2, dash: [6, 4], label: '−k' }]).draw();
    plot2.setSeries([{ x: fP, y: plus, color: COLORS.cyan, width: 2.5, label: '+k' }, { x: fM, y: minus, color: COLORS.pink, width: 2, dash: [6, 4], label: '−k' }]).draw();
    let ip = 0; for (let i = 1; i < N; i++) if (plus[i] > plus[ip]) ip = i;
    ro.kp.set(`${fmtNum(ks[ip] / 1e6, 4)} rad/µm (λ = ${fmtNum(2 * Math.PI / ks[ip] * 1e6, 3)} µm)`);
    let k0 = NaN; for (let i = 1; i < N; i++) { const j = disp.antennaJ(A, ks[i]), jp = disp.antennaJ(A, ks[i - 1]); if (j * jp <= 0) { k0 = ks[i]; break; } }
    ro.k0.set(Number.isFinite(k0) ? `${fmtNum(k0 / 1e6, 4)} rad/µm` : '–');
    const half = plus[ip] / 2, inBand = fP.filter((f, i) => plus[i] >= half && Number.isFinite(f));
    ro.band.set(inBand.length ? `${fmtNum(Math.min(...inBand), 4)} – ${fmtNum(Math.max(...inBand), 4)} GHz` : '–');
    ro.ratio.set(minus[ip] > 0 ? fmtNum(plus[ip] / minus[ip], 3) : '∞');
  }
  subs.add(() => { if (!pane.hidden) draw(); });
  return { show: draw, resize: draw };
}

// ------------------------------------------------------------------------------------- tab: isofrequency
function tabIso(pane) {
  const g = geometryControls();
  const f0 = slider({ label: 'Frequency of the contour', unit: 'GHz', min: 0.1, max: 60, step: 0.01, value: S.f0 / 1e9, digits: 4, onInput: (v) => { S.f0 = v * 1e9; draw(); } });
  const km = slider({ label: 'Largest wavenumber', unit: 'rad/µm', min: 0.5, max: 300, log: true, value: S.kmax / 1e6, digits: 3, onInput: (v) => { S.kmax = v * 1e6; changed(); } });
  const arrows = checkbox({ label: 'Show group velocity arrows', checked: true, onChange: () => draw() });
  const box = canvasBox('square', '1 / 1', 'Isofrequency curves in k-space');
  const plot = new Plot(box.canvas, { xlabel: 'k along M (rad/µm)', ylabel: 'k across M (rad/µm)', colorbar: { label: 'f (GHz)' }, hover: true });
  const ro = { range: readout('Frequency range shown'), cur: readout('At the cursor'), caustic: readout('Direction of the strongest beam') };
  plot.onCursor((kx, ky) => {
    const k = Math.hypot(kx, ky) * 1e6, phi = Math.atan2(Math.abs(ky), Math.abs(kx)) * 180 / Math.PI;
    const s = disp.setup(params({ phi })), sgn = ky < 0 ? -1 : 1;
    ro.cur.set(`f = ${fmtNum(disp.omegaOf(s, sgn * k) / 2 / Math.PI / 1e9, 4)} GHz at |k| = ${fmtNum(k / 1e6, 3)} rad/µm, ${fmtNum(phi, 3)}°`);
  });
  pane.append(
    el('p', { class: 'vp-intro', html: 'Curves of equal frequency in the plane of wavevectors, for an in-plane magnetized film. Energy flows along the group velocity, normal to the curve, which is not along k. Where the curve flattens, many wavevectors share one group-velocity direction and the waves gather into narrow <b>caustic beams</b>.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ fields: ['d', 'Ms', 'A', 'gamma', 'alpha', 'Kp', 'D'] }), group('Field', g.B), group('Contour', f0, km, arrows)),
      el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ...Object.values(ro)))));
  let t = 0;
  function draw() {
    cancelAnimationFrame(t);
    t = requestAnimationFrame(() => {
      const n = 161, K = S.kmax, data = new Float32Array(n * n);
      const setups = new Map();
      const sFor = (phi) => { const key = Math.round(phi * 50); let s = setups.get(key); if (!s) { s = disp.setup(params({ inPlane: true, phi: key / 50 })); setups.set(key, s); } return s; };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const kx = -K + 2 * K * i / (n - 1), ky = -K + 2 * K * j / (n - 1), k = Math.hypot(kx, ky);
        const phi = Math.atan2(Math.abs(ky), Math.abs(kx)) * 180 / Math.PI;
        data[j * n + i] = disp.omegaOf(sFor(phi), (ky < 0 ? -1 : 1) * Math.max(k, 1)) / 2 / Math.PI / 1e9;
      }
      const fin = Array.from(data).filter(Number.isFinite), vmin = Math.min(...fin), vmax = Math.max(...fin);
      const km = K / 1e6;
      plot.setHeatmap({ data, nx: n, ny: n, x0: -km, x1: km, y0: -km, y1: km, colormap: 'lab', vmin, vmax, gamma: 0.8 });
      const series = [];
      for (let q = 1; q <= 4; q++) { const lev = vmin + (vmax - vmin) * q / 5; const c = contour(data, n, n, -km, km, -km, km, lev); series.push({ x: c.x, y: c.y, color: 'rgba(255,255,255,0.45)', width: 1 }); }
      const c0 = contour(data, n, n, -km, km, -km, km, S.f0 / 1e9);
      series.push({ x: c0.x, y: c0.y, color: '#FFD84A', width: 3 });
      // group velocity: gradient of f in k-space at points on the chosen contour
      let best = null;
      if (arrows.get() && c0.x.length) {
        const dk = 2 * km / (n - 1), at = (x, y) => { const i = Math.round((x + km) / dk), j = Math.round((y + km) / dk); return data[Math.max(0, Math.min(n - 1, j)) * n + Math.max(0, Math.min(n - 1, i))]; };
        const ax = [], ay = [], dirs = [];
        for (let p = 0; p < c0.x.length; p += 3 * 6) {
          const x = c0.x[p], y = c0.y[p]; if (!Number.isFinite(x)) continue;
          const gx = (at(x + dk, y) - at(x - dk, y)) / (2 * dk), gy = (at(x, y + dk) - at(x, y - dk)) / (2 * dk), gn = Math.hypot(gx, gy);
          if (!(gn > 0)) continue;
          const L = km * 0.09;
          ax.push(x, x + gx / gn * L, NaN); ay.push(y, y + gy / gn * L, NaN);
          dirs.push(Math.atan2(gy, gx));
        }
        series.push({ x: ax, y: ay, color: '#FFFFFF', width: 1.8 });
        // most common group-velocity direction (histogram) = caustic
        if (dirs.length > 6) {
          const bins = new Array(90).fill(0);
          for (const a of dirs) bins[Math.floor(((a % Math.PI + Math.PI) % Math.PI) / Math.PI * 90) % 90]++;
          let bi = 0; for (let i = 1; i < 90; i++) if (bins[i] > bins[bi]) bi = i;
          best = (bi + 0.5) * 2;
        }
      }
      plot.setSeries(series).draw();
      ro.range.set(`${fmtNum(vmin, 3)} – ${fmtNum(vmax, 3)} GHz`);
      ro.caustic.set(best != null ? `${fmtNum(best > 90 ? 180 - best : best, 3)}° from M` : '–');
      if (!S.inPlane) ro.caustic.set('Out-of-plane films have circular contours (no caustics).');
    });
  }
  subs.add(() => { if (!pane.hidden) draw(); });
  return { show: draw, resize: draw };
}

const api = {
  id: 'dispersion', title: 'Blackboard', kicker: 'Spin-wave dispersion', icon: 'k',
  blurb: 'Dispersion of the film, group velocity and decay length, antenna excitation, isofrequency curves.',
  build3D,
  tabs: [
    { id: 'dispersion', label: 'Dispersion', build: tabDispersion },
    { id: 'antenna', label: 'Antenna', build: tabAntenna },
    { id: 'iso', label: 'Isofrequency', build: tabIso },
  ],
};
export default api;
