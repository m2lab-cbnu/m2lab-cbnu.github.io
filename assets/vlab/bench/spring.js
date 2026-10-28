// 1F · Spring and motor. A mass on a spring, hung from a motor that shakes the top up and
// down. Swap springs, masses and dampers; pluck it and watch it ring down, or sweep the motor
// through resonance. (The same physics, with spins instead of springs, is upstairs on 3F.)

import { el, slider, button, group, readout, canvasBox, note, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas, gauss } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

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
  const need = note('The lag needs the <b>motion sensor</b>. With the ruler you only read the size of the swing, to about a millimetre.');
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
    runs.push({ xs, ys, ls, label: `${ITEMS[current(bench, 'spring')].name}, ${ITEMS[current(bench, 'mass')].name}, ${ITEMS[current(bench, 'damper')].name}`, sensor });
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

bench.tabs = [
  { id: 'live', label: 'Shake it', build: tabLive },
  { id: 'sweep', label: 'Frequency sweep', build: tabSweep },
];

export default bench;
