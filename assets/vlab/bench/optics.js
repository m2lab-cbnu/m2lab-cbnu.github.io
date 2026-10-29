// 1F · Lens bench. A lamp, one or two lenses and a white screen on a 1.5 m rail. Slide the
// lens and the screen until the picture is sharp; the screen shows what you would really see,
// blurred when out of focus and dimmer when magnified. Then check the lens equation.

import { el, slider, button, group, readout, canvasBox, note, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, dataTable, fitLine, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { tr, trf } from '../i18n.js';

const OBJ = 10;   // cm: where the lamp sits on the rail

const bench = {
  id: 'optics', title: 'Lens bench', kicker: '1F · Classics Hall', icon: '◐', floor: 1,
  blurb: 'Images, focal lengths and the lens equation.',
  slots: [
    { id: 'lens', label: 'Lens', options: ['lens-10', 'lens-20', 'lens-m15', 'lens-x'], def: 'lens-10' },
    { id: 'lens2', label: 'Second lens', options: ['lens-none', 'lens-10', 'lens-20', 'lens-m15'], def: 'lens-none' },
    { id: 'source', label: 'Light source', options: ['src-arrow', 'src-candle', 'src-far'], def: 'src-arrow' },
    { id: 'stop', label: 'Aperture', options: ['no-iris', 'iris'], def: 'no-iris' },
  ],
};
bench.header = rigStrip(bench);

const S = { x1: 35, x2: 70, xs: 60 };

function focal(id) {
  if (id === 'lens-x') return rig.secret('lensF');
  return ITEMS[id].phys.f * 100;   // cm
}
// 2x2 matrices for (height, angle)
const T = (d) => [1, d, 0, 1];
const L = (f) => [1, 0, -1 / f, 1];
const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3]];

// the optical system from the lamp (or from lens 1, for light from far away) to the screen
function system() {
  const f1 = focal(current(bench, 'lens')), id2 = current(bench, 'lens2'), two = id2 !== 'lens-none';
  const f2 = two ? focal(id2) : null;
  const far = current(bench, 'source') === 'src-far';
  const a = current(bench, 'stop') === 'iris' ? 0.35 : 1.8;   // aperture radius, cm
  const els = [{ x: S.x1, f: f1 }];
  if (two) els.push({ x: S.x2, f: f2 });
  els.sort((p, q) => p.x - q.x);
  const start = far ? els[0].x : OBJ;
  let M = [1, 0, 0, 1], x = start;
  for (const e of els) { if (e.x > S.xs) break; M = mul(L(e.f), mul(T(e.x - x), M)); x = e.x; }
  M = mul(T(S.xs - x), M);
  const d1 = els[0].x - OBJ;
  return { M, a, far, f1, f2, two, els, d1, behind: els.some((e) => e.x > S.xs) };
}
// what the screen shows: centre scale (magnification) and blur radius, in cm
function screenImage() {
  const s = system();
  const [A, B] = s.M;
  if (s.far) {
    const alpha = 0.012;   // the far-away arrow subtends about 0.7 degrees
    return { mag: B * alpha / 3, blur: Math.abs(A) * s.a, light: 1.6 / Math.max(0.2, Math.abs(A) * s.a + 0.05) ** 1.2, s };
  }
  const d1 = s.d1;
  const mag = A - B / d1;
  const blur = Math.abs(B) * s.a / d1;
  const light = (s.a / d1) ** 2 * 900 / Math.max(0.05, mag * mag);
  return { mag, blur, light, s };
}

const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'lens', label: 'Lens', fmt: (v) => ITEMS[v].name },
  { key: 'dO', label: 'Lamp to lens d_o (cm)', fmt: (v) => (Number.isFinite(v) ? v.toFixed(1) : 'far away') },
  { key: 'dI', label: 'Lens to screen d_i (cm)', fmt: (v) => v.toFixed(1) },
  { key: 'h', label: 'Image height (cm)', fmt: (v) => v.toFixed(2) },
], { caption: 'Sharp images you found', onChange: () => bench._graph && bench._graph() });

