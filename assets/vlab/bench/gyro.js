// 2F · Gyroscope. A spinning wheel on the end of an axle, resting on a pivot. Let go and it
// does not fall: it swings round the stand (precession), with a small fast wobble on top
// (nutation). Solved as a heavy symmetric top with Euler's angles.

import { el, slider, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

const G = 9.81;

const bench = {
  id: 'gyro', title: 'Gyroscope', kicker: '2F · Physics Playground', icon: '◎', floor: 2,
  blurb: 'Precession and nutation.',
  slots: [
    { id: 'wheel', label: 'Wheel', options: ['gyrowheel', 'gyro-steel'], def: 'gyrowheel' },
    { id: 'weight', label: 'Extra weight', options: ['gw-none', 'gw-hang', 'gw-counter'], def: 'gw-none' },
    { id: 'watch', label: 'Watch with', options: ['eyes', 'stopwatch', 'camera'], def: 'eyes' },
  ],
};
bench.header = rigStrip(bench);

const S = { rpm: 3000, run: false, th: Math.PI / 2, thd: 0, ph: 0, t: 0, trail: [], trace: [], pphi: 0, watch: { on: false, t0: 0, acc: 0 }, friction: false };

function params() {
  const w = phys(bench, 'wheel'), x = phys(bench, 'weight');
  const I3 = 0.5 * w.m * w.R * w.R;
  const I1 = w.m * (0.25 * w.R * w.R + w.d * w.d) + x.mw * x.dw * x.dw + 0.02 * 0.12 * 0.12 / 3;
  const mgd = G * (w.m * w.d + x.mw * x.dw);
  return { I1, I3, mgd, d: w.d, R: w.R, wheel: w.id, weight: x.id };
}
// steady (slow) precession rate at angle th, from I1 Ω² cosθ − I3 ω3 Ω + m g d = 0
export function slowPrecession(p, w3, th = Math.PI / 2) {
  const c = Math.cos(th), L = p.I3 * w3;
  if (Math.abs(c) < 1e-9) return p.mgd / L;
  const disc = L * L - 4 * p.I1 * c * p.mgd;
  return disc < 0 ? NaN : (L - Math.sqrt(disc)) / (2 * p.I1 * c);
}

function release() {
  const p = params(), w3 = S.rpm * 2 * Math.PI / 60;
  S.w3 = w3; S.th = Math.PI / 2; S.thd = 0; S.ph = 0; S.t = 0; S.run = true; S.trail = []; S.trace = [];
  S.pphi = p.I3 * w3 * Math.cos(S.th);   // released from rest: no precession yet
  if (S.rpm === 3000 && p.wheel === 'gyrowheel' && p.weight === 'gw-none') rig.flag('gyroPeriod', Math.round(2 * Math.PI / slowPrecession(p, w3) * 100) / 100);
  rig.note({ bench: 'gyro', rpm: S.rpm, wheel: p.wheel, weight: p.weight });
}
function step(p, h) {
  const f = (th, thd) => {
    const s = Math.sin(th), c = Math.cos(th);
    const phd = (S.pphi - p.I3 * S.w3 * c) / (p.I1 * s * s);
    const thdd = (p.I1 * phd * phd * s * c - p.I3 * S.w3 * phd * s + p.mgd * s - 0.004 * thd) / p.I1;
    return [thd, thdd, phd];
  };
  const k1 = f(S.th, S.thd), k2 = f(S.th + h / 2 * k1[0], S.thd + h / 2 * k1[1]), k3 = f(S.th + h / 2 * k2[0], S.thd + h / 2 * k2[1]), k4 = f(S.th + h * k3[0], S.thd + h * k3[1]);
  S.th += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  S.thd += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  S.ph += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  S.t += h;
  if (S.friction) {
    // the wheel's bearing slows the spin; the angular momentum about the vertical is unchanged
    S.w3 *= Math.exp(-h / 90);
  }
  if (S.th > Math.PI * 0.97) { S.th = Math.PI * 0.97; S.thd = 0; }
}

function tabSpin(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Spin the wheel up, rest the axle on the pivot and let go. Gravity tries to tip it over, but a spinning wheel turns sideways instead: it <b>precesses</b>. Spin it slower and it wobbles more and precesses faster.' }));
  const box = canvasBox('', '4 / 3', 'The gyroscope on its stand');
  const topBox = canvasBox('', '1 / 1', 'The end of the axle, seen from above');
  const rpm = slider({ label: 'Wheel speed', unit: 'rpm', min: 600, max: 8000, step: 50, value: S.rpm, digits: 4, onInput: (v) => { S.rpm = v; } });
  const go = button('Spin and let go', () => { release(); watchReset(); }, 'go');
  const fr = checkbox({ label: 'Let the bearing slow the wheel down', checked: S.friction, onChange: (v) => { S.friction = v; } });
  const wDisp = el('div', { class: 'watch', text: '0.00 s' });
  const wBtn = button('Start', () => watchToggle(), 'go', { class: 'vbtn vbtn-go watch-btn' });
  const wGrp = group('Stopwatch', wDisp, el('div', { class: 'vp-row' }, wBtn, button('Reset', () => watchReset(), 'quiet')), el('p', { class: 'ctl-hint', text: 'Time one full turn around the stand.' }));
  const pRo = readout('Precession, measured'), tRo = readout('Precession, Ω = mgr / Iω'), nRo = readout('Wobble (nutation)');
  pane.append(el('div', { class: 'vp-cols' }, el('div', { class: 'vp-side' }, group('Wheel', rpm, go, fr), wGrp, topBox), el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, pRo, tRo, nRo))));
  function watchTime() { return S.watch.acc + (S.watch.on ? (performance.now() - S.watch.t0) / 1000 : 0); }
  function watchToggle() { if (S.watch.on) { S.watch.acc = watchTime(); S.watch.on = false; wBtn.textContent = 'Start'; } else { S.watch.t0 = performance.now(); S.watch.on = true; wBtn.textContent = 'Stop'; } }
  function watchReset() { S.watch = { on: false, t0: 0, acc: 0 }; wBtn.textContent = 'Start'; wDisp.textContent = '0.00 s'; }
  function sync() { wGrp.hidden = current(bench, 'watch') !== 'stopwatch'; topBox.hidden = current(bench, 'watch') !== 'camera'; }
  onRig(bench, () => { sync(); S.run = false; });
  sync();

  const anim = loop((dt) => {
    const p = params();
    if (S.run) {
      let left = dt; while (left > 1e-9) { const h = Math.min(0.0005, left); step(p, h); left -= h; }
      const n = [Math.sin(S.th) * Math.cos(S.ph), Math.sin(S.th) * Math.sin(S.ph)];
      S.trail.push(n); if (S.trail.length > 1500) S.trail.shift();
      S.trace.push([S.t, S.th, S.ph]); if (S.trace.length > 4000) S.trace.shift();
    }
    if (S.watch.on) wDisp.textContent = watchTime().toFixed(2) + ' s';
    draw(p);
  });
  function draw(p = params()) {
    drawGyro(box.canvas, p);
    if (!topBox.hidden) drawTop(topBox.canvas);
    const w3 = S.run ? S.w3 : S.rpm * 2 * Math.PI / 60;
    const Om = slowPrecession(p, w3);
    tRo.set(Number.isFinite(Om) ? `one turn in ${(2 * Math.PI / Om).toFixed(2)} s` : 'too slow: it falls');
    const cam = current(bench, 'watch') === 'camera';
    if (S.run && S.trace.length > 50 && cam) {
      const tr = S.trace, a = tr[0], b = tr[tr.length - 1];
      const rate = (b[2] - a[2]) / (b[0] - a[0]);
      pRo.set(`one turn in ${(2 * Math.PI / rate).toFixed(2)} s`);
      let lo = Infinity, hi = -Infinity; for (const q of tr.slice(-400)) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }
      nRo.set(`${((hi - lo) * 180 / Math.PI).toFixed(2)}° up and down`);
    } else { pRo.set(cam ? '–' : current(bench, 'watch') === 'stopwatch' ? 'use the stopwatch' : 'film it to measure'); nRo.set(cam ? '–' : 'film it to measure'); }
  }
  function drawGyro(c, p) {
    const { g, w, h } = fitCanvas(c);
    g.fillStyle = '#F1ECFF'; g.fillRect(0, 0, w, h);
    const sc = h * 2.6, el = 0.33, ce = Math.cos(el), se = Math.sin(el);
    const P0 = [w * 0.5, h * 0.42];
    const proj = (x, y, z) => [P0[0] + x * sc, P0[1] - (z * ce + y * se) * sc, y * ce - z * se];
    // stand
    g.fillStyle = '#B9A8FF'; g.beginPath(); g.ellipse(P0[0], P0[1] + 0.13 * sc * ce, 0.07 * sc, 0.07 * sc * se, 0, 0, 7); g.fill();
    g.fillStyle = '#6B5BE6'; g.fillRect(P0[0] - 4, P0[1], 8, 0.13 * sc * ce);
    const th = S.th, ph = S.ph;
    const n = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
    // axle: from behind the pivot to past the wheel
    const a0 = proj(-0.03 * n[0], -0.03 * n[1], -0.03 * n[2]), a1 = proj(0.09 * n[0], 0.09 * n[1], 0.09 * n[2]);
    // wheel: a circle at distance d along the axle
    const u = [Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), -Math.sin(th)], v = [-Math.sin(ph), Math.cos(ph), 0];
    const cx = p.d * n[0], cy = p.d * n[1], cz = p.d * n[2];
    const pts = [];
    for (let i = 0; i < 40; i++) { const al = i / 40 * 2 * Math.PI, ca = Math.cos(al), sa = Math.sin(al); pts.push(proj(cx + p.R * (u[0] * ca + v[0] * sa), cy + p.R * (u[1] * ca + v[1] * sa), cz + p.R * (u[2] * ca + v[2] * sa))); }
    const wheelBehind = proj(cx, cy, cz)[2] > 0;
    const drawAxle = () => { g.strokeStyle = '#4F6A8F'; g.lineWidth = 3; g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke(); };
    if (wheelBehind) drawAxle();
    const col = p.wheel === 'gyro-steel' ? '#9DB8D3' : '#D8B04A';
    g.fillStyle = col; g.strokeStyle = '#1B2440'; g.lineWidth = 1.5; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.stroke();
    // spokes that turn with the wheel
    const sp = S.run ? (S.t * S.w3) % (2 * Math.PI) : 0;
    g.strokeStyle = 'rgba(27,36,64,0.45)'; g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const al = sp + k * 2 * Math.PI / 3; const q = proj(cx + 0.8 * p.R * (u[0] * Math.cos(al) + v[0] * Math.sin(al)), cy + 0.8 * p.R * (u[1] * Math.cos(al) + v[1] * Math.sin(al)), cz + 0.8 * p.R * (u[2] * Math.cos(al) + v[2] * Math.sin(al))); const o = proj(cx, cy, cz); g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(q[0], q[1]); g.stroke(); }
    if (!wheelBehind) drawAxle();
    // weights
    const x = phys(bench, 'weight');
    if (x.mw > 0) { const q = proj(x.dw * n[0], x.dw * n[1], x.dw * n[2]); g.fillStyle = '#D8B04A'; g.fillRect(q[0] - 6, q[1] - 6, 12, 12); g.strokeStyle = '#1B2440'; g.strokeRect(q[0] - 6, q[1] - 6, 12, 12); }
    g.fillStyle = '#4A3A8C'; g.beginPath(); g.arc(P0[0], P0[1], 4, 0, 7); g.fill();
    if (!S.run) { g.fillStyle = '#12243A'; g.font = '500 12px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Your hand holds the end of the axle level', w / 2, h - 14); }
  }
  function drawTop(c) {
    const { g, w, h } = fitCanvas(c);
    g.fillStyle = '#0E1630'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(168,236,255,0.2)'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, 7); g.stroke();
    g.strokeStyle = '#FFE07A'; g.lineWidth = 1.2; g.beginPath();
    S.trail.forEach(([x, y], i) => { const X = w / 2 + x * w * 0.42, Y = h / 2 - y * w * 0.42; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.stroke();
    g.fillStyle = '#A8ECFF'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('axle tip from above (camera)', w / 2, h - 8);
  }
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'How the precession depends on the spin. In the fast-top limit the period of one turn round the stand is <b>T = 2π I ω / (m g r)</b>: proportional to the spin. The curve is the exact steady precession; it breaks away at low speed, where the gyroscope can no longer hold itself up.' }));
  const box = canvasBox('', '16 / 10', 'Precession period against wheel speed');
  const plot = new Plot(box.canvas, { xlabel: 'Wheel speed (rpm)', ylabel: 'One turn round the stand (s)' });
  pane.append(el('div', { class: 'vp-main' }, box));
  function draw() {
    const p = params(), xs = [], ys = [], yf = [];
    for (let r = 600; r <= 8000; r += 50) { const w3 = r * 2 * Math.PI / 60, Om = slowPrecession(p, w3, Math.PI / 2 + 0.02); xs.push(r); ys.push(Number.isFinite(Om) ? 2 * Math.PI / Om : NaN); yf.push(2 * Math.PI * p.I3 * w3 / p.mgd); }
    plot.setSeries([{ x: xs, y: yf, color: COLORS.gold, dash: [5, 4], width: 1.6, label: 'fast-top formula' }, { x: xs, y: ys, color: COLORS.violet, width: 2.4, label: 'steady precession' }]).setVLines([{ x: S.rpm, color: COLORS.pink, dash: [4, 4] }]).draw();
  }
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

bench.tabs = [
  { id: 'spin', label: 'Spin', build: tabSpin },
  { id: 'graph', label: 'Speed and precession', build: tabGraph },
];

export default bench;
