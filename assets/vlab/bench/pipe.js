// 2F · Magnet and pipes. Drop a strong magnet down a metal pipe and it drifts down slowly: as it
// falls, the changing magnetic flux drives rings of current round the pipe (eddy currents),
// and those currents push back. The braking is computed properly for a magnet of finite size,
// from the mutual inductance of coaxial rings, and compared with the textbook point-dipole result.

import { el, slider, button, group, readout, canvasBox, note, checkbox, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas, fmtNum } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

const MU0 = 4e-7 * Math.PI, G = 9.81, LP = 1.0;   // pipe length, m

const bench = {
  id: 'pipe', title: 'Magnet and pipes', kicker: '2F · Physics Playground', icon: '⤓', floor: 2,
  blurb: 'A magnet falls through a copper pipe, very slowly.',
  slots: [
    { id: 'magnet', label: 'Falling thing', options: ['magnet-n42', 'magnet-stack', 'magnet-n52', 'magnet-ferrite', 'magnet-tiny', 'slug-steel'], def: 'magnet-n42' },
    { id: 'pipe', label: 'Pipe', options: ['pipe-cu', 'pipe-al', 'pipe-brass', 'pipe-steel', 'pipe-pvc', 'pipe-slot', 'pipe-thick'], def: 'pipe-cu' },
    { id: 'temp', label: 'Temperature', options: ['warm', 'ln2'], def: 'warm' },
    { id: 'timer', label: 'Timing', options: ['stopwatch', 'photogate', 'camera'], def: 'stopwatch' },
  ],
};
bench.header = rigStrip(bench);

// ---------------------------------------------------------------- the physics
// complete elliptic integrals K and E of parameter m = k^2, by the arithmetic-geometric mean
function ellip(m) {
  let a = 1, b = Math.sqrt(1 - m), sum = m / 2, pow = 0.5;
  for (let i = 0; i < 40; i++) {
    const an = (a + b) / 2, bn = Math.sqrt(a * b), cn = (a - b) / 2;
    pow *= 2; sum += pow * cn * cn; a = an; b = bn;
    if (Math.abs(cn) < 1e-16) break;
  }
  const K = Math.PI / (2 * a);
  return [K, K * (1 - sum)];
}
// mutual inductance of two coaxial circular loops (radii r1, r2, axial distance d)
export function mutual(r1, r2, d) {
  const m = 4 * r1 * r2 / ((r1 + r2) ** 2 + d * d), k = Math.sqrt(m);
  const [K, E] = ellip(Math.min(m, 1 - 1e-15));
  return MU0 * Math.sqrt(r1 * r2) * ((2 / k - k) * K - (2 / k) * E);
}

// braking coefficient b(z) (N s/m) for the magnet centre at depth z below the top of the pipe
export function brakeTable(mag, pipe, cold) {
  const M = mag.Br / MU0, R = mag.R, len = mag.len;
  let sigma = pipe.sigma * (cold ? pipe.cold : 1);
  if (pipe.slot) sigma *= 0.04;   // the cut stops the currents going round
  const shells = 6, U = 0.25, du = 0.0002, n = Math.round(2 * U / du) + 1;
  const g = new Float64Array(n);
  if (sigma > 0 && M > 0) {
    for (let s = 0; s < shells; s++) {
      const rho = pipe.a + (s + 0.5) * pipe.w / shells, w = pipe.w / shells;
      const pre = sigma * w / (2 * Math.PI * rho) * M * M;
      for (let i = 0; i < n; i++) {
        const u = -U + i * du;
        const dPhi = mutual(rho, R, u + len / 2) - mutual(rho, R, u - len / 2);   // dΦ/dz per unit magnetisation
        g[i] += pre * dPhi * dPhi;
      }
    }
  }
  // cumulative integral, so b(z) = C(L - z) - C(-z)
  const C = new Float64Array(n);
  for (let i = 1; i < n; i++) C[i] = C[i - 1] + 0.5 * (g[i] + g[i - 1]) * du;
  const at = (u) => { if (u <= -U) return 0; if (u >= U) return C[n - 1]; const x = (u + U) / du, i = Math.floor(x), f = x - i; return C[i] + (C[Math.min(n - 1, i + 1)] - C[i]) * f; };
  const b = (z) => Math.max(0, at(LP - z) - at(-z));
  const mass = mag.rho * Math.PI * R * R * len;
  // the textbook result for a point dipole in a thin-walled pipe
  const mdip = M * Math.PI * R * R * len, am = pipe.a + pipe.w / 2;
  const kDip = 45 * MU0 * MU0 * mdip * mdip * sigma * pipe.w / (1024 * am ** 4);
  const ring = (u) => { const i = Math.round((u + U) / du); return i < 0 || i >= n ? 0 : g[i]; };
  return { b, mass, kDip, bMid: b(LP / 2), ring, sigma, fits: R < pipe.a - 0.2e-3 };
}

