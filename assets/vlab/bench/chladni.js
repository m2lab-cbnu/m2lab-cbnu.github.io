// 2F · Chladni plate. A metal plate held at its centre and shaken by a speaker (or bowed at the
// edge). At each resonance the plate vibrates in a standing-wave pattern; sand bounces off the
// moving parts and collects on the lines that stay still, drawing the pattern for you.

import { el, slider, button, group, readout, canvasBox, note } from '../ui/widgets.js';
import { rigStrip, current, phys, onRig, loop, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

const F0 = 21;      // Hz: sets the scale of the brass plate's notes
const Q = 70;

const bench = {
  id: 'chladni', title: 'Chladni plate', kicker: '2F · Physics Playground', icon: '❖', floor: 2,
  blurb: 'Sand draws the shapes of vibration.',
  slots: [
    { id: 'plate', label: 'Plate', options: ['plate-square', 'plate-round', 'plate-alu'], def: 'plate-square' },
    { id: 'drive', label: 'Make it sing with', options: ['speaker', 'bow'], def: 'speaker' },
    { id: 'grain', label: 'Sprinkle', options: ['sand', 'salt'], def: 'sand' },
  ],
};
bench.header = rigStrip(bench);

// Bessel J_n(x) by its integral, good enough for drawing
function besselJ(n, x) { let s = 0; const M = 60; for (let i = 0; i <= M; i++) { const t = Math.PI * i / M, w = i === 0 || i === M ? 0.5 : 1; s += w * Math.cos(n * t - x * Math.sin(t)); } return s / M; }
// zeros of J_n' (free edge, roughly)
const dZeros = {};
function besselDZeros(n, count) {
  const key = n + ':' + count; if (dZeros[key]) return dZeros[key];
  const out = []; let prev = (besselJ(n, 0.01 + 1e-4) - besselJ(n, 0.01)) / 1e-4, x = 0.01;
  while (out.length < count && x < 60) { x += 0.02; const d = (besselJ(n, x + 1e-4) - besselJ(n, x)) / 1e-4; if (d * prev < 0 && x > 0.5) out.push(x); prev = d; }
  return (dZeros[key] = out);
}

// the plate's modes: shape function on [-1/2, 1/2]² (square) or the unit disc, and frequency
function modeList(shape, c) {
  const L = [];
  if (shape === 'square') {
    for (let n = 0; n <= 14; n += 2) for (let m = 0; m <= n; m += 2) for (const s of [1, -1]) {
      if (n === m && s < 0) continue;
      if (n === 0 && m === 0) continue;
      L.push({ n, m, s, f: F0 * c * (n * n + m * m) * (s > 0 ? 1 : 1.04), shape,
        at: (u, v) => Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) + s * Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v) });
    }
  } else {
    for (let n = 0; n <= 6; n++) {
      const zs = besselDZeros(n, 4);
      zs.forEach((k, si) => {
        const norm = 1 / Math.max(1e-3, Math.abs(besselJ(n, 0.0) || 0.4) + 0.3);
        L.push({ n, s: si + 1, k, f: F0 * c * 1.6 * k * k / 4, shape,
          at: (u, v) => { const r = Math.hypot(u, v) * 2, th = Math.atan2(v, u); return r > 1 ? 0 : besselJ(n, k * r) * Math.cos(n * th) * norm; } });
      });
    }
  }
  return L.sort((a, b) => a.f - b.f);
}

const S = { f: 420, amp: 0.6, grains: null, modes: null, key: '', gallery: [], last: null };

function setup() {
  const pl = phys(bench, 'plate'), key = pl.id;
  if (key !== S.key) { S.modes = modeList(pl.shape, pl.c); S.key = key; S.grains = null; }
  return pl;
}
// how strongly each mode answers at frequency f, for the chosen way of driving
function weights(f) {
  const drive = current(bench, 'drive'), pl = setup();
  const pt = drive === 'speaker' ? [0, 0] : (pl.shape === 'square' ? [0.5, 0.18] : [0.5, 0]);
  return S.modes.map((m) => {
    const exc = m.at(pt[0], pt[1]);
    const den = Math.hypot(m.f * m.f - f * f, f * m.f / Q);
    return exc * m.f * m.f / den;
  });
}

