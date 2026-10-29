// 1F · Field table. Charged pucks on a glass table. Drag them around and watch the field
// lines and the equipotentials follow; read the potential and the field with a probe, or let a
// small test charge go and see where the field takes it.

import { el, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { contour } from '../ui/contour.js';
import { rigStrip, current, onRig, loop, fitCanvas, fmtNum } from './common.js';
import { rig } from '../rpg/state.js';
import { Stage } from './stage.js';
import * as KT from './kit.js';
import { sound } from '../rpg/sound.js';

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

// ---------------------------------------------------------------- the hands-on stage
function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'hoo', label: 'A glass table seen from above with charged pucks. Drag the pucks; tap the glass to let a small test charge go.',
    hello: 'Think of voltage as **height**: positive charges are hills, negative ones are valleys. **Tap the glass** to drop a small positive marble and watch it roll. Drag the pucks to reshape the land.',
    aspect: 4 / 3, phoneAspect: 4 / 3.2,
    onReset: () => { S.charges = PRESETS.dipole.map((c) => ({ ...c })); marbles.length = 0; dirty = true; },
  });
  st.tool('land', 'Hills and valleys', { icon: '#F29E4C', on: true, onChange: () => { dirty = true; } }).tool('lines', 'Field lines', { icon: KT.COL.string, on: true, onChange: () => { dirty = true; } })
    .tool('equi', 'Equal-voltage lines', { icon: KT.COL.net, onChange: () => { dirty = true; } }).tool('arrows', 'Field arrows', { icon: KT.COL.vel }).tool('force', 'Push on the marble', { icon: KT.COL.gravity });
  st.readout('v', 'Voltage where you point').readout('e', 'Field strength there').readout('n', 'Marbles rolling');
  let dirty = true, lines = [], grid = null, img = null, hoverPt = null, sign = 1, first = true, pending = null;
  const marbles = [];
  let Lay = { w: 600, h: 450, x0: 10, y0: 10, s: 14 };

  // ---------- controls
  const add = (q) => { const b = el('button', { type: 'button', class: 'stg-chip', text: q > 0 ? `+${q}` : `−${-q}` }); b.addEventListener('click', () => { if (current(bench, 'layout') !== 'charges') rig.mount(bench.id, 'layout', 'charges'); S.charges.push({ x: 20 + (Math.random() - 0.5) * 8, y: 15 + (Math.random() - 0.5) * 8, q }); dirty = true; sound.play('pop'); }); return b; };
  const preset = (name, L) => { const b = el('button', { type: 'button', class: 'stg-chip', text: name }); b.addEventListener('click', () => { if (current(bench, 'layout') !== 'charges') rig.mount(bench.id, 'layout', 'charges'); S.charges = L.map((c) => ({ ...c })); marbles.length = 0; dirty = true; sound.play('click'); }); return b; };
  const signBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Marbles: positive' });
  signBtn.addEventListener('click', () => { sign = -sign; signBtn.textContent = sign > 0 ? 'Marbles: positive' : 'Marbles: negative'; sound.play('click'); });
  const clr = el('button', { type: 'button', class: 'stg-act ghost', text: 'Clear marbles' });
  clr.addEventListener('click', () => { marbles.length = 0; });
  st.controls(el('p', { class: 'stg-small', text: 'Add a puck' }), el('div', { class: 'stg-row' }, add(1), add(2), add(-1), add(-2)),
    el('p', { class: 'stg-small', text: 'Ready-made' }), el('div', { class: 'stg-row' }, preset('Dipole', PRESETS.dipole), preset('Two alike', PRESETS.alike), preset('+1 and +4', PRESETS.one4), preset('Four', PRESETS.quad)),
    el('div', { class: 'stg-row' }, signBtn, clr));
  onRig(bench, (m) => { if (m.slot === 'layout') { S.charges = current(bench, 'layout') === 'plates' ? plates() : PRESETS.dipole.map((c) => ({ ...c })); marbles.length = 0; } dirty = true; });

  // ---------- the landscape of voltage
  const VMAX = 260;
  function rebuild() {
    const nx = 120, ny = 90, data = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const f = fieldAt(i / (nx - 1) * W, j / (ny - 1) * H);
      data[j * nx + i] = VMAX * Math.tanh(f.v / VMAX);
    }
    grid = { nx, ny, data };
    // colour plus hill shading, at grid resolution; drawn smoothly scaled
    const c = img || document.createElement('canvas'); c.width = nx; c.height = ny;
    const g = c.getContext('2d'), id = g.createImageData(nx, ny);
    const hi = [229, 83, 75], mid = [255, 246, 226], lo = [61, 127, 214];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = data[j * nx + i] / VMAX;
      const a = data[j * nx + Math.min(nx - 1, i + 1)] - data[j * nx + Math.max(0, i - 1)];
      const b = data[Math.min(ny - 1, j + 1) * nx + i] - data[Math.max(0, j - 1) * nx + i];
      // light from the top left: slopes facing it are brighter
      const shade = Math.max(0.55, Math.min(1.25, 1 - (a + b) * 0.004));
      const t = Math.abs(v), base = v > 0 ? hi : lo;
      const k = (j * nx + i) * 4;
      for (let ch = 0; ch < 3; ch++) id.data[k + ch] = Math.max(0, Math.min(255, (mid[ch] + (base[ch] - mid[ch]) * Math.pow(t, 0.8)) * shade));
      id.data[k + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    img = c;
    lines = st.on('lines') ? fieldLines() : [];
    dirty = false;
  }

  // ---------- marbles (small test charges) roll with a little friction
  function drop(x, y, q = sign) { marbles.push({ x, y, vx: 0, vy: 0, q, trail: [[x, y]], life: 0 }); if (marbles.length > 12) marbles.shift(); sound.play('pop'); }
  st.onStep((dt) => {
    if (dt <= 0) return;
    for (const m of marbles) {
      for (let k = 0; k < 6; k++) {
        const h = dt / 6, f = fieldAt(m.x, m.y);
        let ax = m.q * f.ex * 0.011, ay = m.q * f.ey * 0.011;
        const a = Math.hypot(ax, ay); if (a > 700) { ax *= 700 / a; ay *= 700 / a; }
        m.vx += (ax - 1.2 * m.vx) * h; m.vy += (ay - 1.2 * m.vy) * h;
        m.x += m.vx * h; m.y += m.vy * h;
      }
      m.life += dt;
      const last = m.trail[m.trail.length - 1];
      if (Math.hypot(m.x - last[0], m.y - last[1]) > 0.25) { m.trail.push([m.x, m.y]); if (m.trail.length > 400) m.trail.shift(); }
      if (S.charges.some((c) => Math.sign(c.q) === -m.q && (c.x - m.x) ** 2 + (c.y - m.y) ** 2 < 0.9)) { m.dead = true; sound.play('clink', { vol: 0.5 }); }
      if (m.x < -1 || m.y < -1 || m.x > W + 1 || m.y > H + 1 || m.life > 40) m.dead = true;
    }
    for (let i = marbles.length - 1; i >= 0; i--) if (marbles[i].dead) marbles.splice(i, 1);
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- drawing
  st.onResize((w, h) => {
    const s = Math.min((w - 20) / W, (h - 20) / H);
    Lay = { w, h, s, x0: (w - W * s) / 2, y0: (h - H * s) / 2 };
    dirty = true;
  });
  const X = (x) => Lay.x0 + x * Lay.s, Y = (y) => Lay.y0 + y * Lay.s;
  const toCm = (px, py) => [(px - Lay.x0) / Lay.s, (py - Lay.y0) / Lay.s];

  st.onDraw((g, w, h) => {
    if (dirty || !grid) rebuild();
    g.fillStyle = '#16264A'; g.fillRect(0, 0, w, h);
    const tw = W * Lay.s, th = H * Lay.s;
    // the glass table
    KT.box(g, Lay.x0 - 8, Lay.y0 - 8, tw + 16, th + 16, KT.MAT.navy, { r: 12 });
    g.save(); KT.rr(g, Lay.x0, Lay.y0, tw, th, 6); g.clip();
    if (st.on('land')) { g.imageSmoothingEnabled = true; g.drawImage(img, Lay.x0, Lay.y0, tw, th); }
    else { g.fillStyle = '#EAF6FC'; g.fillRect(Lay.x0, Lay.y0, tw, th); }
    // a faint grid on the glass, 1 cm squares
    g.strokeStyle = 'rgba(27,36,64,0.08)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 2) { g.beginPath(); g.moveTo(X(x), Lay.y0); g.lineTo(X(x), Lay.y0 + th); g.stroke(); }
    for (let y = 0; y <= H; y += 2) { g.beginPath(); g.moveTo(Lay.x0, Y(y)); g.lineTo(Lay.x0 + tw, Y(y)); g.stroke(); }
    if (st.on('equi') && grid) {
      g.strokeStyle = 'rgba(75,51,176,0.7)'; g.lineWidth = 1.6; g.setLineDash([5, 4]);
      for (const lv of [-200, -120, -60, -25, 25, 60, 120, 200]) {
        const c = contour(grid.data, grid.nx, grid.ny, 0, W, 0, H, lv);
        g.beginPath(); let pen = false;
        for (let i = 0; i < c.x.length; i++) { if (Number.isNaN(c.x[i])) { pen = false; continue; } if (pen) g.lineTo(X(c.x[i]), Y(c.y[i])); else { g.moveTo(X(c.x[i]), Y(c.y[i])); pen = true; } }
        g.stroke();
      }
      g.setLineDash([]);
    }
    if (st.on('lines')) {
      g.strokeStyle = 'rgba(27,36,64,0.75)'; g.lineWidth = 1.6;
      for (const L of lines) {
        g.beginPath(); L.forEach(([x, y], i) => { if (i) g.lineTo(X(x), Y(y)); else g.moveTo(X(x), Y(y)); }); g.stroke();
        const k = Math.floor(L.length / 2);
        if (L.length > 6) { const [x1, y1] = L[k], [x2, y2] = L[k + 1]; const a = Math.atan2(y2 - y1, x2 - x1); g.save(); g.translate(X(x1), Y(y1)); g.rotate(a); g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, -4); g.lineTo(-3, 4); g.closePath(); g.fillStyle = 'rgba(27,36,64,0.85)'; g.fill(); g.restore(); }
      }
    }
    if (st.on('arrows')) {
      for (let y = 1.5; y < H; y += 3) for (let x = 1.5; x < W; x += 3) {
        const f = fieldAt(x, y); if (f.e < 1) continue;
        const len = Math.min(2.4, 0.5 + Math.log10(f.e) * 0.45) * Lay.s * 0.6;
        KT.arrow(g, X(x) - f.ex / f.e * len / 2, Y(y) - f.ey / f.e * len / 2, X(x) + f.ex / f.e * len / 2, Y(y) + f.ey / f.e * len / 2, KT.COL.vel, { lw: 2.2, head: 7, halo: false });
      }
    }
    // marbles and their trails
    for (const m of marbles) {
      g.beginPath(); m.trail.forEach(([x, y], i) => { if (i) g.lineTo(X(x), Y(y)); else g.moveTo(X(x), Y(y)); }); g.lineTo(X(m.x), Y(m.y));
      g.strokeStyle = m.q > 0 ? 'rgba(201,154,27,0.9)' : 'rgba(31,143,176,0.9)'; g.lineWidth = 2.5; g.stroke();
      KT.shadow(g, X(m.x) + 3, Y(m.y) + 4, 8, 4, 0.35);
      KT.ball(g, X(m.x), Y(m.y), 7, m.q > 0 ? 'yellow' : ['#5FD3F0', '#C9F4FF', '#1F8FB0'], { lw: 1.6 });
      if (st.on('force')) { const f = fieldAt(m.x, m.y); const k = Math.min(70, 8 + Math.log10(1 + f.e) * 12); if (f.e > 1) KT.arrow(g, X(m.x), Y(m.y), X(m.x) + m.q * f.ex / f.e * k, Y(m.y) + m.q * f.ey / f.e * k, KT.COL.gravity, { lw: 3, head: 9 }); }
    }
    g.restore();
    // pucks
    for (const c of S.charges) {
      const r = Math.max(10, Lay.s * (0.9 + 0.25 * Math.sqrt(Math.abs(c.q))));
      KT.shadow(g, X(c.x) + 4, Y(c.y) + 5, r, r * 0.5, 0.35);
      if (st.hovering('puck') && st._hov === c) KT.glow(g, X(c.x), Y(c.y), r * 2.4, '#FFFFFF', 0.5);
      KT.ball(g, X(c.x), Y(c.y), r, c.q > 0 ? 'red' : 'blue', { lw: 2 });
      KT.text(g, (c.q > 0 ? '+' : '−') + (Math.abs(c.q) !== 1 ? Math.abs(c.q) : ''), X(c.x), Y(c.y) + 5, { size: Math.min(16, r), weight: 700, align: 'center', color: '#FFFFFF' });
    }
    if (hoverPt) { const [x, y] = hoverPt; g.save(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.arc(X(x), Y(y), 6, 0, Math.PI * 2); g.stroke(); g.restore(); }
    if (first && marbles.length === 0) KT.tag(g, 'tap the glass to drop a marble', w / 2, Lay.y0 + 26, { size: 12.5, bg: '#FFF1B0' });
  });
  st.onOver(() => {
    if (hoverPt) { const f = fieldAt(hoverPt[0], hoverPt[1]); st.set('v', `${f.v.toFixed(0)} V`); st.set('e', `${f.e < 1000 ? f.e.toFixed(0) : (f.e / 1000).toFixed(1) + ' k'} V/m`); }
    st.set('n', String(marbles.length));
  });

  // ---------- hands: drag pucks, tap to drop marbles
  st.handle({
    id: 'puck', cursor: 'grab', enabled: () => current(bench, 'layout') === 'charges',
    hit: (x, y) => { const [cx, cy] = toCm(x, y); let best = null, bd = 1.8; for (const c of S.charges) { const d = Math.hypot(c.x - cx, c.y - cy); if (d < bd) { bd = d; best = c; } } st._hov = best; return best ? bd : false; },
    down: () => { st._drag = st._hov; first = false; },
    move: (x, y) => { const [cx, cy] = toCm(x, y); const c = st._drag; if (!c) return; c.x = Math.max(1, Math.min(W - 1, cx)); c.y = Math.max(1, Math.min(H - 1, cy)); dirty = true; hoverPt = [c.x, c.y]; },
    up: () => { const f = hoverPt ? fieldAt(hoverPt[0], hoverPt[1]) : null; void f; st._drag = null; },
  });
  st.handle({
    id: 'glass', cursor: 'crosshair',
    hit: (x, y) => { const [cx, cy] = toCm(x, y); return cx > 0 && cy > 0 && cx < W && cy < H ? 50 : false; },
    click: (x, y) => { const [cx, cy] = toCm(x, y); first = false; drop(cx, cy); const f = fieldAt(cx, cy); if (S.charges.length >= 2 && f.e < 0.02 * f.mag) { rig.note({ bench: 'field', nullFound: true, x: cx, y: cy }); st.flash('A still spot!'); } },
  });
  st.cv.addEventListener('pointermove', (e) => { const r = st.cv.getBoundingClientRect(); const [cx, cy] = toCm(e.clientX - r.left, e.clientY - r.top); hoverPt = cx > 0 && cy > 0 && cx < W && cy < H ? [cx, cy] : null; });

  // ---------- why
  const layout = (L) => { if (current(bench, 'layout') !== 'charges') rig.mount(bench.id, 'layout', 'charges'); S.charges = L.map((c) => ({ ...c })); marbles.length = 0; dirty = true; };
  st.tour({
    title: 'What is a field?',
    steps: [
      { say: 'A positive charge pushes other positive charges away. The green arrows show which way a small **+ test charge** would be pushed at each spot: that is the **field**.', tools: { arrows: true, lines: false, land: false, equi: false }, enter: () => layout([{ x: 20, y: 15, q: 1 }]) },
      { say: '**Field lines** follow the arrows. They start on + charges and end on − charges, and where they crowd together the push is strong.', tools: { arrows: false, lines: true }, enter: () => layout(PRESETS.dipole) },
      { say: 'Now think of **voltage as height**: + charges are hills, − charges are valleys. A + marble simply **rolls downhill**. Watch.', tools: { land: true }, enter: () => { layout(PRESETS.dipole); drop(16, 9, 1); drop(14, 20, 1); drop(20, 4, 1); } },
      { say: 'The dashed **equal-voltage lines** are like contour lines on a hiking map. The field always points straight downhill, across them at right angles.', tools: { equi: true }, enter: () => layout(PRESETS.dipole) },
      { say: 'Two equal + hills: right between them the two pushes **cancel**. A marble placed there just sits on the saddle (until it is nudged).', tools: { equi: true, arrows: true }, enter: () => { layout(PRESETS.alike); drop(20.0, 15.0, 1); drop(20, 10, 1); } },
    ],
    onEnd: () => { layout(PRESETS.dipole); },
  });

  // ---------- challenges
  st.setChallenges([
    {
      id: 'null', title: 'The still spot', card: 'field.null',
      setup: () => layout(PRESETS.one4),
      q: 'A +1 puck and a +4 puck. Somewhere on the line between them the field is zero. Where?', choices: ['Exactly in the middle', 'Closer to the +1', 'Closer to the +4'], answer: 1,
      run: (s, finish) => { s.setTool('arrows', true); s.setTool('equi', true); const a = S.charges[0], b = S.charges[1]; const xn = a.x + (b.x - a.x) / 3; setTimeout(() => { drop(xn, 15, 1); hoverPt = [xn, 15]; finish(`It is at ${(xn - a.x).toFixed(1)} cm from the +1, a third of the way.`); }, 1500); },
      explain: 'The push falls off as 1/distance². A charge four times bigger matches the small one from twice as far away, so the balance point is a third of the way from the +1.',
    },
    {
      id: 'neg', title: 'A negative marble', card: 'field.negative',
      setup: () => layout(PRESETS.dipole),
      q: 'On this landscape, a positive marble rolls downhill. A negative marble…', choices: ['also rolls downhill', 'rolls uphill, towards the + hill', 'stays where it is'], answer: 1,
      run: (s, finish) => { s.setTool('land', true); drop(20, 8, -1); drop(20, 22, -1); setTimeout(() => finish(), 3500); },
      explain: 'A negative charge is pushed the opposite way to a positive one, so on the voltage landscape it climbs. That is why electrons in a wire flow from − to +.',
    },
    {
      id: 'scale', title: 'Double every charge', card: 'field.scale',
      setup: () => layout(PRESETS.dipole),
      q: 'Double both charges of the dipole. The pattern of field lines…', choices: ['stays exactly the same shape', 'spreads out wider', 'gets squeezed together'], answer: 0,
      run: (s, finish) => { s.setTool('lines', true); setTimeout(() => { S.charges.forEach((c) => { c.q *= 2; }); dirty = true; setTimeout(() => finish(), 1500); }, 1500); },
      explain: 'Every push doubles, but in the same direction everywhere, so the lines follow the same paths. Only the strength (and how fast the marbles go) changes.',
      after: () => layout(PRESETS.dipole),
    },
  ]);

  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }, { id: 'table', label: 'Measure', build: tabTable }];

export default bench;
