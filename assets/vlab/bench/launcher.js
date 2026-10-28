// 1F · Launcher. Projectiles with real air: drag that grows with the square of the speed, and
// lift from backspin (the Magnus effect). Fire balls of different kinds, measure where they
// land, how high they go and how fast they move, and try to land one in the basket.

import { el, slider, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

const RHO = 1.204, G = 9.81;
const CL_BACKSPIN = { 'ball-golf': 0.16, 'ball-tennis': 0.12, 'ball-pingpong': 0.20, 'ball-steel': 0.05, 'shuttle': 0 };

const bench = {
  id: 'launcher', title: 'Launcher', kicker: '1F · Classics Hall', icon: '↗', floor: 1,
  blurb: 'Projectiles with real air drag. Land one in the basket.',
  slots: [
    { id: 'ball', label: 'Ball', options: ['ball-steel', 'ball-tennis', 'ball-golf', 'ball-pingpong', 'shuttle'], def: 'ball-tennis' },
    { id: 'tool', label: 'Measure with', options: ['tape', 'camera', 'radar'], def: 'tape' },
    { id: 'air', label: 'Air', options: ['air', 'vactube'], def: 'air' },
    { id: 'spin', label: 'Spin', options: ['spin-off', 'spin-back'], def: 'spin-off' },
  ],
};
bench.header = rigStrip(bench);

// ---------------------------------------------------------------- physics
function ballParams() {
  const b = phys(bench, 'ball'), vac = current(bench, 'air') === 'vactube', spin = current(bench, 'spin') === 'spin-back';
  const A = Math.PI * (b.d / 2) ** 2, rho = vac ? 0 : RHO;
  return { id: b.id, m: b.m, r: b.d / 2, kd: 0.5 * rho * b.Cd * A / b.m, kl: spin ? 0.5 * rho * (CL_BACKSPIN[b.id] || 0) * A / b.m : 0, vac, spin };
}
function acc(p, vx, vy) {
  const v = Math.hypot(vx, vy);
  // drag against the motion, lift at right angles to it (up, for backspin while moving right)
  return [-p.kd * v * vx - p.kl * v * vy, -G - p.kd * v * vy + p.kl * v * vx];
}
// fly until the ball reaches the floor; returns sampled points [t, x, y, vx, vy]
export function fly(p, v0, angDeg, h0, dt = 0.001, every = 10) {
  const a = angDeg * Math.PI / 180;
  let x = 0, y = h0, vx = v0 * Math.cos(a), vy = v0 * Math.sin(a), t = 0;
  const pts = [[0, x, y, vx, vy]];
  for (let i = 1; i < 200000; i++) {
    const k1 = acc(p, vx, vy);
    const k2 = acc(p, vx + dt / 2 * k1[0], vy + dt / 2 * k1[1]);
    const k3 = acc(p, vx + dt / 2 * k2[0], vy + dt / 2 * k2[1]);
    const k4 = acc(p, vx + dt * k3[0], vy + dt * k3[1]);
    const nx = x + dt * (vx + dt / 6 * (k1[0] + k2[0] + k3[0])), ny = y + dt * (vy + dt / 6 * (k1[1] + k2[1] + k3[1]));
    const nvx = vx + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), nvy = vy + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    t += dt;
    if (ny < 0) { const f = y / (y - ny); pts.push([t - dt + f * dt, x + f * (nx - x), 0, nvx, nvy]); break; }
    x = nx; y = ny; vx = nvx; vy = nvy;
    if (i % every === 0) pts.push([t, x, y, vx, vy]);
    if (x > 80 || t > 30) break;
  }
  return pts;
}
// where the path crosses a height on the way down, if it does
function crossingDown(pts, H) {
  for (let i = 1; i < pts.length; i++) {
    const [, x0, y0] = pts[i - 1], [, x1, y1] = pts[i];
    if (y0 >= H && y1 < H && pts[i][4] < 0) return x0 + (x1 - x0) * (y0 - H) / (y0 - y1);
  }
  return null;
}