function tabPlate(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Sprinkle sand on the plate and slowly raise the frequency. Between resonances nothing much happens; at a resonance the sand jumps off the moving parts and settles on the <b>nodal lines</b>, where the plate stays still. Higher notes, finer patterns.' }));
  const box = canvasBox('square', '1 / 1', 'The plate seen from above, with sand on it');
  const fS = slider({ label: 'Frequency', unit: 'Hz', min: 50, max: 5000, step: 1, value: S.f, log: true, digits: 4, onInput: (v) => { S.f = v; } });
  const aS = slider({ label: 'Loudness', unit: '', min: 0.1, max: 1, step: 0.05, value: S.amp, digits: 2, onInput: (v) => { S.amp = v; } });
  const up = button('Next resonance up', () => jump(1), 'secondary'), down = button('Next one down', () => jump(-1), 'quiet');
  const sprinkle = button('Sprinkle fresh sand', () => { S.grains = null; }, 'quiet');
  const keep = button('Keep this pattern', () => keepIt(), 'primary');
  const mRo = readout('Strongest mode'), fRo = readout('Its frequency');
  const gal = el('div', { class: 'chladni-gallery' });
  pane.append(el('div', { class: 'vp-cols' }, el('div', { class: 'vp-side' }, group('Drive', fS, el('div', { class: 'vp-row' }, down, up), aS), el('div', { class: 'vp-row' }, sprinkle, keep), el('div', { class: 'ros' }, mRo, fRo)), el('div', { class: 'vp-main' }, box, el('h3', { class: 'gal-title', text: 'Patterns you kept' }), gal)));

  function jump(dir) {
    const active = S.modes.map((m, i) => ({ m, i })).filter(({ m }) => Math.abs(m.at(current(bench, 'drive') === 'speaker' ? 0 : 0.5, current(bench, 'drive') === 'speaker' ? 0 : (setup().shape === 'square' ? 0.18 : 0))) > 0.05);
    const cand = active.map(({ m }) => m.f).filter((f) => (dir > 0 ? f > S.f * 1.003 : f < S.f * 0.997)).sort((a, b) => (dir > 0 ? a - b : b - a));
    if (cand.length) fS.set(Math.round(cand[0]));
  }
  function dominant() {
    const w = weights(S.f); let bi = 0; for (let i = 1; i < w.length; i++) if (Math.abs(w[i]) > Math.abs(w[bi])) bi = i;
    return { m: S.modes[bi], w: w[bi], tot: w.reduce((a, b) => a + Math.abs(b), 0) };
  }
  function keepIt() {
    const c = document.createElement('canvas'); c.width = 120; c.height = 120;
    const g = c.getContext('2d'); g.drawImage(box.canvas, 0, 0, 120, 120);
    const d = dominant();
    S.gallery.push({ img: c, f: S.f });
    gal.prepend(el('figure', {}, c, el('figcaption', { text: `${Math.round(S.f)} Hz` })));
    const lines = d.m.shape === 'square' ? (d.m.n + d.m.m) / 2 : d.m.n + d.m.s;
    rig.note({ bench: 'chladni', f: S.f, lines, plate: current(bench, 'plate') });
  }
  onRig(bench, () => { setup(); S.grains = null; });

  const N = 6000, GN = 128;
  // each mode's shape on a grid, made once; the plate's motion is a weighted sum of a few of them
  function grid(m) {
    if (m.grid) return m.grid;
    const a = new Float32Array(GN * GN);
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) a[j * GN + i] = m.at(i / (GN - 1) - 0.5, j / (GN - 1) - 0.5);
    return (m.grid = a);
  }
  let zKey = '', Z = new Float32Array(GN * GN), zMax = 1, strength = 0;
  function motion() {
    const key = S.key + current(bench, 'drive') + S.f.toFixed(1);
    if (key === zKey) return;
    zKey = key;
    const w = weights(S.f), mx = Math.max(1e-9, ...w.map(Math.abs));
    const top = w.map((v, i) => [v, i]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, 4).filter(([v]) => Math.abs(v) > 0.05 * mx);
    Z.fill(0);
    for (const [wv, i] of top) { const gq = grid(S.modes[i]); for (let k = 0; k < Z.length; k++) Z[k] += wv * gq[k]; }
    zMax = 0; for (let k = 0; k < Z.length; k++) zMax = Math.max(zMax, Math.abs(Z[k]));
    zMax = zMax || 1;
    strength = Math.min(1, mx / 110);
  }
  const anim = loop((dt) => {
    const pl = setup();
    motion();
    if (!S.grains) { S.grains = new Float32Array(N * 2); for (let i = 0; i < N * 2; i++) S.grains[i] = Math.random() - 0.5; }
    const salt = current(bench, 'grain') === 'salt' ? 1.7 : 1;
    const shake = strength * S.amp * salt * Math.min(1, dt * 60);
    for (let k = 0; k < N; k++) {
      let u = S.grains[2 * k], v = S.grains[2 * k + 1];
      const gi = Math.min(GN - 1, Math.max(0, Math.round((u + 0.5) * (GN - 1)))), gj = Math.min(GN - 1, Math.max(0, Math.round((v + 0.5) * (GN - 1))));
      // grains hop in proportion to how much the plate moves under them
      const hop = Math.min(0.06, Math.abs(Z[gj * GN + gi]) / zMax * 0.05 * shake);
      if (hop > 1e-5) { const a = Math.random() * 2 * Math.PI; u += Math.cos(a) * hop; v += Math.sin(a) * hop; }
      if (pl.shape === 'square') { if (Math.abs(u) > 0.5 || Math.abs(v) > 0.5) { u = Math.max(-0.5, Math.min(0.5, u)) * 0.98; v = Math.max(-0.5, Math.min(0.5, v)) * 0.98; } }
      else if (u * u + v * v > 0.25) { const r = Math.hypot(u, v); u *= 0.49 / r; v *= 0.49 / r; }
      S.grains[2 * k] = u; S.grains[2 * k + 1] = v;
    }
    draw(pl);
  });
  function draw(pl = setup()) {
    const { g, w, h } = fitCanvas(box.canvas);
    g.fillStyle = '#22325C'; g.fillRect(0, 0, w, h);
    const s = Math.min(w, h) * 0.9, ox = (w - s) / 2, oy = (h - s) / 2;
    const col = pl.id === 'plate-alu' ? '#CFE0F0' : '#D8B04A';
    g.fillStyle = col;
    if (pl.shape === 'square') g.fillRect(ox, oy, s, s); else { g.beginPath(); g.arc(w / 2, h / 2, s / 2, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(27,36,64,0.35)'; g.beginPath(); g.arc(w / 2, h / 2, 5, 0, 7); g.fill();
    const salt = current(bench, 'grain') === 'salt';
    g.fillStyle = salt ? '#FFFFFF' : '#FFF2D6';
    const gs = salt ? 1.4 : 1.8;
    if (S.grains) for (let k = 0; k < S.grains.length / 2; k++) g.fillRect(ox + (S.grains[2 * k] + 0.5) * s - gs / 2, oy + (S.grains[2 * k + 1] + 0.5) * s - gs / 2, gs, gs);
    if (current(bench, 'drive') === 'bow') { g.strokeStyle = '#8E5A35'; g.lineWidth = 3; const bx = ox + s, by = oy + (pl.shape === 'square' ? 0.68 : 0.5) * s; g.beginPath(); g.moveTo(bx + 30, by - 40); g.lineTo(bx - 4, by + 30); g.stroke(); }
    const d = dominant();
    const near = Math.abs(d.w) > 0.25 * d.tot;
    // a clear, high pattern earns Pip's stamp even without keeping it
    if (near && d.m.shape === 'square' && (d.m.n + d.m.m) / 2 >= 6 && S.noted !== d.m) { S.noted = d.m; rig.note({ bench: 'chladni', f: S.f, lines: (d.m.n + d.m.m) / 2, plate: current(bench, 'plate') }); }
    mRo.set(near ? (d.m.shape === 'square' ? `(${d.m.n}, ${d.m.m})${d.m.s > 0 ? '+' : '−'}` : `${d.m.n} lines across, ${d.m.s} ring${d.m.s > 1 ? 's' : ''}`) : 'between resonances');
    fRo.set(near ? `${d.m.f.toFixed(0)} Hz` : '–');
  }
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

bench.tabs = [{ id: 'plate', label: 'Plate', build: tabPlate }];

export default bench;
