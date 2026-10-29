// 2F · Chladni plate. A metal plate held at its centre and shaken by a speaker (or bowed at the
// edge). At each resonance the plate vibrates in a standing-wave pattern; sand bounces off the
// moving parts and collects on the lines that stay still, drawing the pattern for you.

import { el, slider, button, group, readout, canvasBox, note } from '../ui/widgets.js';
import { rigStrip, current, phys, onRig, loop, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

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
  // a challenge can borrow a plate for a moment (S.plateOver)
  const pl = S.plateOver ? { id: S.plateOver, ...ITEMS[S.plateOver].phys, item: ITEMS[S.plateOver] } : phys(bench, 'plate'), key = pl.id;
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
    // a clear, high pattern earns Kongi's stamp even without keeping it
    if (near && d.m.shape === 'square' && (d.m.n + d.m.m) / 2 >= 6 && S.noted !== d.m) { S.noted = d.m; rig.note({ bench: 'chladni', f: S.f, lines: (d.m.n + d.m.m) / 2, plate: current(bench, 'plate') }); }
    mRo.set(near ? (d.m.shape === 'square' ? `(${d.m.n}, ${d.m.m})${d.m.s > 0 ? '+' : '−'}` : `${d.m.n} lines across, ${d.m.s} ring${d.m.s > 1 ? 's' : ''}`) : 'between resonances');
    fRo.set(near ? `${d.m.f.toFixed(0)} Hz` : '–');
  }
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
const FMIN = 50, FMAX = 5000;
function modeKey(m) { return m.shape === 'square' ? `${m.n},${m.m},${m.s}` : `r${m.n},${m.s}`; }

