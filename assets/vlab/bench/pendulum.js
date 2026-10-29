// 1F · Pendulum. A real swing, solved step by step: a bob of finite size on a light string,
// air drag, buoyancy and the air the bob drags along, large-angle swings, and a gravity room
// that can be set to another planet. Time it by hand, with a photogate, or film it.

import { el, slider, button, group, readout, canvasBox, note, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitProp, fitCanvas, fmtNum } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const RHO_AIR = 1.204;

const bench = {
  id: 'pendulum', title: 'Pendulum', kicker: '1F · Classics Hall', icon: 'T', floor: 1,
  blurb: 'Time swings, swap the bob, take it to another planet, and measure g.',
  slots: [
    { id: 'bob', label: 'Bob', options: ['ball-steel', 'ball-wood', 'bob-brass', 'ball-pingpong'], def: 'ball-steel' },
    { id: 'timer', label: 'Timing', options: ['stopwatch', 'photogate', 'camera'], def: 'stopwatch' },
    { id: 'place', label: 'Gravity room', options: ['g-earth', 'g-moon', 'g-mars', 'g-jupiter', 'g-x'], def: 'g-earth' },
    { id: 'air', label: 'Around it', options: ['air', 'belljar'], def: 'air' },
  ],
};
bench.header = rigStrip(bench);

// ---------------------------------------------------------------- physics
function gOf(placeId) {
  if (placeId === 'g-x') return rig.secret('planetX');
  return (ITEMS[placeId] && ITEMS[placeId].phys.g) || 9.81;
}
function params(L) {
  return paramsFor(L, current(bench, 'bob'), current(bench, 'place'), current(bench, 'air') === 'belljar');
}
function paramsFor(L, bobId, place, vac) {
  const b = { id: bobId, ...ITEMS[bobId].phys };
  const r = b.d / 2, V = 4 / 3 * Math.PI * r ** 3, rho = vac ? 0 : RHO_AIR;
  const g = gOf(place);
  const I = (b.m + 0.5 * rho * V) * L * L + 0.4 * b.m * r * r;
  return {
    L, r, m: b.m, g, rho, place, bob: b.id, vac,
    I, torqueG: (b.m - rho * V) * g * L,
    kd: 0.5 * rho * b.Cd * Math.PI * r * r,
    c: 4e-5 * (1 + L),       // a little friction at the pivot
  };
}
function deriv(p, th, om) {
  const v = p.L * om;
  const drag = p.kd * v * Math.abs(v) * p.L;
  return [om, (-p.torqueG * Math.sin(th) - drag - p.c * om) / p.I];
}
function rk4(p, s, h) {
  const [a1, b1] = deriv(p, s[0], s[1]);
  const [a2, b2] = deriv(p, s[0] + h / 2 * a1, s[1] + h / 2 * b1);
  const [a3, b3] = deriv(p, s[0] + h / 2 * a2, s[1] + h / 2 * b2);
  const [a4, b4] = deriv(p, s[0] + h * a3, s[1] + h * b3);
  s[0] += h / 6 * (a1 + 2 * a2 + 2 * a3 + a4); s[1] += h / 6 * (b1 + 2 * b2 + 2 * b3 + b4);
}
// complete elliptic integral of the first kind, K(k), by the arithmetic-geometric mean
function ellipK(k) { let a = 1, b = Math.sqrt(1 - k * k); for (let i = 0; i < 12; i++) { const t = (a + b) / 2; b = Math.sqrt(a * b); a = t; } return Math.PI / (2 * a); }
export function exactPeriod(p, th0) {
  return 4 * Math.sqrt(p.I / p.torqueG) * ellipK(Math.sin(th0 / 2));
}

// ---------------------------------------------------------------- shared state of the swing
const S = { L: 1.0, th0: 10, s: [0, 0], t: 0, swinging: false, released: 0, gate: [], passes: 0, blocked: null, lastBlock: null, trace: [], watch: { on: false, t0: 0, acc: 0 } };
const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'bob', label: 'Bob', fmt: (v) => ITEMS[v] ? ITEMS[v].name : v },
  { key: 'place', label: 'Where', fmt: (v) => ITEMS[v] ? ITEMS[v].name : v },
  { key: 'L', label: 'L (m)', fmt: (v) => v.toFixed(3) },
  { key: 'th0', label: 'θ₀ (°)', fmt: (v) => v.toFixed(0) },
  { key: 'how', label: 'Timed with' },
  { key: 'T', label: 'Period T (s)', fmt: (v) => v.toFixed(4) },
], { caption: 'Your measured periods', onChange: () => bench._graphs && bench._graphs() });
let nRow = 0;

function release() {
  S.s = [S.th0 * Math.PI / 180, 0]; S.t = 0; S.swinging = true; S.released = performance.now();
  S.gate = []; S.passes = 0; S.blocked = null; S.lastBlock = null; S.trace = [];
}