function tabBench(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Slide the lens and the screen until the picture on the screen is sharp, then record it. The lamp is fixed at 10 cm. Try the collimator (light from far away), the iris, and two lenses together.' }));
  const scr = canvasBox('is-dark', '4 / 3', 'What the white screen shows');
  const rail = canvasBox('', '16 / 4', 'The rail with the lamp, the lens and the screen');
  const l1 = slider({ label: 'Lens position', unit: 'cm', min: 12, max: 145, step: 0.1, value: S.x1, digits: 4, onInput: (v) => { S.x1 = v; draw(); } });
  const l2 = slider({ label: 'Second lens position', unit: 'cm', min: 12, max: 148, step: 0.1, value: S.x2, digits: 4, onInput: (v) => { S.x2 = v; draw(); } });
  const sc = slider({ label: 'Screen position', unit: 'cm', min: 14, max: 150, step: 0.1, value: S.xs, digits: 4, onInput: (v) => { S.xs = v; draw(); } });
  const hRo = readout('Image height (ruler on the screen)'), dRo = readout('Lamp to lens'), iRo = readout('Lens to screen');
  const rec = button('Record: this is sharp', () => {
    const im = screenImage();
    const far = im.s.far;
    table.add({ n: table.rows.length + 1, lens: current(bench, 'lens'), dO: far ? Infinity : S.x1 - OBJ, dI: S.xs - S.x1, h: Math.abs(im.mag * 3), blur: im.blur });
    rig.note({ bench: 'optics', lens: current(bench, 'lens'), dO: far ? Infinity : S.x1 - OBJ, dI: S.xs - S.x1, blur: im.blur });
  }, 'secondary');
  const side = el('div', { class: 'vp-side' }, group('Positions on the rail', l1, l2, sc), rec);
  pane.append(el('div', { class: 'vp-cols' }, side, el('div', { class: 'vp-main' }, scr, rail, el('div', { class: 'ros' }, dRo, iRo, hRo))), table.el);
  function sync() { l2.hidden = current(bench, 'lens2') === 'lens-none'; draw(); }
  onRig(bench, sync);

  let flick = 0, raf = 0;
  function draw() {
    const im = screenImage();
    drawScreen(scr.canvas, im, flick);
    drawRail(rail.canvas, im.s);
    dRo.set(im.s.far ? 'far away (collimator)' : `${(S.x1 - OBJ).toFixed(1)} cm`);
    iRo.set(`${(S.xs - S.x1).toFixed(1)} cm`);
    hRo.set(im.blur < 0.25 ? `${Math.abs(im.mag * 3).toFixed(2)} cm${im.mag < 0 ? ', upside down' : ', upright'}` : 'too blurry to measure');
  }
  // the candle flickers
  function tick() { raf = requestAnimationFrame(tick); if (current(bench, 'source') === 'src-candle') { flick += 0.15; draw(); } }
  sync();
  return { show() { tick(); draw(); }, hide() { cancelAnimationFrame(raf); }, resize() { draw(); } };
}

function drawScreen(c, im, flick) {
  const { g, w, h } = fitCanvas(c);
  g.fillStyle = '#0B1830'; g.fillRect(0, 0, w, h);
  // the white card
  const cw = w * 0.86, ch = h * 0.86, cx = w / 2, cy = h / 2;
  g.fillStyle = '#EEF4F8'; g.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
  const pxPerCm = Math.min(cw / 12, ch / 9);
  const src = current(bench, 'source');
  const glow = Math.min(1, im.light);
  // a soft patch of light that is there even when nothing is sharp
  const R = Math.min(cw, Math.max(10, (im.blur + Math.abs(im.mag) * 1.5) * pxPerCm));
  const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2 + 10);
  rg.addColorStop(0, `rgba(255, 236, 160, ${0.25 * glow})`); rg.addColorStop(1, 'rgba(255, 236, 160, 0)');
  g.fillStyle = rg; g.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
  // the picture: drawn at the size of the image, flipped if inverted, blurred if out of focus
  g.save();
  g.beginPath(); g.rect(cx - cw / 2, cy - ch / 2, cw, ch); g.clip();
  const blurPx = Math.min(60, im.blur * pxPerCm);
  g.filter = blurPx > 0.4 ? `blur(${blurPx.toFixed(1)}px)` : 'none';
  g.globalAlpha = Math.max(0.05, Math.min(1, glow * (1 / (1 + blurPx / 6))));
  g.translate(cx, cy);
  g.scale(im.mag * pxPerCm, im.mag * pxPerCm);   // object units: cm, y up
  if (src === 'src-candle') {
    g.fillStyle = '#FFFDF6'; g.fillRect(-0.5, -1.0, 1.0, 2.2);
    const fl = 0.08 * Math.sin(flick * 3.1) + 0.05 * Math.sin(flick * 7.3);
    g.fillStyle = '#F29E4C'; g.beginPath(); g.ellipse(fl, -2.2, 0.45, 1.05, fl * 0.5, 0, 7); g.fill();
    g.fillStyle = '#FFE07A'; g.beginPath(); g.ellipse(fl * 0.8, -2.0, 0.22, 0.6, 0, 0, 7); g.fill();
  } else {
    // a lit arrow, 3 cm tall, standing on the axis
    g.fillStyle = '#FFE07A';
    g.fillRect(-0.18, -3.0 + 0.9, 0.36, 3.0 - 0.9);
    g.beginPath(); g.moveTo(-0.75, -2.1); g.lineTo(0, -3.0); g.lineTo(0.75, -2.1); g.closePath(); g.fill();
    g.fillStyle = '#F29E4C'; g.fillRect(-0.7, -0.15, 1.4, 0.3);
  }
  g.restore();
  // ruler along the edge of the card
  g.fillStyle = '#12243A'; g.font = '500 10px "Plex", system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (let k = -4; k <= 4; k++) { const y = cy - k * pxPerCm; g.fillRect(cx - cw / 2, y, k % 2 === 0 ? 12 : 7, 1); if (k % 2 === 0) g.fillText(`${k} cm`.replace('-', '−'), cx - cw / 2 + 14, y); }
  g.fillStyle = 'rgba(18,36,58,0.25)'; g.fillRect(cx - cw / 2, cy, cw, 1);
}