// ---------------------------------------------------------------- state
const S = { z: -0.05, v: 0, t: 0, run: false, trace: [], tTop: null, tBot: null, watch: { on: false, t0: 0, acc: 0 }, ff: 1, table: null, key: '' };
function setup() {
  const mag = phys(bench, 'magnet'), pipe = phys(bench, 'pipe'), cold = current(bench, 'temp') === 'ln2';
  const key = mag.id + pipe.id + cold;
  if (key !== S.key) { S.table = brakeTable(mag, pipe, cold); S.key = key; S.mag = mag; S.pipe = pipe; S.cold = cold; }
  return S.table;
}
function drop() { S.z = -0.05; S.v = 0; S.t = 0; S.run = true; S.trace = []; S.tTop = null; S.tBot = null; S.done = false; }

const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'mag', label: 'Falling thing', fmt: (v) => ITEMS[v].name },
  { key: 'pipe', label: 'Pipe', fmt: (v) => ITEMS[v].name },
  { key: 'cold', label: 'Cooled', fmt: (v) => (v ? 'yes' : 'no') },
  { key: 'how', label: 'Timed with' },
  { key: 't', label: 'Time through the pipe (s)', fmt: (v) => v.toFixed(v < 2 ? 3 : 2) },
], { caption: 'Your drops' });
let nDrop = 0;