// ---------------------------------------------------------------- the swing tab
function tabSwing(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Pull the bob aside, let go and time it. <b>L</b> is measured from the pivot to the <b>centre</b> of the bob. Change the bob, the timing tool, the planet or the air above.' }));
  const box = canvasBox('', '4 / 3', 'The pendulum seen from the side');
  const nowRo = readout('Angle now'), perRo = readout('Last period'), spdRo = readout('Speed at the bottom');
  const Ls = slider({ label: 'String length L (pivot to centre of bob)', unit: 'm', min: 0.1, max: 2, step: 0.005, value: S.L, digits: 4, onInput: (v) => { S.L = v; if (!S.swinging) draw(); } });
  const As = slider({ label: 'Release angle θ₀', unit: '°', min: 1, max: 80, step: 1, value: S.th0, digits: 3, onInput: (v) => { S.th0 = v; if (!S.swinging) { S.s = [v * Math.PI / 180, 0]; draw(); } } });
  const relBtn = button('Let go', () => { release(); watchReset(); }, 'primary');
  const stopBtn = button('Catch it', () => { S.swinging = false; S.s = [S.th0 * Math.PI / 180, 0]; draw(); });

  // stopwatch
  const wDisp = el('div', { class: 'watch', 'aria-live': 'off', text: '0.00 s' });
  const wBtn = button('Start', () => watchToggle(), 'go', { class: 'vbtn vbtn-go watch-btn' });
  const wReset = button('Reset', () => watchReset(), 'quiet');
  const nSw = slider({ label: 'Swings you timed', unit: '', min: 1, max: 30, step: 1, value: 10, digits: 2 });
  const wRec = button('Record', () => {
    const t = watchTime(); if (t <= 0) return;
    addRow(t / nSw.get(), 'stopwatch');
  }, 'secondary');
  const watchGrp = group('Stopwatch', wDisp, el('div', { class: 'vp-row' }, wBtn, wReset), nSw, wRec,
    el('p', { class: 'ctl-hint', text: 'Start as the bob passes the middle, count the swings there and back, stop on the last one.' }));
  // photogate
  const gList = el('ol', { class: 'gatelist' });
  const gMean = readout('Mean of the last five');
  const gRec = button('Record the mean', () => { const m = gateMean(); if (m) addRow(m.mean, 'photogate'); }, 'secondary');
  const gateGrp = group('Photogate', gMean, gList, gRec);
  // camera
  const camBox = canvasBox('', '16 / 9', 'Angle against time from the camera');
  const camPlot = new Plot(camBox.canvas, { xlabel: 'Time (s)', ylabel: 'Angle (°)' });
  const cRec = button('Record the period from the film', () => { const T = filmPeriod(); if (T) addRow(T, 'camera'); }, 'secondary');
  const camGrp = group('High-speed camera', camBox, cRec);

  const side = el('div', { class: 'vp-side' }, group('Set the swing', Ls, As, el('div', { class: 'vp-row' }, relBtn, stopBtn)), watchGrp, gateGrp, camGrp);
  const main = el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, nowRo, perRo, spdRo));
  pane.append(el('div', { class: 'vp-cols' }, side, main), table.el);

  function addRow(T, how) {
    table.add({ n: ++nRow, bob: current(bench, 'bob'), place: current(bench, 'place'), L: S.L, th0: S.th0, how, T });
    rig.note({ bench: 'pendulum', L: S.L, th0: S.th0, T, place: current(bench, 'place'), bob: current(bench, 'bob'), how });
  }
  // stopwatch logic
  function watchTime() { return S.watch.acc + (S.watch.on ? (performance.now() - S.watch.t0) / 1000 : 0); }
  function watchToggle() {
    if (S.watch.on) { S.watch.acc = watchTime(); S.watch.on = false; wBtn.textContent = 'Start'; }
    else { S.watch.t0 = performance.now(); S.watch.on = true; wBtn.textContent = 'Stop'; }
  }
  function watchReset() { S.watch = { on: false, t0: 0, acc: 0 }; wBtn.textContent = 'Start'; wDisp.textContent = '0.00 s'; }
  function gateMean() {
    const P = S.gate.slice(-5); if (!P.length) return null;
    const mean = P.reduce((a, b) => a + b, 0) / P.length;
    const sd = P.length > 1 ? Math.sqrt(P.reduce((a, b) => a + (b - mean) ** 2, 0) / (P.length - 1)) : 0;
    return { mean, sd, n: P.length };
  }
  function filmPeriod() {
    // zero crossings going right in the recorded trace
    const tr = S.trace, ups = [];
    for (let i = 1; i < tr.length; i++) if (tr[i - 1][1] < 0 && tr[i][1] >= 0) { const [t0, a0] = tr[i - 1], [t1, a1] = tr[i]; ups.push(t0 + (t1 - t0) * (-a0) / (a1 - a0)); }
    if (ups.length < 2) return null;
    return (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
  }

  let p = params(S.L), frame = 0;
  function syncEquip() {
    const tm = current(bench, 'timer');
    watchGrp.hidden = tm !== 'stopwatch'; gateGrp.hidden = tm !== 'photogate'; camGrp.hidden = tm !== 'camera';
    spdRo.hidden = tm !== 'photogate';
    p = params(S.L);
    draw();
  }
  syncEquip();
  onRig(bench, () => { syncEquip(); });

  const anim = loop((dt) => {
    p = params(S.L);
    if (S.swinging) {
      let left = dt; const h = 0.0005;
      while (left > 1e-9) {
        const step = Math.min(h, left), prev = S.s[0], tPrev = S.t;
        const xPrev = p.L * Math.sin(prev);
        rk4(p, S.s, step); S.t += step; left -= step;
        const x = p.L * Math.sin(S.s[0]);
        // photogate at the bottom: beam blocked while the bob covers it
        if (Math.abs(xPrev) >= p.r && Math.abs(x) < p.r) S.blocked = tPrev + step * (Math.abs(xPrev) - p.r) / Math.max(1e-12, Math.abs(xPrev) - Math.abs(x));
        if (S.blocked !== null && Math.abs(xPrev) < p.r && Math.abs(x) >= p.r) {
          const tOut = tPrev + step * (p.r - Math.abs(xPrev)) / Math.max(1e-12, Math.abs(x) - Math.abs(xPrev));
          S.lastBlock = tOut - S.blocked; S.blocked = null;
        }
        // a period is counted each time it passes the middle going right
        if (prev < 0 && S.s[0] >= 0) {
          const tc = tPrev + step * (-prev) / (S.s[0] - prev);
          if (S.lastCross !== undefined && S.passes > 0) S.gate.push(tc - S.lastCross);
          S.lastCross = tc; S.passes++;
          if (S.gate.length > 40) S.gate.shift();
        }
      }
      S.trace.push([S.t, S.s[0] * 180 / Math.PI]);
      if (S.trace.length > 2400) S.trace.splice(0, S.trace.length - 2400);
    }
    if (S.watch.on) wDisp.textContent = watchTime().toFixed(2) + ' s';
    draw();
  });

  function draw() {
    drawScene(box.canvas, p, S);
    nowRo.set(`${(S.s[0] * 180 / Math.PI).toFixed(1)}°`);
    const last = S.gate.length ? S.gate[S.gate.length - 1] : null;
    const tm = current(bench, 'timer');
    perRo.set(last && tm !== 'stopwatch' ? `${last.toFixed(4)} s` : tm === 'stopwatch' ? 'use your stopwatch' : '–');
    if (tm === 'photogate') {
      spdRo.set(S.lastBlock ? `${(2 * p.r / S.lastBlock).toFixed(3)} m/s` : '–');
      const m = gateMean();
      gMean.set(m ? `${m.mean.toFixed(4)} s ± ${(m.sd / Math.sqrt(m.n)).toFixed(4)}` : '–');
      if ((frame++ % 10) === 0) gList.replaceChildren(...S.gate.slice(-6).map((v) => el('li', { text: v.toFixed(4) + ' s' })));
    }
    if (tm === 'camera' && (frame++ % 3) === 0) {
      const tr = S.trace, t1 = tr.length ? tr[tr.length - 1][0] : 0, t0 = Math.max(0, t1 - 12);
      const xs = [], ys = [];
      for (const [t, a] of tr) if (t >= t0) { xs.push(t); ys.push(a); }
      camPlot.xlim = [t0, Math.max(t0 + 12, t1)];
      const A = Math.max(5, S.th0 * 1.1); camPlot.ylim = [-A, A];
      camPlot.setSeries([{ x: xs, y: ys, color: COLORS.signal, width: 2 }]).draw();
    }
  }
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

// the side view of the pendulum
function drawScene(c, p, S) {
  const { g, w, h } = fitCanvas(c);
  const place = p.place;
  // backdrop: the lab wall, or the planet the gravity room imitates
  const sky = { 'g-earth': ['#EAF6FC', '#D7EEF9'], 'g-moon': ['#0E1630', '#1E2A52'], 'g-mars': ['#F6C49A', '#E89A6A'], 'g-jupiter': ['#F2DDB8', '#E0B47C'], 'g-x': ['#2A1F5C', '#5B3FA8'] }[place] || ['#EAF6FC', '#D7EEF9'];
  const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, sky[0]); grd.addColorStop(1, sky[1]);
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  if (place === 'g-moon' || place === 'g-x') { g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % w, (i * 53) % (h * 0.8), 1.5, 1.5); }
  if (place === 'g-jupiter') { g.fillStyle = 'rgba(201,138,78,0.25)'; for (let i = 0; i < 5; i++) g.fillRect(0, h * (0.15 + i * 0.17), w, h * 0.05); }
  if (place === 'g-x') { g.fillStyle = 'rgba(255,143,171,0.35)'; g.beginPath(); g.arc(w * 0.85, h * 0.2, h * 0.09, 0, 7); g.fill(); }
  const scale = (h * 0.8) / 2.1, px = w / 2, py = h * 0.09;
  // floor
  g.fillStyle = place === 'g-earth' ? '#E9B77E' : 'rgba(27,36,64,0.35)'; g.fillRect(0, h * 0.94, w, h * 0.06);
  // ruler along the side, metres
  g.strokeStyle = 'rgba(18,36,58,0.45)'; g.fillStyle = place === 'g-earth' ? '#12243A' : '#FFFDF6'; g.lineWidth = 1;
  g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let m = 0; m <= 2.0001; m += 0.1) {
    const y = py + m * scale; const big = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
    g.beginPath(); g.moveTo(26, y); g.lineTo(big ? 40 : 33, y); g.stroke();
    if (big) g.fillText(m.toFixed(1), 22, y);
  }
  g.textAlign = 'left'; g.fillText('m', 6, py - 12);
  // support
  g.fillStyle = '#6A86A8'; g.fillRect(px - 70, py - 10, 140, 10);
  g.fillStyle = '#4F6A8F'; g.fillRect(px - 6, py - 4, 12, 8);
  // vacuum jar
  if (p.vac) {
    g.fillStyle = 'rgba(191,239,255,0.25)'; g.strokeStyle = 'rgba(0,115,158,0.6)'; g.lineWidth = 2;
    const jw = Math.min(w * 0.9, (p.L * Math.sin(Math.max(0.3, S.th0 * Math.PI / 180)) + p.r) * scale * 2.4 + 60), jh = (p.L + p.r) * scale + 40;
    g.beginPath(); g.roundRect ? g.roundRect(px - jw / 2, py - 20, jw, jh, [jw / 2, jw / 2, 8, 8]) : g.rect(px - jw / 2, py - 20, jw, jh); g.fill(); g.stroke();
    g.fillStyle = '#12243A'; g.font = '600 12px "Plex", system-ui, sans-serif'; g.fillText('vacuum', px + jw / 2 - 64, py + jh - 34);
  }
  // protractor
  g.strokeStyle = 'rgba(0,115,158,0.5)'; g.lineWidth = 1;
  g.beginPath(); g.arc(px, py, 46, Math.PI / 2 - 1.4, Math.PI / 2 + 1.4); g.stroke();
  for (let a = -80; a <= 80; a += 10) {
    const an = a * Math.PI / 180, r0 = a % 30 === 0 ? 38 : 42;
    g.beginPath(); g.moveTo(px + r0 * Math.sin(an), py + r0 * Math.cos(an)); g.lineTo(px + 46 * Math.sin(an), py + 46 * Math.cos(an)); g.stroke();
  }
  // release angle mark
  const a0 = S.th0 * Math.PI / 180;
  g.setLineDash([4, 4]); g.strokeStyle = 'rgba(224,69,123,0.6)';
  g.beginPath(); g.moveTo(px, py); g.lineTo(px + p.L * scale * Math.sin(a0), py + p.L * scale * Math.cos(a0)); g.stroke(); g.setLineDash([]);
  // photogate at the bottom
  const tm = current(bench, 'timer');
  const by = py + p.L * scale;
  if (tm === 'photogate') {
    const blocked = Math.abs(p.L * Math.sin(S.s[0])) < p.r;
    g.fillStyle = '#2E4A7D'; g.fillRect(px - 5, by + p.r * scale + 6, 10, 26);
    g.fillRect(px - 5, by - p.r * scale - 30, 10, 22);
    g.strokeStyle = blocked ? '#E5534B' : 'rgba(229,83,75,0.35)'; g.lineWidth = 2; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(px, by - p.r * scale - 8); g.lineTo(px, by + p.r * scale + 6); g.stroke(); g.setLineDash([]);
    g.fillStyle = blocked ? '#E5534B' : '#4CB782'; g.beginPath(); g.arc(px, by + p.r * scale + 14, 3, 0, 7); g.fill();
  }
  if (tm === 'camera') { g.fillStyle = '#E5534B'; g.beginPath(); g.arc(w - 22, 20, 6, 0, 7); g.fill(); g.fillStyle = place === 'g-earth' ? '#12243A' : '#FFFDF6'; g.font = '600 12px "Plex", system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('REC 1000 fps', w - 34, 20); g.textAlign = 'left'; }
  // string and bob
  const th = S.s[0];
  const bx = px + p.L * scale * Math.sin(th), byy = py + p.L * scale * Math.cos(th);
  g.strokeStyle = '#12243A'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, py); g.lineTo(bx, byy); g.stroke();
  const item = ITEMS[p.bob]; const col = item.icon[1] || '#9DB8D3', col2 = item.icon[2] || '#6A86A8';
  const rr = Math.max(5, p.r * scale);
  const rg = g.createRadialGradient(bx - rr * 0.35, byy - rr * 0.35, rr * 0.2, bx, byy, rr);
  rg.addColorStop(0, '#FFFFFF'); rg.addColorStop(0.35, col); rg.addColorStop(1, col2);
  g.fillStyle = rg; g.beginPath(); g.arc(bx, byy, rr, 0, 7); g.fill();
  g.strokeStyle = '#1B2440'; g.lineWidth = 1.2; g.stroke();
  // label of g
  g.fillStyle = place === 'g-earth' || place === 'g-mars' || place === 'g-jupiter' ? '#12243A' : '#FFFDF6';
  g.font = '600 13px "Plex", system-ui, sans-serif'; g.textAlign = 'left';
  const gtxt = place === 'g-x' ? 'Planet X: g = ?' : `g = ${p.g.toFixed(2)} m/s²`;
  g.fillText(gtxt, 50, h - 12 - h * 0.06);
}

