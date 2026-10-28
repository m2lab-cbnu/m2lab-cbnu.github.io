// 2F · Double slit, in the dark room. Laser light through one, two, three or ten slits makes
// fringes on a screen. Put a diffuser in the beam (before the slits, after them, or as the
// screen itself; still or spinning), mark the slits with polarisers and erase that mark again,
// or turn the laser down until the light arrives one photon at a time.
// The light is computed as a wave: the field at the slits, a short Fresnel step if needed,
// then the far field by a fast Fourier transform.

import { el, slider, button, group, readout, canvasBox, note, segmented, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, fitCanvas, gauss } from './common.js';
import { fft } from '../physics/fft.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

const NX = 8192, DX = 1.0e-6;          // aperture-plane samples: 8.2 mm at 1 µm
const SCREEN_HALF = 0.06;              // we look at ±6 cm of the screen

const bench = {
  id: 'slit', title: 'Double slit', kicker: '2F · Physics Playground', icon: '⫴', floor: 2,
  blurb: 'Fringes, diffusers, polarisers and single photons.',
  slots: [
    { id: 'laser', label: 'Laser', options: ['laser-red', 'laser-green', 'laser-blue'], def: 'laser-red' },
    { id: 'slits', label: 'Slits', options: ['slit-1', 'slit-2', 'slit-2w', 'slit-3', 'slit-10'], def: 'slit-2' },
    { id: 'diff', label: 'Diffuser', options: ['diff-none', 'diffuser'], def: 'diff-none' },
    { id: 'pol', label: 'Polarisers', options: ['pol-none', 'polarizers'], def: 'pol-none' },
    { id: 'det', label: 'Detector', options: ['screen-eye', 'photodiode', 'spad'], def: 'screen-eye' },
  ],
};
bench.header = rigStrip(bench);

const S = { L: 1.5, where: 'before', spin: false, grain: 12, polMode: 'cross', analyzer: 'none', rate: 200, photons: [], hist: null, sawCrossed: false };

// a smooth random phase screen: random values every `grain` µm, linearly joined, ±π and more
function phaseScreen(grainUm, seed) {
  const step = Math.max(1, Math.round(grainUm * 1e-6 / DX));
  const n = Math.ceil(NX / step) + 2, knots = new Float64Array(n);
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) knots[i] = (rnd() - 0.5) * 4 * Math.PI;
  const out = new Float64Array(NX);
  for (let i = 0; i < NX; i++) { const k = Math.floor(i / step), f = (i % step) / step; out[i] = knots[k] * (1 - f) + knots[k + 1] * f; }
  return out;
}

