// 1F · Lens bench. A lamp, one or two lenses and a white screen on a 1.5 m rail. Slide the
// lens and the screen until the picture is sharp; the screen shows what you would really see,
// blurred when out of focus and dimmer when magnified. Then check the lens equation.

import { el, slider, button, group, readout, canvasBox, note, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, dataTable, fitLine, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

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
    g.fillText(Number.isFinite(di) && Math.abs(di) < 1e4 ? `image ${real ? 'real' : 'virtual'}, ${Math.abs(di).toFixed(1)} cm ${real ? 'behind' : 'in front of'} the lens, ${Math.abs(hi / ho).toFixed(2)}× ${hi < 0 ? 'upside down' : 'upright'}` : 'the rays leave parallel: the image is at infinity', 12, 20);
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

bench.tabs = [
  { id: 'bench', label: 'Bench', build: tabBench },
  { id: 'rays', label: 'Rays', build: tabRays },
  { id: 'graph', label: 'Lens equation', build: tabGraph },
];

export default bench;
