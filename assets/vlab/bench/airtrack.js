// 1F · Air track. Two gliders on a cushion of air, so almost nothing slows them down. Choose
// the bumpers (springy, sticky, squishy, or magnets that never touch), the masses and the
// speeds, and check what is conserved: momentum always, kinetic energy only sometimes.

import { el, slider, button, group, readout, canvasBox, note, checkbox, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas, gauss } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

const TRACK = 2.0, HALF = 0.10, GATE1 = 0.62, GATE2 = 1.72;

const bench = {
  id: 'airtrack', title: 'Air track', kicker: '1F · Classics Hall', icon: '⇄', floor: 1,
  blurb: 'Collisions: momentum and energy.',
  slots: [
    { id: 'bumper', label: 'Bumpers', options: ['bump-spring', 'bump-velcro', 'bump-clay', 'bump-magnet'], def: 'bump-spring' },
    { id: 'timing', label: 'Measure with', options: ['stopwatch', 'photogate', 'camera'], def: 'stopwatch' },
  ],
};
bench.header = rigStrip(bench);

const S = { mA: 0.2, mB: 0.2, vA: 0.6, vB: 0, air: true, run: null, slow: 1 };

function newRun() {
  const bump = phys(bench, 'bumper');
  return {
    bump: bump.id, e: bump.e, magnet: !!bump.magnet,
    xA: 0.25, xB: 1.15, vA: S.vA, vB: S.vB, mA: S.mA, mB: S.mB, t: 0,
    stuck: false, contact: false, touched: false, after: null, before: { vA: S.vA, vB: S.vB }, trace: [], done: false, mu: S.air ? 0.0006 : 0.15,
  };
}

// one small time step of the two gliders
function step(r, dt) {
  const g = 9.81;
  let FA = 0, FB = 0;
  const gap = (r.xB - HALF) - (r.xA + HALF);
  const mu = r.mA * r.mB / (r.mA + r.mB);
  if (r.stuck) {
    const v = (r.mA * r.vA + r.mB * r.vB) / (r.mA + r.mB); r.vA = r.vB = v;
  } else if (r.magnet) {
    const C = 2.0e-4, F = gap < 0.15 ? C / ((Math.max(gap, -0.001) + 0.003) ** 2) - C / (0.153 ** 2) : 0;
    FA -= F; FB += F;
    if (gap < 0.03) r.contact = true; else if (r.contact) { r.contact = false; if (!r.after) r.after = { vA: r.vA, vB: r.vB, t: r.t }; }
  } else if (gap < 0) {
    if (r.e === 0) { r.stuck = true; r.touched = true; const v = (r.mA * r.vA + r.mB * r.vB) / (r.mA + r.mB); r.vA = r.vB = v; r.after = { vA: v, vB: v, t: r.t }; }
    else {
      // a spring with a dashpot, tuned to give the bumper's restitution
      const k = 600, lnE = Math.log(r.e), zeta = -lnE / Math.sqrt(Math.PI ** 2 + lnE ** 2), c = 2 * zeta * Math.sqrt(k * mu);
      const F = Math.max(0, -k * gap - c * (r.vB - r.vA));
      FA -= F; FB += F; r.contact = true; r.touched = true;
    }
  } else if (r.contact) { r.contact = false; if (!r.after) r.after = { vA: r.vA, vB: r.vB, t: r.t }; }
  // friction (tiny on air)
  const fr = (v, m) => (Math.abs(v) < 1e-4 ? 0 : -Math.sign(v) * r.mu * m * g);
  const aA = (FA + fr(r.vA, r.mA)) / r.mA, aB = (FB + fr(r.vB, r.mB)) / r.mB;
  const nvA = r.vA + aA * dt, nvB = r.vB + aB * dt;
  r.vA = Math.sign(nvA) !== Math.sign(r.vA) && Math.abs(FA) < 1e-9 ? 0 : nvA;
  r.vB = Math.sign(nvB) !== Math.sign(r.vB) && Math.abs(FB) < 1e-9 ? 0 : nvB;
  if (r.stuck) { const v = (r.mA * r.vA + r.mB * r.vB) / (r.mA + r.mB); r.vA = r.vB = v; }
  r.xA += r.vA * dt; r.xB += r.vB * dt; r.t += dt;
  // end stops bounce the gliders back
  if (r.xA - HALF < 0) { r.xA = HALF; r.vA = Math.abs(r.vA) * 0.85; }
  if (r.xB + HALF > TRACK) { r.xB = TRACK - HALF; r.vB = -Math.abs(r.vB) * 0.85; }
  if (r.stuck && r.xB + HALF >= TRACK - 1e-6) { r.vA = r.vB; }
}