// ---------------------------------------------------------------- shared state
const S = { v0: 12, ang: 40, h0: 0.30, target: 14, rimH: 0.80, rimR: 0.23, shots: [], cur: null, tShot: 0, ghost: true, party: 0 };
function newTarget() { S.target = Math.round((7 + Math.random() * 17) * 10) / 10; }
newTarget();
const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'ball', label: 'Ball', fmt: (v) => ITEMS[v].name },
  { key: 'v0', label: 'Speed (m/s)', fmt: (v) => v.toFixed(1) },
  { key: 'ang', label: 'Angle (°)', fmt: (v) => v.toFixed(1) },
  { key: 'range', label: 'Range (m)', fmt: (v) => v.toFixed(2) },
  { key: 'tf', label: 'Flight (s)', fmt: (v) => (v === null ? '–' : v.toFixed(3)) },
  { key: 'hmax', label: 'Top (m)', fmt: (v) => (v === null ? '–' : v.toFixed(2)) },
  { key: 'air', label: 'Air' },
], { caption: 'Your shots' });
let nShot = 0;

// ---------------------------------------------------------------- the range
function tabRange(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Set the speed and the angle, then fire. The basket is somewhere down the hall; press <b>New target</b> to move it. Light balls feel the air much more than heavy ones, so the best angle is not always 45°.' }));
  const box = canvasBox('', '16 / 8', 'The launch range seen from the side');
  const vS = slider({ label: 'Launch speed', unit: 'm/s', min: 1, max: 30, step: 0.1, value: S.v0, digits: 3, onInput: (v) => { S.v0 = v; preview(); } });
  const aS = slider({ label: 'Launch angle', unit: '°', min: 0, max: 85, step: 0.5, value: S.ang, digits: 3, onInput: (v) => { S.ang = v; preview(); } });
  const hS = slider({ label: 'Height of the launcher', unit: 'm', min: 0, max: 2, step: 0.05, value: S.h0, digits: 3, onInput: (v) => { S.h0 = v; preview(); } });
  const fire = button('Fire!', () => shoot(), 'go');
  const tgt = button('New target', () => { newTarget(); draw(); }, 'quiet');
  const gh = checkbox({ label: 'Show the path it would take in a vacuum', checked: S.ghost, onChange: (v) => { S.ghost = v; draw(); } });
  const rRo = readout('Landed at'), tRo = readout('Time in the air'), hRo = readout('Highest point'), sRo = readout('Speed');
  const side = el('div', { class: 'vp-side' }, group('Aim', vS, aS, hS, el('div', { class: 'vp-row' }, fire, tgt), gh));
  pane.append(el('div', { class: 'vp-cols' }, side, el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, rRo, tRo, hRo, sRo))), table.el);

  let p = ballParams();
  let aim = null;
  function preview() { aim = null; draw(); }
  function shoot() {
    p = ballParams();
    const pts = fly(p, S.v0, S.ang, S.h0);
    const xHit = crossingDown(pts, S.rimH);
    const hit = xHit !== null && Math.abs(xHit - S.target) <= S.rimR - p.r && pts[pts.length - 1][1] > S.target - 0.5;
    const last = pts[pts.length - 1];
    let hmax = 0; for (const q of pts) hmax = Math.max(hmax, q[2]);
    S.cur = { pts, hit, ball: p.id, range: last[1], tf: last[0], hmax, vac: p.vac, landed: false, v0: S.v0, ang: S.ang };
    S.tShot = 0;
    S.shots.push(S.cur); if (S.shots.length > 6) S.shots.shift();
    if (!anim.running) anim.start();
  }
  function landed(sh) {
    sh.landed = true;
    const tool = current(bench, 'tool');
    table.add({ n: ++nShot, ball: sh.ball, v0: sh.v0, ang: sh.ang, range: sh.range, tf: tool === 'camera' ? sh.tf : null, hmax: tool === 'camera' ? sh.hmax : null, air: sh.vac ? 'vacuum' : 'air' });
    rig.note({ bench: 'launcher', hit: sh.hit, ball: sh.ball, range: sh.range, v0: sh.v0, ang: sh.ang });
    if (sh.hit) S.party = 2.5;
    bench._last = sh;
    if (bench._speedTab) bench._speedTab();
  }
  const anim = loop((dt) => {
    const tool = current(bench, 'tool');
    const slow = tool === 'camera' ? 0.35 : 1;
    if (S.cur && !S.cur.landed) {
      S.tShot += dt * slow;
      if (S.tShot >= S.cur.tf) { S.tShot = S.cur.tf; landed(S.cur); }
    }
    if (S.party > 0) S.party -= dt;
    draw();
  });
  function sync() { p = ballParams(); draw(); }
  onRig(bench, sync);

  function stateAt(sh, t) {
    const pts = sh.pts;
    let i = 1; while (i < pts.length - 1 && pts[i][0] < t) i++;
    const a = pts[i - 1], b = pts[i], f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 1;
    return a.map((v, k) => v + (b[k] - v) * f);
  }

  function draw() {
    const { g, w, h } = fitCanvas(box.canvas);
    const tool = current(bench, 'tool');
    // what to fit in view
    let xmax = Math.max(S.target + 3, 10), ymax = 3;
    const vis = S.shots.slice(-3);
    for (const sh of vis) for (const q of sh.pts) { if (q[1] < 60) xmax = Math.max(xmax, q[1] + 1); ymax = Math.max(ymax, q[2] + 0.8); }
    if (!aim) aim = fly(ballParams(), S.v0, S.ang, S.h0, 0.004, 4);
    for (const q of aim) { if (q[2] > 0) ymax = Math.max(ymax, Math.min(40, q[2] + 0.8)); }
    xmax = Math.min(xmax, 60);
    const pad = 34, sc = Math.min((w - pad - 12) / (xmax + 1), (h - 30) / ymax);
    const X = (x) => pad + (x + 0.5) * sc, Y = (y) => h - 22 - y * sc;
    // sky and floor
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#EAF6FC'); grd.addColorStop(1, '#FFF4DE');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#E9B77E'; g.fillRect(0, h - 22, w, 22);
    g.fillStyle = '#C98A4E'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    const step = xmax > 30 ? 5 : xmax > 14 ? 2 : 1;
    for (let m = 0; m <= xmax; m += step) { g.fillRect(X(m), h - 22, 1, 6); g.fillStyle = '#8E5A35'; g.fillText(m + ' m', X(m), h - 14); g.fillStyle = '#C98A4E'; }
    // vacuum tunnel
    if (current(bench, 'air') === 'vactube') { g.fillStyle = 'rgba(191,239,255,0.28)'; g.fillRect(X(-0.5), Y(ymax), X(xmax) - X(-0.5), Y(0) - Y(ymax)); g.fillStyle = '#00739E'; g.textAlign = 'left'; g.fillText('vacuum tunnel', X(0.2), Y(ymax) + 6); }
    // basket
    const bx = X(S.target), by = Y(S.rimH);
    g.fillStyle = '#6A86A8'; g.fillRect(bx + S.rimR * sc + 2, by - 18, 4, Y(0) - by + 18);
    g.fillStyle = '#FFFDF6'; g.fillRect(bx + S.rimR * sc + 6, by - 34, 6, 30);
    g.strokeStyle = '#E5534B'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx - S.rimR * sc, by); g.lineTo(bx + S.rimR * sc, by); g.stroke();
    g.strokeStyle = 'rgba(255,253,246,0.9)'; g.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(bx + i * S.rimR * sc / 2.5, by); g.lineTo(bx + i * S.rimR * sc / 4, by + 14); g.stroke(); }
    g.fillStyle = '#12243A'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.font = '600 12px "Plex", system-ui, sans-serif';
    g.fillText(`${S.target.toFixed(1)} m`, bx, by - 20);
    // aim line and vacuum ghost
    g.setLineDash([3, 5]); g.strokeStyle = 'rgba(0,115,158,0.55)'; g.lineWidth = 1.5; g.beginPath();
    aim.forEach((q, i) => { const xx = X(q[1]), yy = Y(q[2]); if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); });
    g.stroke();
    if (S.ghost && !ballParams().vac) {
      const vg = fly({ kd: 0, kl: 0 }, S.v0, S.ang, S.h0, 0.004, 4);
      g.strokeStyle = 'rgba(107,91,230,0.45)'; g.beginPath();
      vg.forEach((q, i) => { const xx = X(q[1]), yy = Y(q[2]); if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); });
      g.stroke();
    }
    g.setLineDash([]);
    // launcher
    const a = S.ang * Math.PI / 180, lx = X(0), ly = Y(S.h0);
    g.fillStyle = '#2E4A7D'; g.fillRect(lx - 12, ly, 24, Y(0) - ly);
    g.save(); g.translate(lx, ly); g.rotate(-a); g.fillStyle = '#00A9D6'; g.fillRect(-6, -6, 30, 12); g.fillStyle = '#1B2440'; g.fillRect(20, -6, 4, 12); g.restore();
    // earlier shots, faded
    for (const sh of S.shots) {
      if (sh === S.cur && !sh.landed) continue;
      g.strokeStyle = sh.hit ? 'rgba(76,183,130,0.75)' : 'rgba(18,36,58,0.22)'; g.lineWidth = 1.5; g.beginPath();
      sh.pts.forEach((q, i) => { const xx = X(q[1]), yy = Y(q[2]); if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); });
      g.stroke();
      const L = sh.pts[sh.pts.length - 1]; g.fillStyle = '#E0457B'; g.fillRect(X(L[1]) - 1, Y(0) - 4, 2, 8);
    }
    // the ball in flight
    const sh = S.cur;
    let now = null;
    if (sh) {
      now = stateAt(sh, S.tShot);
      if (tool === 'camera') {
        g.fillStyle = 'rgba(0,115,158,0.8)';
        for (let t = 0; t <= S.tShot; t += 1 / 30) { const q = stateAt(sh, t); g.beginPath(); g.arc(X(q[1]), Y(q[2]), 2.2, 0, 7); g.fill(); }
      } else {
        g.strokeStyle = 'rgba(0,115,158,0.7)'; g.lineWidth = 2; g.beginPath();
        let first = true;
        for (const q of sh.pts) { if (q[0] > S.tShot) break; const xx = X(q[1]), yy = Y(q[2]); if (first) { g.moveTo(xx, yy); first = false; } else g.lineTo(xx, yy); }
        g.lineTo(X(now[1]), Y(now[2])); g.stroke();
      }
      const it = ITEMS[sh.ball], col = it.icon[0] === 'tennis' ? '#DDF27A' : it.icon[0] === 'golf' || it.icon[0] === 'shuttle' ? '#FFFDF6' : (it.icon[1] || '#9DB8D3');
      const rr = Math.max(4, sh.pts && ballParams().r * sc);
      g.fillStyle = col; g.strokeStyle = '#1B2440'; g.lineWidth = 1.2; g.beginPath(); g.arc(X(now[1]), Y(now[2]), rr, 0, 7); g.fill(); g.stroke();
    }
    // readouts
    if (sh && sh.landed) {
      rRo.set(tool === 'tape' || tool === 'camera' || tool === 'radar' ? `${sh.range.toFixed(2)} m` : '–');
      tRo.set(tool === 'camera' ? `${sh.tf.toFixed(3)} s` : 'needs the camera');
      hRo.set(tool === 'camera' ? `${sh.hmax.toFixed(2)} m` : 'needs the camera');
    } else { rRo.set('–'); tRo.set(tool === 'camera' ? '…' : 'needs the camera'); hRo.set(tool === 'camera' ? '…' : 'needs the camera'); }
    sRo.set(tool === 'radar' || tool === 'camera' ? (now ? `${Math.hypot(now[3], now[4]).toFixed(2)} m/s` : `${S.v0.toFixed(1)} m/s at launch`) : 'needs the radar or camera');
    // a little party for a hit
    if (S.party > 0) {
      const cols = ['#E5534B', '#E8C25A', '#4CB782', '#00D4FF', '#6B5BE6', '#FF8FAB'];
      for (let i = 0; i < 40; i++) {
        const k = (i * 37) % 100 / 100, tt = 2.5 - S.party;
        g.fillStyle = cols[i % cols.length];
        g.fillRect(bx + Math.cos(i * 2.4) * (30 + 60 * tt) * k, by - 40 - 80 * tt * k + 70 * tt * tt * k, 4, 4);
      }
      g.fillStyle = '#2F7D5B'; g.font = '600 18px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('In the basket!', w / 2, 30);
    }
  }
  return { show() { anim.start(); draw(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- range against angle
function tabAngles(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Fire the same ball at the same speed at every angle and see where it lands. In a vacuum the best angle is 45° (from floor level). In air it is lower, and much lower for light balls.' }));
  const box = canvasBox('', '16 / 10', 'Range against launch angle');
  const plot = new Plot(box.canvas, { xlabel: 'Launch angle (°)', ylabel: 'Range (m)' });
  const best = readout('Best angle in air'), bestV = readout('Best angle in a vacuum');
  const runs = [];
  const go = button('Fire at every angle', () => run(), 'primary');
  const clr = button('Clear', () => { runs.length = 0; draw(); }, 'quiet');
  pane.append(el('div', { class: 'vp-main' }, el('div', { class: 'vp-row' }, go, clr), box, el('div', { class: 'ros' }, best, bestV)));
  function run() {
    const p = ballParams();
    const xs = [], ys = [], yv = [];
    let bi = 0, bv = 0;
    for (let a = 2.5; a <= 87.5; a += 2.5) {
      const r = fly(p, S.v0, a, S.h0, 0.002, 1000).pop()[1];
      const rv = fly({ kd: 0, kl: 0 }, S.v0, a, S.h0, 0.002, 1000).pop()[1];
      xs.push(a); ys.push(r); yv.push(rv);
      if (r > ys[bi]) bi = ys.length - 1; if (rv > yv[bv]) bv = yv.length - 1;
    }
    runs.push({ xs, ys, label: `${ITEMS[p.id].name} at ${S.v0.toFixed(1)} m/s${p.vac ? ' (vacuum)' : ''}${p.spin ? ', backspin' : ''}` });
    if (runs.length > 4) runs.shift();
    runs.vac = { xs, ys: yv };
    best.set(`${xs[bi]}° → ${ys[bi].toFixed(2)} m`); bestV.set(`${xs[bv]}° → ${yv[bv].toFixed(2)} m`);
    rig.note({ bench: 'launcher', sweep: true, ball: p.id });
    draw();
  }
  function draw() {
    const series = runs.map((r, i) => ({ x: r.xs, y: r.ys, color: [COLORS.signal, COLORS.pink, COLORS.gold, COLORS.green][i % 4], width: 2.2, label: r.label }));
    if (runs.vac) series.push({ x: runs.vac.xs, y: runs.vac.ys, color: COLORS.violet, dash: [5, 4], width: 1.6, label: 'same speed, no air' });
    plot.xlim = [0, 90]; plot.setSeries(series).draw();
  }
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- speed and height of the last shot
function tabSpeed(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'The last shot, frame by frame. Without air, the horizontal speed would stay constant and the speed would be lowest at the top. Air slows the ball all the way.' }));
  const box = canvasBox('', '16 / 9', 'Speed against time');
  const plot = new Plot(box.canvas, { xlabel: 'Time (s)', ylabel: 'Speed (m/s)' });
  const box2 = canvasBox('', '16 / 9', 'Height against time');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Time (s)', ylabel: 'Height (m)' });
  const need = note('This needs the <b>radar gun</b> (speeds) or the <b>high-speed camera</b> (speeds and heights) in the “Measure with” slot. Both are in the cabinet on this floor.');
  pane.append(el('div', { class: 'vp-main' }, need, box, box2));
  function draw() {
    const tool = current(bench, 'tool'), sh = bench._last;
    need.hidden = tool !== 'tape';
    box.hidden = tool === 'tape'; box2.hidden = tool !== 'camera';
    if (!sh || tool === 'tape') return;
    const t = sh.pts.map((q) => q[0]), v = sh.pts.map((q) => Math.hypot(q[3], q[4])), vx = sh.pts.map((q) => q[3]), y = sh.pts.map((q) => q[2]);
    plot.setSeries([{ x: t, y: v, color: COLORS.signal, width: 2.2, label: 'speed' }, { x: t, y: vx, color: COLORS.gold, width: 1.8, dash: [5, 4], label: 'horizontal part' }]).draw();
    if (tool === 'camera') plot2.setSeries([{ x: t, y, color: COLORS.violet, width: 2.2 }]).draw();
  }
  bench._speedTab = draw;
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

bench.tabs = [
  { id: 'range', label: 'Range', build: tabRange },
  { id: 'angles', label: 'Every angle', build: tabAngles },
  { id: 'speed', label: 'Speed and height', build: tabSpeed },
];

export default bench;