// intensity on the screen (arbitrary units) at screen positions xs (m)
function pattern() {
  const lam = phys(bench, 'laser').lambda, sl = phys(bench, 'slits');
  const diff = current(bench, 'diff') === 'diffuser', pol = current(bench, 'pol') === 'polarizers';
  const L = S.L, w0 = 0.7e-3;
  const nreal = diff && S.spin && S.where !== 'screen' ? 28 : 1;
  const nScreen = 600, xs = new Float64Array(nScreen), I = new Float64Array(nScreen);
  for (let i = 0; i < nScreen; i++) xs[i] = -SCREEN_HALF + 2 * SCREEN_HALF * i / (nScreen - 1);
  const re = [new Float64Array(NX), new Float64Array(NX)], im = [new Float64Array(NX), new Float64Array(NX)];
  for (let r = 0; r < nreal; r++) {
    const seed = S.spin ? r + 1 + Math.floor(S.seed || 0) : 7;
    const ph = diff && S.where === 'before' ? phaseScreen(S.grain, seed) : null;
    for (let c = 0; c < 2; c++) { re[c].fill(0); im[c].fill(0); }
    for (let j = 0; j < sl.n; j++) {
      const x0 = (j - (sl.n - 1) / 2) * sl.d;
      // which polarisation this slit passes
      let px = 1, py = 0;
      if (pol && S.polMode === 'cross') { if (j % 2) { px = 0; py = 1; } }
      const i0 = Math.round((x0 - sl.a / 2) / DX) + NX / 2, i1 = Math.round((x0 + sl.a / 2) / DX) + NX / 2;
      for (let i = i0; i < i1; i++) {
        const x = (i - NX / 2) * DX, amp = Math.exp(-(x * x) / (w0 * w0));
        const p = ph ? ph[i] : 0, cr = amp * Math.cos(p), ci = amp * Math.sin(p);
        re[0][i] += px * cr; im[0][i] += px * ci; re[1][i] += py * cr; im[1][i] += py * ci;
      }
    }
    for (let c = 0; c < 2; c++) {
      if (diff && S.where === 'after') {
        // 1.5 cm of free space, then the diffuser
        fft(re[c], im[c]);
        const z = 0.015;
        for (let k = 0; k < NX; k++) {
          const f = (k < NX / 2 ? k : k - NX) / (NX * DX), a = -Math.PI * lam * z * f * f;
          const ca = Math.cos(a), sa = Math.sin(a), xr = re[c][k], xi = im[c][k];
          re[c][k] = xr * ca - xi * sa; im[c][k] = xr * sa + xi * ca;
        }
        fft(re[c], im[c], true);
        const ph2 = phaseScreen(S.grain, seed + 101);
        for (let i = 0; i < NX; i++) { const ca = Math.cos(ph2[i]), sa = Math.sin(ph2[i]), xr = re[c][i], xi = im[c][i]; re[c][i] = xr * ca - xi * sa; im[c][i] = xr * sa + xi * ca; }
      }
      fft(re[c], im[c]);
    }
    // the far field: screen position x = λ L f
    for (let i = 0; i < nScreen; i++) {
      const f = xs[i] / (lam * L), kf = f * NX * DX;
      const k0 = Math.floor(kf), fr = kf - k0;
      const at = (k) => { const kk = ((k % NX) + NX) % NX; return kk; };
      const val = (c, k) => [re[c][at(k)], im[c][at(k)]];
      const lerp = (c) => { const a = val(c, k0), b = val(c, k0 + 1); return [a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr]; };
      const ex = lerp(0), ey = lerp(1);
      let v;
      if (pol && S.analyzer !== 'none') {
        const s = S.analyzer === 'plus' ? 1 : -1;
        const er = (ex[0] + s * ey[0]) / Math.SQRT2, ei = (ex[1] + s * ey[1]) / Math.SQRT2;
        v = er * er + ei * ei;
      } else v = ex[0] * ex[0] + ex[1] * ex[1] + ey[0] * ey[0] + ey[1] * ey[1];
      I[i] += v / nreal;
    }
  }
  let max = 0; for (const v of I) max = Math.max(max, v);
  // fringe visibility near the middle
  let lo = Infinity, hi = 0; const c = Math.floor(nScreen / 2), span = Math.round(nScreen * 0.04);
  for (let i = c - span; i <= c + span; i++) { lo = Math.min(lo, I[i]); hi = Math.max(hi, I[i]); }
  return { xs, I, max, vis: hi > 0 ? (hi - lo) / (hi + lo) : 0, lam, sl };
}

function rgbOf(lam) { return lam > 600e-9 ? [255, 60, 70] : lam > 500e-9 ? [70, 255, 120] : [90, 140, 255]; }