function measured(v, tool) {
  if (tool === 'stopwatch') return v * (1 + 0.06 * gauss());
  if (tool === 'photogate') return Math.round(v * 1000) / 1000;
  return Math.round(v * 10000) / 10000;
}

const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'bump', label: 'Bumpers', fmt: (v) => ITEMS[v].name },
  { key: 'mA', label: 'm_A (g)', fmt: (v) => (v * 1000).toFixed(0) },
  { key: 'mB', label: 'm_B (g)', fmt: (v) => (v * 1000).toFixed(0) },
  { key: 'vA', label: 'v_A', fmt: (v) => v.toFixed(3) },
  { key: 'vB', label: 'v_B', fmt: (v) => v.toFixed(3) },
  { key: 'vA2', label: 'v_A after', fmt: (v) => v.toFixed(3) },
  { key: 'vB2', label: 'v_B after', fmt: (v) => v.toFixed(3) },
  { key: 'p', label: 'p before → after (kg m/s)', fmt: (v, r) => `${r.p1.toFixed(4)} → ${r.p2.toFixed(4)}` },
  { key: 'ke', label: 'KE kept', fmt: (v) => `${(v * 100).toFixed(1)}%` },
], { caption: 'Your collisions (speeds in m/s, right is positive)' });
let nRun = 0;

