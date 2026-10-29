// 1F · Launcher. Projectiles with real air: drag that grows with the square of the speed, and
// lift from backspin (the Magnus effect). Fire balls of different kinds, measure where they
// land, how high they go and how fast they move, and try to land one in the basket.

import { el, slider, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { tr, trf } from '../i18n.js';

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
    runs.push({ xs, ys, label: trf('{0} at {1} m/s', tr(ITEMS[p.id].name), S.v0.toFixed(1)) + (p.vac ? tr(' (vacuum)') : '') + (p.spin ? tr(', backspin') : '') });
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

// ---------------------------------------------------------------- the hands-on stage
const BALL_LOOK = {
  'ball-steel': { mat: 'chrome', name: 'steel ball' },
  'ball-tennis': { mat: 'tennis', pattern: K.PATTERN.tennis, name: 'tennis ball' },
  'ball-golf': { mat: 'white', pattern: K.PATTERN.golf, name: 'golf ball' },
  'ball-pingpong': { mat: 'white', pattern: K.PATTERN.pingpong, name: 'ping-pong ball' },
  'shuttle': { shuttle: true, name: 'shuttlecock' },
};
function paramsOf(ballId, vac, spin) {
  const b = ITEMS[ballId].phys;
  const A = Math.PI * (b.d / 2) ** 2, rho = vac ? 0 : RHO;
  return { id: ballId, m: b.m, r: b.d / 2, kd: 0.5 * rho * b.Cd * A / b.m, kl: spin ? 0.5 * rho * (CL_BACKSPIN[ballId] || 0) * A / b.m : 0, vac, spin };
}
// state at time t along a sampled path
function along(pts, t) {
  let i = 1; while (i < pts.length - 1 && pts[i][0] < t) i++;
  const a = pts[i - 1], b = pts[i], f = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 1;
  return a.map((v, k) => v + (b[k] - v) * f);
}

function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'hoo', label: 'A launcher at one end of the hall and a basket further down. Pull back from the launcher to aim, and let go to fire.',
    hello: 'Pull back from the launcher like a slingshot: the farther you pull, the faster it fires. **Let go** to shoot, and try to land the ball in the basket.',
    aspect: 16 / 7.4,
    onReset: () => { shots.length = 0; flying.length = 0; ghostOn = false; st.setSpeed(1); st.setPaused(false); },
    keys: {
      arrow(dx, dy) { aim.ang = Math.max(0, Math.min(85, aim.ang - dy * 1)); aim.v0 = Math.max(2, Math.min(30, aim.v0 + dx * 0.5)); syncInputs(); },
      action() { fire(); },
    },
  });
  st.tool('speed', 'Speed', { icon: K.COL.vel }).tool('forces', 'Forces', { icon: K.COL.gravity }).tool('snaps', 'Snapshots', { icon: K.COL.net })
    .tool('ghost', 'Path without air', { icon: K.COL.spe }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('launch', 'Launch').readout('range', 'Landed at').readout('time', 'Time in the air').readout('top', 'Highest point');
  const graph = st.liveGraph({ series: [{ id: 'vx', label: 'sideways speed (m/s)', color: '#D9822B' }, { id: 'vy', label: 'upward speed (m/s)', color: K.COL.vel }], window: 4, ylabel: 'm/s' });

  const aim = { v0: 12, ang: 40, h0: 0.3 };
  const shots = [];        // finished paths, newest last
  const flying = [];       // balls in the air: { pts, t, p, label, color, landed, bounce }
  let target = { x: 14, rimH: 0.8, rimR: 0.23 };
  let view = { x1: 18, y1: 6, tx1: 18, ty1: 6 };
  let ghostOn = false, pending = null, drop = null, firstAim = true, demo = false;
  let Lay = { w: 800, h: 420, fy: 360, left: 70, s: 40 };

  const vIn = el('input', { type: 'range', min: 2, max: 30, step: 0.1, value: aim.v0, 'aria-label': 'Launch speed in metres per second' });
  const aIn = el('input', { type: 'range', min: 0, max: 85, step: 0.5, value: aim.ang, 'aria-label': 'Launch angle in degrees' });
  const vLab = el('span'), aLab = el('span');
  vIn.addEventListener('input', () => { aim.v0 = +vIn.value; syncInputs(); });
  aIn.addEventListener('input', () => { aim.ang = +aIn.value; syncInputs(); });
  function syncInputs() { vIn.value = aim.v0; aIn.value = aim.ang; vLab.textContent = `Speed ${aim.v0.toFixed(1)} m/s`; aLab.textContent = `Angle ${aim.ang.toFixed(1)}°`; }
  syncInputs();
  const fireBtn = el('button', { type: 'button', class: 'stg-act', text: 'Fire!' });
  const moveBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Move the basket' });
  fireBtn.addEventListener('click', () => fire());
  moveBtn.addEventListener('click', () => { newBasket(); sound.play('pop'); });
  st.controls(el('label', { class: 'stg-range' }, vLab, vIn), el('label', { class: 'stg-range' }, aLab, aIn), el('div', { class: 'stg-row' }, fireBtn, moveBtn));

  function newBasket() { target.x = Math.round((6 + Math.random() * 16) * 10) / 10; }
  newBasket();
  const cur = () => paramsOf(current(bench, 'ball'), current(bench, 'air') === 'vactube', current(bench, 'spin') === 'spin-back');

  function launch(p, v0, ang, h0, { label = '', color = null, x0 = 0, noRecord = false } = {}) {
    const pts = fly(p, v0, ang, h0, 0.002, 5).map((q) => [q[0], q[1] + x0, q[2], q[3], q[4]]);
    let hmax = 0; for (const q of pts) hmax = Math.max(hmax, q[2]);
    const xHit = noRecord ? null : crossingDown(pts.map((q) => [q[0], q[1], q[2], q[3], q[4]]), target.rimH);
    const hit = xHit !== null && Math.abs(xHit - target.x) <= target.rimR - p.r && pts[pts.length - 1][1] > target.x - 0.5;
    const last = pts[pts.length - 1];
    const b = { pts, t: 0, p, label, color, hit, range: last[1], tf: last[0], hmax, v0, ang, landed: false, roll: null, noRecord, snaps: [] };
    flying.push(b);
    // make room for it
    view.tx1 = Math.max(view.tx1, Math.min(70, Math.max(last[1] + 2, demo ? 0 : target.x + 3)));
    view.ty1 = Math.max(view.ty1, Math.min(45, hmax * 1.25 + 1));
    return b;
  }
  function fire() {
    const p = cur();
    const b = launch(p, aim.v0, aim.ang, aim.h0);
    sound.play('whoosh', { vol: 0.7 }); sound.play('pop');
    firstAim = false; st.hint(null);
    graph.clear();
    return b;
  }
  function land(b) {
    b.landed = true;
    sound.play('thud', { vol: Math.min(1, Math.hypot(b.pts[b.pts.length - 1][3], b.pts[b.pts.length - 1][4]) / 15) });
    // a couple of bounces, then it rolls to a stop
    const L = b.pts[b.pts.length - 1];
    b.roll = { x: L[1], y: 0, vx: L[3] * 0.55, vy: -L[4] * 0.42, t: 0 };
    if (b.noRecord) return;
    shots.push(b); if (shots.length > 6) shots.shift();
    rig.note({ bench: 'launcher', hit: b.hit, ball: b.p.id, range: b.range, v0: b.v0, ang: b.ang });
    if (b.hit) {
      sound.play('clack'); setTimeout(() => sound.play('chime'), 120);
      st.flash('In the basket!');
      const [sx, sy] = toS(target.x, target.rimH); st.confetti(sx, sy, 50);
    }
  }

  // ---------- physics
  st.onStep((dt) => {
    for (const b of flying) {
      if (!b.landed) {
        b.t += dt;
        if (st.on('snaps')) { b.snapT = (b.snapT || 0) + dt; if (b.snapT >= 0.1 || !b.snaps.length) { b.snapT = 0; const q = along(b.pts, Math.min(b.t, b.tf)); b.snaps.push([q[1], q[2]]); } }
        if (b.t >= b.tf) { b.t = b.tf; land(b); }
        else if (dt > 0 && b === flying[flying.length - 1]) { const q = along(b.pts, b.t); graph.push(b.t, { vx: q[3], vy: q[4] }); }
      } else if (b.roll) {
        const r = b.roll; r.t += dt;
        if (r.y > 0 || r.vy > 0) { r.vy -= G * dt; r.y += r.vy * dt; r.x += r.vx * dt; if (r.y <= 0) { r.y = 0; if (Math.abs(r.vy) > 0.8) { r.vy = -r.vy * 0.42; r.vx *= 0.8; sound.play('thud', { vol: 0.25 }); } else r.vy = 0; } }
        else { r.vx *= Math.exp(-2.2 * dt); r.x += r.vx * dt; if (Math.abs(r.vx) < 0.05) b.roll = null; }
      }
    }
    // fade out old balls
    while (flying.length > 8) flying.shift();
    if (drop) { drop.t += dt; }
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
    // ease the view
    view.x1 += (view.tx1 - view.x1) * Math.min(1, dt * 4 + 0.02);
    view.y1 += (view.ty1 - view.y1) * Math.min(1, dt * 4 + 0.02);
  });

  // ---------- layout
  st.onResize((w, h, narrow) => { Lay.w = w; Lay.h = h; Lay.narrow = narrow; });
  function fit() {
    const w = Lay.w, h = Lay.h;
    const fy = Math.round(h * 0.84), left = narrow() ? 40 : 66, top = 46;
    const s = Math.min((w - left - 24) / (view.x1 + 0.6), (fy - top) / Math.max(2.5, view.y1));
    Lay.fy = fy; Lay.left = left; Lay.s = s;
  }
  const narrow = () => Lay.w < 560;
  const toS = (x, y) => [Lay.left + x * Lay.s, Lay.fy - y * Lay.s];

  // ---------- drawing
  function drawHall(g, w, h) {
    K.room(g, w, h, K.THEME[1], { floorH: 0.16, panels: true });
    // windows along the hall
    for (let i = 0; i < 4; i++) {
      const ww = Math.min(150, w * 0.13), x = w * (0.18 + i * 0.22), y = 26;
      K.box(g, x - 4, y - 4, ww + 8, ww * 0.55 + 8, K.MAT.cream, { r: 6, lw: 2 });
      const gr = g.createLinearGradient(0, y, 0, y + ww * 0.55); gr.addColorStop(0, '#8FD3FF'); gr.addColorStop(1, '#D9F4FF');
      g.fillStyle = gr; g.fillRect(x, y, ww, ww * 0.55);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(x + ww * (0.3 + 0.2 * (i % 2)), y + ww * 0.18, 18, 6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7FA6DA'; for (let k = 0; k < ww; k += 8) { const hh = 6 + ((k * 7 + i * 13) % 14); g.fillRect(x + k, y + ww * 0.55 - hh, 7, hh); }
      g.strokeStyle = K.LINE; g.lineWidth = 2; g.strokeRect(x, y, ww, ww * 0.55);
      g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + ww * 0.55); g.stroke();
    }
  }

  function drawFloorMarks(g) {
    const step = view.x1 > 40 ? 10 : view.x1 > 20 ? 5 : view.x1 > 10 ? 2 : 1;
    g.save();
    for (let m = 0; m <= view.x1 + 1; m += step / (step >= 5 ? 5 : 1)) {
      const [x] = toS(m, 0), major = Math.abs(m / step - Math.round(m / step)) < 1e-6;
      g.fillStyle = major ? '#8E5A35' : 'rgba(142,90,53,0.5)';
      g.fillRect(x - 1, Lay.fy + 2, 2, major ? 9 : 5);
      if (major) K.text(g, `${m} m`, x, Lay.fy + 24, { size: 11, weight: 600, align: 'center', color: '#7A4A26' });
    }
    g.restore();
  }

  function drawLauncher(g, hover) {
    const [x, y] = toS(0, aim.h0), a = aim.ang * Math.PI / 180;
    // stand
    K.box(g, x - 22, y + 6, 44, Lay.fy - y - 4, K.MAT.navy, { r: 5 });
    K.box(g, x - 34, Lay.fy - 10, 68, 12, K.MAT.steel, { r: 4 });
    // barrel
    g.save(); g.translate(x, y); g.rotate(-a);
    K.box(g, -14, -11, 62, 22, ['#3FC1D9', '#BFEFFF', '#1F7FA0'], { r: 7 });
    K.box(g, 44, -13, 10, 26, K.MAT.navy, { r: 3 });
    g.restore();
    K.ball(g, x, y, 10, 'steel');
    if (hover) K.glow(g, x, y, 60, '#00D4FF', 0.3);
    return [x, y];
  }

  function drawBasket(g) {
    const [bx, by] = toS(target.x, target.rimH), r = Math.max(10, target.rimR * Lay.s), [, y0] = toS(0, 0);
    K.rod(g, bx + r + 6, by - 30, bx + r + 6, y0, 7, K.MAT.steel);
    K.box(g, bx + r + 2, by - 50, 10, 46, K.MAT.white, { r: 2 });
    K.shadow(g, bx + r + 6, y0 + 4, 20, 5);
    // net
    g.save(); g.strokeStyle = 'rgba(255,253,246,0.95)'; g.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(bx + i * r / 3, by); g.lineTo(bx + i * r / 5, by + r * 1.2); g.stroke(); }
    for (let j = 1; j <= 2; j++) { g.beginPath(); g.moveTo(bx - r * (1 - j * 0.2), by + j * r * 0.4); g.lineTo(bx + r * (1 - j * 0.2), by + j * r * 0.4); g.stroke(); }
    g.restore();
    K.lineSeg(g, bx - r, by, bx + r, by, '#E5534B', 4.5);
    K.tag(g, `${target.x.toFixed(1)} m`, bx, by - 64, { size: 11.5 });
  }

  function drawBall(g, b, x, y, vx, vy, alpha = 1) {
    const look = BALL_LOOK[b.p.id] || BALL_LOOK['ball-tennis'];
    const r = Math.max(6, Math.min(14, b.p.r * Lay.s * 1.6));
    g.save(); g.globalAlpha = alpha;
    if (look.shuttle) {
      // a shuttlecock flies cork first
      const a = Math.atan2(-vy, vx);
      g.translate(x, y); g.rotate(a);
      g.beginPath(); g.moveTo(-2, -3); g.lineTo(-r * 2.2, -r); g.lineTo(-r * 2.2, r); g.lineTo(-2, 3); g.closePath();
      g.fillStyle = '#FFFDF6'; g.fill(); g.lineWidth = 1.6; g.strokeStyle = K.LINE; g.stroke();
      g.strokeStyle = '#C7DAEA'; g.lineWidth = 1; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(-3, 0); g.lineTo(-r * 2.2, k * r / 2.5); g.stroke(); }
      K.ball(g, 0, 0, r * 0.55, 'cream', { lw: 1.6 });
    } else K.ball(g, x, y, r, look.mat, { pattern: look.pattern, spin: b.t * 8 });
    g.restore();
    return r;
  }

  function pathOf(g, pts, t, color, lw = 2.5, dash = null, alpha = 1) {
    g.save(); g.globalAlpha = alpha; g.beginPath();
    let first = true;
    for (const q of pts) { if (q[0] > t) break; const [x, y] = toS(q[1], q[2]); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); }
    const e = along(pts, t); const [ex, ey] = toS(e[1], e[2]); g.lineTo(ex, ey);
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; if (dash) g.setLineDash(dash); g.stroke(); g.restore();
  }

  st.onDraw((g, w, h) => {
    fit();
    st.cache('bg', `${w}x${h}`, drawHall);
    // the floor and its markings follow the zoom
    drawFloorMarks(g);
    if (current(bench, 'air') === 'vactube') {
      const [x0, y0] = toS(-0.3, Math.max(view.y1, 2)), [x1] = toS(view.x1 + 0.5, 0);
      g.save(); g.fillStyle = 'rgba(191,239,255,0.22)'; g.fillRect(x0, y0, x1 - x0, Lay.fy - y0); g.strokeStyle = 'rgba(0,115,158,0.5)'; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, Lay.fy - y0); g.restore();
      K.tag(g, 'vacuum tunnel: no air inside', x0 + 110, y0 + 16, { size: 11.5, bg: '#EAF6FC' });
    }
    if (!demo) drawBasket(g);
    // older shots
    shots.forEach((b, i) => { if (!flying.includes(b) || b.landed) pathOf(g, b.pts, b.tf, b.hit ? '#22B07A' : K.hexA(K.LINE, 0.25), 2, null, 0.4 + 0.6 * (i + 1) / shots.length); });
    // the aim, while you pull
    const [lx, ly] = drawLauncher(g, st.hovering('aim'));
    if (st.isDragging('aim') || firstAim) {
      const a = aim.ang * Math.PI / 180, len = 30 + aim.v0 * 4.2;
      K.arrow(g, lx, ly, lx + Math.cos(a) * len, ly - Math.sin(a) * len, K.COL.vel, { label: `${aim.v0.toFixed(1)} m/s at ${aim.ang.toFixed(0)}°`, lw: 5 });
      if (st.isDragging('aim')) K.angleArc(g, lx, ly, 46, 0, -a, K.COL.net);
    }
    if (st.on('ghost')) {
      const vp = fly({ kd: 0, kl: 0 }, aim.v0, aim.ang, aim.h0, 0.004, 4);
      pathOf(g, vp, 1e9, K.COL.spe, 2.5, [7, 6], 0.8);
    }
    // the falling toy for the "aim at it" challenge
    if (drop) {
      const y = drop.going ? Math.max(0, drop.y0 - 0.5 * G * drop.t * drop.t) : drop.y0;
      const [dx, dy] = toS(drop.x, y);
      K.ball(g, dx, dy, 12, 'pink');
      K.text(g, '•ᴗ•', dx, dy + 4, { size: 10, weight: 700, align: 'center', color: K.LINE });
      if (!drop.going) { K.lineSeg(g, dx, dy - 12, dx, 0, K.hexA(K.LINE, 0.6), 1.5); const [lx, ly] = toS(0, aim.h0); K.lineSeg(g, lx, ly, dx, dy, K.hexA(K.COL.gravity, 0.5), 2, [6, 6]); }
    }
    for (const b of flying) {
      const now = along(b.pts, Math.min(b.t, b.tf));
      if (!b.landed) pathOf(g, b.pts, b.t, b.color || K.hexA('#00739E', 0.85), 2.5);
      if (st.on('snaps') && b.snaps.length) for (const [sx, sy] of b.snaps) { const [x, y] = toS(sx, sy); g.fillStyle = K.hexA(K.COL.net, 0.75); g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); g.strokeStyle = K.LINE; g.lineWidth = 1; g.stroke(); }
      let x, y, vx = now[3], vy = now[4];
      if (b.landed) { const r = b.roll || b.rest || { x: b.range, y: 0 }; if (b.roll) b.rest = { x: b.roll.x, y: b.roll.y }; [x, y] = toS(r.x, r.y); vx = b.roll ? b.roll.vx : 0; vy = 0; }
      else [x, y] = toS(now[1], now[2]);
      const r = drawBall(g, b, x, y - (b.landed ? Math.max(6, Math.min(14, b.p.r * Lay.s * 1.6)) - 2 : 0), vx, vy);
      if (!b.landed) {
        if (st.on('speed')) {
          const k = 4.2;
          K.arrow(g, x, y, x + vx * k, y, '#D9822B', { lw: 3.5, label: Math.abs(vx) > 2 ? `${Math.abs(vx).toFixed(1)}` : null, size: 11 });
          K.arrow(g, x, y, x, y - vy * k, K.COL.vel, { lw: 3.5, label: Math.abs(vy) > 2 ? `${Math.abs(vy).toFixed(1)}` : null, size: 11 });
        }
        if (st.on('forces')) {
          const F = 52;
          K.arrow(g, x, y, x, y + F, K.COL.gravity, { label: 'gravity', size: 11 });
          const v = Math.hypot(vx, vy) || 1, fd = b.p.kd * v * v / G * F, fl = b.p.kl * v * v / G * F;
          if (fd > 3) K.arrow(g, x, y, x - vx / v * fd, y + vy / v * fd, K.COL.drag, { label: 'air drag', size: 11 });
          if (fl > 3) K.arrow(g, x, y, x - vy / v * fl, y - vx / v * fl, K.COL.mag, { label: 'lift', size: 11 });
        }
      }
      if (b.label) K.tag(g, b.label, x, y - r - 16, { size: 11.5, bg: '#FFFDF6' });
      if (b.landed && !b.noRecord) { const [mx] = toS(b.range, 0); g.fillStyle = '#E0457B'; g.fillRect(mx - 1.5, Lay.fy - 6, 3, 12); }
    }
    // the tape measure along the floor to the last landing
    const last = shots[shots.length - 1], tool = current(bench, 'tool');
    if (last && tool === 'tape') {
      const [x0] = toS(0, 0), [x1] = toS(last.range, 0);
      g.save(); g.fillStyle = '#FFD54F'; g.fillRect(x0, Lay.fy - 4, x1 - x0, 6); g.strokeStyle = K.LINE; g.lineWidth = 1.2; g.strokeRect(x0, Lay.fy - 4, x1 - x0, 6); g.restore();
      K.tag(g, `${last.range.toFixed(2)} m`, x1, Lay.fy - 18, { size: 11.5, bg: '#FFE07A' });
    }
    if (tool === 'radar') {
      const b = flying[flying.length - 1];
      const v = b && !b.landed ? Math.hypot(...along(b.pts, b.t).slice(3)) : null;
      K.lcd(g, Lay.w - 130, 54, 110, 40, v ? `${v.toFixed(1)} m/s` : '-- m/s', { label: 'radar gun', size: 17 });
    }
  });
  st.onOver(() => {
    const b = shots[shots.length - 1], tool = current(bench, 'tool');
    st.set('launch', `${aim.v0.toFixed(1)} m/s at ${aim.ang.toFixed(0)}°`);
    st.set('range', b ? `${b.range.toFixed(2)} m` : '–');
    st.set('time', b ? (tool === 'camera' || tool === 'radar' ? `${b.tf.toFixed(2)} s` : `≈ ${b.tf.toFixed(1)} s`) : '–');
    st.set('top', b ? (tool === 'camera' ? `${b.hmax.toFixed(2)} m` : `≈ ${b.hmax.toFixed(1)} m`) : '–');
    graph.draw();
  });

  // ---------- pull back to aim
  st.handle({
    id: 'aim', cursor: 'grab',
    enabled: () => !pending,
    hit: (x, y) => { const [lx, ly] = toS(0, aim.h0); const d = Math.hypot(x - lx, y - ly); return d < 80 ? d : false; },
    down: () => { firstAim = false; st.hint(null); },
    move: (x, y) => {
      const [lx, ly] = toS(0, aim.h0);
      const dx = lx - x, dy = y - ly;               // pulling back and down aims forward and up
      const pull = Math.hypot(dx, dy);
      if (pull < 8) return;
      aim.ang = Math.max(0, Math.min(85, Math.atan2(dy, Math.max(0.01, dx)) * 180 / Math.PI));
      aim.v0 = Math.max(2, Math.min(30, 2 + (pull - 8) / 5.5));
      syncInputs();
    },
    up: () => fire(),
  });
  st.hint('Pull back from the launcher, then let go', { sticky: true });

  // ---------- why does it curve?
  const shootAs = (ball, v0, ang, vac, opts = {}) => launch(paramsOf(ball, vac, opts.spin || false), v0, ang, opts.h0 ?? aim.h0, opts);
  st.tour({
    title: 'Why does it curve?',
    steps: [
      { say: 'Start without air. Watch the **sideways speed** (orange): it never changes. The snapshots are taken every 0.1 s, and they are **evenly spaced** left to right.', tools: { speed: true, snaps: true, forces: false, ghost: false }, enter: (s) => { flying.length = 0; shots.length = 0; view.tx1 = 18; view.ty1 = 6; s.setSpeed(0.25); shootAs('ball-steel', 12, 50, true, { noRecord: true }); } },
      { say: 'The **upward speed** (green) shrinks by 9.8 m/s every second, until it turns into falling. Gravity only pulls down, so only the up-and-down speed changes.', tools: { forces: true }, enter: (s) => { flying.length = 0; s.setSpeed(0.25); shootAs('ball-steel', 12, 50, true, { noRecord: true }); } },
      { say: 'Steady sideways plus faster and faster down makes a **parabola**. In a vacuum, 45° goes farthest, and 30° and 60° land at the same spot.', tools: { speed: false, forces: false, snaps: false }, enter: (s) => { flying.length = 0; s.setSpeed(1); for (const [a, c] of [[30, '#3D7FD6'], [45, '#22B07A'], [60, '#E0457B']]) shootAs('ball-steel', 12, a, true, { label: a + '°', color: c, noRecord: true }); } },
      { say: 'Now with air. **Drag** pushes against the motion and grows with the speed squared. The ball comes down shorter and steeper than the path without air (dashed).', tools: { forces: true, ghost: true }, enter: (s) => { flying.length = 0; s.setSpeed(0.5); aim.v0 = 18; aim.ang = 40; syncInputs(); shootAs('ball-tennis', 18, 40, false, { noRecord: true }); } },
      { say: 'Light, big things feel the air most. A **shuttlecock** stops almost at once and drops nearly straight down. A **golf ball** with backspin gets **lift** from the air and sails further.', tools: { forces: true, ghost: false }, enter: (s) => { flying.length = 0; s.setSpeed(1); shootAs('shuttle', 18, 40, false, { label: 'shuttlecock', noRecord: true }); shootAs('ball-golf', 18, 40, false, { label: 'golf, backspin', spin: true, color: '#22B07A', noRecord: true }); } },
    ],
    onEnd: () => { flying.length = 0; demo = false; view.tx1 = Math.max(18, target.x + 3); view.ty1 = 6; },
  });
  const tourStart = st.startTour.bind(st);
  st.startTour = () => { demo = true; shots.length = 0; tourStart(); };

  // ---------- predict, watch, explain
  const until = (cond, then) => { pending = { until: cond, then }; };
  const allDown = () => flying.length > 0 && flying.every((b) => b.landed);
  const after = (s) => { pending = null; drop = null; demo = false; flying.length = 0; view.tx1 = Math.max(18, target.x + 3); view.ty1 = 6; if (s) { s.setPaused(false); s.setSpeed(1); } };
  const askC = st.askChallenge.bind(st);
  st.askChallenge = (c) => { demo = true; shots.length = 0; askC(c); };
  const homeC = st._home.bind(st);
  st._home = () => { if (st.mode === 'list' || st.mode === 'ask') { demo = false; drop = null; } homeC(); };
  st.setChallenges([
    {
      id: 'angle', title: 'The farthest angle', card: 'launcher.angle45', lock: true, after,
      q: 'In a vacuum, at the same speed: which angle lands farthest?', choices: ['30°', '45°', '60°'], answer: 1,
      run: (s, finish) => { flying.length = 0; view.tx1 = 18; view.ty1 = 6; s.setSpeed(1); for (const [a, c] of [[30, '#3D7FD6'], [45, '#22B07A'], [60, '#E0457B']]) shootAs('ball-steel', 12, a, true, { label: a + '°', color: c, noRecord: true }); until(allDown, () => finish(`30°: ${flying[0].range.toFixed(1)} m, 45°: ${flying[1].range.toFixed(1)} m, 60°: ${flying[2].range.toFixed(1)} m.`)); },
      skip: () => flying.forEach((b) => { b.t = b.tf; }),
      explain: 'Low shots move fast sideways but come down too soon; high shots stay up long but move slowly sideways. 45° balls the two best. 30° and 60° land at the same spot.',
    },
    {
      id: 'drop', title: 'Drop or throw', card: 'launcher.droptime', lock: true, after,
      q: 'From 2 m up, in a vacuum: one ball is simply dropped, the other is fired sideways at 10 m/s, at the same moment. Which hits the floor first?', choices: ['The dropped one', 'The fired one', 'They land together'], answer: 2,
      run: (s, finish) => { flying.length = 0; view.tx1 = 10; view.ty1 = 3; s.setSpeed(0.25); shootAs('ball-steel', 0.001, 0, true, { h0: 2, label: 'dropped', color: '#E0457B', noRecord: true }); shootAs('ball-steel', 10, 0, true, { h0: 2, label: 'fired', color: '#3D7FD6', noRecord: true }); until(allDown, () => finish(`Both took ${flying[0].tf.toFixed(2)} s.`)); },
      skip: () => flying.forEach((b) => { b.t = b.tf; }),
      explain: 'Sideways speed does nothing to the falling. Both start with no downward speed, and gravity adds the same downward speed to each, second by second.',
    },
    {
      id: 'air', title: 'Best angle in air', card: 'launcher.airangle', lock: true, after,
      q: 'A tennis ball at 20 m/s, in ordinary air. Which angle goes farthest?', choices: ['35°', '45°', '55°'], answer: 0,
      run: (s, finish) => { flying.length = 0; view.tx1 = 30; view.ty1 = 9; s.setSpeed(1); for (const [a, c] of [[35, '#3D7FD6'], [45, '#22B07A'], [55, '#E0457B']]) shootAs('ball-tennis', 20, a, false, { label: a + '°', color: c, noRecord: true }); until(allDown, () => finish(`35°: ${flying[0].range.toFixed(1)} m, 45°: ${flying[1].range.toFixed(1)} m, 55°: ${flying[2].range.toFixed(1)} m.`)); },
      skip: () => flying.forEach((b) => { b.t = b.tf; }),
      explain: 'Air drag eats speed the whole flight, and a high shot spends longer in the air losing it. So in air the best angle is below 45°, and lower still for light balls.',
    },
    {
      id: 'monkey', title: 'Aim at a falling toy', card: 'launcher.monkey', lock: true, after,
      q: 'A toy hangs 3 m up and 8 m away. The moment you fire (in a vacuum), it drops. Where should you aim?', choices: ['Straight at it', 'Above it', 'Below it'], answer: 0,
      run: (s, finish) => {
        flying.length = 0; view.tx1 = 10; view.ty1 = 4; s.setSpeed(0.25);
        const ang = Math.atan2(3 - aim.h0, 8) * 180 / Math.PI;
        drop = { x: 8, y0: 3, t: 0, going: false };
        aim.ang = ang; aim.v0 = 14; syncInputs();
        let b = null;
        setTimeout(() => { drop.going = true; drop.t = 0; b = shootAs('ball-steel', 14, ang, true, { label: 'aimed straight at it', noRecord: true }); sound.play('whoosh'); }, 900);
        until(() => b && b.t >= 8 / (14 * Math.cos(ang * Math.PI / 180)), () => { s.setPaused(true); s.flash('Hit!'); sound.play('clack'); finish('The ball meets the toy on the way down.'); });
      },
      explain: 'Both fall the same way: each drops ½gt² below where it would have been without gravity. So a shot aimed straight at the toy is still lined up with it when they meet.',
    },
  ]);

  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'range', label: 'Measure', build: tabRange },
  { id: 'angles', label: 'Every angle', build: tabAngles },
  { id: 'speed', label: 'Speed and height', build: tabSpeed },
];

export default bench;