function tabDark(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Inside the dark room. Two slits make bright and dark stripes, because light arriving from the two slits adds up in some places and cancels in others. Now try to spoil it: a diffuser in different places, still or spinning, or polarisers that tell you which slit the light came through.' }));
  const scr = canvasBox('is-dark', '16 / 7', 'The screen at the back of the dark room');
  const top = canvasBox('', '16 / 4', 'The set-up seen from above');
  const prof = canvasBox('', '16 / 6', 'Brightness across the screen');
  const plot = new Plot(prof.canvas, { xlabel: 'Position on the screen (mm)', ylabel: 'Brightness' });
  const Ls = slider({ label: 'Slits to screen', unit: 'm', min: 0.5, max: 3, step: 0.01, value: S.L, digits: 3, onInput: (v) => { S.L = v; recompute(); } });
  const where = segmented({ label: 'Where the diffuser goes', options: [{ value: 'before', label: 'Before the slits' }, { value: 'after', label: 'After the slits' }, { value: 'screen', label: 'As the screen' }], value: S.where, onChange: (v) => { S.where = v; recompute(); } });
  const spin = checkbox({ label: 'Spin the diffuser', checked: S.spin, onChange: (v) => { S.spin = v; recompute(); } });
  const grain = segmented({ label: 'Diffuser grain', options: [{ value: 12, label: 'Fine (12 µm)' }, { value: 400, label: 'Coarse (0.4 mm)' }], value: S.grain, onChange: (v) => { S.grain = +v; recompute(); } });
  const polm = segmented({ label: 'Polarisers on the slits', options: [{ value: 'same', label: 'Same direction' }, { value: 'cross', label: 'Crossed' }], value: S.polMode, onChange: (v) => { S.polMode = v; recompute(); } });
  const ana = segmented({ label: 'Third polariser, in front of the screen', options: [{ value: 'none', label: 'None' }, { value: 'plus', label: 'At +45°' }, { value: 'minus', label: 'At −45°' }], value: S.analyzer, onChange: (v) => { S.analyzer = v; recompute(); } });
  const rate = slider({ label: 'Laser power (photons per second)', unit: '', min: 10, max: 3000, step: 10, value: S.rate, log: true, digits: 4, onInput: (v) => { S.rate = v; } });
  const clr = button('Clear the photon count', () => { S.photons = []; S.hist = null; }, 'quiet');
  const dGrp = group('Diffuser', where, spin, grain), pGrp = group('Polarisers', polm, ana), sGrp = group('Single photons', rate, clr);
  const visRo = readout('Fringe visibility'), spRo = readout('Fringe spacing'), nRo = readout('Photons counted');
  pane.append(el('div', { class: 'vp-cols' },
    el('div', { class: 'vp-side' }, group('Screen', Ls), dGrp, pGrp, sGrp),
    el('div', { class: 'vp-main' }, scr, top, prof, el('div', { class: 'ros' }, visRo, spRo, nRo))));

  let P = null, pending = false, speckle = null;
  function recompute() { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; P = pattern(); S.photons = []; S.hist = null; afterCompute(); draw(); }); }
  function afterCompute() {
    const sl = P.sl, fringes = sl.n > 1 ? P.lam * S.L / sl.d : null;
    visRo.set(sl.n > 1 ? `${Math.round(P.vis * 100)}%` : 'one slit: no two-slit fringes');
    spRo.set(fringes ? `${(fringes * 1000).toFixed(2)} mm (λL/d)` : '–');
    // the eraser stamp: fringes gone with crossed polarisers, then back with the third one
    const pol = current(bench, 'pol') === 'polarizers', two = sl.n === 2, clean = current(bench, 'diff') === 'diff-none';
    if (pol && two && clean && S.polMode === 'cross' && S.analyzer === 'none' && P.vis < 0.1) S.sawCrossed = true;
    if (pol && two && clean && S.polMode === 'cross' && S.analyzer !== 'none' && P.vis > 0.6 && S.sawCrossed) rig.note({ bench: 'slit', eraser: true });
    rig.note({ bench: 'slit', vis: P.vis, n: sl.n });
  }
  function sync() {
    dGrp.hidden = current(bench, 'diff') !== 'diffuser'; pGrp.hidden = current(bench, 'pol') !== 'polarizers';
    const det = current(bench, 'det'); sGrp.hidden = det !== 'spad'; prof.hidden = det !== 'photodiode'; nRo.hidden = det !== 'spad';
    recompute();
  }
  onRig(bench, sync);

  const anim = loop((dt) => {
    if (current(bench, 'det') === 'spad' && P) {
      // photons arrive at random, more where the wave is bright
      const n = Math.min(400, Math.floor(S.rate * dt + Math.random()));
      if (!S.cdf) buildCdf();
      for (let k = 0; k < n; k++) {
        const u = Math.random(); let lo = 0, hi = S.cdf.length - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (S.cdf[m] < u) lo = m + 1; else hi = m; }
        const x = P.xs[lo] + (Math.random() - 0.5) * (P.xs[1] - P.xs[0]);
        S.photons.push([x, gauss() * 0.004]);
        if (!S.hist) S.hist = new Float64Array(120);
        S.hist[Math.max(0, Math.min(119, Math.floor((x + SCREEN_HALF) / (2 * SCREEN_HALF) * 120)))]++;
      }
      if (S.photons.length > 40000) S.photons.splice(0, S.photons.length - 40000);
      draw();
    } else if (S.spin && current(bench, 'diff') === 'diffuser' && S.where === 'screen') draw();
  });
  function buildCdf() {
    const c = new Float64Array(P.I.length); let s = 0;
    for (let i = 0; i < P.I.length; i++) { s += P.I[i]; c[i] = s; }
    for (let i = 0; i < c.length; i++) c[i] /= s || 1;
    S.cdf = c;
  }

  function draw() {
    if (!P) return;
    S.cdf = S.cdf && S.cdfFor === P ? S.cdf : null; S.cdfFor = P;
    const det = current(bench, 'det');
    const { g, w, h, dpr } = fitCanvas(scr.canvas);
    g.fillStyle = '#05080F'; g.fillRect(0, 0, w, h);
    const sx = w * 0.04, sw = w * 0.92, sy = h * 0.12, sh = h * 0.76;
    g.fillStyle = '#0D1424'; g.fillRect(sx, sy, sw, sh);
    const [r, gg, b] = rgbOf(P.lam);
    if (det === 'spad') {
      g.fillStyle = `rgb(${r},${gg},${b})`;
      for (const [x, y] of S.photons) g.fillRect(sx + (x + SCREEN_HALF) / (2 * SCREEN_HALF) * sw, sy + sh / 2 + y / 0.03 * sh, 1.5, 1.5);
      nRo.set(String(S.photons.length));
    } else {
      // brightness across, a soft beam profile up and down, and speckle when a still diffuser is the screen
      const img = g.createImageData(Math.max(1, Math.floor(sw * dpr)), Math.max(1, Math.floor(sh * dpr)));
      const W = img.width, H = img.height;
      const grainy = current(bench, 'diff') === 'diffuser' && (!S.spin) && (S.where === 'screen' || S.grain < 100);
      if (grainy && (!speckle || speckle.W !== W || speckle.H !== H)) { speckle = { W, H, d: new Float32Array(W * H) }; for (let i = 0; i < W * H; i++) speckle.d[i] = -Math.log(Math.random() + 1e-9); }
      const spinScreen = S.spin && S.where === 'screen' && current(bench, 'diff') === 'diffuser';
      for (let i = 0; i < W; i++) {
        const k = Math.min(P.I.length - 1, Math.floor(i / W * P.I.length));
        const v = Math.pow(P.I[k] / (P.max || 1), 0.55);
        for (let j = 0; j < H; j++) {
          const yy = (j - H / 2) / (H * 0.28), env = Math.exp(-yy * yy);
          let a = v * env;
          if (grainy && !spinScreen) a *= speckle.d[j * W + i] * 0.9;
          const o = (j * W + i) * 4;
          img.data[o] = Math.min(255, r * a); img.data[o + 1] = Math.min(255, gg * a); img.data[o + 2] = Math.min(255, b * a); img.data[o + 3] = 255;
        }
      }
      g.putImageData(img, Math.round(sx * dpr), Math.round(sy * dpr));
    }
    g.fillStyle = 'rgba(207,224,240,0.8)'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let mm = -60; mm <= 60; mm += 20) g.fillText(`${mm} mm`, sx + (mm / 1000 + SCREEN_HALF) / (2 * SCREEN_HALF) * sw, sy + sh + 4);
    drawTop();
    if (det === 'photodiode') {
      const x = Array.from(P.xs, (v) => v * 1000), y = Array.from(P.I, (v) => v / (P.max || 1));
      plot.xlim = [-60, 60]; plot.ylim = [0, 1.05]; plot.setSeries([{ x, y, color: `rgb(${Math.round(r * 0.7)},${Math.round(gg * 0.6)},${Math.round(b * 0.7)})`, width: 1.8 }]).draw();
    }
    if (det === 'spad' && S.hist) {
      // nothing more: the dots are the data
    }
  }
  function drawTop() {
    const { g, w, h } = fitCanvas(top.canvas);
    g.fillStyle = '#0E1630'; g.fillRect(0, 0, w, h);
    const y = h / 2, xL = w * 0.06, xS = w * 0.46, xScr = w * 0.94;
    const [r, gg, b] = rgbOf(P.lam);
    g.fillStyle = '#22325C'; g.fillRect(xL - 20, y - 8, 30, 16);
    g.strokeStyle = `rgba(${r},${gg},${b},0.9)`; g.lineWidth = 2; g.beginPath(); g.moveTo(xL + 10, y); g.lineTo(xS, y); g.stroke();
    g.strokeStyle = `rgba(${r},${gg},${b},0.35)`; g.lineWidth = 1;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(xS, y); g.lineTo(xScr, y + k * h * 0.12); g.stroke(); }
    g.fillStyle = '#CFE0F0'; g.fillRect(xS - 2, y - h * 0.38, 4, h * 0.3); g.fillRect(xS - 2, y + h * 0.08, 4, h * 0.3);
    g.fillStyle = '#EEF4F8'; g.fillRect(xScr, y - h * 0.4, 6, h * 0.8);
    const diff = current(bench, 'diff') === 'diffuser';
    if (diff) {
      const dx = S.where === 'before' ? (xL + xS) / 2 : S.where === 'after' ? xS + 22 : xScr - 4;
      g.fillStyle = 'rgba(207,224,240,0.75)'; g.fillRect(dx - 3, y - h * 0.3, 6, h * 0.6);
      if (S.spin) { g.strokeStyle = '#00D4FF'; g.beginPath(); g.arc(dx, y - h * 0.38, 6, 0.3, 5.5); g.stroke(); }
    }
    if (current(bench, 'pol') === 'polarizers') {
      g.fillStyle = '#B9A8FF'; g.fillRect(xS + 4, y - h * 0.16, 4, h * 0.1); g.fillStyle = '#FF8FAB'; g.fillRect(xS + 4, y + h * 0.06, 4, h * 0.1);
      if (S.analyzer !== 'none') { g.fillStyle = '#E4DCFF'; g.fillRect(xScr - 14, y - h * 0.3, 4, h * 0.6); }
    }
    g.fillStyle = '#A8ECFF'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('laser', xL - 5, y + 22); g.fillText('slits', xS, h - 6); g.fillText(`screen, ${S.L.toFixed(2)} m on`, xScr - 30, h - 6);
  }
  sync();
  return { show() { anim.start(); recompute(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

bench.tabs = [{ id: 'dark', label: 'Dark room', build: tabDark }];

export default bench;
