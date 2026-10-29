// 1F · Spring and motor. A mass on a spring, hung from a motor that shakes the top up and
// down. Swap springs, masses and dampers; pluck it and watch it ring down, or sweep the motor
// through resonance. (The same physics, with spins instead of springs, is upstairs on 3F.)

import { el, slider, button, group, readout, canvasBox, note, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas, gauss } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { tr } from '../i18n.js';

const bench = {
  id: 'spring', title: 'Spring and motor', kicker: '1F · Classics Hall', icon: '≋', floor: 1,
  blurb: 'Driven oscillations and resonance.',
  slots: [
    { id: 'spring', label: 'Spring', options: ['spring-soft', 'spring-mid', 'spring-stiff'], def: 'spring-mid' },
    { id: 'mass', label: 'Mass', options: ['m50', 'm100', 'm200', 'm500', 'm-mystery'], def: 'm100' },
    { id: 'damper', label: 'Damping', options: ['damp-air', 'damp-paddle', 'damp-magnet'], def: 'damp-air' },
    { id: 'sensor', label: 'Measure with', options: ['ruler', 'motion'], def: 'ruler' },
  ],
};
bench.header = rigStrip(bench);

const S = { f: 1.0, A: 0.008, motor: false, gap: 6, x: 0, v: 0, t: 0, phase: 0, trace: [], env: 0, envT: 0, last: null };

function params() {
  const sp = phys(bench, 'spring'), ms = phys(bench, 'mass'), dm = phys(bench, 'damper');
  const m = ms.id === 'm-mystery' ? rig.secret('blockM') / 1000 : ms.m;
  let b = dm.b;
  if (dm.id === 'damp-magnet') b = 0.004 + 0.55 * Math.exp(-S.gap / 3.2);
  const meff = m + sp.ms / 3;
  return { k: sp.k, m, meff, b, f0: Math.sqrt(sp.k / meff) / (2 * Math.PI), Q: Math.sqrt(sp.k * meff) / b, mystery: ms.id === 'm-mystery' };
}
// steady-state response of the mass to the shaking top: amplitude ratio and phase lag
export function response(p, f) {
  const w = 2 * Math.PI * f, w0 = Math.sqrt(p.k / p.meff), g = p.b / p.meff;
  const re = w0 * w0 - w * w, im = g * w;
  return { ratio: w0 * w0 / Math.hypot(re, im), lag: Math.atan2(im, re) };
}