function tabTrack(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Glider A is pushed towards glider B. Choose the masses, the speeds and the bumpers, then let go. The table checks momentum (always kept) and kinetic energy (kept only by bouncy bumpers).' }));
  const box = canvasBox('', '16 / 6', 'The air track seen from the side');
  const masses = [0.1, 0.2, 0.3, 0.4].map((m) => ({ value: m, label: `${m * 1000} g` }));
  const mA = segmented({ label: 'Mass of glider A', options: masses, value: S.mA, onChange: (v) => { S.mA = +v; draw(); } });
  const mB = segmented({ label: 'Mass of glider B', options: masses, value: S.mB, onChange: (v) => { S.mB = +v; draw(); } });
  const vA = slider({ label: 'Push on A (speed)', unit: 'm/s', min: 0.05, max: 1.5, step: 0.01, value: S.vA, digits: 3, onInput: (v) => { S.vA = v; } });
  const vB = slider({ label: 'Speed of B (negative: towards A)', unit: 'm/s', min: -1, max: 1, step: 0.01, value: S.vB, digits: 3, onInput: (v) => { S.vB = v; } });
  const air = checkbox({ label: 'Blower on (air cushion)', checked: S.air, onChange: (v) => { S.air = v; } });
  const slow = checkbox({ label: 'Slow motion (camera)', checked: false, onChange: (v) => { S.slow = v ? 0.2 : 1; } });
  const go = button('Let go', () => { S.run = newRun(); anim.start(); }, 'go');
  const ro1 = readout('Momentum before'), ro2 = readout('Momentum after'), ro3 = readout('Kinetic energy kept');
  const side = el('div', { class: 'vp-side' }, group('Gliders', mA, mB, vA, vB), group('Track', air, slow), go);
  pane.append(el('div', { class: 'vp-cols' }, side, el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ro1, ro2, ro3))), table.el);
  function sync() { slow.hidden = current(bench, 'timing') !== 'camera'; if (slow.hidden) S.slow = 1; else S.slow = slow.get() ? 0.2 : 1; draw(); }
  onRig(bench, sync); sync();

  const anim = loop((dt) => {
    const r = S.run;
    if (r && !r.done) {
      let left = dt * S.slow;
      while (left > 1e-9) { const h = Math.min(0.0002, left); step(r, h); left -= h; }
      r.trace.push([r.t, r.xA, r.xB, r.vA, r.vB]);
      const settled = r.after && r.t - r.after.t > 0.25;
      if (settled && !r.logged) log(r);
      if (r.t > 9 || (Math.abs(r.vA) < 1e-3 && Math.abs(r.vB) < 1e-3 && r.t > 0.3)) { if (!r.logged) log(r); r.done = true; }
    }
    draw();
  });
  function log(r) {
    r.logged = true;
    const tool = current(bench, 'timing');
    if (!r.after) return;
    const m = { vA: measured(r.before.vA, tool), vB: measured(r.before.vB, tool), vA2: measured(r.after.vA, tool), vB2: measured(r.after.vB, tool) };
    const p1 = r.mA * m.vA + r.mB * m.vB, p2 = r.mA * m.vA2 + r.mB * m.vB2;
    const k1 = 0.5 * r.mA * m.vA ** 2 + 0.5 * r.mB * m.vB ** 2, k2 = 0.5 * r.mA * m.vA2 ** 2 + 0.5 * r.mB * m.vB2 ** 2;
    const kept = k1 > 0 ? k2 / k1 : 1;
    table.add({ n: ++nRun, bump: r.bump, mA: r.mA, mB: r.mB, ...m, p1, p2, ke: kept });
    ro1.set(`${p1.toFixed(4)} kg m/s`); ro2.set(`${p2.toFixed(4)} kg m/s`); ro3.set(`${(kept * 100).toFixed(1)}%`);
    // the true loss, for the stamp
    const t1 = 0.5 * r.mA * r.before.vA ** 2 + 0.5 * r.mB * r.before.vB ** 2, t2 = 0.5 * r.mA * r.after.vA ** 2 + 0.5 * r.mB * r.after.vB ** 2;
    rig.note({ bench: 'airtrack', keLost: 1 - t2 / t1, bump: r.bump, tool });
    bench._run = r; if (bench._graph) bench._graph();
  }
  function draw() {
    const { g, w, h } = fitCanvas(box.canvas);
    const r = S.run || { xA: 0.25, xB: 1.15, mA: S.mA, mB: S.mB, trace: [] };
    const sc = (w - 40) / TRACK, X = (x) => 20 + x * sc, ty = h * 0.62;
    g.fillStyle = '#EAF6FC'; g.fillRect(0, 0, w, h);
    // the track
    g.fillStyle = '#CFE0F0'; g.fillRect(X(0), ty, TRACK * sc, 10); g.fillStyle = '#9DB8D3'; g.fillRect(X(0), ty + 10, TRACK * sc, 8);
    g.fillStyle = '#6A86A8'; for (let x = 0.05; x < TRACK; x += 0.05) g.fillRect(X(x), ty + 3, 2, 2);
    g.fillStyle = '#E0457B'; g.fillRect(X(0) - 6, ty - 14, 6, 24); g.fillRect(X(TRACK), ty - 14, 6, 24);
    g.fillStyle = '#12243A'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let m = 0; m <= TRACK + 1e-9; m += 0.5) g.fillText(m.toFixed(1) + ' m', X(m), ty + 22);
    if (S.air) { g.fillStyle = 'rgba(111,183,240,0.5)'; for (let i = 0; i < 30; i++) g.fillRect(X((i * 0.07 + (performance.now() / 4000)) % TRACK), ty - 2, 3, 1); }
    const tool = current(bench, 'timing');
    if (tool === 'photogate') for (const gx of [GATE1, GATE2]) { g.fillStyle = '#2E4A7D'; g.fillRect(X(gx) - 3, ty - 46, 6, 10); g.fillRect(X(gx) - 3, ty - 12, 6, 12); g.strokeStyle = 'rgba(229,83,75,0.7)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(gx), ty - 36); g.lineTo(X(gx), ty - 12); g.stroke(); g.setLineDash([]); }
    // camera dots: where the gliders were, every tenth of a second
    if (tool === 'camera' && r.trace.length) {
      let last = -1;
      for (const q of r.trace) { if (q[0] - last < 0.1) continue; last = q[0]; g.fillStyle = 'rgba(232,194,90,0.8)'; g.fillRect(X(q[1]) - 1, ty - 30, 2, 4); g.fillStyle = 'rgba(0,169,214,0.8)'; g.fillRect(X(q[2]) - 1, ty - 30, 2, 4); }
    }
    const glider = (x, m, col, name) => {
      const hh = 14 + 10 * (m / 0.4), gw = 2 * HALF * sc;
      g.fillStyle = col; g.strokeStyle = '#1B2440'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(X(x) - gw / 2, ty); g.lineTo(X(x) - gw / 2 + 6, ty - hh); g.lineTo(X(x) + gw / 2 - 6, ty - hh); g.lineTo(X(x) + gw / 2, ty); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#1B2440'; g.fillRect(X(x) - 2, ty - hh - 12, 4, 12);
      g.fillStyle = '#12243A'; g.font = '600 12px "Plex", system-ui, sans-serif'; g.textBaseline = 'bottom'; g.fillText(`${name} · ${Math.round(m * 1000)} g`, X(x), ty - hh - 14);
      // bumper ends
      const bump = current(bench, 'bumper');
      const bc = { 'bump-spring': '#9DB8D3', 'bump-velcro': '#F29E4C', 'bump-clay': '#FF8FAB', 'bump-magnet': '#E5534B' }[bump];
      g.fillStyle = bc; g.fillRect(name === 'A' ? X(x) + gw / 2 - 2 : X(x) - gw / 2 - 4, ty - 10, 6, 8);
    };
    glider(r.xA, r.mA, '#E8C25A', 'A'); glider(r.xB, r.mB, '#00A9D6', 'B');
  }
  return { show() { anim.start(); draw(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'The last run, filmed. Position against time for each glider, and the total momentum, which stays the same through the collision even while the bumpers squash.' }));
  const box = canvasBox('', '16 / 9', 'Positions against time');
  const plot = new Plot(box.canvas, { xlabel: 'Time (s)', ylabel: 'Position (m)' });
  const box2 = canvasBox('', '16 / 7', 'Momentum against time');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Time (s)', ylabel: 'Momentum (kg m/s)' });
  const need = note('Graphs need the <b>high-speed camera</b> in the “Measure with” slot. It is in the cabinet on this floor.');
  pane.append(el('div', { class: 'vp-main' }, need, box, box2));
  function draw() {
    const ok = current(bench, 'timing') === 'camera', r = bench._run;
    need.hidden = ok; box.hidden = box2.hidden = !ok;
    if (!ok || !r) return;
    const t = r.trace.map((q) => q[0]);
    plot.setSeries([{ x: t, y: r.trace.map((q) => q[1]), color: COLORS.gold, width: 2.2, label: 'glider A' }, { x: t, y: r.trace.map((q) => q[2]), color: COLORS.cyan, width: 2.2, label: 'glider B' }]).draw();
    const pa = r.trace.map((q) => r.mA * q[3]), pb = r.trace.map((q) => r.mB * q[4]);
    plot2.setSeries([{ x: t, y: pa, color: COLORS.gold, width: 1.8, label: 'A' }, { x: t, y: pb, color: COLORS.cyan, width: 1.8, label: 'B' }, { x: t, y: pa.map((v, i) => v + pb[i]), color: COLORS.pink, width: 2.4, label: 'total' }]).draw();
  }
  bench._graph = draw;
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

bench.tabs = [
  { id: 'track', label: 'Collide', build: tabTrack },
  { id: 'graph', label: 'Film', build: tabGraph },
];

export default bench;