// ---------------------------------------------------------------- graphs from your data
function tabGraphs(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Your recorded periods, plotted. For a small swing <b>T² = (4π²/g) L</b>, so T² against L is a straight line through the origin, and its slope gives g. Large swings take longer: the exact period needs an elliptic integral.' }));
  let mode = 'TL';
  const seg = segmented({ label: 'Plot', options: [{ value: 'TL', label: 'T² against L' }, { value: 'TA', label: 'T against the release angle' }], value: mode, onChange: (v) => { mode = v; draw(); } });
  const box = canvasBox('', '16 / 10', 'Plot of your measurements');
  const plot = new Plot(box.canvas, { xlabel: 'L (m)', ylabel: 'T² (s²)' });
  const gRo = readout('g from the slope'), nRo = readout('Points used');
  const hint = note('Record a few periods at different lengths (keep the swing small), and they will show up here.');
  pane.append(el('div', { class: 'vp-main' }, seg, box, el('div', { class: 'ros' }, gRo, nRo), hint));
  function draw() {
    const place = current(bench, 'place');
    const rows = table.rows.filter((r) => r.place === place);
    if (mode === 'TL') {
      const x = rows.map((r) => r.L), y = rows.map((r) => r.T * r.T);
      const f = x.length >= 2 ? fitProp(x, y) : null;
      const series = [{ x, y, points: true, r: 4.5, color: COLORS.signal, label: 'your data' }];
      if (f) series.push({ x: [0, 2.05], y: [0, 2.05 * f.a], color: COLORS.pink, width: 2, dash: [6, 4], label: 'best line through 0' });
      plot.o.xlabel = 'L (m)'; plot.o.ylabel = 'T² (s²)'; plot.xlim = [0, 2.05]; plot.ylim = null;
      plot.setSeries(series).setTexts([]).draw();
      if (f) { const gEst = 4 * Math.PI * Math.PI / f.a, dg = gEst * f.sa / f.a; gRo.set(`${gEst.toFixed(3)} ± ${dg.toFixed(3)} m/s²`); } else gRo.set('–');
      nRo.set(String(x.length));
    } else {
      const x = rows.map((r) => r.th0), y = rows.map((r) => r.T);
      const p = params(rows.length ? rows[rows.length - 1].L : S.L);
      const ax = [], ay = [], sx = [], sy = [];
      for (let a = 1; a <= 80; a += 1) { ax.push(a); ay.push(exactPeriod(p, a * Math.PI / 180)); sx.push(a); sy.push(exactPeriod(p, 1e-4)); }
      plot.o.xlabel = 'Release angle θ₀ (°)'; plot.o.ylabel = 'Period (s)'; plot.xlim = [0, 82]; plot.ylim = null;
      plot.setSeries([{ x: ax, y: ay, color: COLORS.violet, width: 2.2, label: `exact, L = ${p.L.toFixed(2)} m` }, { x: sx, y: sy, color: COLORS.gold, dash: [5, 4], width: 1.5, label: 'small-angle formula' }, { x, y, points: true, r: 4.5, color: COLORS.signal, label: 'your data' }]).draw();
      gRo.set('–'); nRo.set(String(x.length));
    }
  }
  bench._graphs = draw;
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- decay, in fast-forward
function tabDecay(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Leave the pendulum swinging for a few minutes and watch the swing shrink. Air drag grows with the square of the speed, so it bites hardest on light, large bobs. Run it once for each bob, or in the vacuum jar, and compare.' }));
  const box = canvasBox('', '16 / 10', 'Size of the swing against time');
  const plot = new Plot(box.canvas, { xlabel: 'Time (s)', ylabel: 'Swing amplitude (°)' });
  const runs = [];
  const qRo = readout('Quality factor Q (last run)');
  const go = button('Swing for 3 minutes (fast-forward)', () => run(), 'primary');
  const clr = button('Clear', () => { runs.length = 0; draw(); }, 'quiet');
  const need = note('Filming needs the <b>high-speed camera</b> in the Timing slot. You will find one in the cabinet on this floor.');
  pane.append(el('div', { class: 'vp-main' }, el('div', { class: 'vp-row' }, go, clr), box, el('div', { class: 'ros' }, qRo), need));
  function sync() { const ok = current(bench, 'timer') === 'camera'; go.disabled = !ok; need.hidden = ok; }
  onRig(bench, sync); sync();
  function run() {
    const p = params(S.L), s = [S.th0 * Math.PI / 180, 0];
    const h = 0.002, T = 180; let t = 0, prevOm = 0; const xs = [0], ys = [S.th0];
    while (t < T) {
      rk4(p, s, h); t += h;
      if (prevOm > 0 && s[1] <= 0) { xs.push(t); ys.push(s[0] * 180 / Math.PI); }
      prevOm = s[1];
    }
    const name = `${ITEMS[p.bob].name}${p.vac ? ' (vacuum)' : ''}, L ${p.L.toFixed(2)} m`;
    runs.push({ x: xs, y: ys, label: name });
    if (runs.length > 5) runs.shift();
    // Q from the energy loss over the first ten swings
    const k = Math.min(10, ys.length - 1);
    if (k > 1 && ys[k] > 0) { const loss = 1 - (ys[k] / ys[0]) ** 2; const per = loss / k; qRo.set(per > 0 ? fmtNum(2 * Math.PI / per, 3) : '> 10⁵'); }
    rig.note({ bench: 'pendulum', decay: true, bob: p.bob, vac: p.vac });
    draw();
  }
  function draw() {
    plot.setSeries(runs.map((r, i) => ({ x: r.x, y: r.y, color: [COLORS.signal, COLORS.pink, COLORS.violet, COLORS.gold, COLORS.green][i % 5], width: 2, label: r.label }))).draw();
  }
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
const BOB_LOOK = {
  'ball-steel': { mat: 'chrome', pattern: null, name: 'steel ball' },
  'ball-wood': { mat: 'wood', pattern: K.PATTERN.wood, name: 'wooden ball' },
  'bob-brass': { mat: 'brass', pattern: null, name: 'brass bob' },
  'ball-pingpong': { mat: 'white', pattern: K.PATTERN.pingpong, name: 'ping-pong ball' },
};
const SKY = { 'g-earth': 'earth', 'g-moon': 'moon', 'g-mars': 'mars', 'g-jupiter': 'jupiter', 'g-x': 'x' };
const PLANET = { 'g-earth': 'Earth', 'g-moon': 'Moon', 'g-mars': 'Mars', 'g-jupiter': 'Jupiter', 'g-x': 'Planet X' };
const MAXA = 85 * Math.PI / 180;

function swingOf(L, bob, place, vac, label = '') {
  return { L, bob, place, vac, label, p: paramsFor(L, bob, place, vac), s: [0, 0], free: false, t: 0, cross: null, periods: [], E0: 0, snaps: [], snapT: 0, vmax: 0, passes: 0 };
}
function energyOf(q) { return { pe: q.p.torqueG * (1 - Math.cos(q.s[0])), ke: 0.5 * q.p.I * q.s[1] * q.s[1] }; }
function letGo(q, th, om = 0) {
  q.s = [th, om]; q.free = true; q.t = 0; q.cross = null; q.periods = []; q.snaps = []; q.vmax = 0; q.passes = 0;
  const e = energyOf(q); q.E0 = e.pe + e.ke;
}
function advance(q, dt, onCross) {
  if (!q.free || dt <= 0) return;
  let left = dt;
  while (left > 1e-12) {
    const h = Math.min(0.0005, left), prev = q.s[0], tPrev = q.t;
    rk4(q.p, q.s, h); q.t += h; left -= h;
    if (prev < 0 && q.s[0] >= 0) {
      const tc = tPrev + h * (-prev) / (q.s[0] - prev);
      if (q.cross !== null) q.periods.push(tc - q.cross);
      q.cross = tc; q.passes++; if (onCross) onCross(q);
    } else if (prev > 0 && q.s[0] <= 0) { q.passes++; if (onCross) onCross(q); }
  }
  q.snapT += dt;
  if (q.snapT >= 1 / 14) { q.snapT = 0; q.snaps.push(q.s[0]); if (q.snaps.length > 14) q.snaps.shift(); }
  const v = Math.abs(q.s[1]) * q.L; if (v > q.vmax) q.vmax = v;
}
const meanP = (q, n = 3) => { const a = q.periods.slice(-n); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };

function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'hoo', label: 'A pendulum hanging from a beam. Drag the bob to one side and let go.',
    hello: 'Grab the bob, pull it to one side and **let go**. Then try a different bob, a longer string, or another planet from the parts above.',
    onReset: () => { exitCompare(); hold(0); st.setSpeed(1); st.setPaused(false); },
    keys: {
      arrow(dx, dy) {
        if (cmp) return;
        if (dx) { hold(Math.max(-MAXA, Math.min(MAXA, (one.free ? one.s[0] : one.s[0]) + dx * 2 * Math.PI / 180))); }
        if (dy) setL(one.L - dy * 0.05);
      },
      action() { if (cmp) return; if (one.free) hold(one.s[0]); else release(); },
    },
  });
  st.tool('forces', 'Forces', { icon: K.COL.gravity }).tool('speed', 'Speed', { icon: K.COL.vel }).tool('snaps', 'Snapshots', { icon: K.COL.net })
    .tool('energy', 'Energy', { icon: K.COL.ke }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('T', 'Time for one swing').readout('L', 'String length').readout('v', 'Top speed').readout('g', 'Gravity here');
  const graph = st.liveGraph({ series: [{ id: 'a', label: 'angle (°)', color: K.COL.net }], window: 8, ylabel: 'angle (°)', sym: true });

  // your pendulum, and a second one for side-by-side comparisons
  let one = swingOf(1.0, current(bench, 'bob'), current(bench, 'place'), current(bench, 'air') === 'belljar');
  let cmp = null;          // { A, B, s } while comparing
  let watch = { on: false, t: 0 };
  let decomp = false, firstGrab = true, noted = false, pending = null;
  let G = { w: 600, h: 400, fy: 340, s: 200, px: 300, py: 50 };

  const lenSl = el('input', { type: 'range', min: 0.2, max: 1.6, step: 0.01, value: 1, 'aria-label': 'String length in metres' });
  lenSl.addEventListener('input', () => setL(+lenSl.value));
  const goBtn = el('button', { type: 'button', class: 'stg-act', text: 'Let go' });
  const stopBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Stop it' });
  goBtn.addEventListener('click', () => { if (!one.free && Math.abs(one.s[0]) < 0.02) hold(20 * Math.PI / 180); release(); });
  stopBtn.addEventListener('click', () => hold(0));
  st.controls(el('label', { class: 'stg-range' }, el('span', { text: 'String length' }), lenSl), el('div', { class: 'stg-row' }, goBtn, stopBtn));

  function sync() {
    const bob = current(bench, 'bob'), place = current(bench, 'place'), vac = current(bench, 'air') === 'belljar';
    one.bob = bob; one.place = place; one.vac = vac;
    one.p = paramsFor(one.L, bob, place, vac);
    const e = energyOf(one); if (one.free) one.E0 = Math.max(one.E0, e.pe + e.ke);
    if (current(bench, 'timer') === 'camera') st.setTool('graph', true);
  }
  onRig(bench, sync);
  function setL(L) {
    L = Math.max(0.2, Math.min(1.6, L));
    one.L = L; one.p = paramsFor(L, one.bob, one.place, one.vac);
    lenSl.value = L;
    if (one.free) { one.free = false; one.s[1] = 0; }
  }
  function hold(th) { one.free = false; one.s = [th, 0]; one.periods = []; one.cross = null; one.snaps = []; noted = false; }
  function release(om = 0) {
    letGo(one, one.s[0], om); noted = false; graph.clear();
    firstGrab = false; st.hint(null);
    if (Math.abs(one.s[0]) > 0.05 || Math.abs(om) > 0.1) sound.play('swing');
  }
  function onCross(q) {
    if (q !== one && !cmp) return;
    const tm = current(bench, 'timer');
    if (!cmp && tm === 'photogate') sound.play('beep'); else sound.play('tick', { vol: cmp ? 0.5 : 0.7, pitch: q === (cmp && cmp.B) ? 1.25 : 1 });
  }
  // comparisons for the walkthrough and the challenges
  function compare(a, b, scale) {
    cmp = { A: swingOf(a.L, a.bob, a.place, a.vac || false, a.label), B: swingOf(b.L, b.bob, b.place, b.vac || false, b.label), s: scale || null };
    cmp.A.s = [a.th, 0]; cmp.B.s = [b.th, 0];
    one.free = false;
    graph.clear();
  }
  function goCompare() { letGo(cmp.A, cmp.A.s[0]); letGo(cmp.B, cmp.B.s[0]); sound.play('swing'); }
  function exitCompare() { cmp = null; }

  // ---------- physics
  st.onStep((dt) => {
    if (cmp) { advance(cmp.A, dt, onCross); advance(cmp.B, dt, onCross); }
    else advance(one, dt, onCross);
    if (watch.on) watch.t += dt;
    const q = cmp ? cmp.A : one;
    if (q.free && dt > 0) graph.push(q.t, { a: q.s[0] * 180 / Math.PI });
    if (!cmp && one.free && one.periods.length >= 3 && !noted) {
      noted = true;
      rig.note({ bench: 'pendulum', L: one.L, th0: Math.abs(one.E0 > 0 ? Math.acos(1 - one.E0 / one.p.torqueG) * 180 / Math.PI : 0), T: meanP(one), place: one.place, bob: one.bob, how: 'play' });
    }
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- layout
  st.onResize((w, h, narrow) => {
    const fy = Math.round(h * (narrow ? 0.88 : 0.86));
    const py = 54;
    const s = Math.min((fy - py - 38) / 1.62, (w * 0.5 - 26) / 1.66);
    G = { w, h, fy, s, px: Math.round(w / 2), py, narrow };
  });

  // ---------- drawing
  const bobR = (q, s) => Math.max(14, Math.min(28, q.p.r * s * 2.8));
  function pos(q, x0, y0, s) { const L = q.L * s, th = q.s[0]; return [x0 + L * Math.sin(th), y0 + L * Math.cos(th)]; }

  function drawBackdrop(g, w, h) {
    const place = cmp ? 'g-earth' : one.place;
    const { fy } = G;
    K.room(g, w, h, K.THEME[1], { floorH: 1 - fy / h });
    // window to the gravity room's planet, with its sign
    const ww = Math.round(Math.min(200, w * (G.narrow ? 0.3 : 0.22))), wh = Math.round(ww * 0.64);
    const wx = w - ww - 22, wy = 62;
    // sunlight falling from the window across the wall
    if (!cmp && (place === 'g-earth' || place === 'g-mars')) {
      g.save(); g.globalAlpha = 0.16; g.fillStyle = '#FFF6C9';
      g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx + ww, wy + wh); g.lineTo(wx + ww - 120, fy); g.lineTo(wx - 190, fy); g.closePath(); g.fill(); g.restore();
    }
    if (!cmp) K.scenery(g, wx, wy, ww, wh, SKY[place] || 'earth', 0);
    // a plant in the corner and a poster of Prof. Bueong's notes
    drawPlant(g, w - 40, fy + 6, G.narrow ? 0.75 : 1);
    if (!G.narrow && h > 440) drawNotes(g, 62, 96);
    const gv = one.p.g;
    if (!cmp) K.tag(g, place === 'g-x' ? 'Planet X · g = ?' : `${PLANET[place]} · g = ${gv.toFixed(2)} m/s²`, wx + ww / 2, wy + wh + 18, { size: G.narrow ? 11 : 12.5, bg: '#FFFDF6' });
    // ceiling beam
    K.box(g, -8, 0, w + 16, 24, K.MAT.steel, { r: 0, lw: 2 });
    g.fillStyle = K.MAT.steel[2];
    for (let x = 30; x < w; x += 80) { g.beginPath(); g.arc(x, 12, 2.5, 0, Math.PI * 2); g.fill(); }
  }

  function drawPlant(g, x, y, k) {
    K.shadow(g, x, y + 2, 26 * k, 7 * k, 0.25);
    const leaf = (a, l, c) => { g.save(); g.translate(x, y - 34 * k); g.rotate(a); g.beginPath(); g.ellipse(0, -l * k / 2, 9 * k, l * k / 2, 0, 0, Math.PI * 2); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore(); };
    leaf(-0.9, 46, '#3A9A55'); leaf(0.9, 44, '#3A9A55'); leaf(-0.35, 58, '#62C46E'); leaf(0.4, 54, '#62C46E'); leaf(0, 66, '#4CB782');
    K.box(g, x - 20 * k, y - 36 * k, 40 * k, 38 * k, K.MAT.copper, { r: 6 });
    g.fillStyle = K.MAT.copper[1]; g.fillRect(x - 20 * k + 2, y - 36 * k + 3, 40 * k - 4, 5 * k);
  }
  function drawNotes(g, x, y) {
    g.save(); g.translate(x, y); g.rotate(-0.04);
    g.scale(0.88, 0.88);
    K.box(g, 0, 0, 96, 120, K.MAT.cream, { r: 3, bands: false });
    g.fillStyle = '#E5534B'; g.beginPath(); g.arc(48, 4, 4, 0, Math.PI * 2); g.fill();
    K.text(g, 'one swing:', 10, 24, { size: 11, weight: 600, font: K.PIXF });
    g.strokeStyle = '#3D6FB6'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(48, 34); g.lineTo(30, 82); g.stroke();
    g.beginPath(); g.moveTo(48, 34); g.lineTo(66, 82); g.stroke();
    g.setLineDash([3, 3]); g.beginPath(); g.arc(48, 34, 50, Math.PI / 2 - 0.4, Math.PI / 2 + 0.4); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#E8C25A'; g.beginPath(); g.arc(30, 82, 5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(66, 82, 5, 0, Math.PI * 2); g.fill();
    K.text(g, 'there & back', 48, 104, { size: 10.5, weight: 600, align: 'center', color: '#00739E' });
    g.restore();
  }

  function drawRuler(g) {
    const { py, s, fy } = G;
    const x = 12;
    K.rulerV(g, x, py, py + 1.6 * s, (v) => py + v * s, 0, 1.6, 0.1, { major: 5, fmt: (v) => v.toFixed(1) });
    K.text(g, 'm', x + 4, py - 9, { size: 11, weight: 600 });
    void fy;
  }

  function drawProtractor(g, x0, y0, R) {
    g.save();
    g.beginPath(); g.moveTo(x0 - R, y0); g.arc(x0, y0, R, Math.PI, 0, true); g.closePath();
    g.fillStyle = 'rgba(168,236,255,0.28)'; g.fill();
    g.strokeStyle = 'rgba(0,115,158,0.55)'; g.lineWidth = 1.5; g.stroke();
    g.lineWidth = 1;
    for (let a = -80; a <= 80; a += 5) {
      const an = a * Math.PI / 180, big = a % 30 === 0, mid = a % 10 === 0;
      const r0 = R - (big ? 12 : mid ? 8 : 4);
      g.beginPath(); g.moveTo(x0 + r0 * Math.sin(an), y0 + r0 * Math.cos(an)); g.lineTo(x0 + R * Math.sin(an), y0 + R * Math.cos(an)); g.stroke();
      if (big && a !== 0 && R > 70) K.text(g, Math.abs(a) + '°', x0 + (R - 22) * Math.sin(an), y0 + (R - 22) * Math.cos(an) + 4, { size: 10, weight: 600, color: '#00739E', align: 'center' });
    }
    g.restore();
  }

  function drawClamp(g, x0, y0, hover) {
    K.rod(g, x0, 18, x0, y0 - 6, 8, K.MAT.steel, { lw: 2 });
    K.box(g, x0 - 13, y0 - 12, 26, 14, K.MAT.steel, { r: 3 });
    // the length knob
    K.ball(g, x0 + 19, y0 - 5, 6.5, hover ? 'yellow' : 'brass', { lw: 2 });
    if (hover) K.tag(g, '↕ drag to change the length', x0 + 30, y0 - 5, { align: 'left', size: 11.5 });
  }

  function drawBob(g, q, x0, y0, s, { ghost = false, hover = false } = {}) {
    const [bx, by] = pos(q, x0, y0, s), rv = bobR(q, s);
    const look = BOB_LOOK[q.bob] || BOB_LOOK['ball-steel'];
    // shadow on the floor, smaller and fainter the higher the bob is
    const hgt = Math.max(0, G.fy - by);
    K.shadow(g, bx, G.fy + 8, rv * (1.3 - Math.min(0.6, hgt / 900)), rv * 0.32, 0.22 * (1 - Math.min(0.7, hgt / 700)));
    K.lineSeg(g, x0, y0, bx, by, K.LINE, 2.2);
    if (hover) K.glow(g, bx, by, rv * 2.2, '#00D4FF', 0.35);
    // the little eyelet the string is tied to
    const ex = bx - Math.sin(q.s[0]) * (rv + 2), ey = by - Math.cos(q.s[0]) * (rv + 2);
    g.beginPath(); g.arc(ex, ey, 3.2, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    K.ball(g, bx, by, rv, look.mat, { pattern: look.pattern });
    if (!ghost && hover && !q.free) K.tag(g, 'drag me', bx, by - rv - 16, { size: 11.5 });
    return [bx, by, rv];
  }

  function drawSnaps(g, q, x0, y0, s) {
    const n = q.snaps.length, rv = bobR(q, s), look = BOB_LOOK[q.bob] || BOB_LOOK['ball-steel'];
    q.snaps.forEach((th, i) => {
      const L = q.L * s, bx = x0 + L * Math.sin(th), by = y0 + L * Math.cos(th);
      g.save(); g.globalAlpha = 0.12 + 0.4 * (i / n);
      K.ball(g, bx, by, rv, look.mat, { lw: 1.5 });
      g.restore();
    });
  }

  function drawForces(g, q, bx, by, x0, y0) {
    const th = q.s[0], F = Math.max(64, Math.min(96, G.s * 0.42));
    const geff = q.p.torqueG / (q.p.m * q.L) || q.p.g;
    const T = Math.cos(th) + (q.L * q.s[1] * q.s[1]) / geff;
    const ux = (x0 - bx), uy = (y0 - by), Lp = Math.hypot(ux, uy) || 1;
    const tx = Math.cos(th), ty = -Math.sin(th);       // direction of increasing angle
    // weight
    K.arrow(g, bx, by, bx, by + F, K.COL.gravity, { label: 'gravity' });
    // pull of the string
    K.arrow(g, bx, by, bx + ux / Lp * F * T, by + uy / Lp * F * T, K.COL.string, { label: 'string' });
    // the part of gravity along the path: back towards the middle
    const back = -Math.sin(th) * F;
    if (Math.abs(back) > 3) K.arrow(g, bx, by, bx + tx * back, by + ty * back, K.COL.net, { label: Math.abs(back) > 22 ? 'back to the middle' : null, lw: 5, labelAt: 'side', side: th > 0 ? -1 : 1 });
    if (decomp) {
      // gravity split into along-the-string and along-the-path parts
      const along = Math.cos(th) * F;
      const ax = bx - ux / Lp * along, ay = by - uy / Lp * along;
      K.arrow(g, bx, by, ax, ay, K.hexA(K.COL.gravity, 0.75), { dash: [6, 5], lw: 3.5, label: 'cancelled by the string', size: 11, labelAt: 'side', side: th > 0 ? 1 : -1 });
      g.save(); g.setLineDash([4, 4]); g.strokeStyle = K.hexA(K.LINE, 0.5); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by + F); g.lineTo(bx + tx * back, by + ty * back); g.stroke(); g.restore();
    }
    // air drag, opposite to the motion
    const v = q.s[1] * q.L, kd = q.p.kd, wgt = q.p.m * q.p.g;
    const fd = kd * v * Math.abs(v) / wgt * F;
    if (Math.abs(fd) > 4) K.arrow(g, bx, by, bx - tx * fd, by - ty * fd, K.COL.drag, { label: 'air', lw: 3.5, size: 11 });
  }

  function drawSpeed(g, q, bx, by) {
    const v = q.s[1] * q.L;
    const k = Math.min(150, Math.abs(v) * 55) * Math.sign(v);
    const tx = Math.cos(q.s[0]), ty = -Math.sin(q.s[0]);
    if (Math.abs(k) > 3) K.arrow(g, bx, by, bx + tx * k, by + ty * k, K.COL.vel, { label: `${Math.abs(v).toFixed(2)} m/s`, lw: 4.5 });
  }

  function drawEnergy(g, q, w, h) {
    const e = energyOf(q), E0 = Math.max(q.E0, e.pe + e.ke, 1e-12), heat = Math.max(0, E0 - e.pe - e.ke);
    const bw = G.narrow ? 132 : 158, bh = G.narrow ? 150 : 176;
    const x = G.narrow ? 46 : w - bw - 22, y = G.narrow ? G.fy - bh - 10 : 62 + Math.round(Math.min(200, w * 0.22) * 0.64) + 40;
    K.bars(g, x, y, bw, bh, [
      { label: 'height', value: e.pe, color: K.COL.pe },
      { label: 'motion', value: e.ke, color: K.COL.ke },
      { label: 'air', value: heat, color: K.COL.heat },
    ], E0, { title: 'Energy' });
  }

  function drawGate(g, x0, yb, rv, blocked, last) {
    const gap = rv + 9;
    g.save();
    K.rod(g, x0 + gap + 26, yb + 10, x0 + gap + 26, G.fy + 2, 7, K.MAT.steel);
    K.box(g, x0 - gap - 12, yb + gap - 2, 2 * gap + 24, 12, K.MAT.navy, { r: 3 });
    K.box(g, x0 - gap - 12, yb - 22, 12, gap + 22, K.MAT.navy, { r: 3 });
    K.box(g, x0 + gap, yb - 22, 12, gap + 22, K.MAT.navy, { r: 3 });
    K.lineSeg(g, x0 - gap, yb, x0 + gap, yb, blocked ? 'rgba(229,83,75,0.25)' : 'rgba(229,83,75,0.9)', 2.5, [5, 4]);
    K.glow(g, x0 - gap - 6, yb - 16, 9, blocked ? '#E5534B' : '#22B07A', 0.9);
    g.fillStyle = blocked ? '#E5534B' : '#22B07A'; g.beginPath(); g.arc(x0 - gap - 6, yb - 16, 3, 0, Math.PI * 2); g.fill();
    g.restore();
    K.lcd(g, x0 + gap + 2, G.fy - 46, 96, 34, last ? last.toFixed(4) + ' s' : '----', { label: 'photogate', size: 15 });
  }

  function drawCamera(g, w) {
    const x = w - 92, y = G.fy - 70;
    g.save();
    K.lineSeg(g, x + 30, y + 26, x + 6, G.fy + 10, K.LINE, 3); K.lineSeg(g, x + 30, y + 26, x + 54, G.fy + 10, K.LINE, 3); K.lineSeg(g, x + 30, y + 26, x + 30, G.fy + 14, K.LINE, 3);
    K.box(g, x + 4, y - 4, 54, 32, K.MAT.navy, { r: 6 });
    K.box(g, x - 16, y + 2, 22, 20, K.MAT.steel, { r: 4 });
    K.ball(g, x - 16, y + 12, 8, ['#3FC1D9', '#BFEFFF', '#1F6E8C'], { lw: 2 });
    const on = Math.floor(st.t * 2) % 2 === 0;
    g.fillStyle = on ? '#E5534B' : '#7A2A35'; g.beginPath(); g.arc(x + 48, y + 5, 3.5, 0, Math.PI * 2); g.fill();
    if (on) K.glow(g, x + 48, y + 5, 10, '#E5534B', 0.7);
    g.restore();
    K.tag(g, '1000 fps', x + 30, y - 16, { size: 11 });
  }

  function drawJar(g, x0, y0, reach) {
    const half = Math.min(G.w * 0.48, reach + 46), top = y0 - 36, bot = G.fy + 2;
    g.save();
    g.beginPath();
    g.moveTo(x0 - half, bot); g.lineTo(x0 - half, top + half * 0.5);
    g.quadraticCurveTo(x0 - half, top, x0, top); g.quadraticCurveTo(x0 + half, top, x0 + half, top + half * 0.5);
    g.lineTo(x0 + half, bot); g.closePath();
    g.fillStyle = 'rgba(191,239,255,0.20)'; g.fill();
    g.lineWidth = 2.5; g.strokeStyle = 'rgba(0,115,158,0.55)'; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(x0 - half + 16, bot - 40); g.lineTo(x0 - half + 16, top + half * 0.55); g.stroke();
    g.restore();
    K.box(g, x0 - half - 8, bot - 6, 2 * half + 16, 12, K.MAT.steel, { r: 3 });
    K.tag(g, 'vacuum: no air', x0 - half + 70, bot - 22, { size: 11.5, bg: '#EAF6FC' });
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${cmp ? 'cmp' : one.place}|${w}x${h}|${G.s.toFixed(2)}`, (gg, ww, hh) => { drawBackdrop(gg, ww, hh); drawRuler(gg); });
    const { s, px, py } = G;
    if (cmp) {
      const sc = cmp.s || s;
      const xs = [w * 0.3, w * 0.7];
      [cmp.A, cmp.B].forEach((q, i) => {
        const x0 = xs[i];
        drawProtractor(g, x0, py, Math.min(110, q.L * sc * 0.55));
        if (st.on('snaps')) drawSnaps(g, q, x0, py, sc);
        drawClamp(g, x0, py, false);
        const [bx, by, rv] = drawBob(g, q, x0, py, sc);
        if (st.on('forces')) drawForces(g, q, bx, by, x0, py);
        if (st.on('speed')) drawSpeed(g, q, bx, by);
        K.tag(g, q.label, x0, Math.min(G.fy + (h - G.fy) / 2, py + q.L * sc + rv + 26), { size: 12.5, bg: i ? '#FFE9B3' : '#DCD3FF' });
        const T = meanP(q, 2);
        K.tag(g, T ? `${T.toFixed(3)} s per swing` : 'timing…', x0, h - 14, { size: 11.5, bg: '#FFFDF6' });
      });
      return;
    }
    const q = one;
    const rv = bobR(q, s);
    drawProtractor(g, px, py, Math.min(150, q.L * s * 0.62));
    const tm = current(bench, 'timer');
    if (tm === 'photogate') {
      const yb = py + q.L * s, blocked = Math.abs(q.L * s * Math.sin(q.s[0])) < rv;
      drawGate(g, px, yb, rv, blocked && q.free, q.periods.length ? q.periods[q.periods.length - 1] : null);
    }
    if (tm === 'camera') drawCamera(g, w);
    if (st.on('snaps') && q.free) drawSnaps(g, q, px, py, s);
    // the release angle and the swing's path
    if (!q.free || st.isDragging('bob')) {
      const a = q.s[0];
      K.lineSeg(g, px, py, px, py + q.L * s + rv, K.hexA(K.LINE, 0.35), 1.5, [5, 5]);
      if (Math.abs(a) > 0.03) K.angleArc(g, px, py, Math.min(70, q.L * s * 0.35), Math.PI / 2, Math.PI / 2 - a, K.COL.net, `${Math.abs(a * 180 / Math.PI).toFixed(0)}°`);
      g.save(); g.setLineDash([3, 6]); g.strokeStyle = K.hexA(K.COL.net, 0.45); g.lineWidth = 2;
      g.beginPath(); g.arc(px, py, q.L * s, Math.PI / 2 - Math.abs(a), Math.PI / 2 + Math.abs(a)); g.stroke(); g.restore();
    }
    drawClamp(g, px, py, st.hovering('len'));
    const [bx, by] = drawBob(g, q, px, py, s, { hover: st.hovering('bob') });
    if (q.vac) drawJar(g, px, py, q.L * s * Math.sin(Math.min(MAXA, Math.max(0.35, Math.acos(Math.max(-1, 1 - (q.E0 || 0) / q.p.torqueG))))) + rv);
    if (st.on('forces')) drawForces(g, q, bx, by, px, py);
    if (st.on('speed') && q.free) drawSpeed(g, q, bx, by);
    if (st.on('energy')) drawEnergy(g, q, w, h);
    if (tm === 'stopwatch') K.stopwatch(g, G.narrow ? 46 : 74, G.fy - (G.narrow ? 28 : 34), G.narrow ? 26 : 32, watch.t, watch.on, { hover: st.hovering('watch') });
    if (firstGrab && !q.free && !st.isDragging('bob')) {
      // a gentle hand pointing at the bob
      const k = (Math.sin(st.t * 3) + 1) / 2;
      K.arrow(g, bx + 70 + k * 10, by - 30 - k * 6, bx + rv + 10, by - 6, K.COL.normal, { lw: 3.5, head: 11, halo: true });
    }
  });

  st.onOver(() => {
    // numbers in the guide card, a few times a second is plenty
    const q = cmp ? cmp.A : one;
    const T = meanP(q, 2);
    const tm = current(bench, 'timer');
    st.set('T', T ? (tm === 'photogate' ? `${T.toFixed(4)} s` : `${T.toFixed(2)} s`) : (q.free ? 'timing…' : '–'));
    st.set('L', `${q.L.toFixed(2)} m`);
    st.set('v', q.vmax ? `${q.vmax.toFixed(2)} m/s` : '–');
    st.set('g', q.place === 'g-x' ? '? (find out!)' : `${q.p.g.toFixed(2)} m/s²`);
    graph.draw();
  });

  // ---------- hands
  st.handle({
    id: 'bob', cursor: 'grab',
    enabled: () => !cmp,
    hit: (x, y) => { const [bx, by] = pos(one, G.px, G.py, G.s); const d = Math.hypot(x - bx, y - by); return d < bobR(one, G.s) + 18 ? d : false; },
    down: () => { one.free = false; one.s[1] = 0; firstGrab = false; st.hint(null); },
    move: (x, y) => {
      let th = Math.atan2(x - G.px, Math.max(1, y - G.py));
      if (y < G.py) th = Math.sign(x - G.px) * MAXA;
      one.s = [Math.max(-MAXA, Math.min(MAXA, th)), 0];
    },
    up: (x, y, vx, vy) => {
      const th = one.s[0], Lp = one.L * G.s;
      let om = (vx * Math.cos(th) - vy * Math.sin(th)) / Lp;
      // never so fast that it would go over the top of the swing
      const room = 2 * one.p.torqueG / one.p.I * Math.max(0, Math.cos(th) - Math.cos(MAXA));
      const cap = Math.sqrt(room);
      if (Math.abs(om) < 0.4) om = 0;
      om = Math.max(-cap, Math.min(cap, om));
      release(om);
    },
  });
  st.handle({
    id: 'len', cursor: 'ns-resize',
    enabled: () => !cmp,
    hit: (x, y) => { const d = Math.hypot(x - (G.px + 19), y - (G.py - 5)); return d < 15 ? d : false; },
    down: (x, y) => { st._len = { L0: one.L, y0: y }; },
    move: (x, y) => setL(st._len.L0 + (y - st._len.y0) / G.s),
  });
  st.handle({
    id: 'watch', cursor: 'pointer',
    enabled: () => !cmp && current(bench, 'timer') === 'stopwatch',
    hit: (x, y) => { const cx = G.narrow ? 46 : 74, cy = G.fy - (G.narrow ? 28 : 34); const d = Math.hypot(x - cx, y - cy); return d < 40 ? d : false; },
    click: () => {
      if (!watch.on && watch.t > 0) { watch.t = 0; sound.play('click'); return; }
      watch.on = !watch.on; sound.play('beep', { pitch: watch.on ? 1 : 0.8 });
      if (!watch.on) st.hint('Divide the time by the number of swings you counted.');
    },
  });
  st.hint('Grab the bob and pull it to one side', { sticky: true });

  // ---------- why does it swing?
  const setOne = (th, free = false) => { exitCompare(); hold(th); if (free) release(); };
  st.tour({
    title: 'Why does it swing?',
    steps: [
      { say: 'Two things pull on the bob. **Gravity** pulls it straight down (red). The **string** pulls it towards the pivot (blue).', tools: { forces: true, speed: false, snaps: false, energy: false }, enter: () => { setOne(32 * Math.PI / 180); decomp = false; }, mark: () => { const [x, y] = pos(one, G.px, G.py, G.s); return [x, y, bobR(one, G.s) + 10]; } },
      { say: 'Split gravity into two parts. One part pulls **along the string**, and the string cancels it. The other part (purple) points along the path, **back towards the middle**. That part makes it swing.', enter: () => { setOne(32 * Math.PI / 180); decomp = true; }, leave: () => { decomp = false; } },
      { say: 'Now watch the purple arrow while it swings, in slow motion. It is biggest at the ends and **zero at the bottom**: the bob speeds up all the way down, then slows down on the way up.', tools: { forces: true, speed: true }, enter: () => { setOne(32 * Math.PI / 180, true); st.setSpeed(0.25); } },
      { say: 'Energy goes back and forth: **height energy** at the ends, **motion energy** at the bottom. The snapshots are taken at equal times, so they spread out where it is fast and bunch up where it is slow.', tools: { forces: false, speed: false, snaps: true, energy: true }, enter: () => { setOne(40 * Math.PI / 180, true); st.setSpeed(1); } },
      { say: 'Heavy or light? A heavier bob is pulled harder, but it is just as much harder to get moving. The two cancel, so the **brass bob and the ping-pong ball swing in step**.', tools: { snaps: false, energy: false }, enter: () => { compare({ L: 1, bob: 'bob-brass', place: 'g-earth', th: 0.35, label: 'brass bob, 285 g' }, { L: 1, bob: 'ball-pingpong', place: 'g-earth', th: 0.35, label: 'ping-pong ball, 2.7 g' }); goCompare(); } },
      { say: 'What does matter is the **length**. A string a quarter as long swings twice as fast: **T = 2π√(L/g)**. Weaker gravity, as on the Moon, makes it slower.', enter: () => { compare({ L: 1, bob: 'ball-steel', place: 'g-earth', th: 0.3, label: '1 m' }, { L: 0.25, bob: 'ball-steel', place: 'g-earth', th: 0.3, label: '25 cm' }); goCompare(); } },
      { say: 'Air steals a little energy on every swing (the orange bar), so the swing dies away. A light, big ball loses it fastest. In the vacuum jar it keeps going much longer.', tools: { energy: true }, enter: () => { exitCompare(); one.bob = 'ball-pingpong'; one.p = paramsFor(one.L, one.bob, 'g-earth', false); one.place = 'g-earth'; one.vac = false; hold(40 * Math.PI / 180); release(); st.setSpeed(1); } },
    ],
    onEnd: () => { exitCompare(); sync(); hold(0); },
  });

  // ---------- predict, watch, explain
  const until = (cond, then) => { pending = { until: cond, then }; };
  const runCmp = (a, b, needA, needB, fmt) => (stg, finish) => {
    compare(a, b, typeof a.scale === 'function' ? a.scale() : a.scale); stg.setSpeed(1); stg.setPaused(false);
    setTimeout(goCompare, 400);
    until(() => cmp && cmp.A.periods.length >= needA && cmp.B.periods.length >= needB, () => finish(fmt(meanP(cmp.A, needA), meanP(cmp.B, needB))));
  };
  const skipCmp = () => { if (!cmp) return; for (let i = 0; i < 4000 && !(pending && pending.until()); i++) { advance(cmp.A, 0.01); advance(cmp.B, 0.01); } };
  const after = () => { pending = null; exitCompare(); sync(); hold(0); };
  st.setChallenges([
    {
      id: 'mass', title: 'Heavy or light', card: 'pendulum.mass', lock: true, after, skip: skipCmp,
      q: 'Same string, same pull. One has a 285 g brass bob, the other a 2.7 g ping-pong ball. Which swings back and forth faster?',
      choices: ['The brass bob', 'The ping-pong ball', 'About the same'], answer: 2,
      run: runCmp({ L: 1, bob: 'bob-brass', place: 'g-earth', th: 0.35, label: 'brass bob' }, { L: 1, bob: 'ball-pingpong', place: 'g-earth', th: 0.35, label: 'ping-pong ball' }, 3, 3,
        (a, b) => `Brass: ${a.toFixed(3)} s. Ping-pong: ${b.toFixed(3)} s.`),
      explain: 'More mass means more pull, but also more to move, and the two cancel. The ping-pong ball is a hair slower (it drags some air along) and its swing dies sooner, but the beat is the same.',
    },
    {
      id: 'length', title: 'Shorter string', card: 'pendulum.length', lock: true, after, skip: skipCmp,
      q: 'Make the string four times shorter: 1 m becomes 25 cm. The time for one swing becomes…',
      choices: ['4 times shorter', '2 times shorter', 'the same'], answer: 1,
      run: runCmp({ L: 1, bob: 'ball-steel', place: 'g-earth', th: 0.26, label: '1 m' }, { L: 0.25, bob: 'ball-steel', place: 'g-earth', th: 0.26, label: '25 cm' }, 2, 4,
        (a, b) => `1 m: ${a.toFixed(3)} s. 25 cm: ${b.toFixed(3)} s.`),
      explain: 'The swing time grows with the square root of the length, T = 2π√(L/g). Four times shorter means √4 = 2 times faster.',
    },
    {
      id: 'moon', title: 'On the Moon', card: 'pendulum.moon', lock: true, after, skip: skipCmp,
      q: 'The same 50 cm pendulum on Earth and on the Moon, where gravity is about six times weaker. On the Moon it swings…',
      choices: ['faster', 'at the same speed', 'about 2.5 times slower'], answer: 2,
      run: runCmp({ L: 0.5, bob: 'ball-steel', place: 'g-earth', th: 0.3, label: 'on Earth' }, { L: 0.5, bob: 'ball-steel', place: 'g-moon', th: 0.3, label: 'on the Moon' }, 4, 2,
        (a, b) => `Earth: ${a.toFixed(2)} s. Moon: ${b.toFixed(2)} s.`),
      explain: 'Weaker gravity pulls it back to the middle more gently, so it takes longer. Six times weaker gravity means √6 ≈ 2.45 times slower.',
    },
    {
      id: 'angle', title: 'Big swing, small swing', card: 'pendulum.angle', lock: true, after, skip: skipCmp,
      q: 'Two identical 60 cm pendulums. Let one go from 10° and the other from 60°. Which takes longer for each swing?',
      choices: ['The 10° one', 'The 60° one', 'They take the same time'], answer: 1,
      run: runCmp({ L: 0.6, bob: 'ball-steel', place: 'g-earth', th: 10 * Math.PI / 180, label: 'from 10°', scale: () => Math.min(G.s, (G.w * 0.2 - 30) / (0.6 * Math.sin(Math.PI / 3) + 0.05)) }, { L: 0.6, bob: 'ball-steel', place: 'g-earth', th: 60 * Math.PI / 180, label: 'from 60°' }, 5, 5,
        (a, b) => `10°: ${a.toFixed(3)} s. 60°: ${b.toFixed(3)} s. Watch them drift out of step.`),
      explain: 'For small swings the time hardly depends on how far you pull. For big ones the pull back is a bit weaker than the simple rule assumes, so each swing takes longer: about 7% at 60°.',
    },
  ]);

  sync(); hold(0);
  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'swing', label: 'Measure', build: tabSwing },
  { id: 'graphs', label: 'Graphs', build: tabGraphs },
  { id: 'decay', label: 'Decay', build: tabDecay },
];

export default bench;
export { params, gOf };