// ---------------------------------------------------------------- live
function tabLive(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Pluck the mass and let it ring, or switch on the motor to shake the top of the spring. Near the natural frequency a tiny shake gives a huge swing: <b>resonance</b>.' }));
  const box = canvasBox('', '3 / 4', 'The spring, the mass and the motor');
  const trBox = canvasBox('', '16 / 9', 'Position of the mass against time');
  const trPlot = new Plot(trBox.canvas, { xlabel: 'Time (s)', ylabel: 'Position (mm)' });
  const fS = slider({ label: 'Motor frequency', unit: 'Hz', min: 0.1, max: 6, step: 0.005, value: S.f, digits: 4, onInput: (v) => { S.f = v; } });
  const aS = slider({ label: 'Motor stroke (amplitude)', unit: 'mm', min: 1, max: 20, step: 0.5, value: S.A * 1000, digits: 3, onInput: (v) => { S.A = v / 1000; } });
  const gS = slider({ label: 'Magnet gap', unit: 'mm', min: 1, max: 20, step: 0.5, value: S.gap, digits: 3, onInput: (v) => { S.gap = v; } });
  const motor = button('Motor on', () => { S.motor = !S.motor; motor.textContent = S.motor ? 'Motor off' : 'Motor on'; }, 'go');
  const pluck = button('Pluck it', () => { S.motor = false; motor.textContent = 'Motor on'; S.x = 0.03; S.v = 0; S.trace = []; }, 'secondary');
  const still = button('Hold it still', () => { S.x = 0; S.v = 0; S.motor = false; motor.textContent = 'Motor on'; }, 'quiet');
  const ampRo = readout('Size of the swing'), lagRo = readout('Lag behind the motor'), f0Ro = readout('Frequency you see');
  const rec = button('Record this point', () => {
    const p = params(), sensor = current(bench, 'sensor');
    if (!S.motor) return;
    const r = S.env;
    table.add({ n: table.rows.length + 1, spring: current(bench, 'spring'), mass: current(bench, 'mass'), f: S.f, amp: r * 1000, lag: sensor === 'motion' ? S.lagMeas * 180 / Math.PI : null });
    rig.note({ bench: 'spring', f: S.f, amp: r, mass: current(bench, 'mass') });
  }, 'secondary');
  const side = el('div', { class: 'vp-side' }, group('Motor', fS, aS, el('div', { class: 'vp-row' }, motor, pluck, still)), gS, rec);
  const main = el('div', { class: 'vp-main' }, el('div', { class: 'spring-row' }, box, trBox), el('div', { class: 'ros' }, ampRo, lagRo, f0Ro));
  pane.append(el('div', { class: 'vp-cols' }, side, main), table.el);
  function sync() { gS.hidden = current(bench, 'damper') !== 'damp-magnet'; const m = current(bench, 'sensor') === 'motion'; trBox.hidden = !m; lagRo.hidden = !m; }
  onRig(bench, sync); sync();

  let lastPeak = null, peaks = [], prevV = 0, cross = [];
  const anim = loop((dt) => {
    const p = params();
    const h = 0.0005;
    let left = dt;
    while (left > 1e-9) {
      const st = Math.min(h, left); left -= st;
      const w = 2 * Math.PI * S.f;
      const top = S.motor ? S.A * Math.sin(S.phase) : 0;
      // semi-implicit Euler is plenty at half a millisecond
      const a = (p.k * (top - S.x) - p.b * S.v) / p.meff;
      S.v += a * st; S.x += S.v * st; S.t += st;
      if (S.motor) S.phase += w * st;
      // turning points for the swing size, upward zero crossings for the frequency
      if (prevV > 0 && S.v <= 0) { peaks.push([S.t, S.x]); if (peaks.length > 6) peaks.shift(); }
      if (S.x - S.v * st < 0 && S.x >= 0 && S.v > 0) { cross.push(S.t); if (cross.length > 6) cross.shift(); if (S.motor) { const ph = ((S.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); S.lagMeas = ph; } }
      prevV = S.v;
    }
    S.trace.push([S.t, S.x * 1000]); if (S.trace.length > 1500) S.trace.splice(0, S.trace.length - 1500);
    S.env = peaks.length ? Math.max(...peaks.slice(-2).map((q) => q[1])) : 0;
    draw(p);
  });
  function draw(p = params()) {
    drawSpring(box.canvas, p, S);
    const sensor = current(bench, 'sensor');
    const amp = S.env * 1000;
    ampRo.set(sensor === 'ruler' ? `about ${Math.max(0, Math.round(amp))} mm` : `${amp.toFixed(2)} mm`);
    if (cross.length > 2) f0Ro.set(`${((cross.length - 1) / (cross[cross.length - 1] - cross[0])).toFixed(sensor === 'motion' ? 3 : 2)} Hz`);
    if (sensor === 'motion') {
      lagRo.set(S.motor && S.lagMeas !== undefined ? `${(S.lagMeas * 180 / Math.PI).toFixed(0)}°` : '–');
      const tr = S.trace, t1 = tr.length ? tr[tr.length - 1][0] : 0;
      const xs = [], ys = []; for (const [t, x] of tr) if (t > t1 - 8) { xs.push(t); ys.push(x); }
      trPlot.xlim = [t1 - 8, t1]; trPlot.setSeries([{ x: xs, y: ys, color: COLORS.signal, width: 2 }]).draw();
    }
  }
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

function drawSpring(c, p, S) {
  const { g, w, h } = fitCanvas(c);
  g.fillStyle = '#EAF6FC'; g.fillRect(0, 0, w, h);
  const sc = h / 0.62;   // pixels per metre
  const cx = w * 0.55, motorY = h * 0.12;
  const top = S.motor ? S.A * Math.sin(S.phase) : 0;
  // stand
  g.fillStyle = '#CFE0F0'; g.fillRect(w * 0.12, 10, 10, h - 20); g.fillRect(w * 0.12, 10, cx - w * 0.12 + 30, 10);
  g.fillStyle = '#9DB8D3'; g.fillRect(w * 0.05, h - 16, w * 0.9, 8);
  // motor and its crank
  g.fillStyle = '#2E4A7D'; g.fillRect(cx - 34, motorY - 22, 68, 30);
  g.fillStyle = S.motor ? '#4CB782' : '#6A86A8'; g.beginPath(); g.arc(cx + 24, motorY - 7, 4, 0, 7); g.fill();
  const rodY = motorY + 8 + top * sc;
  g.fillStyle = '#4F6A8F'; g.fillRect(cx - 3, motorY + 8, 6, Math.max(2, 10 + top * sc));
  // spring
  const springTop = rodY + 10, rest = 0.30 * sc;
  const massTop = motorY + 18 + rest + S.x * sc;   // the spring stretches between the moving rod and the mass
  const coils = 14, wdt = 18 + 6 * (ITEMS[current(bench, 'spring')].phys.k / 40);
  g.strokeStyle = { 'spring-soft': '#2F7D5B', 'spring-mid': '#3D6FB6', 'spring-stiff': '#B3243B' }[current(bench, 'spring')] || '#3D6FB6';
  g.lineWidth = 2; g.beginPath(); g.moveTo(cx, springTop);
  for (let i = 0; i <= coils; i++) { const y = springTop + (massTop - springTop) * i / coils; g.lineTo(cx + (i % 2 ? wdt / 2 : -wdt / 2) * (i === 0 || i === coils ? 0 : 1), y); }
  g.lineTo(cx, massTop); g.stroke();
  // mass
  const mid = current(bench, 'mass'), mm = p.m;
  const mh = 18 + 30 * Math.cbrt(mm / 0.5), mw = 40 + 24 * Math.cbrt(mm / 0.5);
  g.fillStyle = mid === 'm-mystery' ? '#6B5BE6' : '#D8B04A'; g.strokeStyle = '#1B2440'; g.lineWidth = 1.5;
  g.fillRect(cx - mw / 2, massTop, mw, mh); g.strokeRect(cx - mw / 2, massTop, mw, mh);
  g.fillStyle = '#FFFDF6'; g.font = '600 12px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(mid === 'm-mystery' ? '?' : ITEMS[mid].name.replace(' mass', ''), cx, massTop + mh / 2);
  // damper
  const dm = current(bench, 'damper');
  if (dm === 'damp-paddle') { g.fillStyle = 'rgba(111,183,240,0.35)'; g.fillRect(cx - 60, massTop + mh + 30, 120, 70); g.strokeStyle = '#6A86A8'; g.strokeRect(cx - 60, massTop + mh + 30 - 10, 120, 80); g.fillStyle = '#4F6A8F'; g.fillRect(cx - 2, massTop + mh, 4, 60); g.fillRect(cx - 22, massTop + mh + 52, 44, 8); }
  if (dm === 'damp-magnet') { g.fillStyle = '#D9824A'; g.fillRect(cx - 2, massTop + mh, 4, 50); g.fillRect(cx - 18, massTop + mh + 30, 36, 30); g.fillStyle = '#E5534B'; g.fillRect(cx + 22 + S.gap * 2, massTop + mh + 34, 18, 22); g.fillStyle = '#3D6FB6'; g.fillRect(cx - 40 - S.gap * 2, massTop + mh + 34, 18, 22); }
  // ruler or sensor
  const sensor = current(bench, 'sensor');
  if (sensor === 'ruler') {
    const rx = cx + mw / 2 + 26;
    g.fillStyle = '#FFE07A'; g.fillRect(rx, massTop - 60, 22, 140);
    g.fillStyle = '#1B2440'; for (let i = 0; i <= 28; i++) g.fillRect(rx, massTop - 60 + i * 5, i % 2 ? 6 : 11, 1);
  } else {
    g.fillStyle = '#22325C'; g.fillRect(cx - 22, h - 46, 44, 26); g.fillStyle = '#A8ECFF'; g.beginPath(); g.arc(cx, h - 33, 8, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,169,214,0.35)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(cx, h - 46); g.lineTo(cx, massTop + mh + 2); g.stroke(); g.setLineDash([]);
  }
}

// ---------------------------------------------------------------- frequency sweep
function tabSweep(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Let the motor run at each frequency until the swing settles, read the size of the swing and the lag, then step to the next frequency. The peak sits at the natural frequency f₀ = (1/2π)√(k/m), and its width tells you the damping.' }));
  const box = canvasBox('', '16 / 9', 'Swing size against motor frequency');
  const plot = new Plot(box.canvas, { xlabel: 'Motor frequency (Hz)', ylabel: 'Swing ÷ motor stroke' });
  const box2 = canvasBox('', '16 / 7', 'Lag against motor frequency');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Motor frequency (Hz)', ylabel: 'Lag (°)' });
  const f1 = slider({ label: 'From', unit: 'Hz', min: 0.1, max: 6, step: 0.05, value: 0.3, digits: 3 });
  const f2 = slider({ label: 'To', unit: 'Hz', min: 0.2, max: 8, step: 0.05, value: 4, digits: 3 });
  const go = button('Sweep', () => run(), 'primary');
  const clr = button('Clear', () => { runs.length = 0; draw(); }, 'quiet');
  const peakRo = readout('Peak at'), qRo = readout('Width (half power)');
  const need = note('The lag needs the <b>motion sensor</b>. With the ruler you only read the size of the swing, to about a millimeter.');
  const runs = [];
  pane.append(el('div', { class: 'vp-cols' }, el('div', { class: 'vp-side' }, group('Sweep range', f1, f2, el('div', { class: 'vp-row' }, go, clr))), el('div', { class: 'vp-main' }, box, box2, el('div', { class: 'ros' }, peakRo, qRo), need)));
  function run() {
    const p = params(), sensor = current(bench, 'sensor');
    const a = Math.min(f1.get(), f2.get()), b = Math.max(f1.get(), f2.get());
    const n = 160, xs = [], ys = [], ls = [];
    for (let i = 0; i < n; i++) {
      const f = a + (b - a) * i / (n - 1), r = response(p, f);
      // reading noise: a millimetre by eye, a few hundredths with the sensor
      const noise = sensor === 'ruler' ? 0.001 / S.A : 0.00005 / S.A;
      xs.push(f); ys.push(Math.max(0, r.ratio + noise * gauss())); ls.push(r.lag * 180 / Math.PI + (sensor === 'motion' ? 0.5 * gauss() : 0));
    }
    let im = 0; for (let i = 1; i < n; i++) if (ys[i] > ys[im]) im = i;
    const half = ys[im] / Math.SQRT2; let lo = im, hi = im;
    while (lo > 0 && ys[lo] > half) lo--; while (hi < n - 1 && ys[hi] > half) hi++;
    peakRo.set(`${xs[im].toFixed(3)} Hz`);
    qRo.set(lo > 0 && hi < n - 1 ? `${(xs[hi] - xs[lo]).toFixed(3)} Hz, so Q ≈ ${(xs[im] / (xs[hi] - xs[lo])).toFixed(0)}` : 'sweep wider to see it');
    runs.push({ xs, ys, ls, label: ['spring', 'mass', 'damper'].map((k) => tr(ITEMS[current(bench, k)].name)).join(', '), sensor });
    if (runs.length > 4) runs.shift();
    rig.note({ bench: 'spring', sweep: true, peak: xs[im], mass: current(bench, 'mass') });
    draw();
  }
  function draw() {
    const cols = [COLORS.signal, COLORS.pink, COLORS.violet, COLORS.gold];
    plot.setSeries(runs.map((r, i) => ({ x: r.xs, y: r.ys, color: cols[i], width: 2, label: r.label }))).draw();
    const withLag = runs.filter((r) => r.sensor === 'motion');
    box2.hidden = !withLag.length; need.hidden = !!withLag.length;
    if (withLag.length) { plot2.ylim = [0, 180]; plot2.setSeries(withLag.map((r, i) => ({ x: r.xs, y: r.ls, color: cols[runs.indexOf(r)], width: 2 }))).draw(); }
  }
  return { show() { draw(); }, resize() { draw(); } };
}

const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'spring', label: 'Spring', fmt: (v) => ITEMS[v].name },
  { key: 'mass', label: 'Mass', fmt: (v) => ITEMS[v].name },
  { key: 'f', label: 'Motor (Hz)', fmt: (v) => v.toFixed(3) },
  { key: 'amp', label: 'Swing (mm)', fmt: (v) => v.toFixed(1) },
  { key: 'lag', label: 'Lag (°)', fmt: (v) => (v === null ? '–' : v.toFixed(0)) },
], { caption: 'Your readings' });

