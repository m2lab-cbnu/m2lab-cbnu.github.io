// 1F · Field table. Charged pucks on a glass table. Drag them around and watch the field
// lines and the equipotentials follow; read the potential and the field with a probe, or let a
// small test charge go and see where the field takes it.

import { el, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { contour } from '../ui/contour.js';
import { rigStrip, current, onRig, loop, fitCanvas, fmtNum } from './common.js';
import { rig } from '../rpg/state.js';

const K = 8.988;          // k q for q = 1 nC, in V m
const W = 40, H = 30;     // table size, cm

const bench = {
  id: 'field', title: 'Field table', kicker: '1F · Classics Hall', icon: '±', floor: 1,
  blurb: 'Charges, field lines and equipotentials.',
  slots: [
    { id: 'layout', label: 'On the table', options: ['charges', 'plates'], def: 'charges' },
    { id: 'tool', label: 'Tool', options: ['probe', 'testq'], def: 'probe' },
  ],
};
bench.header = rigStrip(bench);

const S = {
  charges: [{ x: 13, y: 15, q: 1 }, { x: 27, y: 15, q: -1 }],
  probe: { x: 20, y: 8 }, lines: true, equi: true, shade: false, sel: -1, test: null, trail: [],
};
const PRESETS = {
  dipole: [{ x: 13, y: 15, q: 1 }, { x: 27, y: 15, q: -1 }],
  alike: [{ x: 13, y: 15, q: 1 }, { x: 27, y: 15, q: 1 }],
  one4: [{ x: 10, y: 15, q: 1 }, { x: 31, y: 15, q: 4 }],
  quad: [{ x: 14, y: 9, q: 1 }, { x: 26, y: 9, q: -1 }, { x: 14, y: 21, q: -1 }, { x: 26, y: 21, q: 1 }],
};
function plates() {
  const out = [];
  for (let i = 0; i <= 12; i++) { out.push({ x: 13, y: 6 + i * 1.5, q: 0.35 }); out.push({ x: 27, y: 6 + i * 1.5, q: -0.35 }); }
  return out;
}

// field (V/m) and potential (V) at (x, y) in cm
function fieldAt(x, y, ch = S.charges) {
  let ex = 0, ey = 0, v = 0, mag = 0;
  for (const c of ch) {
    const dx = (x - c.x) / 100, dy = (y - c.y) / 100, r2 = dx * dx + dy * dy + 1e-8, r = Math.sqrt(r2);
    const k = K * c.q / (r2 * r);
    ex += k * dx; ey += k * dy; v += K * c.q / r; mag += Math.abs(K * c.q) / r2;
  }
  return { ex, ey, e: Math.hypot(ex, ey), v, mag };
}

function fieldLines() {
  const pos = S.charges.filter((c) => c.q > 0), neg = S.charges.filter((c) => c.q < 0);
  const starts = pos.length ? pos : neg, sign = pos.length ? 1 : -1;
  const lines = [];
  const perUnit = starts.length > 8 ? 3 : 9;
  for (const c of starts) {
    const n = Math.max(4, Math.round(perUnit * Math.abs(c.q)));
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * (k + 0.5) / n;
      let x = c.x + 0.7 * Math.cos(a), y = c.y + 0.7 * Math.sin(a);
      const pts = [[x, y]];
      for (let s = 0; s < 900; s++) {
        const d = (px, py) => { const f = fieldAt(px, py); return f.e > 0 ? [sign * f.ex / f.e, sign * f.ey / f.e] : [0, 0]; };
        const h = 0.25;
        const k1 = d(x, y), k2 = d(x + h / 2 * k1[0], y + h / 2 * k1[1]), k3 = d(x + h / 2 * k2[0], y + h / 2 * k2[1]), k4 = d(x + h * k3[0], y + h * k3[1]);
        x += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        pts.push([x, y]);
        if (x < -5 || y < -5 || x > W + 5 || y > H + 5) break;
        if ((sign > 0 ? neg : pos).some((o) => (o.x - x) ** 2 + (o.y - y) ** 2 < 0.5)) break;
      }
      lines.push(pts);
    }
  }
  return lines;
}