function tabPlay(pane) {
  const N = 9000, GN = 128;
  if (S.f === 420) S.f = 300;     // start between resonances, so the first pattern is yours to find
  let grains = null, first = true, pending = null, anim = null, hold = { key: '', t: 0 };
  let zKey = '', Z = new Float32Array(GN * GN), zMax = 1, strength = 0, resp = null, phase = 0;
  let Lay = { w: 800, h: 500 };
  const side = Array.from({ length: 54 }, () => ({ u: Math.random() - 0.5, h: 0, vh: 0, vu: 0 }));
  const hum = sound.hum('sine');
  const thumbs = new Map();

  const st = new Stage(pane, {
    bench, npc: 'pip',
    label: 'A metal plate seen from above, with sand on it, held at its center over a speaker. Below it, a strip of notes from low to high.',
    hello: 'Slide along the **strip of notes** at the bottom. Most notes do nothing… but at a **resonance** the sand dances into a pattern. How many can you find?',
    aspect: 16 / 10, phoneAspect: 0.72, minH: 360,
    onReset: () => { grains = null; S.f = 300; anim = null; pending = null; first = true; },
    onHide: () => hum.set(200, 0),
    keys: { arrow: (dx, dy) => { const k = dx || -dy; if (k) setF(S.f * Math.pow(1.01, k)); }, action: () => jump(1) },
  });
  st.tool('motion', 'Movement', { icon: '#E5534B' }).tool('lines', 'Still lines', { icon: K.COL.net }).tool('side', 'Side view', { icon: K.COL.vel, on: true });
  st.readout('f', 'Note').readout('pat', 'Pattern').readout('found', 'Patterns found');

  // ---------- controls
  const prev = el('button', { type: 'button', class: 'stg-act ghost', text: '◀ Resonance' });
  const next = el('button', { type: 'button', class: 'stg-act', text: 'Resonance ▶' });
  const fresh = el('button', { type: 'button', class: 'stg-act ghost', text: 'Fresh sand' });
  prev.addEventListener('click', () => jump(-1)); next.addEventListener('click', () => jump(1));
  fresh.addEventListener('click', () => { grains = null; sound.play('sand'); });
  const colHead = el('p', { class: 'stg-small', text: '' });
  const col = el('div', { class: 'chl-col', role: 'list', 'aria-label': 'Patterns you have found' });
  st.controls(el('div', { class: 'stg-row' }, prev, next), fresh, colHead, col);

  function plate() { return setup(); }
  function drivePt(pl) { return current(bench, 'drive') === 'speaker' ? [0, 0] : (pl.shape === 'square' ? [0.5, 0.18] : [0.5, 0]); }
  function excitable() {
    const pl = plate(), pt = drivePt(pl);
    return S.modes.filter((m) => m.f <= FMAX && m.f >= FMIN && Math.abs(m.at(pt[0], pt[1])) > 0.05);
  }
  const foundSet = () => new Set(rig.flag('chladniFound') || []);
  function setF(f) { S.f = Math.max(FMIN, Math.min(FMAX, f)); first = false; }
  function jump(dir) {
    const cand = excitable().map((m) => m.f).filter((f) => (dir > 0 ? f > S.f * 1.004 : f < S.f * 0.996)).sort((a, b) => (dir > 0 ? a - b : b - a));
    if (cand.length) glide(cand[0]);
  }
  function glide(f, then) { first = false; anim = { t0: st.simT, from: Math.log(S.f), to: Math.log(f), dur: 0.7, set: (v) => { S.f = Math.exp(v); }, then }; }

  // each mode's shape on a grid, made once
  function grid(m) {
    if (m.grid) return m.grid;
    const a = new Float32Array(GN * GN);
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) a[j * GN + i] = m.at(i / (GN - 1) - 0.5, j / (GN - 1) - 0.5);
    return (m.grid = a);
  }
  // the plate's motion at this note: a weighted sum of the few modes that answer
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
  function dominant() {
    const w = weights(S.f); let bi = 0; for (let i = 1; i < w.length; i++) if (Math.abs(w[i]) > Math.abs(w[bi])) bi = i;
    return { m: S.modes[bi], w: w[bi], tot: w.reduce((a, b) => a + Math.abs(b), 0) };
  }
  // how loudly the plate answers along the strip of notes
  function response() {
    const key = S.key + current(bench, 'drive');
    if (resp && resp.key === key) return resp;
    const n = 420, fs = new Float32Array(n), r = new Float32Array(n);
    let mx = 0;
    // the strongest single answer at each note: tall, narrow peaks at the resonances
    for (let i = 0; i < n; i++) { const f = FMIN * Math.pow(FMAX / FMIN, i / (n - 1)); fs[i] = f; const w = weights(f); let s = 0; for (const v of w) s = Math.max(s, Math.abs(v)); r[i] = Math.pow(s, 0.6); mx = Math.max(mx, r[i]); }
    for (let i = 0; i < n; i++) r[i] /= mx || 1;
    return (resp = { key, fs, r });
  }
  const respAt = (f) => { const R = response(), x = Math.log(f / FMIN) / Math.log(FMAX / FMIN) * (R.fs.length - 1); const i = Math.max(0, Math.min(R.fs.length - 2, Math.floor(x))), q = x - i; return R.r[i] * (1 - q) + R.r[i + 1] * q; };

  // a small picture of a pattern: dark where the plate stays still
  function thumb(m, size = 40) {
    const k = S.key + ':' + modeKey(m) + ':' + size;
    if (thumbs.has(k)) return thumbs.get(k);
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'), id = g.createImageData(size, size), gq = grid(m);
    let mx = 0; for (const v of gq) mx = Math.max(mx, Math.abs(v));
    const pl = plate(), alu = pl.id === 'plate-alu';
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const u = i / (size - 1) - 0.5, v = j / (size - 1) - 0.5, o = (j * size + i) * 4;
      if (pl.shape !== 'square' && u * u + v * v > 0.25) { id.data[o + 3] = 0; continue; }
      const gi = Math.round((u + 0.5) * (GN - 1)), gj = Math.round((v + 0.5) * (GN - 1)), z = Math.abs(gq[gj * GN + gi]) / (mx || 1);
      const still = z < 0.14;
      id.data[o] = still ? 255 : alu ? 196 : 222; id.data[o + 1] = still ? 246 : alu ? 214 : 176; id.data[o + 2] = still ? 214 : alu ? 236 : 74; id.data[o + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    thumbs.set(k, c);
    return c;
  }
  let colKey = '';
  function renderCollection() {
    const list = excitable(), found = foundSet(), key = S.key + current(bench, 'drive') + [...found].join('|');
    if (key === colKey) return;
    colKey = key;
    const mine = list.filter((m) => found.has(S.key + ':' + modeKey(m)));
    colHead.textContent = `Your collection: ${mine.length} of ${list.length} patterns on this plate`;
    col.replaceChildren(...list.map((m, i) => {
      const got = found.has(S.key + ':' + modeKey(m));
      const b = el('button', { type: 'button', class: 'chl-item' + (got ? ' is-got' : ''), role: 'listitem', title: got ? `Pattern ${i + 1}, ${Math.round(m.f)} Hz: play it again` : `Pattern ${i + 1}: not found yet`, 'aria-label': got ? `Pattern ${i + 1}, ${Math.round(m.f)} hertz` : `Pattern ${i + 1}, not found yet` });
      if (got) { b.append(thumb(m, 40)); b.addEventListener('click', () => glide(m.f)); } else { b.textContent = '?'; b.disabled = true; }
      return b;
    }));
    st.set('found', `${mine.length} of ${list.length}`);
  }
  onRig(bench, () => { setup(); grains = null; colKey = ''; renderCollection(); });

  // ---------- time
  st.onStep((sdt, dt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const a = anim; anim = null; if (a.then) a.then(); }
    }
    const pl = plate();
    motion();
    if (!grains) { grains = new Float32Array(N * 2); for (let i = 0; i < N * 2; i++) grains[i] = Math.random() - 0.5; if (pl.shape !== 'square') for (let k = 0; k < N; k++) { const r = 0.49 * Math.sqrt(Math.random()), a = Math.random() * 2 * Math.PI; grains[2 * k] = r * Math.cos(a); grains[2 * k + 1] = r * Math.sin(a); } }
    phase += sdt * 2 * Math.PI * 2.2;
    const salt = current(bench, 'grain') === 'salt' ? 1.7 : 1;
    if (sdt > 0) {
      const shake = strength * salt * Math.min(1, sdt * 60);
      for (let k = 0; k < N; k++) {
        let u = grains[2 * k], v = grains[2 * k + 1];
        const gi = Math.min(GN - 1, Math.max(0, Math.round((u + 0.5) * (GN - 1)))), gj = Math.min(GN - 1, Math.max(0, Math.round((v + 0.5) * (GN - 1))));
        // grains hop in proportion to how much the plate moves under them
        const hop = Math.min(0.06, Math.abs(Z[gj * GN + gi]) / zMax * 0.05 * shake);
        if (hop > 1e-5) { const a = Math.random() * 2 * Math.PI; u += Math.cos(a) * hop; v += Math.sin(a) * hop; }
        if (pl.shape === 'square') { if (Math.abs(u) > 0.5 || Math.abs(v) > 0.5) { u = Math.max(-0.5, Math.min(0.5, u)) * 0.98; v = Math.max(-0.5, Math.min(0.5, v)) * 0.98; } }
        else if (u * u + v * v > 0.25) { const r = Math.hypot(u, v); u *= 0.49 / r; v *= 0.49 / r; }
        grains[2 * k] = u; grains[2 * k + 1] = v;
      }
      // the slice seen from the side: grains are thrown up where the plate moves and come to rest where it does not
      const A = strength * 16, gv = 900;
      for (const q of side) {
        const a = A * Math.abs(sliceZ(q.u));
        if (q.h > 0 || q.vh > 0) { q.vh -= gv * sdt; q.h += q.vh * sdt; q.u += q.vu * sdt; if (q.h <= 0) { q.h = 0; q.vh = 0; q.vu = 0; } }
        else if (a > 1.2 && Math.random() < 0.6) { q.vh = Math.sqrt(2 * gv * a) * (0.6 + 0.6 * Math.random()); q.vu = (Math.random() - 0.5) * 0.25 * Math.min(1, a / 10); }
        q.u = Math.max(-0.49, Math.min(0.49, q.u));
      }
    }
    // a resonance you stay on long enough goes into your collection
    const d = dominant(), near = Math.abs(d.w) > 0.3 * d.tot && strength > 0.25 && !anim;
    const key = near ? S.key + ':' + modeKey(d.m) : '';
    if (key && key === hold.key) {
      hold.t += sdt;
      const found = foundSet();
      if (hold.t > 1.6 && !S.plateOver && !found.has(key) && excitable().includes(d.m)) {
        found.add(key); rig.flag('chladniFound', [...found]);
        sound.play('chime'); st.flash(st.narrow ? 'New pattern!' : 'New pattern for your collection!');
        st.confetti(Lay.cx || st.w / 2, (Lay.py || 0) + 40, 24);
        renderCollection();
      }
    } else hold = { key, t: 0 };
    hum.set(S.f, st.running ? 0.005 + 0.035 * Math.pow(respAt(S.f), 2.2) : 0, 1);
    if (pending && pending.cond()) { const f = pending.then; pending = null; f(); }
  });
  // the shape along the middle of the plate, -1..1
  function sliceZ(u) { const gi = Math.min(GN - 1, Math.max(0, Math.round((u + 0.5) * (GN - 1)))), gj = Math.round((GN - 1) / 2); return Z[gj * GN + gi] / zMax; }

  // ---------- layout
  st.onResize((w, h, narrow) => {
    const stripH = narrow ? 92 : 104;
    if (narrow) {
      const sideH = 96, P = Math.min(w - 24, h - stripH - sideH - 44);
      Lay = { w, h, narrow, P, px: Math.round((w - P) / 2), py: 12, sx: 12, sw: w - 24, sy: h - stripH - 8, sh: stripH, side: { x: 12, y: 12 + P + 12, w: w - 24, h: sideH } };
    } else {
      const P = Math.min(h - stripH - 40, w * 0.5);
      const px = 18, rx = px + P + 24;
      Lay = { w, h, narrow, P, px, py: 14, sx: 12, sw: w - 24, sy: h - stripH - 8, sh: stripH, side: { x: rx, y: 30, w: w - rx - 14, h: Math.min(170, P * 0.48) } };
    }
    Lay.cx = Lay.px + Lay.P / 2; Lay.cy = Lay.py + Lay.P / 2;
  });
  const fx = (f) => Lay.sx + 16 + (Lay.sw - 32) * Math.log(f / FMIN) / Math.log(FMAX / FMIN);
  const xf = (x) => FMIN * Math.pow(FMAX / FMIN, Math.max(0, Math.min(1, (x - Lay.sx - 16) / (Lay.sw - 32))));

  // ---------- drawing
  let ov = null;
  function overlay(g, kind) {
    if (!ov) { ov = document.createElement('canvas'); ov.width = GN; ov.height = GN; }
    const og = ov.getContext('2d'), id = og.createImageData(GN, GN), c = Math.cos(phase), pl = plate();
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const k = j * GN + i, o = k * 4, z = Z[k] / zMax;
      if (pl.shape !== 'square') { const u = i / (GN - 1) - 0.5, v = j / (GN - 1) - 0.5; if (u * u + v * v > 0.25) continue; }
      if (kind === 'motion') {
        const s = z * c * Math.min(1, strength * 1.6);
        if (s > 0) { id.data[o] = 229; id.data[o + 1] = 83; id.data[o + 2] = 75; } else { id.data[o] = 61; id.data[o + 1] = 127; id.data[o + 2] = 214; }
        id.data[o + 3] = Math.min(200, Math.abs(s) * 230);
      } else {
        const still = Math.abs(z) < 0.06 && strength > 0.05;
        if (still) { id.data[o] = 123; id.data[o + 1] = 92; id.data[o + 2] = 240; id.data[o + 3] = 200; }
      }
    }
    og.putImageData(id, 0, 0);
    g.save(); clipPlate(g); g.imageSmoothingEnabled = true; g.drawImage(ov, Lay.px, Lay.py, Lay.P, Lay.P); g.restore();
  }
  function clipPlate(g) {
    const pl = plate(); g.beginPath();
    if (pl.shape === 'square') g.rect(Lay.px, Lay.py, Lay.P, Lay.P); else g.arc(Lay.cx, Lay.cy, Lay.P / 2, 0, Math.PI * 2);
    g.clip();
  }
  function drawPlate(g) {
    const pl = plate(), { px, py, P, cx, cy } = Lay, alu = pl.id === 'plate-alu';
    // a soft shadow on the bench below
    g.save(); g.fillStyle = 'rgba(19,36,71,0.28)';
    if (pl.shape === 'square') { K.rr(g, px + 8, py + 12, P, P, 6); g.fill(); } else { g.beginPath(); g.arc(cx + 8, cy + 12, P / 2, 0, Math.PI * 2); g.fill(); }
    g.restore();
    const gr = g.createLinearGradient(px, py, px + P, py + P);
    if (alu) { gr.addColorStop(0, '#EEF6FF'); gr.addColorStop(0.5, '#C4D8EC'); gr.addColorStop(1, '#9DB8D3'); }
    else { gr.addColorStop(0, '#F6DB86'); gr.addColorStop(0.5, '#E2B84E'); gr.addColorStop(1, '#C3972F'); }
    g.save(); g.beginPath();
    if (pl.shape === 'square') K.rr(g, px, py, P, P, 4); else g.arc(cx, cy, P / 2, 0, Math.PI * 2);
    g.fillStyle = gr; g.fill(); g.lineWidth = 2.5; g.strokeStyle = K.LINE; g.stroke();
    // a sheen, like brushed metal
    g.clip(); g.globalAlpha = 0.18; g.fillStyle = '#FFFFFF';
    g.beginPath(); g.moveTo(px, py + P * 0.25); g.lineTo(px + P * 0.25, py); g.lineTo(px + P * 0.42, py); g.lineTo(px, py + P * 0.42); g.closePath(); g.fill();
    g.restore();
  }
  function drawSand(g) {
    if (!grains) return;
    const salt = current(bench, 'grain') === 'salt', { px, py, P } = Lay;
    g.fillStyle = salt ? '#FFFFFF' : '#FFF6DE';
    const gs = Math.max(1.5, P / 300) * (salt ? 0.85 : 1);
    for (let k = 0; k < N; k++) g.fillRect(px + (grains[2 * k] + 0.5) * P - gs / 2, py + (grains[2 * k + 1] + 0.5) * P - gs / 2, gs, gs);
    g.fillStyle = 'rgba(158,110,40,0.55)';
    for (let k = 0; k < N; k += 7) g.fillRect(px + (grains[2 * k] + 0.5) * P - gs / 2 + 0.6, py + (grains[2 * k + 1] + 0.5) * P - gs / 2 + 0.6, gs * 0.8, gs * 0.8);
  }
  function drawCentre(g) {
    K.ball(g, Lay.cx, Lay.cy, Math.max(5, Lay.P / 60), 'chrome', { lw: 1.6 });
    if (current(bench, 'drive') === 'bow') {
      const pl = plate(), bx = Lay.px + Lay.P + 2, by = Lay.py + (pl.shape === 'square' ? 0.68 : 0.5) * Lay.P, k = Math.sin(st.t * 6) * 6 * strength;
      K.rod(g, bx + 34 + k, by - 50, bx - 6 + k, by + 40, 5, K.MAT.wood, { lw: 1.6 });
      K.lineSeg(g, bx + 40 + k, by - 46, bx + 2 + k, by + 42, '#FFF6DE', 1.4);
    }
  }
  function drawSide(g) {
    const S2 = Lay.side; if (!S2 || !st.on('side')) return;
    const { x, y, w, h } = S2;
    g.save(); K.rr(g, x, y, w, h, 12); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    K.text(g, Lay.narrow ? 'Side view' : 'Side view: a slice through the middle', x + 12, y + 20, { size: 12, weight: 600 });
    const x0 = x + 18, x1 = x + w - 18, ym = y + h * 0.62, A = strength * 16, c = Math.cos(phase);
    const X = (u) => x0 + (u + 0.5) * (x1 - x0), Y = (u) => ym - A * sliceZ(u) * c;
    // the post holding the plate up
    K.rod(g, X(0), ym + 4, X(0), y + h - 8, 8, K.MAT.steel, { lw: 1.6 });
    const pts = []; for (let i = 0; i <= 80; i++) { const u = -0.5 + i / 80; pts.push([X(u), Y(u)]); }
    K.polyline(g, pts, K.LINE, 7.5); K.polyline(g, pts, plate().id === 'plate-alu' ? '#C4D8EC' : '#E2B84E', 4.5);
    for (const q of side) { g.beginPath(); g.arc(X(q.u), Y(q.u) - 5 - q.h, 3.2, 0, Math.PI * 2); g.fillStyle = '#FFF6DE'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#9E6E28'; g.stroke(); }
    K.text(g, strength > 0.15 ? 'exaggerated and slowed down' : 'hardly moving', x + w - 12, y + 20, { size: 10.5, weight: 600, align: 'right', color: '#5B4BC4' });
  }
  function drawStrip(g) {
    const { sx, sy, sw, sh } = Lay, R = response(), found = foundSet();
    g.save(); K.rr(g, sx, sy, sw, sh, 12); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const top = sy + 34, bot = sy + sh - 22;
    // how loudly the plate answers at each note
    g.beginPath(); g.moveTo(fx(R.fs[0]), bot);
    for (let i = 0; i < R.fs.length; i++) g.lineTo(fx(R.fs[i]), bot - (bot - top) * R.r[i]);
    g.lineTo(fx(R.fs[R.fs.length - 1]), bot); g.closePath();
    g.fillStyle = 'rgba(185,168,255,0.45)'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = '#7B5CF0'; g.stroke();
    for (const f of [50, 100, 200, 500, 1000, 2000, 5000]) { const x = fx(f); g.fillStyle = '#12243A'; g.fillRect(x, bot, 1.5, 5); K.text(g, f === 50 ? '50 Hz' : f >= 1000 ? `${f / 1000}k` : String(f), x, bot + 15, { size: 10, weight: 600, align: f === 50 ? 'left' : f === 5000 ? 'right' : 'center' }); }
    // the patterns along the strip: a picture once found, a question mark until then
    // (close neighbours take turns between two rows, so they do not pile up)
    const lastX = [-1e9, -1e9];
    for (const m of excitable()) {
      const x = fx(m.f), got = found.has(S.key + ':' + modeKey(m));
      const row = x - lastX[0] > 16 ? 0 : x - lastX[1] > 16 ? 1 : 0; lastX[row] = x;
      const y = sy + 12 + row * 14;
      if (got) { g.drawImage(thumb(m, 40), x - 7, y - 7, 14, 14); g.lineWidth = 1; g.strokeStyle = K.LINE; g.strokeRect(x - 7, y - 7, 14, 14); }
      else { g.beginPath(); g.arc(x, y, 5.5, 0, Math.PI * 2); g.fillStyle = '#EAF6FC'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#7B5CF0'; g.stroke(); K.text(g, '?', x, y + 3.5, { size: 8.5, weight: 700, align: 'center', color: '#5B4BC4' }); }
    }
    // your note
    const x = fx(S.f);
    K.lineSeg(g, x, top - 4, x, bot, '#E5534B', 2.5);
    K.ball(g, x, bot - 2, 8, st.hovering('tune') || st.isDragging('tune') ? 'yellow' : 'red', { lw: 2 });
    K.tag(g, `${Math.round(S.f)} Hz`, Math.max(sx + 40, Math.min(sx + sw - 40, x)), top + 10, { size: 11.5, bg: '#FFE07A' });
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.tag(g, '← drag along the notes →', Math.max(sx + 110, Math.min(sx + sw - 110, x + 120 + k * 8)), bot - 22, { size: 11.5, bg: '#FFFDF6' }); }
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      // a wooden workbench seen from above
      gg.fillStyle = '#D9A066'; gg.fillRect(0, 0, ww, hh);
      gg.strokeStyle = 'rgba(185,122,64,0.45)'; gg.lineWidth = 2;
      for (let y = 18; y < hh; y += 34) { gg.beginPath(); gg.moveTo(0, y); for (let x = 0; x <= ww; x += 40) gg.lineTo(x, y + Math.sin(x * 0.02 + y) * 2); gg.stroke(); }
      gg.fillStyle = 'rgba(255,244,222,0.25)'; for (let y = 0; y < hh; y += 68) gg.fillRect(0, y, ww, 2);
    });
    drawPlate(g);
    if (st.on('motion')) overlay(g, 'motion');
    drawSand(g);
    if (st.on('lines')) overlay(g, 'lines');
    drawCentre(g);
    drawSide(g);
    drawStrip(g);
  });
  st.onOver(() => {
    const d = dominant(), near = Math.abs(d.w) > 0.3 * d.tot && strength > 0.15;
    st.set('f', `${Math.round(S.f)} Hz`);
    const list = excitable(), i = list.indexOf(d.m);
    st.set('pat', near && i >= 0 ? `number ${i + 1}, at ${Math.round(d.m.f)} Hz` : 'between resonances');
    renderCollection();
  });

  // ---------- hands
  st.handle({
    id: 'tune', cursor: 'ew-resize',
    hit: (x, y) => (y > Lay.sy && y < Lay.sy + Lay.sh && x > Lay.sx && x < Lay.sx + Lay.sw ? Math.abs(x - fx(S.f)) * 0.01 : false),
    down: (x) => { anim = null; setF(xf(x)); },
    move: (x) => setF(xf(x)),
    click: (x) => { anim = null; setF(xf(x)); },
  });
  st.handle({
    id: 'plate', cursor: 'crosshair',
    hit: (x, y) => (x > Lay.px && x < Lay.px + Lay.P && y > Lay.py && y < Lay.py + Lay.P ? 50 : false),
    // sprinkle a little more sand where you click
    click: (x, y) => {
      if (!grains) return;
      const u0 = (x - Lay.px) / Lay.P - 0.5, v0 = (y - Lay.py) / Lay.P - 0.5;
      for (let k = 0; k < 400; k++) { const j = Math.floor(Math.random() * N), r = 0.06 * Math.sqrt(Math.random()), a = Math.random() * 2 * Math.PI; grains[2 * j] = Math.max(-0.5, Math.min(0.5, u0 + r * Math.cos(a))); grains[2 * j + 1] = Math.max(-0.5, Math.min(0.5, v0 + r * Math.sin(a))); }
      sound.play('sand'); first = false;
    },
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  const firstRes = () => { const l = excitable(); return l.length ? l[Math.min(2, l.length - 1)].f : 400; };
  st.tour({
    title: 'How does the sand know?',
    steps: [
      { say: 'This brass plate is held at its center over a speaker, with sand sprinkled all over it. The speaker plays one steady note.',
        tools: { motion: false, lines: false, side: true }, enter: () => { grains = null; anim = null; S.f = firstRes() * 0.82; } },
      { say: 'Most notes do almost nothing: the plate barely moves and the sand sits still. Watch the curve in the strip: the plate only answers strongly at a few **resonances**.',
        mark: () => [fx(S.f), Lay.sy + Lay.sh / 2, 30] },
      { say: 'Here is a resonance. The plate now swings hard, in a fixed shape: red parts go up while blue parts go down, and between them are lines that **do not move at all**.',
        tools: { motion: true }, enter: () => glide(firstRes()) },
      { say: 'Sand on the moving parts gets thrown up again and again, landing somewhere new each time, until it lands on a line that stays still. There it can rest. Watch the side view!',
        tools: { motion: false, lines: true, side: true } },
      { say: 'Higher notes fit **shorter bending waves** on the plate, so there are more still lines and finer patterns. Every resonance has its own pattern: can you collect them all?',
        tools: { lines: false }, enter: () => { const l = excitable(); if (l.length) glide(l[Math.min(l.length - 1, 12)].f); } },
    ],
  });

  // ---------- challenges
  const after = () => { pending = null; anim = null; S.plateOver = null; colKey = ''; };
  st.setChallenges([
    {
      id: 'higher', title: 'A higher note', card: 'chladni.higher', lock: true, after,
      setup: () => { anim = null; pending = null; grains = null; S.f = firstRes(); },
      q: 'Here is one pattern. Now jump to a resonance much higher up. The new pattern will be…',
      choices: ['finer, with more still lines', 'bigger, with fewer still lines', 'the same pattern, just faster'], answer: 0,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(3, () => { const l = excitable(); glide(l[Math.min(l.length - 1, 14)].f, () => wait(4, () => finish())); }); },
      explain: 'Each resonance fits a whole number of bending waves on the plate. A higher note means shorter waves, so more lines that stay still and a finer pattern.',
    },
    {
      id: 'still', title: 'Where the sand goes', card: 'chladni.nodes', lock: true, after,
      setup: () => { anim = null; pending = null; grains = null; S.f = firstRes(); st.setTool('motion', false); st.setTool('lines', false); },
      q: 'At a resonance, where does the sand end up?',
      choices: ['where the plate moves the most', 'where the plate stays still', 'always at the edges'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(2, () => { st.setTool('motion', true); wait(2, () => { st.setTool('lines', true); wait(1.5, () => finish()); }); }); },
      explain: 'Sand on the moving parts keeps getting kicked into the air. Only on the still lines, the nodes, does it get left alone, so that is where it piles up.',
    },
    {
      id: 'stiff', title: 'An aluminum plate', card: 'chladni.stiff', lock: true, after,
      setup: () => { anim = null; pending = null; S.plateOver = 'plate-square'; grains = null; S.f = firstRes(); },
      q: 'Aluminum is lighter than brass but almost as stiff. Swap to an aluminum plate of the same size. The same pattern now appears at…',
      choices: ['a higher note', 'a lower note', 'the same note'], answer: 0,
      run: (s0, finish) => {
        s0.setPaused(false); s0.setSpeed(1);
        const fb = firstRes();
        wait(2.5, () => { S.plateOver = 'plate-alu'; grains = null; resp = null; const fa = firstRes(); glide(fa, () => wait(3, () => finish(`Brass: ${Math.round(fb)} Hz. Aluminum: ${Math.round(fa)} Hz, the same pattern.`))); });
      },
      explain: 'Bending waves run faster on a plate that is stiffer for its weight. Faster waves mean every resonance moves to a higher note, by about 1.4 times here.',
    },
  ]);

  st.peek = () => ({ L: Lay, fx: (f) => fx(f), f: S.f, found: (rig.flag('chladniFound') || []).length, strength });   // for tests
  renderCollection();
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }, { id: 'plate', label: 'Gallery', build: tabPlate }];

export default bench;
