// 1F · Pendulum. A real swing, solved step by step: a bob of finite size on a light string,
// air drag, buoyancy and the air the bob drags along, large-angle swings, and a gravity room
// that can be set to another planet. Time it by hand, with a photogate, or film it.

import { el, slider, button, group, readout, canvasBox, note, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitProp, fitCanvas, fmtNum } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

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
  const b = phys(bench, 'bob'), place = current(bench, 'place'), vac = current(bench, 'air') === 'belljar';
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

bench.tabs = [
  { id: 'swing', label: 'Swing', build: tabSwing },
  { id: 'graphs', label: 'Graphs', build: tabGraphs },
  { id: 'decay', label: 'Decay', build: tabDecay },
];

export default bench;
export { params, gOf };