function tabTable(pane) {
  pane.append(el('p', { class: 'vp-intro', html: '<b>Drag</b> the pucks around. Field lines start on positive charges and end on negative ones; the dashed equipotentials cross them at right angles. Click empty glass to move the probe or, with the test charge, to let one go and watch it drift along the field.' }));
  const box = canvasBox('', '4 / 3', 'The field table seen from above');
  box.style.touchAction = 'none';
  const add = (q) => button(q > 0 ? `+${q}` : `−${-q}`, () => { if (current(bench, 'layout') !== 'charges') return; S.charges.push({ x: 20 + (Math.random() - 0.5) * 6, y: 15 + (Math.random() - 0.5) * 6, q }); dirty = true; }, q > 0 ? 'secondary' : 'quiet');
  const addRow = el('div', { class: 'vp-row' }, add(1), add(2), add(4), add(-1), add(-2));
  const presets = el('div', { class: 'vp-row' },
    button('Dipole', () => setLayout(PRESETS.dipole), 'quiet'), button('Two alike', () => setLayout(PRESETS.alike), 'quiet'),
    button('+1 and +4', () => setLayout(PRESETS.one4), 'quiet'), button('Four', () => setLayout(PRESETS.quad), 'quiet'));
  const del = button('Remove the selected puck', () => { if (S.sel >= 0) { S.charges.splice(S.sel, 1); S.sel = -1; dirty = true; } }, 'quiet');
  const lc = checkbox({ label: 'Field lines', checked: S.lines, onChange: (v) => { S.lines = v; dirty = true; } });
  const ec = checkbox({ label: 'Equipotentials', checked: S.equi, onChange: (v) => { S.equi = v; dirty = true; } });
  const sc = checkbox({ label: 'Shade by field strength', checked: S.shade, onChange: (v) => { S.shade = v; dirty = true; } });
  const vRo = readout('Potential at the probe'), eRo = readout('Field at the probe'), dRo = readout('Field direction');
  const side = el('div', { class: 'vp-side' }, group('Add a puck', addRow, del), group('Ready-made', presets), group('Show', lc, ec, sc));
  pane.append(el('div', { class: 'vp-cols' }, side, el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, vRo, eRo, dRo))));

  function setLayout(L) { if (current(bench, 'layout') !== 'charges') rig.mount(bench.id, 'layout', 'charges'); S.charges = L.map((c) => ({ ...c })); S.sel = -1; dirty = true; }
  let dirty = true, cache = null;
  onRig(bench, (m) => {
    if (m.slot === 'layout') { S.charges = current(bench, 'layout') === 'plates' ? plates() : PRESETS.dipole.map((c) => ({ ...c })); S.sel = -1; }
    S.test = null; S.trail = []; dirty = true;
  });

  // pointer: drag pucks, place the probe, release test charges
  const cv = box.canvas;
  let drag = -1;
  const toCm = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  cv.addEventListener('pointerdown', (e) => {
    const [x, y] = toCm(e);
    const i = S.charges.findIndex((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < 2.2);
    if (i >= 0 && current(bench, 'layout') === 'charges') { drag = i; S.sel = i; try { cv.setPointerCapture(e.pointerId); } catch (_) {} dirty = true; return; }
    S.sel = -1;
    if (current(bench, 'tool') === 'testq') { S.test = { x, y, vx: 0, vy: 0 }; S.trail = [[x, y]]; }
    else { S.probe = { x, y }; probeNote(); }
    dirty = true;
  });
  cv.addEventListener('pointermove', (e) => {
    if (drag < 0) return;
    const [x, y] = toCm(e);
    S.charges[drag].x = Math.max(1, Math.min(W - 1, x)); S.charges[drag].y = Math.max(1, Math.min(H - 1, y)); dirty = true;
  });
  const up = () => { if (drag >= 0) { drag = -1; probeNote(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.tabIndex = 0;
  cv.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel >= 0) { S.charges.splice(S.sel, 1); S.sel = -1; dirty = true; } });

  function probeNote() {
    const f = fieldAt(S.probe.x, S.probe.y);
    if (S.charges.length >= 2 && f.e < 0.02 * f.mag) rig.note({ bench: 'field', nullFound: true, x: S.probe.x, y: S.probe.y });
  }

  const anim = loop((dt) => {
    if (S.test) {
      // a light positive test charge with a bit of drag, so it follows the field lines
      // it drifts along the field, faster where the field is strong
      for (let k = 0; k < 8; k++) {
        const f = fieldAt(S.test.x, S.test.y);
        if (f.e < 1e-6) break;
        const sp = Math.max(3, Math.min(30, f.e * 0.01));
        S.test.x += f.ex / f.e * sp * dt / 8; S.test.y += f.ey / f.e * sp * dt / 8;
      }
      S.trail.push([S.test.x, S.test.y]); if (S.trail.length > 600) S.trail.shift();
      const hit = S.charges.some((c) => c.q < 0 && (c.x - S.test.x) ** 2 + (c.y - S.test.y) ** 2 < 0.8);
      if (hit || S.test.x < -2 || S.test.y < -2 || S.test.x > W + 2 || S.test.y > H + 2) S.test = null;
      dirty = true;
    }
    if (dirty) { draw(); dirty = false; }
  });

  function draw() {
    const { g, w, h } = fitCanvas(cv);
    const X = (x) => x / W * w, Y = (y) => y / H * h;
    g.fillStyle = '#E6F7FD'; g.fillRect(0, 0, w, h);
    if (!cache || cache.key !== JSON.stringify(S.charges) + S.lines + S.equi + S.shade + w) {
      cache = { key: JSON.stringify(S.charges) + S.lines + S.equi + S.shade + w, lines: S.lines ? fieldLines() : [] };
      if (S.equi || S.shade) {
        const nx = 120, ny = 90, data = new Float64Array(nx * ny), emag = new Float64Array(nx * ny);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const f = fieldAt(i / (nx - 1) * W, j / (ny - 1) * H); data[j * nx + i] = f.v; emag[j * nx + i] = f.e; }
        cache.equi = [];
        if (S.equi) for (const lev of [-400, -250, -150, -100, -70, -45, -30, -20, -10, 0, 10, 20, 30, 45, 70, 100, 150, 250, 400]) cache.equi.push({ lev, c: contour(data, nx, ny, 0, W, 0, H, lev) });
        if (S.shade) {
          const img = g.createImageData(nx, ny);
          for (let k = 0; k < nx * ny; k++) { const t = Math.min(1, Math.log10(1 + emag[k] / 200) / 1.6); img.data[k * 4] = 255; img.data[k * 4 + 1] = 230 - 120 * t; img.data[k * 4 + 2] = 120 - 100 * t; img.data[k * 4 + 3] = 40 + 150 * t; }
          const off = document.createElement('canvas'); off.width = nx; off.height = ny; off.getContext('2d').putImageData(img, 0, 0); cache.shade = off;
        } else cache.shade = null;
      } else { cache.equi = []; cache.shade = null; }
    }
    if (cache.shade) { g.imageSmoothingEnabled = true; g.drawImage(cache.shade, 0, 0, w, h); }
    // grid on the glass
    g.strokeStyle = 'rgba(0,115,158,0.12)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 5) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), h); g.stroke(); }
    for (let y = 0; y <= H; y += 5) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(w, Y(y)); g.stroke(); }
    // equipotentials
    g.setLineDash([4, 4]); g.lineWidth = 1.3;
    for (const { lev, c } of cache.equi) {
      g.strokeStyle = lev > 0 ? 'rgba(224,69,123,0.6)' : lev < 0 ? 'rgba(61,111,182,0.6)' : 'rgba(18,36,58,0.5)';
      g.beginPath();
      for (let i = 0; i < c.x.length; i += 3) { if (!Number.isFinite(c.x[i])) continue; g.moveTo(X(c.x[i]), Y(c.y[i])); g.lineTo(X(c.x[i + 1]), Y(c.y[i + 1])); }
      g.stroke();
    }
    g.setLineDash([]);
    // field lines with small arrows
    g.strokeStyle = 'rgba(107,91,230,0.85)'; g.fillStyle = 'rgba(107,91,230,0.85)'; g.lineWidth = 1.4;
    for (const L of cache.lines) {
      g.beginPath(); L.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
      const m = Math.floor(L.length * 0.35);
      if (L.length > 6) {
        const [x0, y0] = L[m], [x1, y1] = L[m + 1], a = Math.atan2(Y(y1) - Y(y0), X(x1) - X(x0)) + (S.charges.some((c) => c.q > 0) ? 0 : Math.PI);
        g.save(); g.translate(X(x0), Y(y0)); g.rotate(a); g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, -3.5); g.lineTo(-3, 3.5); g.fill(); g.restore();
      }
    }
    // test charge trail
    if (S.trail.length > 1) { g.strokeStyle = '#E8C25A'; g.lineWidth = 2.5; g.beginPath(); S.trail.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke(); }
    if (S.test) { g.fillStyle = '#E8C25A'; g.strokeStyle = '#1B2440'; g.beginPath(); g.arc(X(S.test.x), Y(S.test.y), 5, 0, 7); g.fill(); g.stroke(); }
    // pucks
    for (let i = 0; i < S.charges.length; i++) {
      const c = S.charges[i], r = current(bench, 'layout') === 'plates' ? 6 : 10 + 3 * Math.min(3, Math.abs(c.q));
      g.fillStyle = c.q > 0 ? '#E5534B' : '#3D6FB6'; g.strokeStyle = i === S.sel ? '#E8C25A' : '#1B2440'; g.lineWidth = i === S.sel ? 3 : 1.5;
      g.beginPath(); g.arc(X(c.x), Y(c.y), r, 0, 7); g.fill(); g.stroke();
      if (r > 8) { g.fillStyle = '#FFFDF6'; g.font = '700 12px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((c.q > 0 ? '+' : '−') + Math.abs(c.q), X(c.x), Y(c.y) + 1); }
    }
    // probe
    const tool = current(bench, 'tool');
    if (tool === 'probe') {
      const f = fieldAt(S.probe.x, S.probe.y);
      g.strokeStyle = '#B3243B'; g.lineWidth = 2; g.beginPath(); g.arc(X(S.probe.x), Y(S.probe.y), 6, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(X(S.probe.x) - 10, Y(S.probe.y)); g.lineTo(X(S.probe.x) + 10, Y(S.probe.y)); g.moveTo(X(S.probe.x), Y(S.probe.y) - 10); g.lineTo(X(S.probe.x), Y(S.probe.y) + 10); g.stroke();
      if (f.e > 1) { const L = 26, ux = f.ex / f.e, uy = f.ey / f.e; g.strokeStyle = '#2F7D5B'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X(S.probe.x), Y(S.probe.y)); g.lineTo(X(S.probe.x) + L * ux, Y(S.probe.y) + L * uy); g.stroke(); }
      vRo.set(`${f.v.toFixed(1)} V`);
      eRo.set(f.e < 0.02 * f.mag ? `${fmtNum(f.e, 3)} V/m (almost nothing!)` : `${fmtNum(f.e, 3)} V/m`);
      dRo.set(f.e > 1 ? `${Math.round((Math.atan2(-f.ey, f.ex) * 180 / Math.PI + 360) % 360)}° from the right` : '–');
    } else { vRo.set('use the probe'); eRo.set('use the probe'); dRo.set('–'); }
    // scale
    g.fillStyle = '#12243A'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillRect(10, h - 12, X(5), 2); g.fillText('5 cm', 12, h - 16);
    g.textAlign = 'right'; g.fillText('each +1 is 1 nC', w - 10, h - 8);
  }
  return { show() { dirty = true; anim.start(); }, hide() { anim.stop(); }, resize() { cache = null; dirty = true; } };
}

bench.tabs = [{ id: 'table', label: 'Table', build: tabTable }];

export default bench;