// ---------------------------------------------------------------- the hands-on stage
const GRAV = 9.81;
function paramsFor(springId, massId, damperId, gap = 6) {
  const sp = ITEMS[springId].phys, dmP = ITEMS[damperId].phys;
  const m = massId === 'm-mystery' ? rig.secret('blockM') / 1000 : ITEMS[massId].phys.m;
  let b = dmP.b;
  if (damperId === 'damp-magnet') b = 0.004 + 0.55 * Math.exp(-gap / 3.2);
  const meff = m + sp.ms / 3;
  return { k: sp.k, m, meff, b, f0: Math.sqrt(sp.k / meff) / (2 * Math.PI), spring: springId, mass: massId, damper: damperId };
}
function rigOf(springId, massId, damperId, label = '') {
  return { p: paramsFor(springId, massId, damperId), x: 0, v: 0, phase: 0, motor: false, f: 1, A: 0.008, t: 0, peaks: [], cross: [], env: 0, heat: 0, work: 0, lag: null, label, hold: false, prevV: 0, E0: 0 };
}
function stepRig(r, dt, onBig) {
  let left = dt;
  const p = r.p;
  while (left > 1e-12) {
    const h = Math.min(0.0005, left); left -= h;
    const w = 2 * Math.PI * r.f;
    const top = r.motor ? r.A * Math.sin(r.phase) : 0;
    if (!r.hold) {
      const a = (p.k * (top - r.x) - p.b * r.v) / p.meff;
      r.v += a * h; r.x += r.v * h;
      r.heat += p.b * r.v * r.v * h;
    }
    r.t += h;
    if (r.motor) r.phase += w * h;
    if (r.prevV > 0 && r.v <= 0) { r.peaks.push([r.t, r.x]); if (r.peaks.length > 4) r.peaks.shift(); if (onBig) onBig(r); }
    if (r.x - r.v * h < 0 && r.x >= 0 && r.v > 0) {
      r.cross.push(r.t); if (r.cross.length > 6) r.cross.shift();
      if (r.motor) { r.lag = ((r.phase % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); }
    }
    r.prevV = r.v;
  }
  r.env = r.peaks.length ? Math.max(...r.peaks.slice(-2).map((q) => Math.abs(q[1]))) : Math.abs(r.x);
}
const freqSeen = (r) => (r.cross.length > 2 ? (r.cross.length - 1) / (r.cross[r.cross.length - 1] - r.cross[0]) : null);

function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'hoo', label: 'A mass hanging on a spring from a motor. Drag the mass down and let go, or switch the motor on.',
    hello: 'Pull the mass down and **let go** to see it bounce on its own. Then switch the **motor** on and slowly change its speed. Somewhere it goes wild: that is **resonance**.',
    aspect: 16 / 10.5,
    onReset: () => { exitCompare(); one.motor = false; one.x = 0; one.v = 0; one.heat = 0; one.work = 0; curve.clear(); syncBtns(); },
    onHide: () => { hum.set(60, 0); },
    keys: { arrow(dx, dy) { if (dy) { one.hold = true; one.x = Math.max(-0.06, Math.min(0.06, one.x - dy * 0.004)); one.v = 0; } if (dx) setF(one.f * (dx > 0 ? 1.03 : 1 / 1.03)); }, action() { if (one.hold) letGo(); else toggleMotor(); } },
  });
  st.tool('forces', 'Forces', { icon: K.COL.spring }).tool('energy', 'Energy', { icon: K.COL.ke }).tool('phase', 'Timing dial', { icon: '#F29E4C' })
    .tool('curve', 'Your resonance curve', { icon: K.COL.net, on: true }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('f0', 'Bounces on its own at').readout('motor', 'Motor').readout('amp', 'Size of the swing').readout('lag', 'Mass lags the motor by');
  const graph = st.liveGraph({ series: [{ id: 'x', label: 'mass (mm)', color: K.COL.net }, { id: 'top', label: 'motor (mm)', color: '#F29E4C' }], window: 6, ylabel: 'mm', sym: true });

  let one = rigOf(current(bench, 'spring'), current(bench, 'mass'), current(bench, 'damper'));
  let cmp = null, pending = null, firstPull = true;
  const curve = new Map();          // frequency bin -> swing / stroke
  let steadyT = 0, G = { w: 700, h: 460 };
  const hum = sound.hum('triangle');

  const fIn = el('input', { type: 'range', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'Motor frequency' });
  const fLab = el('span');
  const toF = (u) => 0.2 * Math.pow(25, u / 1000), toU = (f) => Math.round(1000 * Math.log(f / 0.2) / Math.log(25));
  fIn.addEventListener('input', () => setF(toF(+fIn.value)));
  const motorBtn = el('button', { type: 'button', class: 'stg-act', text: 'Motor on' });
  const pullBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Pull and let go' });
  motorBtn.addEventListener('click', () => toggleMotor());
  pullBtn.addEventListener('click', () => { one.motor = false; one.x = -0.03; one.v = 0; one.hold = false; one.E0 = 0.5 * one.p.k * 0.03 * 0.03; one.heat = 0; one.work = 0; syncBtns(); sound.play('boing'); });
  st.controls(el('label', { class: 'stg-range' }, fLab, fIn), el('div', { class: 'stg-row' }, motorBtn, pullBtn));
  function setF(f) { one.f = Math.max(0.2, Math.min(5, f)); fIn.value = toU(one.f); fLab.textContent = `Motor speed: ${one.f.toFixed(2)} turns a second`; steadyT = 0; }
  function toggleMotor() { one.motor = !one.motor; one.hold = false; if (one.motor) { one.heat = 0; one.work = 0; firstPull = false; st.hint(null); } syncBtns(); sound.play('click'); }
  function syncBtns() { motorBtn.textContent = one.motor ? 'Motor off' : 'Motor on'; }
  setF(1.0);
  function letGo() { one.hold = false; one.v = 0; one.E0 = 0.5 * one.p.k * one.x * one.x; one.heat = 0; one.work = 0; sound.play('boing', { vol: Math.min(1, Math.abs(one.x) * 30) }); }
  function sync() {
    const motor = one.motor, f = one.f, x = one.x, v = one.v;
    one.p = paramsFor(current(bench, 'spring'), current(bench, 'mass'), current(bench, 'damper'));
    Object.assign(one, { motor, f, x, v });
    curve.clear();
  }
  onRig(bench, sync);
  function compare(a, b) { cmp = { A: rigOf(a.spring, a.mass, a.damper || 'damp-air', a.label), B: rigOf(b.spring, b.mass, b.damper || 'damp-air', b.label) }; }
  function exitCompare() { cmp = null; }

  // ---------- physics
  st.onStep((dt) => {
    const rigs = cmp ? [cmp.A, cmp.B] : [one];
    for (const r of rigs) stepRig(r, dt);
    const r = rigs[0];
    if (dt > 0) graph.push(r.t, { x: r.x * 1000, top: r.motor ? r.A * Math.sin(r.phase) * 1000 : 0 });
    // the curve fills in as the swing settles at each motor speed
    if (!cmp && one.motor && dt > 0) {
      steadyT += dt;
      const need = Math.max(3, 8 / (one.p.b / one.p.meff + 0.5));
      if (steadyT > Math.min(need, 12)) curve.set(Math.round(one.f * 40) / 40, one.env / one.A);
    }
    const loud = one.motor && !cmp ? 0.05 : 0;
    hum.set(55 + one.f * 18, loud, 0.5);
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- drawing
  st.onResize((w, h, narrow) => { G = { w, h, narrow }; });
  let PX = 1700;                           // pixels per metre for the swing
  const U = () => Math.max(0.8, Math.min(1.25, (G.h || 520) / 540));
  const stretchPx = (p) => 170 * U() * Math.tanh((p.m * GRAV / p.k) / 0.2);
  function layout(r, cx) {
    const u = U(); PX = 1700 * u;
    const motorY = 50, rodTop = motorY + 34;
    const top = r.motor ? r.A * Math.sin(r.phase) : 0;
    const attach = rodTop + 22 - top * PX;
    const rest = 130 * u, eqY = attach + rest + stretchPx(r.p);
    const massY = eqY - r.x * PX;
    return { cx, motorY, attach, eqY, massY, top };
  }
  const massSize = (p) => { const k = Math.cbrt(p.m / 0.1), u = U(); return [(52 + 22 * k) * u, (22 + 18 * k) * u]; };

  function drawRig(g, r, cx, { hover = false, labelTag = null } = {}) {
    const L = layout(r, cx), [mw, mh] = massSize(r.p);
    // frame arm from the left post
    K.rod(g, cx - 120, L.motorY - 22, cx + 30, L.motorY - 22, 10, K.MAT.steel);
    // motor box with its crank wheel
    K.box(g, cx - 40, L.motorY - 16, 80, 40, K.MAT.navy, { r: 6 });
    const wx = cx, wy = L.motorY + 4, wr = 13;
    g.save(); g.beginPath(); g.arc(wx, wy, wr, 0, Math.PI * 2); g.fillStyle = '#C4D8EC'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(r.phase - Math.PI / 2) * (wr - 3), wy - Math.sin(r.phase - Math.PI / 2) * (wr - 3)); g.lineWidth = 3; g.strokeStyle = '#F29E4C'; g.stroke();
    g.restore();
    K.glow(g, cx + 30, L.motorY - 6, 8, r.motor ? '#22B07A' : '#E5534B', 0.9);
    g.fillStyle = r.motor ? '#22B07A' : '#E5534B'; g.beginPath(); g.arc(cx + 30, L.motorY - 6, 3, 0, Math.PI * 2); g.fill();
    // the push rod, moving up and down with the motor
    K.rod(g, cx, L.motorY + 24, cx, L.attach, 7, K.MAT.chrome);
    K.box(g, cx - 9, L.attach - 4, 18, 8, K.MAT.steel, { r: 2 });
    // spring
    const col = { 'spring-soft': ['#62C46E', '#2F7D5B'], 'spring-mid': ['#6FA9E8', '#2E4A7D'], 'spring-stiff': ['#F28A8A', '#A12F38'] }[r.p.spring] || ['#6FA9E8', '#2E4A7D'];
    K.spring(g, cx, L.attach + 3, cx, L.massY, { coils: 9, r: 13 + 4 * Math.sqrt(r.p.k / 25), lw: 2.8, color: col[0], dark: col[1], ends: 6 });
    // mass: slotted brass discs, or the mystery block
    K.shadow(g, cx, G.h * 0.95, mw * 0.6, 7, 0.18);
    if (hover) K.glow(g, cx, L.massY + mh / 2, mw, '#00D4FF', 0.32);
    if (r.p.mass === 'm-mystery') {
      K.box(g, cx - mw / 2, L.massY, mw, mh, K.MAT.violet, { r: 6 });
      K.text(g, '?', cx, L.massY + mh / 2 + 6, { size: 18, weight: 700, align: 'center', color: '#FFFDF6', font: K.PIXF });
    } else {
      const n = Math.max(1, Math.round(mh / 9));
      for (let i = 0; i < n; i++) K.box(g, cx - mw / 2, L.massY + i * (mh / n), mw, mh / n + 1, K.MAT.brass, { r: 4, lw: 2 });
      K.text(g, ITEMS[r.p.mass].name.replace(' mass', ''), cx, L.massY + mh / 2 + 5, { size: 12, weight: 700, align: 'center', color: K.LINE });
    }
    // damper below the mass
    const dm = r.p.damper, by = L.massY + mh;
    if (dm === 'damp-paddle') {
      K.rod(g, cx, by, cx, by + 46, 4, K.MAT.steel);
      const wy0 = L.eqY + mh + 30;
      g.save(); g.fillStyle = 'rgba(111,183,240,0.45)'; g.fillRect(cx - 52, wy0, 104, 64); g.restore();
      K.box(g, cx - 18, by + 34, 36, 12, K.MAT.alu, { r: 2 });
      g.save(); g.strokeStyle = 'rgba(0,115,158,0.7)'; g.lineWidth = 2.5; g.strokeRect(cx - 56, wy0 - 14, 112, 80); g.restore();
      K.tag(g, 'paddle in water', cx + 70, wy0 + 24, { align: 'left', size: 11 });
    } else if (dm === 'damp-magnet') {
      K.rod(g, cx, by, cx, by + 40, 4, K.MAT.copper);
      K.box(g, cx - 14, by + 22, 28, 34, K.MAT.copper, { r: 3 });
      const yy = L.eqY + mh + 26;
      K.box(g, cx + 22, yy, 22, 28, K.MAT.magnetN, { r: 3 }); K.box(g, cx - 44, yy, 22, 28, K.MAT.magnetS, { r: 3 });
      K.text(g, 'N', cx + 33, yy + 19, { size: 12, weight: 700, align: 'center', color: '#FFFDF6' }); K.text(g, 'S', cx - 33, yy + 19, { size: 12, weight: 700, align: 'center', color: '#FFFDF6' });
      K.tag(g, 'copper plate between magnets', cx + 54, yy + 14, { align: 'left', size: 11 });
    }
    if (labelTag) K.tag(g, labelTag, cx, 18, { size: 12, bg: '#FFE9B3' });
    return { L, mw, mh };
  }

  function drawRuler(g, x, L) {
    const top = L.eqY - 0.06 * PX, bot = L.eqY + 0.06 * PX;
    K.box(g, x, top - 6, 30, bot - top + 12, K.MAT.yellow, { r: 3, lw: 2, bands: false });
    g.save(); g.fillStyle = K.LINE; g.font = `600 9px ${K.FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    for (let mm = -60; mm <= 60; mm += 5) { const y = L.eqY - mm / 1000 * PX, big = mm % 10 === 0; g.fillRect(x, y, big ? 10 : 6, 1.2); if (mm % 20 === 0) g.fillText(String(mm / 10), x + 12, y); }
    g.restore();
    K.text(g, 'cm', x + 6, top - 12, { size: 10, weight: 600 });
    K.lineSeg(g, x - 10, L.eqY, x + 34, L.eqY, K.hexA(K.COL.net, 0.6), 1.5, [4, 3]);
  }

  function drawSensor(g, cx, L, r, h) {
    const y = h - 40;
    K.box(g, cx - 26, y, 52, 26, K.MAT.navy, { r: 5 });
    K.ball(g, cx - 9, y + 13, 7, ['#BFEFFF', '#FFFFFF', '#3D9AC6'], { lw: 1.5 }); K.ball(g, cx + 9, y + 13, 7, ['#BFEFFF', '#FFFFFF', '#3D9AC6'], { lw: 1.5 });
    const k = (st.t * 3) % 1;
    g.save(); g.strokeStyle = `rgba(0,169,214,${0.6 * (1 - k)})`; g.lineWidth = 2;
    for (let j = 0; j < 3; j++) { const rr = 14 + ((k + j / 3) % 1) * (y - L.massY - 70); if (rr > 0) { g.beginPath(); g.arc(cx, y, rr, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); } }
    g.restore();
    K.lcd(g, cx + 34, y - 8, 96, 34, `${(r.x * 1000).toFixed(1)} mm`, { size: 14, label: 'motion sensor' });
  }

  function drawForces(g, r, cx, L, mh) {
    const F = 58, cy = L.massY + mh / 2;
    const top = r.motor ? r.A * Math.sin(r.phase) : 0;
    const extra = r.p.k * (top - r.x) / (r.p.m * GRAV);
    K.arrow(g, cx - 34, cy, cx - 34, cy + F, K.COL.gravity, { label: 'weight', size: 11 });
    K.arrow(g, cx - 34, cy, cx - 34, cy - F * Math.max(0, 1 + extra), K.COL.spring, { label: 'spring', size: 11 });
    const net = (extra - r.p.b * r.v / (r.p.m * GRAV)) * F;
    if (Math.abs(net) > 3) K.arrow(g, cx + 36, cy, cx + 36, cy - net, K.COL.net, { label: Math.abs(net) > 18 ? 'total: back to the middle' : null, labelAt: 'side', side: -1, size: 11, lw: 5 });
  }

  function drawPhaseDial(g, r, x, y) {
    const R = 34;
    g.save();
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fillStyle = 'rgba(255,253,246,0.95)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    // both hands go round once per turn of the motor; the gap between them is the lag
    const mot = r.phase - Math.PI / 2, mass = Math.atan2(-r.v / (2 * Math.PI * r.f), r.x);
    const hand = (a, c, len) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y - Math.sin(a) * len); g.strokeStyle = c; g.lineWidth = 4; g.lineCap = 'round'; g.stroke(); };
    hand(mot, '#F29E4C', R - 6);
    if (r.motor && r.env > 0.0005) hand(mass, K.COL.net, R - 10);
    g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fillStyle = K.LINE; g.fill();
    g.restore();
    K.tag(g, 'motor', x - 30, y + R + 14, { size: 10.5, bg: '#FFD1A1' }); K.tag(g, 'mass', x + 30, y + R + 14, { size: 10.5, bg: '#C3B4FF' });
  }

  function drawCurve(g, x, y, w, h) {
    K.box(g, x, y, w, h, K.MAT.cream, { r: 10, lw: 2, bands: false });
    K.text(g, 'your resonance curve', x + 10, y + 17, { size: 11.5, weight: 600 });
    const px0 = x + 30, py0 = y + h - 22, pw = w - 42, ph = h - 50;
    g.save(); g.strokeStyle = K.LINE; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px0, y + 26); g.lineTo(px0, py0); g.lineTo(px0 + pw, py0); g.stroke();
    K.text(g, 'motor speed →', px0 + pw, py0 + 15, { size: 10, weight: 600, align: 'right' });
    K.text(g, 'swing', x + 6, y + 36, { size: 10, weight: 600 });
    let mx = 4; for (const v of curve.values()) mx = Math.max(mx, v);
    const X = (f) => px0 + Math.log(f / 0.2) / Math.log(25) * pw, Y = (v) => py0 - v / (mx * 1.1) * ph;
    // where the motor is now
    K.lineSeg(g, X(one.f), y + 26, X(one.f), py0, K.hexA('#F29E4C', 0.8), 2, [4, 3]);
    for (const [f, v] of curve) { g.beginPath(); g.arc(X(f), Y(v), 3.5, 0, Math.PI * 2); g.fillStyle = K.COL.net; g.fill(); g.lineWidth = 1; g.strokeStyle = K.LINE; g.stroke(); }
    g.restore();
  }

  function drawEnergy(g, r, x, y) {
    const top = r.motor ? r.A * Math.sin(r.phase) : 0;
    const ke = 0.5 * r.p.meff * r.v * r.v, pe = 0.5 * r.p.k * (top - r.x) ** 2;
    r.Emax = Math.max((r.Emax || 0) * 0.995, ke + pe, 1e-9);
    K.bars(g, x, y, 150, 160, [
      { label: 'motion', value: ke, color: K.COL.ke }, { label: 'spring', value: pe, color: K.COL.spe },
    ], r.Emax, { title: 'Energy now' });
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[1], { floorH: 0.08 });
      // a tall stand on the left
      K.rod(gg, ww * 0.5 - 120, 24, ww * 0.5 - 120, hh * 0.93, 12, K.MAT.steel);
      K.box(gg, ww * 0.5 - 170, hh * 0.92, 100, 14, K.MAT.navy, { r: 4 });
    });
    if (cmp) {
      [[cmp.A, w * 0.3], [cmp.B, w * 0.7]].forEach(([r, cx]) => {
        drawRig(g, r, cx, { labelTag: r.label });
        const f = freqSeen(r);
        K.tag(g, f ? `${f.toFixed(2)} bounces a second` : '…', cx, h - 16, { size: 11.5 });
        if (st.on('phase') && r.motor) drawPhaseDial(g, r, cx + 90, 120);
      });
      return;
    }
    const cx = w * 0.5;
    const { L, mh } = drawRig(g, one, cx, { hover: st.hovering('mass') });
    if (current(bench, 'sensor') === 'motion') drawSensor(g, cx, L, one, h); else drawRuler(g, cx + 70, L);
    if (st.on('forces')) drawForces(g, one, cx, L, mh);
    if (st.on('phase')) drawPhaseDial(g, one, w - 70, G.narrow ? 70 : 90);
    if (st.on('energy')) drawEnergy(g, one, 16, 36);
    if (st.on('curve') && !G.narrow) drawCurve(g, w - 236, h - 186, 220, 168);
    if (firstPull && !one.motor) { const k = (Math.sin(st.t * 3) + 1) / 2; K.arrow(g, cx - 90, L.massY + mh / 2 + k * 8, cx - massSize(one.p)[0] / 2 - 8, L.massY + mh / 2 + 10, K.COL.normal, { lw: 3.5, head: 11 }); }
  });
  st.onOver(() => {
    const f = freqSeen(one);
    st.set('f0', !one.motor && f ? `${f.toFixed(2)} bounces a second` : one.motor ? '(motor on)' : 'pull it and see');
    st.set('motor', one.motor ? `${one.f.toFixed(2)} turns a second` : 'off');
    const sensor = current(bench, 'sensor');
    st.set('amp', sensor === 'motion' ? `${(one.env * 1000).toFixed(1)} mm` : `about ${Math.round(one.env * 1000)} mm`);
    const lagDeg = one.lag === null ? null : ((one.lag * 180 / Math.PI) > 300 ? 0 : one.lag * 180 / Math.PI);
    st.set('lag', one.motor && lagDeg !== null && one.env > 0.0008 ? `${Math.round(lagDeg)}° of a turn` : '–');
    graph.draw();
  });

  // ---------- hands
  st.handle({
    id: 'mass', cursor: 'grab', enabled: () => !cmp,
    hit: (x, y) => { const L = layout(one, G.w * 0.5), [mw, mh] = massSize(one.p); return x > G.w * 0.5 - mw / 2 - 14 && x < G.w * 0.5 + mw / 2 + 14 && y > L.massY - 14 && y < L.massY + mh + 14 ? 0 : false; },
    down: (x, y) => { firstPull = false; st.hint(null); one.hold = true; one.v = 0; st._y0 = y; st._x0 = one.x; },
    move: (x, y) => { one.x = Math.max(-0.06, Math.min(0.06, st._x0 - (y - st._y0) / PX)); one.v = 0; },
    up: (x, y, vx, vy) => { letGo(); one.v = Math.max(-1.2, Math.min(1.2, -vy / PX * 0.5)); },
  });
  st.handle({
    id: 'motorbox', cursor: 'pointer', enabled: () => !cmp,
    hit: (x, y) => (Math.abs(x - G.w * 0.5) < 42 && y > 26 && y < 72 ? 0 : false),
    click: () => toggleMotor(),
  });
  st.hint('Pull the mass down and let go', { sticky: true });

  // ---------- why does it bounce?
  const setMotor = (on, f) => { one.motor = on; if (f) setF(f); one.hold = false; syncBtns(); };
  st.tour({
    title: 'What is resonance?',
    steps: [
      { say: 'Pull the mass down and the spring pulls it back up. It overshoots, the spring pushes it back, and it **bounces at its own pace**: f = (1/2π)√(k/m).', tools: { forces: true, phase: false, energy: false }, enter: () => { exitCompare(); setMotor(false); one.x = -0.03; one.v = 0; } },
      { say: 'Switch the motor on, **slowly**. The mass simply rides along with the top of the spring, in step with it.', tools: { forces: false, phase: true }, enter: () => { one.x = 0; one.v = 0; setMotor(true, one.p.f0 * 0.35); } },
      { say: 'Now **too fast**. The mass can hardly follow: it barely moves, and what little it does is the wrong way round, down when the top goes up.', enter: () => { one.x = 0; one.v = 0; setMotor(true, one.p.f0 * 2.2); } },
      { say: 'Right at its own pace, **every push comes at just the right moment**, like pushing a swing. Each turn adds a little energy and the bounce grows and grows. That is **resonance**.', tools: { energy: true }, enter: () => { one.x = 0; one.v = 0; setMotor(true, one.p.f0); } },
      { say: 'Watch the timing dial: at resonance the mass is **a quarter turn behind** the motor. The motor pushes up while the mass is moving up, so every push helps.', tools: { energy: false, phase: true }, enter: () => { setMotor(true, one.p.f0); } },
      { say: 'Damping eats energy every bounce. With the **paddle in water** the peak is lower and much wider. Bridges, car springs and loudspeakers all need just the right amount.', tools: { phase: false }, enter: () => { one.p = paramsFor(one.p.spring, one.p.mass, 'damp-paddle'); one.x = 0; one.v = 0; setMotor(true, one.p.f0); } },
    ],
    onEnd: () => { sync(); setMotor(false); },
  });

  // ---------- predict, watch, explain
  const until = (cond, then) => { pending = { until: cond, then }; };
  const after = () => { pending = null; exitCompare(); sync(); setMotor(false); };
  st.setChallenges([
    {
      id: 'mass', title: 'A heavier mass', card: 'spring.mass', lock: true, after,
      q: 'Same spring, but a 500 g mass instead of 100 g. It bounces…', choices: ['faster', 'slower', 'at the same pace'], answer: 1,
      run: (s, finish) => {
        compare({ spring: 'spring-mid', mass: 'm100', label: '100 g' }, { spring: 'spring-mid', mass: 'm500', label: '500 g' });
        cmp.A.x = -0.03; cmp.B.x = -0.03;
        sound.play('boing');
        until(() => cmp && freqSeen(cmp.A) && freqSeen(cmp.B) && cmp.B.cross.length >= 4, () => finish(`100 g: ${freqSeen(cmp.A).toFixed(2)} bounces a second. 500 g: ${freqSeen(cmp.B).toFixed(2)}.`));
      },
      skip: () => { for (let i = 0; i < 2000 && cmp && !(cmp.B.cross.length >= 4); i++) { stepRig(cmp.A, 0.005); stepRig(cmp.B, 0.005); } },
      explain: 'A heavier mass is harder to speed up and slow down, so each bounce takes longer. Five times the mass gives √5 ≈ 2.2 times slower.',
    },
    {
      id: 'fast', title: 'Shake it fast', card: 'spring.fast', lock: true, after,
      q: 'Run the motor at about twice the speed the mass likes to bounce at. The mass moves…', choices: ['a lot, more than the motor', 'a little, and the wrong way round', 'exactly with the motor'], answer: 1,
      run: (s, finish) => { exitCompare(); one.x = 0; one.v = 0; setMotor(true, one.p.f0 * 2); s.setTool('phase', true); setTimeout(() => finish(`The swing settled at ${(one.env * 1000).toFixed(1)} mm for a ${(one.A * 1000).toFixed(0)} mm stroke.`), 5000); },
      explain: 'Above resonance the mass cannot keep up. The spring pushes it up just as the motor starts to come down, so it ends up moving opposite to the motor, and only a little.',
    },
    {
      id: 'phase', title: 'Perfect timing', card: 'spring.phase', lock: true, after,
      q: 'At resonance, the motor’s rod is at its highest. Where is the mass?', choices: ['At its highest too', 'In the middle, moving up', 'At its lowest'], answer: 1,
      run: (s, finish) => { exitCompare(); one.x = 0; one.v = 0; setMotor(true, one.p.f0); s.setTool('phase', true); s.setSpeed(0.25); setTimeout(() => { s.setSpeed(1); finish(); }, 6000); },
      explain: 'At resonance the mass lags a quarter turn behind. When the rod is at the top the mass is passing the middle on its way up, and the spring is pushing in the direction it moves, so the motor feeds it energy every turn.',
    },
  ]);

  sync();
  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'live', label: 'Measure', build: tabLive },
  { id: 'sweep', label: 'Frequency sweep', build: tabSweep },
];

export default bench;
