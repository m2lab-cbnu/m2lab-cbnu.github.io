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
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { tr, trf } from '../i18n.js';

const NX = 8192, DX = 1.0e-6;          // aperture-plane samples: 8.2 mm at 1 µm
const SCREEN_HALF = 0.06;              // we look at ±6 cm of the screen

const bench = {
  id: 'slit', title: 'Double slit', kicker: '2F · Physics Playground', icon: '⫴', floor: 2,
  blurb: 'Fringes, diffusers, polarizers and single photons.',
  slots: [
    { id: 'laser', label: 'Laser', options: ['laser-red', 'laser-green', 'laser-blue'], def: 'laser-red' },
    { id: 'slits', label: 'Slits', options: ['slit-1', 'slit-2', 'slit-2w', 'slit-3', 'slit-10'], def: 'slit-2' },
    { id: 'diff', label: 'Diffuser', options: ['diff-none', 'diffuser'], def: 'diff-none' },
    { id: 'pol', label: 'Polarizers', options: ['pol-none', 'polarizers'], def: 'pol-none' },
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
  pane.append(el('p', { class: 'vp-intro', html: 'Inside the dark room. Two slits make bright and dark stripes, because light arriving from the two slits adds up in some places and cancels in others. Now try to spoil it: a diffuser in different places, still or spinning, or polarizers that tell you which slit the light came through.' }));
  const scr = canvasBox('is-dark', '16 / 7', 'The screen at the back of the dark room');
  const top = canvasBox('', '16 / 4', 'The set-up seen from above');
  const prof = canvasBox('', '16 / 6', 'Brightness across the screen');
  const plot = new Plot(prof.canvas, { xlabel: 'Position on the screen (mm)', ylabel: 'Brightness' });
  const Ls = slider({ label: 'Slits to screen', unit: 'm', min: 0.5, max: 3, step: 0.01, value: S.L, digits: 3, onInput: (v) => { S.L = v; recompute(); } });
  const where = segmented({ label: 'Where the diffuser goes', options: [{ value: 'before', label: 'Before the slits' }, { value: 'after', label: 'After the slits' }, { value: 'screen', label: 'As the screen' }], value: S.where, onChange: (v) => { S.where = v; recompute(); } });
  const spin = checkbox({ label: 'Spin the diffuser', checked: S.spin, onChange: (v) => { S.spin = v; recompute(); } });
  const grain = segmented({ label: 'Diffuser grain', options: [{ value: 12, label: 'Fine (12 µm)' }, { value: 400, label: 'Coarse (0.4 mm)' }], value: S.grain, onChange: (v) => { S.grain = +v; recompute(); } });
  const polm = segmented({ label: 'Polarizers on the slits', options: [{ value: 'same', label: 'Same direction' }, { value: 'cross', label: 'Crossed' }], value: S.polMode, onChange: (v) => { S.polMode = v; recompute(); } });
  const ana = segmented({ label: 'Third polarizer, in front of the screen', options: [{ value: 'none', label: 'None' }, { value: 'plus', label: 'At +45°' }, { value: 'minus', label: 'At −45°' }], value: S.analyzer, onChange: (v) => { S.analyzer = v; recompute(); } });
  const rate = slider({ label: 'Laser power (photons per second)', unit: '', min: 10, max: 3000, step: 10, value: S.rate, log: true, digits: 4, onInput: (v) => { S.rate = v; } });
  const clr = button('Clear the photon count', () => { S.photons = []; S.hist = null; }, 'quiet');
  const dGrp = group('Diffuser', where, spin, grain), pGrp = group('Polarizers', polm, ana), sGrp = group('Single photons', rate, clr);
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

// ---------------------------------------------------------------- the hands-on stage
// The dark room from above, with the light drawn as a wave thousands of times bigger than real,
// and the screen from the front beside it. The ripples are a true wave sum from points across
// each open slit, and the screen shows the average brightness of that same sum, so the room and
// the screen always agree. (The Measure tab has the real sizes.)
function tabPlay(pane) {
  const covered = new Set();
  const dots = [], flights = [], sparks = [], hist = new Float32Array(100);
  let dMul = 1, lamOver = null, aimY = null, sweep = null, wobble = null, streaming = false, auto = false, holding = 0, acc = 0, lastTick = 0;
  let F = null, Lg = null, anim = null, pending = null, first = true, hoverSlit = -1, grab = null, lastSlit = current(bench, 'slits');
  const OMEGA = 1.1, T1 = 0.6, T2 = 0.85, RATE = 260;

  const st = new Stage(pane, {
    bench, npc: 'pip',
    label: 'The dark room from above: a laser on the left, a plate with slits, and a screen on the right. The strip beside it is the screen seen from the front.',
    hello: 'Here the light is drawn as a **wave**, thousands of times bigger than real. **Click a slit** to cover it, **drag a slit** to move them apart, or **tap the laser** to send single photons.',
    aspect: 16 / 9, phoneAspect: 0.8, minH: 320,
    onReset: () => { fresh(); first = true; },
    onTap: (x, y) => { if (Lg && st.on('paths') && x > Lg.xp && y > Lg.ry0 && y < Lg.ry1) { aimY = y; sweep = null; } },
    keys: { arrow: (dx, dy) => { if (dy) setMul(dMul * (dy < 0 ? 1.06 : 1 / 1.06)); }, action: () => fire(true) },
  });
  st.tool('waves', 'Waves', { icon: '#FF5A5A', on: true, title: 'Show the light as moving waves. Off: where the light goes, on average.' })
    .tool('paths', 'Path difference', { icon: '#FFE07A', onChange: (v) => { if (v) { aimY = null; sweep = null; } } })
    .tool('dirs', 'Bright directions', { icon: '#9BE3C1' })
    .tool('profile', 'Brightness curve', { icon: K.COL.ke })
    .tool('photons', 'One photon at a time', { icon: '#C9BCFF', onChange: (v) => { clearDots(); streaming = false; if (!v) auto = false; else if (st.mode === 'play') st.hint('Tap the laser for one photon. Hold it down for a stream.'); syncCtl(); } });
  st.readout('lam', 'Light').readout('d', 'Slits').readout('sp', 'Stripes on the real screen').readout('n', 'Photons caught');

  // ---------- controls in the guide card
  const wipe = el('button', { type: 'button', class: 'stg-act ghost', text: 'Wipe the screen' });
  wipe.addEventListener('click', () => { clearDots(); sound.play('pop'); });
  const polBtn = el('button', { type: 'button', class: 'stg-act ghost' }), anaBtn = el('button', { type: 'button', class: 'stg-act ghost' });
  polBtn.addEventListener('click', () => { S.polMode = S.polMode === 'cross' ? 'same' : 'cross'; polChanged(); });
  anaBtn.addEventListener('click', () => { S.analyzer = S.analyzer === 'none' ? 'plus' : S.analyzer === 'plus' ? 'minus' : 'none'; polChanged(); });
  const polRow = el('div', { class: 'stg-row' }, polBtn, anaBtn);
  st.controls(wipe, polRow);
  function polChanged() {
    sound.play('click'); clearDots(); syncCtl();
    const two = phys(bench, 'slits').n === 2 && !covered.size && current(bench, 'diff') === 'diff-none';
    if (two && S.polMode === 'cross' && S.analyzer === 'none') S.sawCrossed = true;
    if (two && S.polMode === 'cross' && S.analyzer !== 'none' && S.sawCrossed) rig.note({ bench: 'slit', eraser: true });
    if (st.mode !== 'play') return;
    if (S.polMode === 'cross' && S.analyzer === 'none') st.say('The films are **crossed**: light from one slit is polarized up and down (bright ripples), from the other side to side (pale ripples). Such waves cannot cancel each other, and the light now carries a mark of **which slit** it came through. The stripes are gone.');
    else if (S.polMode === 'cross') st.say('The **third film** lets through only light at 45°, a share of each kind. After it, nobody can tell which slit the light came from… and the stripes **come back**. This is the idea behind the quantum eraser.');
    else st.say('Both films point **the same way**, so the light from the two slits can still add up and cancel: stripes, a little dimmer.');
  }
  function syncCtl() {
    wipe.hidden = !st.on('photons');
    polRow.hidden = current(bench, 'pol') !== 'polarizers';
    polBtn.textContent = S.polMode === 'cross' ? 'Slit films: crossed' : 'Slit films: same way';
    anaBtn.textContent = S.analyzer === 'none' ? 'Third film: none' : S.analyzer === 'plus' ? 'Third film: +45°' : 'Third film: −45°';
  }
  onRig(bench, (ev) => {
    const sid = current(bench, 'slits');
    if (sid !== lastSlit) { lastSlit = sid; covered.clear(); if (!anim) dMul = 1; }
    if (ev && ev.slot === 'det') { const det = current(bench, 'det'); if (det === 'spad') st.setTool('photons', true); if (det === 'photodiode') st.setTool('profile', true); }
    if (ev && ev.slot === 'diff' && current(bench, 'diff') === 'diffuser') st.hint('The diffuser works in the Measure tab. In here the light stays clean.');
    syncCtl();
  });

  // ---------- colours
  const RGB = [[450e-9, [105, 160, 255]], [532e-9, [70, 255, 120]], [650e-9, [255, 60, 70]]];
  function colourOf(lam) {
    if (lam <= RGB[0][0]) return RGB[0][1];
    for (let i = 1; i < RGB.length; i++) if (lam <= RGB[i][0]) { const [l0, c0] = RGB[i - 1], [l1, c1] = RGB[i], f = (lam - l0) / (l1 - l0); return c0.map((v, k) => Math.round(v + (c1[k] - v) * f)); }
    return RGB[RGB.length - 1][1];
  }
  const hexOf = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  const nameOf = (lam) => (lam > 590e-9 ? 'red' : lam > 495e-9 ? 'green' : 'blue');

  // ---------- layout and model
  st.onResize((w, h, narrow) => {
    const stripW = Math.round(Math.max(58, Math.min(150, w * (narrow ? 0.2 : 0.16))));
    const rx0 = 8, rx1 = w - stripW - 26, ry0 = 8, ry1 = h - 8;
    const lamR = Math.max(10, Math.min(20, (ry1 - ry0) / 26, (rx1 - rx0) / 30));
    Lg = { w, h, narrow, rx0, rx1, ry0, ry1, sx0: rx1 + 18, sx1: w - 8, mid: Math.round((ry0 + ry1) / 2), xp: Math.round(rx0 + (rx1 - rx0) * 0.25), xs: rx1 - 3, lamR, laserX: rx0 + 6, laserW: narrow ? 30 : 40 };
  });
  function model() {
    const L = Lg, sl = phys(bench, 'slits'), lam = lamOver || phys(bench, 'laser').lambda;
    // drawing px per metre along the plate; the grating is drawn with shorter waves, so ten slits fit
    const n = sl.n, lamR = n >= 6 ? L.lamR * 0.6 : L.lamR, perM = (n >= 6 ? 2.9 : 6) * lamR / 250e-6;
    const lamPx = lamR * lam / 650e-9, room = L.ry1 - L.ry0;
    const dBase = (sl.d || 250e-6) * perM;
    let dPx = dBase * dMul;
    if (n > 1) dPx = Math.min(dPx, room * 0.84 / (n - 1));
    const aPx = Math.max(lamPx * 0.35, sl.a * perM);
    const ys = Array.from({ length: n }, (_, j) => L.mid + (j - (n - 1) / 2) * dPx);
    const polOn = current(bench, 'pol') === 'polarizers', cross = polOn && S.polMode === 'cross', ana = polOn && S.analyzer !== 'none';
    // which way each slit's light is polarised: channel 0 or 1; the third film folds both into one
    const chan = ys.map((_, j) => ((!cross || j % 2 === 0) ? [0, 1] : ana ? [0, S.analyzer === 'plus' ? 1 : -1] : [1, 1]));
    return { n, lam, lamPx, dPx, dBase, aPx, ys, chan, scale: ana ? Math.SQRT1_2 : 1, polOn, cross, ana, open: ys.map((_, j) => !covered.has(j)), dReal: n > 1 ? sl.d * dPx / dBase : 0 };
  }
  // the gap that sets the stripe spacing: the common step between the open slits
  // (only light polarised the same way can add up or cancel, so each polarisation counts on its own)
  function gapOf(m) {
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    let best = 0;
    for (const c of [0, 1]) {
      const idx = m.open.map((o, j) => (o && m.chan[j][0] === c ? j : -1)).filter((j) => j >= 0);
      let g0 = 0; for (let i = 1; i < idx.length; i++) g0 = gcd(g0, idx[i] - idx[i - 1]);
      if (g0 && (!best || g0 < best)) best = g0;
    }
    return best;
  }
  function build() {
    const L = Lg, m = model();
    const shape = [m.lamPx.toFixed(3), m.dPx.toFixed(2), m.aPx.toFixed(2), m.open.join(''), m.chan.join(';'), m.scale].join('|');
    const key = `${L.w}|${L.h}|${shape}`;
    if (F && F.key === key) return F;
    if (F && dots.length && F.shape !== shape) clearDots();     // old dots would not match the new set-up
    // about six cells to a wave, so short blue waves stay smooth, but never too many cells
    let cell = Math.max(1.8, Math.min(4, m.lamPx / 6));
    if ((L.rx1 - L.rx0) * (L.ry1 - L.ry0) / (cell * cell) > 90000) cell = Math.sqrt((L.rx1 - L.rx0) * (L.ry1 - L.ry0) / 90000);
    const nx = Math.ceil((L.rx1 - L.rx0) / cell), ny = Math.ceil((L.ry1 - L.ry0) / cell), N = nx * ny;
    const lp = m.lamPx, k = 2 * Math.PI / lp;
    const per = Math.max(2, Math.ceil(m.aPx / (lp * 0.45)));
    const src = [];
    m.ys.forEach((yc, j) => { if (m.open[j]) for (let q = 0; q < per; q++) src.push([yc - m.aPx / 2 + (q + 0.5) * m.aPx / per, m.chan[j][0], m.chan[j][1] * m.scale / per]); });
    const nOpen = m.open.filter(Boolean).length;
    const ax = new Float32Array(N), bx = new Float32Array(N), ay = new Float32Array(N), by = new Float32Array(N);
    const beamHalf = Math.min((L.ry1 - L.ry0) * 0.46, (m.n - 1) * m.dPx / 2 + m.aPx / 2 + 1.6 * lp);
    const xStart = L.laserX + L.laserW;
    let two = false;
    for (let j = 0; j < ny; j++) {
      const y = L.ry0 + (j + 0.5) * cell, eb = Math.exp(-Math.pow((y - L.mid) / beamHalf, 6));
      for (let i = 0; i < nx; i++) {
        const x = L.rx0 + (i + 0.5) * cell, o = j * nx + i;
        if (x < L.xp) {
          // the laser beam: straight wavefronts, phase zero at the plate
          if (x < xStart || eb < 1e-3) continue;
          const ph = k * (x - L.xp);
          ax[o] = eb * Math.cos(ph); bx[o] = eb * Math.sin(ph);
          continue;
        }
        let r0 = 0, i0 = 0, r1 = 0, i1 = 0;
        for (let s = 0; s < src.length; s++) {
          const q = src[s], r = Math.hypot(x - L.xp, y - q[0]), a = q[2] / Math.sqrt(r / lp + 0.35), ph = k * r;
          if (q[1] === 0) { r0 += a * Math.cos(ph); i0 += a * Math.sin(ph); } else { r1 += a * Math.cos(ph); i1 += a * Math.sin(ph); }
        }
        // undo the thinning with distance, so far ripples are as easy to see as near ones
        const nrm = nOpen ? Math.sqrt(Math.hypot(x - L.xp, y - L.mid) / lp + 0.35) / nOpen : 0;
        ax[o] = r0 * nrm; bx[o] = i0 * nrm; ay[o] = r1 * nrm; by[o] = i1 * nrm;
        if (r1 || i1) two = true;
      }
    }
    // average brightness along the screen, 1 = every slit open and adding up. Each spot on the screen
    // is reached along one direction from the slits (the far-field picture, as in a real dark room,
    // where the screen is a thousand slit gaps away)
    const nyS = Math.ceil((L.ry1 - L.ry0) / 1.5), I = new Float32Array(nyS), D = L.xs - L.xp;
    for (let j = 0; j < nyS; j++) {
      const th = Math.atan2(L.ry0 + (j + 0.5) * (L.ry1 - L.ry0) / nyS - L.mid, D), sn = Math.sin(th), cs = Math.cos(th);
      let r0 = 0, i0 = 0, r1 = 0, i1 = 0;
      for (const q of src) {
        const ph = -k * (q[0] - L.mid) * sn;
        if (q[1] === 0) { r0 += q[2] * Math.cos(ph); i0 += q[2] * Math.sin(ph); } else { r1 += q[2] * Math.cos(ph); i1 += q[2] * Math.sin(ph); }
      }
      I[j] = (r0 * r0 + i0 * i0 + r1 * r1 + i1 * i1) * cs * ((1 + cs) / 2) ** 2 / (m.n * m.n);
    }
    let Imax = 0; for (const v of I) Imax = Math.max(Imax, v);
    F = { key, shape, m, nx, ny, cell, ax, bx, ay, by, two, I, nyS, Imax, beamHalf, cdf: null };
    const g0 = gapOf(m);
    st.describe(trf('Top view of the double slit: {0} of {1} slits open, {2} light. The screen shows {3}.', nOpen, m.n, tr(nameOf(m.lam)), tr(g0 ? 'bright and dark stripes' : nOpen ? 'one soft patch of light' : 'nothing')));
    return F;
  }

  // ---------- photons
  function sample(F0) {
    if (!F0.cdf) { const c = new Float64Array(F0.nyS); let s = 0; for (let j = 0; j < F0.nyS; j++) { s += F0.I[j]; c[j] = s; } F0.cdf = c; }
    const tot = F0.cdf[F0.nyS - 1]; if (!(tot > 1e-9)) return null;
    const u = Math.random() * tot; let lo = 0, hi = F0.nyS - 1;
    while (lo < hi) { const md = (lo + hi) >> 1; if (F0.cdf[md] < u) lo = md + 1; else hi = md; }
    return (lo + Math.random()) / F0.nyS;
  }
  function land(f) {
    dots.push([f, Math.max(0.05, Math.min(0.95, 0.5 + gauss() * 0.17))]);
    if (dots.length > 9000) dots.shift();
    hist[Math.min(hist.length - 1, Math.floor(f * hist.length))]++;
  }
  function clearDots() { dots.length = 0; flights.length = 0; hist.fill(0); acc = 0; }
  function fire(animated) {
    first = false;
    if (!st.on('photons')) st.setTool('photons', true);
    const f = sample(build());
    if (f === null) { st.flash('Every slit is covered!', { tone: 'bad' }); return; }
    if (animated) { flights.push({ t0: st.simT, f, done: false }); sound.play('laser'); } else land(f);
  }
  const setMul = (v) => { dMul = Math.max(0.4, Math.min(2.4, v)); first = false; };
  const ensureTwo = () => { if (phys(bench, 'slits').n !== 2) rig.mount(bench.id, 'slits', 'slit-2', 'challenge'); };
  function fresh() { covered.clear(); dMul = 1; lamOver = null; anim = null; pending = null; wobble = null; sweep = null; auto = false; streaming = false; clearDots(); }

  // ---------- time
  st.onStep((sdt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const a = anim; anim = null; if (a.then) a.then(); }
    }
    if (wobble !== null) dMul = 1 + 0.5 * Math.sin((st.simT - wobble) * 1.1);
    if (sweep !== null && Lg) aimY = Lg.mid + (Lg.ry1 - Lg.ry0) * 0.38 * Math.sin((st.simT - sweep) * 0.45);
    if (holding && !streaming && st.t - holding > 0.35) streaming = true;
    if ((streaming || auto) && sdt > 0 && Lg) {
      const F0 = build();
      acc += sdt * RATE;
      while (acc >= 1) { acc -= 1; const f = sample(F0); if (f === null) { acc = 0; break; } land(f); }
      if (st.t - lastTick > 0.07) { sound.play('photon', { vol: 0.3 }); lastTick = st.t; }
    }
    for (const fl of flights) if (!fl.done && st.simT - fl.t0 >= T1 + T2) { fl.done = true; land(fl.f); sparks.push([fl.f, st.t]); sound.play('photon'); }
    while (flights.length && flights[0].done) flights.shift();
    while (sparks.length && st.t - sparks[0][1] > 0.6) sparks.shift();
    if (pending && pending.cond()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- drawing
  let fcv = null, fimg = null;
  function paintRoom(g, F0) {
    const L = Lg, m = F0.m;
    if (!fcv || fcv.width !== F0.nx || fcv.height !== F0.ny) { fcv = document.createElement('canvas'); fcv.width = F0.nx; fcv.height = F0.ny; fimg = fcv.getContext('2d').createImageData(F0.nx, F0.ny); }
    const d = fimg.data, [cr, cg, cb] = colourOf(m.lam);
    const tr = (cr + 2 * 255) / 3, tg = (cg + 2 * 255) / 3, tb = (cb + 2 * 255) / 3;    // paler: light polarised the other way
    const wt = st.simT * 2 * Math.PI * OMEGA, c = Math.cos(wt), s = Math.sin(wt), waves = st.on('waves');
    for (let o = 0, N = F0.nx * F0.ny; o < N; o++) {
      let R = 11, G = 22, B = 48;
      if (waves) {
        const v = F0.ax[o] * c + F0.bx[o] * s;
        if (v > 0) { const q = v > 1 ? 1 : Math.pow(v, 0.85); R += (cr - R) * q; G += (cg - G) * q; B += (cb - B) * q; }
        else { const q = v < -1 ? 0.55 : 1 + 0.45 * v; R *= q; G *= q; B *= q; }
        if (F0.two) { const u = F0.ay[o] * c + F0.by[o] * s; if (u > 0) { const q = (u > 1 ? 1 : Math.pow(u, 0.85)) * 0.85; R += (tr - R) * q; G += (tg - G) * q; B += (tb - B) * q; } }
      } else {
        const I = F0.ax[o] * F0.ax[o] + F0.bx[o] * F0.bx[o] + F0.ay[o] * F0.ay[o] + F0.by[o] * F0.by[o];
        const q = (I >= 1 ? 1 : Math.pow(I, 0.6)) * 0.9;
        R += (cr - R) * q; G += (cg - G) * q; B += (cb - B) * q;
      }
      const p = o * 4; d[p] = R; d[p + 1] = G; d[p + 2] = B; d[p + 3] = 255;
    }
    fcv.getContext('2d').putImageData(fimg, 0, 0);
    g.save();
    K.rr(g, L.rx0, L.ry0, L.rx1 - L.rx0, L.ry1 - L.ry0, 10); g.clip();
    g.fillStyle = '#0B1630'; g.fillRect(L.rx0, L.ry0, L.rx1 - L.rx0, L.ry1 - L.ry0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(fcv, L.rx0, L.ry0, F0.nx * F0.cell, F0.ny * F0.cell);
    g.restore();
  }
  function paintDirs(g, F0) {
    const L = Lg, m = F0.m, g0 = gapOf(m);
    if (!g0) return;
    const dEff = g0 * m.dPx, open = m.ys.filter((_, j) => m.open[j]), yc = (open[0] + open[open.length - 1]) / 2, D = L.xs - L.xp;
    g.save(); K.rr(g, L.rx0, L.ry0, L.rx1 - L.rx0, L.ry1 - L.ry0, 10); g.clip();
    const labelled = [];
    for (let q = -12; q <= 12; q++) {
      const sn = q * m.lamPx / dEff; if (Math.abs(sn) >= 0.97) continue;
      const y1 = yc + D * Math.tan(Math.asin(sn));
      if (y1 < L.ry0 - 40 || y1 > L.ry1 + 40) continue;
      K.lineSeg(g, L.xp, yc, L.xs, y1, 'rgba(155,227,193,0.85)', 1.8, [6, 6]);
      if (y1 > L.ry0 + 10 && y1 < L.ry1 - 10 && labelled.every((y) => Math.abs(y - y1) > (L.narrow ? 17 : 21))) {
        labelled.push(y1);
        const lab = q === 0 ? (L.narrow ? '0' : 'same distance') : L.narrow ? String(Math.abs(q)) : `${Math.abs(q)} wave${Math.abs(q) > 1 ? 's' : ''} longer`;
        K.tag(g, lab, L.xs - 10, y1, { align: 'right', size: 10.5, bg: '#E6FBF1', pad: 4 });
      }
    }
    g.restore();
  }
  function defaultAim(m) {
    const L = Lg, g0 = gapOf(m), D = L.xs - L.xp;
    if (g0) { const sn = m.lamPx / (g0 * m.dPx); if (sn < 0.9) { const y = L.mid + D * Math.tan(Math.asin(sn)); if (y < L.ry1 - 20) return y; } }
    return L.mid + (L.ry1 - L.ry0) * 0.2;
  }
  function paintPaths(g, F0) {
    const L = Lg, m = F0.m;
    const open = m.ys.filter((_, j) => m.open[j]);
    if (open.length < 2) { K.tag(g, 'Open two slits to compare their paths', (L.xp + L.xs) / 2, L.ry0 + 22, { size: 12 }); return null; }
    const jo = m.ys.map((_, j) => j).filter((j) => m.open[j]), same = m.chan[jo[0]][0] === m.chan[jo[1]][0];
    const A = open[0], B = open[1], yT = aimY === null ? defaultAim(m) : aimY, lp = m.lamPx;
    const rA = Math.hypot(L.xs - L.xp, yT - A), rB = Math.hypot(L.xs - L.xp, yT - B);
    const ph = ((st.simT * OMEGA) % 1 + 1) % 1;
    for (const [y0, col, r] of [[A, '#FFE07A', rA], [B, '#9BE3C1', rB]]) {
      K.lineSeg(g, L.xp, y0, L.xs, yT, col, 2.6);
      const ux = (L.xs - L.xp) / r, uy = (yT - y0) / r;
      // a dot on every crest travelling along this path
      g.fillStyle = col; g.strokeStyle = K.LINE; g.lineWidth = 1.2;
      for (let q = ph * lp; q < r; q += lp) { g.beginPath(); g.arc(L.xp + ux * q, y0 + uy * q, 3.6, 0, Math.PI * 2); g.fill(); g.stroke(); }
    }
    g.beginPath(); g.arc(L.xs, yT, 7, 0, Math.PI * 2); g.strokeStyle = '#FFFFFF'; g.lineWidth = 2.5; g.stroke();
    const dw = (rB - rA) / lp, e = Math.abs(dw - Math.round(dw));
    const nar = L.narrow;
    const verdict = !same ? (nar ? 'no canceling' : 'polarized differently: they cannot cancel') : e < 0.15 ? (nar ? 'bright' : 'crests arrive together: bright') : e > 0.35 ? (nar ? 'dark' : 'crest meets trough: dark') : (nar ? 'dim' : 'partly cancel: dim');
    const x0 = L.xp + (nar ? 12 : 24), y0 = L.ry0 + (nar ? 34 : 20), sz = nar ? 10 : 12;
    K.tag(g, `${nar ? 'yellow' : 'yellow path'}: ${(rA / lp).toFixed(2)} waves`, x0, y0, { align: 'left', size: sz, bg: '#FFF4C7' });
    K.tag(g, `${nar ? 'green' : 'green path'}: ${(rB / lp).toFixed(2)} waves`, x0, y0 + sz + 12, { align: 'left', size: sz, bg: '#E6FBF1' });
    K.tag(g, `difference ${Math.abs(dw).toFixed(2)}: ${verdict}`, x0, y0 + 2 * (sz + 12), { align: 'left', size: sz, bg: !same ? '#DCD3FF' : e < 0.15 ? '#FFE07A' : e > 0.35 ? '#C9D6F2' : '#FFFDF6', weight: 700 });
    return yT;
  }
  function paintFlights(g, F0) {
    const L = Lg, m = F0.m, x0 = L.laserX + L.laserW, bh = F0.beamHalf;
    g.save(); K.rr(g, L.rx0, L.ry0, L.rx1 - L.rx0, L.ry1 - L.ry0, 10); g.clip();
    for (const fl of flights) {
      const age = st.simT - fl.t0;
      if (age < T1) {
        // the photon's wave: a short burst of crests spread across the whole beam...
        const x = x0 + (L.xp - x0) * age / T1;
        for (let q = -2; q <= 2; q++) { g.globalAlpha = Math.exp(-q * q / 2) * 0.95; g.fillStyle = '#FFFFFF'; g.fillRect(x + q * m.lamPx - 1.5, L.mid - bh, 3, 2 * bh); }
        g.globalAlpha = 1;
      } else {
        // ...which leaves through every open slit at once
        const r = (age - T1) / T2 * (L.xs - L.xp) * 1.03;
        g.lineWidth = 3;
        m.ys.forEach((y, j) => {
          if (!m.open[j]) return;
          g.beginPath(); g.arc(L.xp, y, Math.max(1, r), -Math.PI / 2, Math.PI / 2);
          g.strokeStyle = K.hexA('#FFFFFF', 0.9 - 0.45 * r / (L.xs - L.xp)); g.stroke();
        });
      }
    }
    g.restore();
  }
  function paintKit(g, F0) {
    const L = Lg, m = F0.m, col = hexOf(colourOf(m.lam));
    // the laser
    const bh = Math.max(14, F0.beamHalf), ly = L.mid - bh - 6, lh = 2 * bh + 12;
    K.box(g, L.laserX, ly, L.laserW, lh, K.MAT.navy, { r: 6 });
    g.fillStyle = col; g.fillRect(L.laserX + L.laserW - 5, L.mid - bh, 3, 2 * bh);
    K.glow(g, L.laserX + L.laserW, L.mid, Math.min(60, bh), col, 0.5);
    if (st.hovering('laser')) K.glow(g, L.laserX + L.laserW / 2, L.mid, bh + 20, '#FFFFFF', 0.3);
    K.text(g, 'laser', L.laserX + L.laserW / 2, Math.min(L.ry1 - 8, ly + lh + 16), { size: 11, weight: 600, align: 'center', color: '#A8ECFF', halo: '#0B1630' });
    // the plate, with a gap for every slit
    const half = m.aPx / 2;
    let y0 = L.ry0 + 1;
    for (const y of m.ys) { if (y - half > y0) K.box(g, L.xp - 4, y0, 8, y - half - y0, K.MAT.steel, { r: 2, lw: 1.5, bands: false }); y0 = y + half; }
    if (L.ry1 - 1 > y0) K.box(g, L.xp - 4, y0, 8, L.ry1 - 1 - y0, K.MAT.steel, { r: 2, lw: 1.5, bands: false });
    m.ys.forEach((y, j) => {
      if (!m.open[j]) K.box(g, L.xp - 10, y - half - 6, 13, 2 * half + 12, K.MAT.orange, { r: 3, lw: 1.5 });
      if ((hoverSlit === j && st.hovering('slit')) || (grab && grab.j === j)) K.glow(g, L.xp, y, 24, '#FFFFFF', 0.55);
      if (m.polOn && m.open[j]) K.tag(g, m.cross && j % 2 ? '↔' : '↕', L.xp + 14, y, { size: 11, bg: '#DCD3FF', pad: 3 });
    });
    // the screen, edge on, and the third film in front of it
    if (m.ana) { K.box(g, L.xs - 16, L.ry0 + 6, 6, L.ry1 - L.ry0 - 12, K.MAT.violet, { r: 2, lw: 1.2, bands: false }); K.tag(g, S.analyzer === 'plus' ? '+45°' : '−45°', L.xs - 22, L.ry1 - 22, { align: 'right', size: 10.5, bg: '#DCD3FF' }); }
    K.box(g, L.xs - 2, L.ry0 + 2, 6, L.ry1 - L.ry0 - 4, K.MAT.white, { r: 2, lw: 1.5, bands: false });
    K.tag(g, 'slits', L.xp, L.ry0 + 14, { size: 10.5, pad: 4 });
    K.tag(g, 'screen', L.xs - 6, L.ry0 + 14, { size: 10.5, pad: 4, align: 'right' });
    if (!L.narrow) K.text(g, 'not to scale: real light waves are thousands of times smaller', L.xp + 12, L.ry1 - 10, { size: 10.5, weight: 600, color: '#A8ECFF', halo: '#0B1630' });
  }
  function paintScreen(g, F0, yAim) {
    const L = Lg, m = F0.m, [cr, cg, cb] = colourOf(m.lam), W = L.sx1 - L.sx0, H = L.ry1 - L.ry0;
    K.box(g, L.sx0 - 5, L.ry0 - 5, W + 10, H + 10, K.MAT.navy, { r: 10, bands: false });
    g.save(); g.beginPath(); g.rect(L.sx0, L.ry0, W, H); g.clip();
    g.fillStyle = '#0E1A33'; g.fillRect(L.sx0, L.ry0, W, H);
    if (!st.on('photons')) {
      if (!F0.strip) {
        const c = document.createElement('canvas'); c.width = 1; c.height = F0.nyS;
        const cx = c.getContext('2d'), id = cx.createImageData(1, F0.nyS);
        for (let j = 0; j < F0.nyS; j++) { const a = Math.min(1, Math.pow(F0.I[j], 0.55)); id.data[j * 4] = 14 + (cr - 14) * a; id.data[j * 4 + 1] = 26 + (cg - 26) * a; id.data[j * 4 + 2] = 51 + (cb - 51) * a; id.data[j * 4 + 3] = 255; }
        cx.putImageData(id, 0, 0); F0.strip = c;
      }
      g.imageSmoothingEnabled = true; g.drawImage(F0.strip, L.sx0, L.ry0, W, H);
      const gr = g.createLinearGradient(L.sx0, 0, L.sx1, 0);
      gr.addColorStop(0, 'rgba(14,26,51,0.9)'); gr.addColorStop(0.28, 'rgba(14,26,51,0)'); gr.addColorStop(0.72, 'rgba(14,26,51,0)'); gr.addColorStop(1, 'rgba(14,26,51,0.9)');
      g.fillStyle = gr; g.fillRect(L.sx0, L.ry0, W, H);
    } else {
      g.fillStyle = `rgb(${cr},${cg},${cb})`;
      for (const [f, u] of dots) g.fillRect(L.sx0 + u * W - 1.3, L.ry0 + f * H - 1.3, 2.6, 2.6);
    }
    if (st.on('profile')) {
      const mx = Math.max(1e-6, F0.Imax);
      if (st.on('photons') && dots.length) {
        let hm = 1; for (const c of hist) hm = Math.max(hm, c);
        g.fillStyle = 'rgba(201,188,255,0.42)';
        for (let i = 0; i < hist.length; i++) g.fillRect(L.sx0, L.ry0 + i * H / hist.length, hist[i] / hm * (W - 8), H / hist.length - 0.6);
      }
      g.beginPath();
      for (let j = 0; j < F0.nyS; j++) { const x = L.sx0 + 4 + (F0.I[j] / mx) * (W - 10), y = L.ry0 + (j + 0.5) * H / F0.nyS; if (j) g.lineTo(x, y); else g.moveTo(x, y); }
      g.strokeStyle = '#FFE07A'; g.lineWidth = 2; g.stroke();
    }
    if (yAim !== null && yAim !== undefined) K.lineSeg(g, L.sx0, yAim, L.sx1, yAim, '#FFFFFF', 1.6, [5, 4]);
    for (const [f, t0] of sparks) K.glow(g, L.sx0 + W / 2, L.ry0 + f * H, 26, '#FFFFFF', 0.8 * (1 - (st.t - t0) / 0.6));
    g.restore();
    for (const [f, t0] of sparks) K.glow(g, L.xs, L.ry0 + f * H, 22, '#FFFFFF', 0.9 * (1 - (st.t - t0) / 0.6));
    if (st.on('photons')) K.tag(g, `${dots.length}`, L.sx0 + W / 2, L.ry1 - 14, { size: 10.5, pad: 4 });
    else K.text(g, L.narrow ? 'front' : 'screen, front view', L.sx0 + W / 2, L.ry1 - 8, { size: 10, weight: 600, align: 'center', color: '#A8ECFF', halo: '#0E1A33' });
  }

  st.onDraw((g, w, h, t) => {
    if (!Lg) return;
    const F0 = build();
    g.fillStyle = '#14213F'; g.fillRect(0, 0, w, h);
    paintRoom(g, F0);
    if (st.on('dirs')) paintDirs(g, F0);
    const yAim = st.on('paths') ? paintPaths(g, F0) : null;
    paintFlights(g, F0);
    paintKit(g, F0);
    paintScreen(g, F0, yAim);
    g.save(); K.rr(g, Lg.rx0, Lg.ry0, Lg.rx1 - Lg.rx0, Lg.ry1 - Lg.ry0, 10); g.strokeStyle = '#2C4475'; g.lineWidth = 2; g.stroke(); g.restore();
    if (first && st.mode === 'play' && F0.m.n > 1) {
      const y = F0.m.ys[0], k = (Math.sin(t * 4) + 1) / 2;
      K.arrow(g, Lg.xp + 80 + k * 8, y - 64 - k * 6, Lg.xp + 12, y - 8, K.COL.normal, { lw: 3.5, head: 11 });
      K.tag(g, 'click or drag a slit', Lg.xp + 84 + k * 8, y - 76 - k * 6, { size: 11.5, align: 'left' });
    }
    // readouts
    const m = F0.m, g0 = gapOf(m), nOpen = m.open.filter(Boolean).length;
    st.set('lam', trf('{0}, {1} nm', tr(nameOf(m.lam)), (m.lam * 1e9).toFixed(0)));
    st.set('d', m.n === 1 ? 'one slit' : `${nOpen} of ${m.n} open, ${(m.dReal * 1000).toFixed(2)} mm apart`);
    st.set('sp', g0 ? `${(m.lam * S.L / (g0 * m.dReal) * 1000).toFixed(2)} mm apart` : nOpen ? 'no stripes' : 'all dark');
    st.set('n', String(dots.length));
    st.showReadout('n', st.on('photons'));
  });

  // ---------- hands
  st.handle({
    id: 'slit', cursor: 'ns-resize',
    hit: (x, y) => {
      if (!Lg || Math.abs(x - Lg.xp) > 18) return false;
      const m = build().m; let best = -1, bd = Infinity;
      m.ys.forEach((yy, j) => { const d = Math.abs(y - yy); if (d < bd) { bd = d; best = j; } });
      if (best < 0 || bd > Math.max(14, m.aPx / 2 + 8)) return false;
      hoverSlit = best; return bd;
    },
    down: () => { const m = build().m; grab = { j: hoverSlit, off: hoverSlit - (m.n - 1) / 2, base: m.dBase }; first = false; },
    move: (x, y) => { if (!grab || !grab.off) return; setMul((y - Lg.mid) / grab.off / grab.base); },
    up: () => { grab = null; },
    click: () => { const j = grab ? grab.j : hoverSlit; grab = null; if (j < 0) return; first = false; if (covered.has(j)) covered.delete(j); else covered.add(j); sound.play('click'); },
  });
  st.handle({
    id: 'laser', cursor: 'pointer',
    hit: (x, y) => { if (!Lg || !F) return false; const bh = Math.max(14, F.beamHalf); return x > Lg.laserX - 4 && x < Lg.laserX + Lg.laserW + 6 && Math.abs(y - Lg.mid) < bh + 10 ? 1 : false; },
    down: () => { fire(true); holding = st.t; },
    up: () => { holding = 0; streaming = false; },
    click: () => { holding = 0; streaming = false; },
  });
  st.cv.addEventListener('pointermove', (e) => {
    if (!Lg || !st.on('paths') || st.drag || st.mode === 'tour') return;
    const r = st.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x > Lg.xp && x < Lg.sx1 && y > Lg.ry0 && y < Lg.ry1) { aimY = y; sweep = null; }
  });

  // ---------- why it happens
  const slitAt = (j) => { const m = build().m; return [Lg.xp, m.ys[Math.min(j, m.n - 1)]]; };
  st.tour({
    title: 'Where do the stripes come from?',
    steps: [
      { say: 'Light is a **wave**. Here it is drawn thousands of times bigger than real: the bright bands are **crests**, the dark gaps between them **troughs**, and they march from the laser to the right.',
        tools: { waves: true, paths: false, dirs: false, profile: false, photons: false }, enter: () => { fresh(); ensureTwo(); },
        mark: () => [(Lg.laserX + Lg.laserW + Lg.xp) / 2, Lg.mid, 34] },
      { say: 'With **one slit** open, the light squeezes through and spreads out in half circles, like the ripples from a stone dropped in a pond. On the screen there is just one broad, soft patch.',
        enter: () => { fresh(); ensureTwo(); covered.add(1); }, mark: () => { const p = slitAt(0); return [p[0] + 36, p[1], 30]; } },
      { say: 'Now open the second slit, and **two** sets of ripples cross. Where a crest meets a crest they add up: **bright**. Where a crest meets a trough they cancel: **dark**. Can you see the dark lines fanning out?',
        tools: { dirs: true }, enter: () => { covered.clear(); } },
      { say: 'Why there? Follow the **yellow** and **green** paths to one spot on the screen. If one path is longer by a **whole number of waves**, crests arrive together: bright. Longer by half a wave: dark.',
        tools: { dirs: false, paths: true }, enter: () => { sweep = st.simT; }, leave: () => { sweep = null; aimY = null; } },
      { say: 'So the stripes sit where the path difference is 0, 1, 2… waves, and they are **λL/d** apart. Watch: as the slits move **apart** the stripes squeeze **together**. Longer waves (red) spread them out.',
        tools: { paths: false, dirs: true, profile: true }, enter: () => { wobble = st.simT; }, leave: () => { wobble = null; dMul = 1; } },
      { say: 'Now the strange part. Turn the laser down until the light comes **one photon at a time**. Each lands as a single dot, at random… yet thousands of them build the **same stripes**. Where a photon can land is set by a wave that went through **both** slits.',
        tools: { dirs: false, profile: false, photons: true }, enter: () => { clearDots(); auto = true; }, leave: () => { auto = false; } },
    ],
    onEnd: () => { fresh(); st.setTool('photons', false); },
  });

  // ---------- challenges
  const until = (cond, then) => { pending = { cond, then }; };
  const tween = (from, to, dur, set, then) => { anim = { t0: st.simT, from, to, dur, set, then }; };
  const spacing = () => { const m = build().m, g0 = gapOf(m); return g0 ? m.lam * S.L / (g0 * m.dReal) * 1000 : 0; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  const after = () => { fresh(); syncCtl(); };
  st.setChallenges([
    {
      id: 'cover', title: 'Cover one slit', card: 'slit.cover', lock: true, after,
      setup: () => { fresh(); ensureTwo(); st.setTool('photons', false); st.setTool('waves', true); },
      q: 'Two slits make bright and dark stripes. Now cover one of the slits. On the screen…',
      choices: ['every other stripe goes dark', 'the stripes vanish, leaving one soft patch', 'the same stripes stay, only dimmer'], answer: 1,
      run: (s, finish) => { s.setPaused(false); wait(1.4, () => { covered.add(0); sound.play('click'); wait(2.2, () => finish()); }); },
      skip: () => { pending = null; covered.add(0); },
      explain: 'Stripes need two waves meeting, so that one adds to the other in some places and cancels it in others. With one slit there is nothing to meet: the light just spreads out softly.',
    },
    {
      id: 'color', title: 'From red to blue', card: 'slit.color', lock: true, after,
      setup: () => { fresh(); ensureTwo(); st.setTool('photons', false); lamOver = 650e-9; },
      q: 'Blue light has shorter waves than red. Change the laser from red to blue. The stripes get…',
      choices: ['farther apart', 'closer together', 'no different'], answer: 1,
      run: (s, finish) => { s.setPaused(false); const a = spacing(); tween(650e-9, 450e-9, 2.6, (v) => { lamOver = v; }, () => { const b = spacing(); wait(0.8, () => finish(`On the real screen: ${a.toFixed(1)} mm apart in red, ${b.toFixed(1)} mm in blue.`)); }); },
      skip: () => { anim = null; pending = null; lamOver = 450e-9; },
      explain: 'With shorter waves, a smaller step along the screen already makes one path a whole wave longer, so the stripes squeeze together. The spacing is λL/d: it grows with the wavelength.',
    },
    {
      id: 'apart', title: 'Slits farther apart', card: 'slit.apart', lock: true, after,
      setup: () => { fresh(); ensureTwo(); st.setTool('photons', false); },
      q: 'Now move the two slits farther apart. The stripes on the screen get…',
      choices: ['farther apart', 'closer together', 'no different'], answer: 1,
      run: (s, finish) => { s.setPaused(false); const a = spacing(); tween(1, 1.9, 2.6, (v) => { dMul = v; }, () => { const b = spacing(); wait(0.8, () => finish(`${a.toFixed(1)} mm apart before, ${b.toFixed(1)} mm after.`)); }); },
      skip: () => { anim = null; pending = null; dMul = 1.9; },
      explain: 'With the slits farther apart, the two path lengths change faster as you move along the screen, so you reach the next whole wave sooner. The stripes squeeze together: spacing = λL/d.',
    },
    {
      id: 'photons', title: 'One photon at a time', card: 'slit.photons', lock: true, after,
      setup: () => { fresh(); ensureTwo(); st.setTool('profile', false); st.setTool('photons', true); },
      q: 'Turn the laser down so the light comes one photon at a time, and wait. After a couple of thousand photons, the screen shows…',
      choices: ['two bright lines, one behind each slit', 'the same bright and dark stripes', 'an even spray of dots'], answer: 1,
      run: (s, finish) => { s.setPaused(false); s.setSpeed(1); auto = true; wait(7, () => { auto = false; finish(`${dots.length} photons.`); }); },
      skip: () => { pending = null; auto = false; const F0 = build(); for (let i = 0; i < 1800; i++) { const f = sample(F0); if (f === null) break; land(f); } },
      explain: 'Each photon lands as one dot in a random spot, but where it is likely to land is set by a wave that passed through both slits. Add up thousands and the stripes appear.',
    },
  ]);

  st.peek = () => ({ L: Lg, m: build().m, dots: dots.length, covered: [...covered], dMul });   // for tests
  syncCtl();
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }, { id: 'dark', label: 'Measure', build: tabDark }];

export default bench;