function drawRail(c, s) {
  const { g, w, h } = fitCanvas(c);
  g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, w, h);
  const X = (cm) => 14 + (cm / 150) * (w - 28), y0 = h * 0.62;
  g.fillStyle = '#6A86A8'; g.fillRect(X(0), y0, X(150) - X(0), 6);
  g.fillStyle = '#12243A'; g.font = '500 10px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
  for (let cm = 0; cm <= 150; cm += 10) { g.fillRect(X(cm), y0 + 6, 1, cm % 50 === 0 ? 8 : 4); if (cm % 50 === 0) g.fillText(cm + ' cm', X(cm), y0 + 15); }
  const far = s.far;
  g.fillStyle = far ? '#4F6A8F' : '#2E4A7D'; g.fillRect(X(OBJ) - 10, y0 - 22, 14, 22);
  g.fillStyle = '#FFE07A'; g.fillRect(X(OBJ) + 4, y0 - 16, 3, 10);
  const lensAt = (x, f, col) => { g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); if (f > 0) { g.ellipse(X(x), y0 - 18, 3, 16, 0, 0, 7); } else { g.moveTo(X(x) - 3, y0 - 34); g.lineTo(X(x) + 3, y0 - 34); g.moveTo(X(x), y0 - 34); g.lineTo(X(x), y0 - 2); g.moveTo(X(x) - 3, y0 - 2); g.lineTo(X(x) + 3, y0 - 2); } g.stroke(); g.fillStyle = '#6A86A8'; g.fillRect(X(x) - 1, y0 - 2, 2, 4); };
  lensAt(S.x1, s.f1, '#00A9D6');
  if (s.two) lensAt(S.x2, s.f2, '#6B5BE6');
  g.fillStyle = '#EEF4F8'; g.strokeStyle = '#1B2440'; g.lineWidth = 1; g.fillRect(X(S.xs) - 2, y0 - 36, 5, 36); g.strokeRect(X(S.xs) - 2, y0 - 36, 5, 36);
}