function tabDrop(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Hold the magnet over the top of the 1 m pipe and let go. In plastic it simply falls. In metal it slows down at once and drifts to the bottom at a steady speed. Try the steel slug, the different pipes, the slotted pipe, and liquid nitrogen.' }));
  const box = canvasBox('', '5 / 6', 'The pipe, cut open so you can see inside');
  const go = button('Drop it', () => { setup(); if (!S.table.fits) return; drop(); watchReset(); }, 'go');
  const ff = segmented({ label: 'Playback speed', options: [{ value: 1, label: 'Real time' }, { value: 5, label: '×5' }, { value: 20, label: '×20' }], value: 1, onChange: (v) => { S.ff = +v; } });
  const rings = checkbox({ label: 'Show the eddy currents', checked: true, onChange: (v) => { S.rings = v; } }); S.rings = true;
  const wDisp = el('div', { class: 'watch', text: '0.00 s' });
  const wBtn = button('Start', () => watchToggle(), 'go', { class: 'vbtn vbtn-go watch-btn' });
  const wRec = button('Record', () => { const t = watchTime(); if (t > 0) addRow(t, 'stopwatch'); }, 'secondary');
  const wGrp = group('Stopwatch', wDisp, el('div', { class: 'vp-row' }, wBtn, wRec), el('p', { class: 'ctl-hint', text: 'Start when the magnet enters the top, stop when it drops out of the bottom.' }));
  const gTop = readout('Top gate'), gBot = readout('Bottom gate'), gDur = readout('Time between the gates');
  const gGrp = group('Photogates', gTop, gBot, gDur);
  const vRo = readout('Speed now'), bRo = readout('Steady speed inside (calculated)'), dRo = readout('Point-dipole estimate'), fRo = readout('Fall without a pipe');
  const fitNote = note('This magnet does not fit in this pipe!');
  pane.append(el('div', { class: 'vp-cols' },
    el('div', { class: 'vp-side' }, group('Drop', go, ff, rings), wGrp, gGrp),
    el('div', { class: 'vp-main' }, fitNote, box, el('div', { class: 'ros' }, vRo, bRo, dRo, fRo))), table.el);

  function addRow(t, how) {
    table.add({ n: ++nDrop, mag: current(bench, 'magnet'), pipe: current(bench, 'pipe'), cold: S.cold, how, t });
    rig.note({ bench: 'pipe', time: t, mag: current(bench, 'magnet'), pipe: current(bench, 'pipe'), cold: S.cold, how });
  }
  function watchTime() { return S.watch.acc + (S.watch.on ? (performance.now() - S.watch.t0) / 1000 * S.ff : 0); }
  function watchToggle() { if (S.watch.on) { S.watch.acc = watchTime(); S.watch.on = false; wBtn.textContent = 'Start'; } else { S.watch.t0 = performance.now(); S.watch.on = true; wBtn.textContent = 'Stop'; } }
  function watchReset() { S.watch = { on: false, t0: 0, acc: 0 }; wBtn.textContent = 'Start'; wDisp.textContent = '0.00 s'; }

  function sync() {
    const T = setup(), tm = current(bench, 'timer');
    wGrp.hidden = tm !== 'stopwatch'; gGrp.hidden = tm !== 'photogate';
    fitNote.hidden = T.fits; go.disabled = !T.fits;
    const vt = T.bMid > 0 ? T.mass * G / T.bMid : Infinity;
    bRo.set(Number.isFinite(vt) && vt < 4.4 ? `${fmtNum(vt * 100, 3)} cm/s` : 'no braking');
    const vd = T.kDip > 0 ? T.mass * G / T.kDip : Infinity;
    dRo.set(Number.isFinite(vd) && vd < 4.4 ? `${fmtNum(vd * 100, 3)} cm/s` : '–');
    fRo.set(`${Math.sqrt(2 * (LP + 0.05) / G).toFixed(2)} s for the drop`);
    draw();
  }
  onRig(bench, sync);

  const anim = loop((dt) => {
    const T = setup();
    if (S.run) {
      let left = dt * S.ff;
      while (left > 1e-9) {
        const h = Math.min(0.0005, left); left -= h;
        const b = T.b(S.z), k = b / T.mass;
        const zPrev = S.z;
        if (k * h > 1e-6) { const vt = G / k, e = Math.exp(-k * h); const vNew = vt + (S.v - vt) * e; S.z += vt * h + (S.v - vt) * (1 - e) / k; S.v = vNew; }
        else { S.z += S.v * h + 0.5 * G * h * h; S.v += G * h; }
        S.t += h;
        // the gates sit at the two ends of the pipe; the beam is cut when the magnet's centre passes
        if (zPrev < 0 && S.z >= 0) S.tTop = S.t - h * (S.z / (S.z - zPrev));
        if (zPrev < LP && S.z >= LP) {
          S.tBot = S.t - h * ((S.z - LP) / (S.z - zPrev));
          if (current(bench, 'timer') === 'photogate') addRow(S.tBot - S.tTop, 'photogates');
          else if (current(bench, 'timer') === 'camera') addRow(S.tBot - S.tTop, 'camera');
          rig.note({ bench: 'pipe', time: S.tBot - S.tTop, mag: current(bench, 'magnet'), pipe: current(bench, 'pipe'), cold: S.cold, auto: true });
        }
        if (S.z > LP + 0.12) { S.run = false; S.z = LP + 0.12; S.v = 0; break; }
      }
      if (!S.trace.length || S.t - S.trace[S.trace.length - 1][0] > 0.01) S.trace.push([S.t, S.z, S.v]);
      if (bench._graph) bench._graph();
    }
    if (S.watch.on) wDisp.textContent = watchTime().toFixed(2) + ' s';
    draw();
  });

  function draw() {
    const T = S.table || setup();
    const { g, w, h } = fitCanvas(box.canvas);
    const cold = S.cold;
    g.fillStyle = cold ? '#E3F4FF' : '#F1ECFF'; g.fillRect(0, 0, w, h);
    const top = h * 0.07, bot = h * 0.86, sc = (bot - top) / LP;
    const cx = w * 0.42, pw = Math.max(26, Math.min(60, w * 0.12));
    const p = S.pipe, item = ITEMS[current(bench, 'pipe')];
    const [col, hi] = item.icon.slice(1, 3);
    // stand
    g.fillStyle = '#6B5BE6'; g.fillRect(cx - pw - 18, top - 10, 6, bot - top + 40); g.fillRect(cx + pw + 12, top - 10, 6, bot - top + 40);
    g.fillStyle = '#4A3A8C'; g.fillRect(cx - pw - 30, bot + 26, 2 * pw + 60, 8);
    // the pipe, cut open: back wall and two edges
    g.fillStyle = col; g.fillRect(cx - pw / 2 - 6, top, 6, LP * sc); g.fillRect(cx + pw / 2, top, 6, LP * sc);
    g.fillStyle = hi; g.fillRect(cx - pw / 2 - 5, top, 2, LP * sc);
    g.fillStyle = 'rgba(27,36,64,0.10)'; g.fillRect(cx - pw / 2, top, pw, LP * sc);
    if (p.slot) { g.fillStyle = '#1B2440'; g.fillRect(cx - 1, top, 2, LP * sc); }
    if (cold) { g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 26; i++) { const y = top + ((i * 53 + performance.now() / 30) % (LP * sc)); g.fillRect(cx + pw / 2 + 8 + (i % 3) * 5, y, 3, 2); } }
    // eddy currents: rings that circulate one way above the magnet and the other way below
    if (S.rings && T.sigma > 0) {
      for (let k = 0; k <= 50; k++) {
        const z = k / 50 * LP, u = z - S.z;
        const J = Math.sqrt(T.ring(u)) * Math.abs(S.v) * Math.sign(u || 1);
        const a = Math.min(1, Math.abs(J) / (T.ringMax || (T.ringMax = Math.sqrt(Math.max(...[0, 0.002, 0.004, 0.006, 0.008, 0.01].map((x) => T.ring(x)))) * 0.3 + 1e-12)));
        if (a < 0.03) continue;
        g.strokeStyle = J > 0 ? `rgba(229,83,75,${a})` : `rgba(61,111,182,${a})`; g.lineWidth = 2;
        g.beginPath(); g.ellipse(cx, top + z * sc, pw / 2 + 3, 4, 0, 0, 7); g.stroke();
      }
    }
    // gates
    if (current(bench, 'timer') === 'photogate') for (const z of [0, LP]) { g.fillStyle = '#2E4A7D'; g.fillRect(cx - pw / 2 - 26, top + z * sc - 4, 14, 8); g.fillRect(cx + pw / 2 + 12, top + z * sc - 4, 14, 8); g.strokeStyle = 'rgba(229,83,75,0.6)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx - pw / 2 - 12, top + z * sc); g.lineTo(cx + pw / 2 + 12, top + z * sc); g.stroke(); g.setLineDash([]); }
    // catch box
    g.fillStyle = '#FFE07A'; g.fillRect(cx - pw, bot + 6, 2 * pw, 20); g.fillStyle = '#E8C25A'; g.fillRect(cx - pw, bot + 6, 2 * pw, 4);
    // the falling thing (drawn to scale across the pipe)
    const mag = S.mag, mh = Math.max(8, mag.len * sc * 1.0), mw = pw * (mag.R / p.a) * 0.95;
    const mz = top + Math.min(S.z, LP + 0.1) * sc;
    const mi = current(bench, 'magnet');
    if (mi === 'slug-steel') { g.fillStyle = '#9DB8D3'; g.fillRect(cx - mw / 2, mz - mh / 2, mw, mh); }
    else if (mi === 'magnet-ferrite') { g.fillStyle = '#22325C'; g.fillRect(cx - mw / 2, mz - mh / 2, mw, mh); }
    else { g.fillStyle = '#3D6FB6'; g.fillRect(cx - mw / 2, mz - mh / 2, mw, mh / 2); g.fillStyle = '#E5534B'; g.fillRect(cx - mw / 2, mz, mw, mh / 2); }
    g.strokeStyle = '#1B2440'; g.lineWidth = 1.2; g.strokeRect(cx - mw / 2, mz - mh / 2, mw, mh);
    // ruler
    g.fillStyle = '#12243A'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
    for (let cm = 0; cm <= 100; cm += 10) { const y = top + cm / 100 * LP * sc; g.fillRect(cx + pw + 22, y, cm % 50 ? 6 : 10, 1); if (cm % 50 === 0) g.fillText(`${cm} cm`, cx + pw + 36, y); }
    vRo.set(`${(Math.abs(S.v) * 100).toFixed(1)} cm/s`);
    const tm = current(bench, 'timer');
    if (tm === 'photogate') { gTop.set(S.tTop !== null ? `${S.tTop.toFixed(4)} s` : '–'); gBot.set(S.tBot !== null ? `${S.tBot.toFixed(4)} s` : '–'); gDur.set(S.tTop !== null && S.tBot !== null ? `${(S.tBot - S.tTop).toFixed(4)} s` : '–'); }
  }
  sync();
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- speed against time
function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Filmed from the side through the slot: the magnet speeds up for a moment, then the braking force (proportional to the speed) balances its weight and it falls at a steady <b>terminal speed</b>.' }));
  const box = canvasBox('', '16 / 9', 'Speed against time');
  const plot = new Plot(box.canvas, { xlabel: 'Time (s)', ylabel: 'Speed (cm/s)' });
  const box2 = canvasBox('', '16 / 7', 'Braking along the pipe');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Depth of the magnet’s centre (cm)', ylabel: 'Braking b (N s/m)' });
  const need = note('The speed graph needs the <b>high-speed camera</b>. You can always see the braking calculated along the pipe below.');
  pane.append(el('div', { class: 'vp-main' }, need, box, box2));
  function draw() {
    const cam = current(bench, 'timer') === 'camera';
    need.hidden = cam; box.hidden = !cam;
    if (cam && S.trace.length) plot.setSeries([{ x: S.trace.map((q) => q[0]), y: S.trace.map((q) => q[2] * 100), color: COLORS.signal, width: 2.2 }]).draw();
    const T = setup(), xs = [], ys = [];
    for (let z = -0.08; z <= LP + 0.08; z += 0.004) { xs.push(z * 100); ys.push(T.b(z)); }
    plot2.setSeries([{ x: xs, y: ys, color: COLORS.violet, width: 2.2, label: 'full calculation' }, { x: [0, LP * 100], y: [T.kDip, T.kDip], color: COLORS.gold, dash: [5, 4], width: 1.6, label: 'point-dipole formula' }]).draw();
  }
  let last = 0;
  bench._graph = () => { const now = performance.now(); if (now - last > 200) { last = now; draw(); } };
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

bench.tabs = [
  { id: 'drop', label: 'Drop', build: tabDrop },
  { id: 'graph', label: 'Speed and braking', build: tabGraph },
];

export default bench;