// ---------------------------------------------------------------- rays
function tabRays(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Three easy rays from the tip of the arrow: one parallel to the axis (it then passes through the focus), one through the centre of the lens (straight on), and one through the near focus (it leaves parallel). Where they meet is the image. If they spread apart, trace them backwards: a <b>virtual</b> image.' }));
  const box = canvasBox('', '16 / 8', 'Ray diagram for the first lens');
  pane.append(el('div', { class: 'vp-main' }, box, note('The diagram uses the first lens only. Positions follow the sliders on the Bench tab.')));
  function draw() {
    const { g, w, h } = fitCanvas(box.canvas);
    g.fillStyle = '#FFFDF6'; g.fillRect(0, 0, w, h);
    const f = focal(current(bench, 'lens')), dO = S.x1 - OBJ, ho = 3;
    const di = 1 / (1 / f - 1 / dO), hi = -ho * di / dO;
    const span = Math.max(60, Math.min(220, Math.max(dO + Math.abs(di) + 20, 2.5 * Math.abs(f) + dO)));
    const xL = 30 + (dO + 10) / span * (w - 60);
    const sc = (w - 60) / span, ys = (h * 0.42) / Math.max(4, Math.min(12, Math.abs(hi) + 1));
    const X = (x) => xL + x * sc, Y = (y) => h / 2 - y * ys;
    g.strokeStyle = 'rgba(18,36,58,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(w, Y(0)); g.stroke();
    // lens and foci
    g.strokeStyle = '#00A9D6'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(0), Y(-5.5)); g.lineTo(X(0), Y(5.5)); g.stroke();
    g.fillStyle = '#12243A'; g.font = '600 12px "Plex", system-ui, sans-serif'; g.textAlign = 'center';
    for (const s of [-1, 1]) { g.beginPath(); g.arc(X(s * Math.abs(f)), Y(0), 3.5, 0, 7); g.fill(); g.fillText('F', X(s * Math.abs(f)), Y(0) + 18); }
    // object
    const arrow = (x, y, col, dash) => { g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.5; g.setLineDash(dash ? [5, 4] : []); g.beginPath(); g.moveTo(X(x), Y(0)); g.lineTo(X(x), Y(y)); g.stroke(); g.setLineDash([]); const d = Math.sign(y) || 1; g.beginPath(); g.moveTo(X(x) - 6, Y(y) + 8 * d); g.lineTo(X(x), Y(y)); g.lineTo(X(x) + 6, Y(y) + 8 * d); g.fill(); };
    arrow(-dO, ho, '#E8C25A');
    const real = di > 0 && Number.isFinite(di);
    const end = Math.max(X(Math.abs(di) + 15), w);
    const ray = (pts, col) => { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); };
    const xEnd = (end - xL) / sc;
    // 1: parallel, then through the far focus
    const s1 = -ho / f; ray([[-dO, ho], [0, ho], [xEnd, ho + s1 * xEnd]], '#E5534B');
    // 2: through the centre
    const s2 = -ho / dO; ray([[-dO, ho], [xEnd, ho + s2 * (xEnd + dO)]], '#4CB782');
    // 3: through the near focus, then parallel
    if (Math.abs(dO - f) > 0.5) { const yl = ho - ho * dO / (dO - f); ray([[-dO, ho], [0, yl], [xEnd, yl]], '#6B5BE6'); }
    if (!real && Number.isFinite(di)) {
      g.setLineDash([4, 4]);
      ray([[0, ho], [di, hi]], 'rgba(229,83,75,0.6)'); ray([[0, 0], [di, hi]], 'rgba(76,183,130,0.6)');
      g.setLineDash([]);
    }
    if (Number.isFinite(di) && Math.abs(di) < 1e4) arrow(di, hi, real ? '#E0457B' : 'rgba(224,69,123,0.7)', !real);
    g.fillStyle = '#12243A'; g.textAlign = 'left';
    g.fillText(Number.isFinite(di) && Math.abs(di) < 1e4 ? trf('image {0}, {1} cm {2} the lens, {3}× {4}', tr(real ? 'real' : 'virtual'), Math.abs(di).toFixed(1), tr(real ? 'behind' : 'in front of'), Math.abs(hi / ho).toFixed(2), tr(hi < 0 ? 'upside down' : 'upright')) : 'the rays leave parallel: the image is at infinity', 12, 20);
    if (current(bench, 'lens') === 'lens-x') { g.fillStyle = '#6B5BE6'; g.fillText('(the mystery lens: positions of F hidden on the real bench!)', 12, 38); }
  }
  bench._rays = draw;
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the lens equation
function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'For a thin lens, <b>1/f = 1/d_o + 1/d_i</b>. Plot 1/d_i against 1/d_o: the points lie on a line of slope −1, and where it meets either axis is 1/f.' }));
  const box = canvasBox('', '16 / 10', 'One over image distance against one over object distance');
  const plot = new Plot(box.canvas, { xlabel: '1/d_o (1/cm)', ylabel: '1/d_i (1/cm)' });
  const fRo = readout('Focal length from your data'), nRo = readout('Points (this lens)');
  pane.append(el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, fRo, nRo)));
  function draw() {
    const lens = current(bench, 'lens');
    const rows = table.rows.filter((r) => r.lens === lens && r.dI > 0);
    const x = rows.map((r) => (Number.isFinite(r.dO) ? 1 / r.dO : 0)), y = rows.map((r) => 1 / r.dI);
    const series = [{ x, y, points: true, r: 4.5, color: COLORS.signal, label: 'your sharp images' }];
    let fEst = null;
    if (x.length >= 2) {
      // fit with the slope fixed at -1: intercept is the mean of (y + x)
      const b = x.reduce((s, xi, i) => s + y[i] + xi, 0) / x.length;
      fEst = 1 / b;
      series.push({ x: [0, b], y: [b, 0], color: COLORS.pink, dash: [6, 4], width: 2, label: 'slope −1 through your points' });
    } else if (x.length === 1) fEst = 1 / (x[0] + y[0]);
    plot.setSeries(series).draw();
    fRo.set(fEst ? `${fEst.toFixed(2)} cm` : '–'); nRo.set(String(x.length));
  }
  bench._graph = draw;
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'hoo', label: 'An optical rail with a lamp, a lens and a white screen. Drag the lens and the screen along the rail.',
    hello: 'Drag the **lens** and the **screen** along the rail until the picture on the screen (top right) is sharp. The yellow lines are rays of light from the tip of the arrow.',
    aspect: 16 / 8.8, time: false,
    onReset: () => { S.x1 = 35; S.xs = 60; cover = 0; },
    keys: { arrow(dx, dy) { if (dx) S.x1 = clampLens(S.x1 + dx * 0.5); if (dy) S.xs = clampScreen(S.xs - dy * 0.5); } },
  });
  st.tool('fan', 'Rays', { icon: '#FFD54F', on: true }).tool('principal', 'Three easy rays', { icon: K.COL.net }).tool('focus', 'Focal points', { icon: K.COL.gravity })
    .tool('ghost', 'Where the image is', { icon: K.COL.pe });
  st.readout('dO', 'Lamp to lens').readout('dI', 'Lens to screen').readout('img', 'Picture on the screen').readout('sharp', 'Sharpness');
  let cover = 0, first = true, Lay = { w: 800, h: 440, x0: 30, s: 5, ay: 220, vs: 14 };
  const clampLens = (x) => Math.max(OBJ + 2, Math.min(145, x));
  const clampScreen = (x) => Math.max(S.x1 + 1, Math.min(150, x));

  st.onResize((w, h, narrow) => {
    const x0 = narrow ? 16 : 36, s = (w - 2 * x0) / 150;
    Lay = { w, h, x0, s, ay: Math.round(h * 0.5), vs: Math.min(28, h / 18), narrow };
  });
  const X = (cm) => Lay.x0 + cm * Lay.s;
  const Y = (cm) => Lay.ay - cm * Lay.vs;

  // trace one ray from (x0, y0) with slope m through the lenses, until xEnd (or a blocked lens)
  function trace(x0, y0, m, xEnd, lenses, aperture) {
    const pts = [[x0, y0]];
    let x = x0, y = y0;
    for (const L of lenses) {
      if (L.x > xEnd || L.x < x) continue;
      y = y + m * (L.x - x); x = L.x;
      pts.push([x, y]);
      if (Math.abs(y) > aperture) return { pts, blocked: true };
      if (L.cover && y > aperture * (1 - 2 * L.cover)) return { pts, blocked: true };
      m = m - y / L.f;
    }
    y = y + m * (xEnd - x); pts.push([xEnd, y]);
    return { pts, blocked: false, m, y };
  }

  function lensesNow() {
    const s = system();
    return s.els.map((e, i) => ({ x: e.x, f: e.f, cover: i === 0 ? cover : 0 }));
  }

  // where the sharp image of the arrow tip is (for one lens), in cm
  function imageOf() {
    const s = system();
    if (s.far) return { x: s.els[0].x + s.f1, h: null };
    const d = s.els[0].x - OBJ, f = s.f1;
    if (Math.abs(d - f) < 0.01) return { x: Infinity, h: null };
    const di = 1 / (1 / f - 1 / d);
    return { x: s.els[0].x + di, h: -3 * di / d, virtual: di < 0 };
  }

  function drawRail(g, w, h) {
    K.room(g, w, h, K.THEME[1], { floorH: 0.12 });
    K.benchTop(g, 8, Lay.ay + 70, w - 16, 14, 20, K.MAT.wood);
    // the rail
    K.box(g, X(0) - 6, Lay.ay + 56, 150 * Lay.s + 12, 14, K.MAT.alu, { r: 3 });
    g.save(); g.fillStyle = K.INK; g.font = `600 10px ${K.FONT}`; g.textAlign = 'center';
    for (let cm = 0; cm <= 150; cm += 2) { const big = cm % 10 === 0; g.fillRect(X(cm) - 0.5, Lay.ay + 56, 1, big ? 8 : 4); if (big && cm % 20 === 0) g.fillText(cm + ' cm', X(cm), Lay.ay + 102); }
    g.restore();
    // the optical axis
    K.lineSeg(g, X(0), Lay.ay, X(150), Lay.ay, K.hexA(K.LINE, 0.25), 1.2, [6, 6]);
  }

  function drawLamp(g, s) {
    const x = X(OBJ);
    K.box(g, x - 34, Lay.ay - 10, 28, 64, K.MAT.navy, { r: 5 });
    if (s.far) { K.box(g, x - 8, Lay.ay - 12, 26, 24, K.MAT.steel, { r: 4 }); K.tag(g, 'collimator: light from far away', x + 4, Lay.ay - 48, { size: 11 }); return; }
    const src = current(bench, 'source');
    if (src === 'src-candle') {
      K.box(g, x - 4, Y(1.2), 8, Lay.ay - Y(1.2) + 2, K.MAT.cream, { r: 2 });
      const fl = Math.sin(st.t * 9) * 0.6;
      g.save(); g.beginPath(); g.ellipse(x + fl, Y(2.6), 6, 15, fl * 0.05, 0, Math.PI * 2); g.fillStyle = '#F29E4C'; g.fill(); g.beginPath(); g.ellipse(x + fl * 0.7, Y(2.3), 3, 8, 0, 0, Math.PI * 2); g.fillStyle = '#FFE07A'; g.fill(); g.restore();
      K.glow(g, x, Y(2.4), 50, '#FFB46B', 0.5);
    } else {
      // the lit arrow, 3 cm tall
      g.save(); g.fillStyle = '#FFE07A'; g.strokeStyle = K.LINE; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x - 3, Lay.ay); g.lineTo(x - 3, Y(2.1)); g.lineTo(x - 10, Y(2.1)); g.lineTo(x, Y(3)); g.lineTo(x + 10, Y(2.1)); g.lineTo(x + 3, Y(2.1)); g.lineTo(x + 3, Lay.ay); g.closePath(); g.fill(); g.stroke(); g.restore();
      K.glow(g, x, Y(1.6), 46, '#FFE07A', 0.45);
    }
  }

  function drawLens(g, x, f, hover, col = '#7FE4FF') {
    const ap = 1.8 * Lay.vs + 6, cx = X(x);
    K.box(g, cx - 5, Lay.ay + ap - 2, 10, 58 - ap + 2, K.MAT.steel, { r: 2 });
    K.box(g, cx - 14, Lay.ay + 50, 28, 10, K.MAT.navy, { r: 3 });
    if (hover) K.glow(g, cx, Lay.ay, 70, '#00D4FF', 0.35);
    g.save();
    g.beginPath();
    const bulge = f > 0 ? 9 : -6;
    g.moveTo(cx, Lay.ay - ap); g.quadraticCurveTo(cx + 6 + bulge, Lay.ay, cx, Lay.ay + ap); g.quadraticCurveTo(cx - 6 - bulge, Lay.ay, cx, Lay.ay - ap);
    if (f < 0) { g.closePath(); }
    g.fillStyle = K.hexA(col, 0.45); g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    g.beginPath(); g.moveTo(cx - 2, Lay.ay - ap + 8); g.lineTo(cx - 2, Lay.ay - 6); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.stroke();
    g.restore();
    return ap;
  }

  function drawScreenHolder(g, hover) {
    const cx = X(S.xs);
    K.box(g, cx - 4, Lay.ay - 6 * Lay.vs, 8, 6 * Lay.vs * 2 + 2, K.MAT.white, { r: 2 });
    K.box(g, cx - 5, Lay.ay + 6 * Lay.vs, 10, 56 - 6 * Lay.vs, K.MAT.steel, { r: 2 });
    K.box(g, cx - 14, Lay.ay + 50, 28, 10, K.MAT.navy, { r: 3 });
    if (hover) K.glow(g, cx, Lay.ay, 70, '#00D4FF', 0.3);
  }

  function rays(g, s, lenses) {
    const ap = 1.8, a = current(bench, 'stop') === 'iris' ? 0.35 : ap;
    g.save(); g.globalCompositeOperation = 'source-over'; g.lineCap = 'round';
    const n = 9;
    const tipY = s.far ? 0 : 3;
    for (let i = 0; i < n; i++) {
      const yl = -a + 2 * a * i / (n - 1);              // where the ray meets the first lens
      let x0, y0, m;
      if (s.far) { x0 = OBJ; y0 = yl; m = 0.006; }      // nearly parallel light
      else { x0 = OBJ; y0 = tipY; m = (yl - tipY) / (lenses[0].x - OBJ); }
      const r = trace(x0, y0, m, S.xs, lenses, ap);
      g.beginPath(); r.pts.forEach(([x, y], k) => { if (k) g.lineTo(X(x), Y(y)); else g.moveTo(X(x), Y(y)); });
      g.strokeStyle = r.blocked ? 'rgba(242,158,76,0.45)' : 'rgba(255,196,60,0.9)'; g.lineWidth = r.blocked ? 1.5 : 2.2; g.stroke();
      if (!r.blocked) { const [ex, ey] = r.pts[r.pts.length - 1]; K.glow(g, X(ex), Y(ey), 7, '#FFD54F', 0.6); }
    }
    g.restore();
  }

  function principal(g, s) {
    if (s.far || s.two) return;
    const xL = s.els[0].x, f = s.f1, h0 = 3, d = xL - OBJ;
    const end = Math.max(S.xs, xL + 10);
    const col = K.COL.net;
    const seg = (pts, dash) => K.polyline(g, pts.map(([x, y]) => [X(x), Y(y)]), col, 2.5, { dash });
    // 1: parallel, then through the far focus
    seg([[OBJ, h0], [xL, h0], [end, h0 - (end - xL) * h0 / f]]);
    // 2: through the centre, straight on
    seg([[OBJ, h0], [end, h0 - (end - OBJ) * h0 / d]]);
    // 3: through the near focus, then parallel
    if (Math.abs(d - f) > 0.5) { const yL = h0 - d * h0 / (d - f); if (Math.abs(yL) < 6) seg([[OBJ, h0], [xL, yL], [end, yL]]); }
    // traced backwards for a virtual image
    const im = imageOf();
    if (im.virtual) { seg([[xL, h0], [im.x, im.h]], [5, 5]); seg([[xL, 0], [im.x, im.h]], [5, 5]); }
  }

  function screenCard(g, im) {
    const cw = Lay.narrow ? 150 : 230, ch = cw * 0.72, x = Lay.w - cw - 16, y = 14;
    K.box(g, x - 6, y - 6, cw + 12, ch + 30, K.MAT.navy, { r: 10 });
    K.text(g, 'what the screen shows', x + cw / 2, y + ch + 17, { size: 11.5, weight: 600, align: 'center', color: '#A8ECFF' });
    g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip();
    g.fillStyle = '#EEF4F8'; g.fillRect(x, y, cw, ch);
    const pxPerCm = Math.min(cw / 12, ch / 9), cx = x + cw / 2, cy = y + ch / 2;
    const glowK = Math.min(1, im.light) * (1 - cover * 0.95);
    const R = Math.min(cw, Math.max(10, (im.blur + Math.abs(im.mag) * 1.5) * pxPerCm));
    const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.2 + 10);
    rg.addColorStop(0, `rgba(255,236,160,${0.3 * glowK})`); rg.addColorStop(1, 'rgba(255,236,160,0)');
    g.fillStyle = rg; g.fillRect(x, y, cw, ch);
    const blurPx = Math.min(40, im.blur * pxPerCm);
    g.filter = blurPx > 0.4 ? `blur(${blurPx.toFixed(1)}px)` : 'none';
    g.globalAlpha = Math.max(0.04, Math.min(1, glowK * (1 / (1 + blurPx / 6))));
    g.translate(cx, cy); g.scale(im.mag * pxPerCm, im.mag * pxPerCm);
    if (current(bench, 'source') === 'src-candle') {
      g.fillStyle = '#FFFDF6'; g.fillRect(-0.5, -1.0, 1.0, 2.2);
      g.fillStyle = '#F29E4C'; g.beginPath(); g.ellipse(0, -2.2, 0.45, 1.05, 0, 0, 7); g.fill();
    } else {
      g.fillStyle = '#F2B90F';
      g.fillRect(-0.18, -2.1, 0.36, 2.1); g.beginPath(); g.moveTo(-0.75, -2.1); g.lineTo(0, -3.0); g.lineTo(0.75, -2.1); g.closePath(); g.fill();
      g.fillStyle = '#E07A2B'; g.fillRect(-0.7, -0.15, 1.4, 0.3);
    }
    g.restore();
    g.save(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.strokeRect(x, y, cw, ch); g.restore();
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, drawRail);
    const s = system(), lenses = lensesNow(), im = screenImage();
    drawLamp(g, s);
    if (st.on('focus')) for (const L of lenses) for (const sg of [-1, 1]) {
      const fx = L.x + sg * L.f; if (fx < 0 || fx > 150) continue;
      g.beginPath(); g.arc(X(fx), Lay.ay, 5, 0, Math.PI * 2); g.fillStyle = K.COL.gravity; g.fill(); g.lineWidth = 1.5; g.strokeStyle = K.LINE; g.stroke();
      K.text(g, 'F', X(fx), Lay.ay + 20, { size: 12, weight: 700, align: 'center', color: K.COL.gravity });
    }
    if (st.on('fan')) rays(g, s, lenses);
    if (st.on('principal')) principal(g, s);
    if (st.on('ghost') && !s.two) {
      const ii = imageOf();
      if (Number.isFinite(ii.x) && ii.h !== null && ii.x > 0 && ii.x < 152) {
        const x = X(ii.x), top = Y(ii.h);
        g.save(); g.globalAlpha = ii.virtual ? 0.45 : 0.7; g.setLineDash(ii.virtual ? [5, 4] : []);
        K.arrow(g, x, Lay.ay, x, top, '#F2B90F', { lw: 4, halo: false });
        g.restore();
        K.tag(g, ii.virtual ? 'virtual image' : 'sharp image here', x, Math.min(top, Lay.ay) - 18, { size: 11, bg: '#FFF1B0' });
      }
    }
    lenses.forEach((L, i) => drawLens(g, L.x, L.f, st.hovering(i ? 'lens2' : 'lens'), i ? '#C3B4FF' : '#7FE4FF'));
    // the card covering part of the first lens
    if (cover > 0.01) {
      const ap = 1.8 * Lay.vs + 6, cx = X(lenses[0].x);
      K.box(g, cx - 12, Lay.ay - ap - 6, 24, ap * 2 * cover + 6, ['#3D6FB6', '#9CCBFF', '#22508F'], { r: 3 });
    }
    drawScreenHolder(g, st.hovering('screen'));
    screenCard(g, im);
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.arrow(g, X(lenses[0].x) + 46 + k * 8, Lay.ay - 70, X(lenses[0].x) + 10, Lay.ay - 36, K.COL.normal, { lw: 3.5, head: 11 }); }
  });
  st.onOver(() => {
    const s = system(), im = screenImage();
    st.set('dO', s.far ? 'far away' : `${(s.els[0].x - OBJ).toFixed(1)} cm`);
    st.set('dI', `${(S.xs - s.els[0].x).toFixed(1)} cm`);
    st.set('img', im.blur < 0.25 ? `${Math.abs(im.mag * 3).toFixed(2)} cm, ${im.mag < 0 ? 'upside down' : 'upright'}` : 'blurry');
    st.set('sharp', im.blur < 0.08 ? 'sharp!' : im.blur < 0.3 ? 'nearly' : im.blur < 1 ? 'blurry' : 'very blurry');
    if (im.blur < 0.08 && !st._sharpOnce) { st._sharpOnce = true; sound.play('chime'); st.flash('Sharp!'); }
    if (im.blur > 0.3) st._sharpOnce = false;
  });

  // ---------- hands: slide the lens and the screen
  const slide = (id, get, set) => ({
    id, cursor: 'ew-resize',
    hit: (x, y) => { const d = Math.abs(x - X(get())); return d < 18 && y > Lay.ay - 7 * Lay.vs - 10 && y < Lay.ay + 64 ? d : false; },
    down: (x) => { first = false; st._dx = x - X(get()); },
    move: (x) => set((x - st._dx - Lay.x0) / Lay.s),
  });
  st.handle(slide('lens', () => S.x1, (v) => { S.x1 = clampLens(v); if (S.xs < S.x1 + 1) S.xs = Math.min(150, S.x1 + 1); }));
  st.handle({ ...slide('lens2', () => S.x2, (v) => { S.x2 = Math.max(OBJ + 2, Math.min(148, v)); }), enabled: () => current(bench, 'lens2') !== 'lens-none' });
  st.handle(slide('screen', () => S.xs, (v) => { S.xs = clampScreen(v); }));
  st.hint('Slide the lens or the screen along the rail', { sticky: true });

  // ---------- why
  const put = (x1, xs) => { S.x1 = x1; S.xs = xs; };
  st.tour({
    title: 'How does a lens make a picture?',
    steps: [
      { say: 'Light leaves every point of the lamp in **all directions**. Here are rays from the tip of the arrow, fanning out towards the lens.', tools: { fan: true, principal: false, focus: false, ghost: false }, enter: () => put(40, 46) },
      { say: 'A convex lens bends each ray, more strongly the farther from the middle it passes. So rays from the tip **come back together at one point**: the image of the tip.', tools: { ghost: true }, enter: () => put(40, 70) },
      { say: 'Put the screen exactly there and the picture is **sharp**. In front of that point or behind it, the light from each point is spread over a patch: **blurry**.', enter: () => put(40, 55) },
      { say: 'Three easy rays find the image without any maths. Parallel to the axis → through the focus **F**. Through the centre → straight on. Through the near focus → out parallel.', tools: { fan: false, principal: true, focus: true }, enter: () => put(40, 55) },
      { say: 'Bring the lens closer: the lamp nears the focus and the image runs **far away and gets big**. Closer than the focus, the rays spread apart: no picture on the screen, but your eye sees a big upright image. That is a **magnifying glass**.', tools: { principal: true, focus: true, ghost: true }, enter: () => put(17, 100) },
    ],
    onEnd: () => put(35, 60),
  });

  // ---------- challenges
  const after = () => { cover = 0; };
  st.setChallenges([
    {
      id: 'half', title: 'Half a lens', card: 'optics.half', after,
      setup: () => { put(30, 50); },
      q: 'The picture is sharp. Now cover the top half of the lens with a card. What happens to the picture on the screen?', choices: ['Its top half disappears', 'Its bottom half disappears', 'The whole picture stays, just dimmer'], answer: 2,
      run: (s, finish) => { s.setTool('fan', true); let k = 0; const t = setInterval(() => { k += 0.05; cover = Math.min(0.5, k); if (k >= 0.5) { clearInterval(t); setTimeout(() => finish(), 1200); } }, 60); },
      explain: 'Every part of the lens gets light from every part of the lamp. Covering half the lens just removes half the rays for every point, so the whole picture is still there, only dimmer.',
    },
    {
      id: 'twof', title: 'Twice the focal length', card: 'optics.2f',
      setup: () => { put(30, 40); },
      q: 'A +10 cm lens, with the lamp 20 cm away (twice the focal length). Where the picture is sharp, it is…', choices: ['bigger than the lamp', 'the same size, upside down', 'smaller, the right way up'], answer: 1,
      run: (s, finish) => { s.setTool('ghost', true); s.setTool('principal', true); let x = 40; const t = setInterval(() => { x += 1; S.xs = x; if (x >= 50) { clearInterval(t); setTimeout(() => finish(`Sharp at ${(S.xs - S.x1).toFixed(0)} cm behind the lens.`), 900); } }, 80); },
      explain: 'At 2f in front, the image forms 2f behind, the same size and upside down. Closer than 2f the image is bigger (a projector); farther, it is smaller (a camera).',
    },
    {
      id: 'inside', title: 'Too close', card: 'optics.inside',
      setup: () => { put(17, 60); },
      q: 'The lamp is closer to the +10 cm lens than its focal length. Slide the screen anywhere. What do you get?', choices: ['a big sharp picture', 'a small sharp picture', 'no sharp picture anywhere'], answer: 2,
      run: (s, finish) => { s.setTool('fan', true); s.setTool('ghost', true); let x = 20; const t = setInterval(() => { x += 3; S.xs = Math.min(150, x); if (x >= 150) { clearInterval(t); finish(); } }, 60); },
      explain: 'Inside the focus the lens cannot bend the rays enough to bring them back together: they leave spreading apart. Traced backwards they seem to come from a big, upright, virtual image, which is what a magnifying glass shows your eye.',
    },
  ]);

  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'bench', label: 'Measure', build: tabBench },
  { id: 'rays', label: 'Rays', build: tabRays },
  { id: 'graph', label: 'Lens equation', build: tabGraph },
];

export default bench;
