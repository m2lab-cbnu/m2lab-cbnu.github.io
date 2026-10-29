// 1F · Air track. Two gliders on a cushion of air, so almost nothing slows them down. Choose
// the bumpers (springy, sticky, squishy, or magnets that never touch), the masses and the
// speeds, and check what is conserved: momentum always, kinetic energy only sometimes.

import { el, slider, button, group, readout, canvasBox, note, checkbox, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas, gauss } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { trf } from '../i18n.js';

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
  pane.append(el('p', { class: 'vp-intro', html: 'Glider A is pushed toward glider B. Choose the masses, the speeds and the bumpers, then let go. The table checks momentum (always kept) and kinetic energy (kept only by bouncy bumpers).' }));
  const box = canvasBox('', '16 / 6', 'The air track seen from the side');
  const masses = [0.1, 0.2, 0.3, 0.4].map((m) => ({ value: m, label: `${m * 1000} g` }));
  const mA = segmented({ label: 'Mass of glider A', options: masses, value: S.mA, onChange: (v) => { S.mA = +v; draw(); } });
  const mB = segmented({ label: 'Mass of glider B', options: masses, value: S.mB, onChange: (v) => { S.mB = +v; draw(); } });
  const vA = slider({ label: 'Push on A (speed)', unit: 'm/s', min: 0.05, max: 1.5, step: 0.01, value: S.vA, digits: 3, onInput: (v) => { S.vA = v; } });
  const vB = slider({ label: 'Speed of B (negative: toward A)', unit: 'm/s', min: -1, max: 1, step: 0.01, value: S.vB, digits: 3, onInput: (v) => { S.vB = v; } });
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

// ---------------------------------------------------------------- the hands-on stage
function runWith({ bump, mA, mB, vA, vB, xA = 0.3, xB = 1.15, air = true }) {
  const b = ITEMS[bump].phys;
  return { bump, e: b.e, magnet: !!b.magnet, xA, xB, vA, vB, mA, mB, t: 0, stuck: false, contact: false, touched: false, after: null, before: { vA, vB }, trace: [], done: false, mu: air ? 0.0006 : 0.15 };
}
const GL = { A: ['#FFD54F', '#FFF1B0', '#C99A1B'], B: ['#5FD3F0', '#C9F4FF', '#1F8FB0'] };

function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'hoo', label: 'Two gliders on an air track. Grab one, push it toward the other and let go.',
    hello: 'Grab a glider, **push it** toward the other one and let go. Try different masses and bumpers, and watch the arrows: the total never changes.',
    aspect: 16 / 8.2,
    onReset: () => reset(),
    keys: { arrow(dx) { r.vA = Math.max(-1.5, Math.min(1.5, r.vA + dx * 0.1)); }, action() { reset(); r.vA = 0.6; } },
  });
  st.tool('mom', 'Momentum', { icon: K.COL.vel, on: true }).tool('energy', 'Energy', { icon: K.COL.ke }).tool('cm', 'Center of mass', { icon: K.COL.net })
    .tool('snaps', 'Snapshots', { icon: '#F29E4C' }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('pa', 'Momentum of A').readout('pb', 'Momentum of B').readout('pt', 'Total').readout('ke', 'Motion energy kept');
  const graph = st.liveGraph({ series: [{ id: 'a', label: 'glider A (m)', color: '#C99A1B' }, { id: 'b', label: 'glider B (m)', color: '#1F8FB0' }], window: 6, ylabel: 'position (m)' });

  const M = { A: 0.2, B: 0.2 };
  let r = null, air = true, held = null, pending = null, ke0 = 0, keMin = 1, hitSound = false, snaps = [], snapT = 0, first = true;
  let Lay = { w: 800, h: 400, x0: 40, s: 360, y: 260 };
  const massBtns = (who) => el('div', { class: 'stg-row', role: 'group', 'aria-label': trf('Mass of glider {0}', who) }, ...[0.1, 0.2, 0.4].map((m) => {
    const b = el('button', { type: 'button', class: 'stg-chip', 'aria-pressed': M[who] === m ? 'true' : 'false', text: `${m * 1000} g` });
    b.addEventListener('click', () => { M[who] = m; b.parentNode.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); reset(); sound.play('clink'); });
    return b;
  }));
  const goBtn = el('button', { type: 'button', class: 'stg-act', text: 'Push A at 0.6 m/s' });
  goBtn.addEventListener('click', () => { reset(); r.vA = 0.6; r.before = { vA: 0.6, vB: 0 }; startE(); sound.play('swing'); });
  const airBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Blower off' });
  airBtn.addEventListener('click', () => { air = !air; airBtn.textContent = air ? 'Blower off' : 'Blower on'; if (r) r.mu = air ? 0.0006 : 0.15; sound.play('click'); });
  st.controls(el('p', { class: 'stg-small', text: 'Glider A' }), massBtns('A'), el('p', { class: 'stg-small', text: 'Glider B' }), massBtns('B'), el('div', { class: 'stg-row' }, goBtn, airBtn));

  function reset(o = {}) {
    r = runWith({ bump: o.bump || current(bench, 'bumper'), mA: o.mA ?? M.A, mB: o.mB ?? M.B, vA: o.vA ?? 0, vB: o.vB ?? 0, xA: o.xA ?? 0.3, xB: o.xB ?? 1.15, air });
    ke0 = 0; keMin = 1; snaps = []; graph.clear();
  }
  function startE() { ke0 = 0.5 * r.mA * r.vA * r.vA + 0.5 * r.mB * r.vB * r.vB; keMin = 1; }
  reset();
  onRig(bench, () => { if (r && !r.touched) { const b = ITEMS[current(bench, 'bumper')].phys; r.bump = current(bench, 'bumper'); r.e = b.e; r.magnet = !!b.magnet; } });

  // ---------- physics
  st.onStep((dt) => {
    if (!r) return;
    let left = dt;
    const wasContact = r.contact || r.stuck;
    while (left > 1e-12) {
      const h = Math.min(0.0005, left); left -= h;
      if (held === 'A') { const keepV = r.vA; step(r, h); r.vA = keepV; r.xA = held_x; }
      else if (held === 'B') { const keepV = r.vB; step(r, h); r.vB = keepV; r.xB = held_x; }
      else step(r, h);
    }
    if (!wasContact && (r.contact || r.stuck) && !hitSound) {
      hitSound = true;
      const rel = Math.abs(r.vA - r.vB) + 0.1;
      if (r.bump === 'bump-spring') sound.play('clack', { vol: rel }); else if (r.bump === 'bump-velcro') { sound.play('thud', { vol: rel }); sound.play('sand', { vol: 2 }); }
      else if (r.bump === 'bump-clay') sound.play('thud', { vol: rel }); else sound.play('whoosh', { vol: 0.4 });
    }
    if (!(r.contact || r.stuck)) hitSound = false;
    if (ke0 > 0) keMin = Math.min(keMin, ke() / ke0);
    if (dt > 0) { graph.push(r.t, { a: r.xA, b: r.xB }); snapT += dt; if (snapT >= 0.1) { snapT = 0; snaps.push([r.xA, r.xB]); if (snaps.length > 12) snaps.shift(); } }
    if (r.after && !r.noted) {
      r.noted = true;
      const p1 = r.mA * r.before.vA + r.mB * r.before.vB, p2 = r.mA * r.after.vA + r.mB * r.after.vB;
      const k1 = 0.5 * r.mA * r.before.vA ** 2 + 0.5 * r.mB * r.before.vB ** 2, k2 = 0.5 * r.mA * r.after.vA ** 2 + 0.5 * r.mB * r.after.vB ** 2;
      rig.note({ bench: 'airtrack', keLost: k1 > 0 ? 1 - k2 / k1 : 0, p1, p2, bump: r.bump });
    }
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
  });
  let held_x = 0;
  const ke = () => 0.5 * r.mA * r.vA * r.vA + 0.5 * r.mB * r.vB * r.vB;

  // ---------- drawing
  st.onResize((w, h, narrow) => {
    const x0 = narrow ? 18 : 46, s = (w - 2 * x0) / TRACK;
    Lay = { w, h, x0, s, y: Math.round(h * 0.62), narrow };
  });
  const X = (x) => Lay.x0 + x * Lay.s;
  const gW = () => 2 * HALF * Lay.s;

  function drawTrack(g, w, h) {
    K.room(g, w, h, K.THEME[1], { floorH: 0.12 });
    const y = Lay.y;
    K.benchTop(g, 10, y + 44, w - 20, 16, 22, K.MAT.wood);
    // legs and the blower
    for (const x of [X(0.15), X(1.85)]) K.box(g, x - 6, y + 14, 12, 32, K.MAT.steel, { r: 2 });
    K.box(g, X(0) - 36, y - 14, 28, 34, K.MAT.navy, { r: 5 });
    K.text(g, 'air', X(0) - 22, y + 8, { size: 10, weight: 700, align: 'center', color: '#A8ECFF', font: K.PIXF });
    // the rail: a long aluminium beam full of tiny holes
    K.box(g, X(0) - 6, y - 4, TRACK * Lay.s + 12, 18, K.MAT.alu, { r: 3 });
    g.fillStyle = 'rgba(46,74,125,0.55)';
    for (let x = X(0.02); x < X(TRACK - 0.02); x += 9) { g.beginPath(); g.arc(x, y + 2, 1.2, 0, Math.PI * 2); g.fill(); }
    // end stops
    for (const x of [X(0) - 8, X(TRACK) + 2]) K.box(g, x, y - 22, 6, 22, K.MAT.rubber, { r: 2 });
    // a metre stick along the front
    K.rulerH(g, X(0), X(TRACK), y + 16, X, 0, TRACK, 0.1, { major: 5, fmt: (v) => v.toFixed(1) + ' m', h: 22 });
  }

  function drawGlider(g, x, m, cols, label, bumpLeft, bumpRight, hover) {
    const y = Lay.y, w = gW(), x0 = X(x) - w / 2, top = y - 36;
    if (air) for (let k = 0; k < 4; k++) { const ax = x0 + 8 + k * (w - 16) / 3, a = 0.3 + 0.3 * Math.sin(st.t * 30 + k * 2 + x * 10); g.fillStyle = `rgba(168,236,255,${a})`; g.fillRect(ax, y - 6, 2, 3); }
    if (hover) K.glow(g, X(x), y - 18, w * 0.8, '#00D4FF', 0.35);
    // body: an upside-down V that rides on the rail
    K.box(g, x0, top, w, 30, cols, { r: 6 });
    K.box(g, x0 + w / 2 - 3, top - 26, 6, 26, K.MAT.navy, { r: 2 });       // the flag for the photogates
    // stacked weights show the mass
    const n = Math.round(m / 0.1);
    for (let i = 0; i < n - 1; i++) K.box(g, x0 + w * 0.2 + (i % 2) * w * 0.32, top - 10 - Math.floor(i / 2) * 9, w * 0.26, 9, K.MAT.brass, { r: 3, lw: 1.5 });
    K.text(g, label, x0 + w / 2, top + 20, { size: 14, weight: 700, align: 'center', color: K.LINE, font: K.PIXF });
    // bumpers
    const bumper = (bx, dir, kind) => {
      if (kind === 'bump-spring') { g.save(); g.strokeStyle = '#6886AC'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(bx + dir * 7, top + 12, 8, 9, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
      else if (kind === 'bump-velcro') K.box(g, dir > 0 ? bx : bx - 7, top + 3, 7, 18, ['#F29E4C', '#FFD1A1', '#B9651F'], { r: 2, lw: 1.5 });
      else if (kind === 'bump-clay') { g.beginPath(); g.ellipse(bx + dir * 5, top + 13, 6, 8, 0, 0, Math.PI * 2); g.fillStyle = '#FF8FAB'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = K.LINE; g.stroke(); }
      else if (kind === 'bump-magnet') K.box(g, dir > 0 ? bx : bx - 9, top + 3, 9, 18, dir > 0 ? K.MAT.magnetN : K.MAT.magnetN, { r: 2, lw: 1.5 });
    };
    if (bumpRight) bumper(x0 + w, 1, bumpRight);
    if (bumpLeft) bumper(x0, -1, bumpLeft);
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, drawTrack);
    if (!r) return;
    const bump = r.bump;
    if (st.on('snaps')) snaps.forEach(([a, b], i) => { g.save(); g.globalAlpha = 0.1 + 0.25 * i / snaps.length; K.box(g, X(a) - gW() / 2, Lay.y - 30, gW(), 24, GL.A, { r: 5, lw: 1 }); K.box(g, X(b) - gW() / 2, Lay.y - 30, gW(), 24, GL.B, { r: 5, lw: 1 }); g.restore(); });
    drawGlider(g, r.xA, r.mA, GL.A, 'A', null, bump, st.hovering('A'));
    drawGlider(g, r.xB, r.mB, GL.B, 'B', bump, null, st.hovering('B'));
    const pS = Lay.s * 1.4;                          // pixels per kg m/s
    const cap = (v) => Math.max(-260, Math.min(260, v));
    if (st.on('mom')) {
      const pa = r.mA * r.vA, pb = r.mB * r.vB, yA = Lay.y - 92;
      if (Math.abs(pa) > 0.003) K.arrow(g, X(r.xA), yA, X(r.xA) + cap(pa * pS), yA, '#C99A1B', { label: `A: ${pa.toFixed(3)}`, size: 11.5 });
      if (Math.abs(pb) > 0.003) K.arrow(g, X(r.xB), yA - 28, X(r.xB) + cap(pb * pS), yA - 28, '#1F8FB0', { label: `B: ${pb.toFixed(3)}`, size: 11.5 });
      // the total, drawn from a fixed spot so you can see it never changes
      const pt = pa + pb, ty = 58, tx = Lay.w * 0.42;
      K.text(g, 'total momentum', tx, ty - 18, { size: 12, weight: 600, align: 'center' });
      g.save(); g.fillStyle = '#E6FBF1'; K.rr(g, tx - 150, ty - 10, 300, 22, 8); g.fill(); g.restore();
      K.lineSeg(g, tx, ty - 12, tx, ty + 14, K.LINE, 1.5);
      if (Math.abs(pt) > 0.003) K.arrow(g, tx, ty + 1, tx + Math.max(-140, Math.min(140, pt * pS)), ty + 1, K.COL.vel, { label: `${pt.toFixed(3)} kg m/s`, size: 11.5 });
      // forces during contact: equal and opposite
      if (r.contact && !r.stuck) {
        K.arrow(g, X(r.xA) + gW() / 2, Lay.y - 50, X(r.xA) + gW() / 2 - 40, Lay.y - 50, K.COL.gravity, { label: 'push on A', size: 10.5 });
        K.arrow(g, X(r.xB) - gW() / 2, Lay.y - 50, X(r.xB) - gW() / 2 + 40, Lay.y - 50, K.COL.gravity, { label: 'push on B', size: 10.5 });
      }
    }
    if (st.on('cm')) {
      const xc = (r.mA * r.xA + r.mB * r.xB) / (r.mA + r.mB);
      const cx = X(xc), cy = Lay.y - 132;
      g.save(); g.beginPath(); g.moveTo(cx, cy - 10); g.lineTo(cx + 9, cy); g.lineTo(cx, cy + 10); g.lineTo(cx - 9, cy); g.closePath(); g.fillStyle = K.COL.net; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
      K.lineSeg(g, cx, cy + 10, cx, Lay.y - 34, K.hexA(K.COL.net, 0.5), 1.5, [4, 4]);
      K.tag(g, 'center of mass', cx, cy - 22, { size: 11, bg: '#DCD3FF' });
    }
    if (st.on('energy')) {
      const ka = 0.5 * r.mA * r.vA ** 2, kb = 0.5 * r.mB * r.vB ** 2, E = Math.max(ke0, ka + kb, 1e-9);
      K.bars(g, w - 176, 18, 158, 150, [{ label: 'A', value: ka, color: '#E8C25A' }, { label: 'B', value: kb, color: '#3FC1D9' }, { label: 'lost', value: Math.max(0, ke0 - ka - kb), color: K.COL.heat }], E, { title: 'Motion energy' });
    }
    if (first && !held) { const k = (Math.sin(st.t * 3) + 1) / 2; K.arrow(g, X(r.xA) - 70 - k * 10, Lay.y - 70, X(r.xA) - gW() / 2 - 6, Lay.y - 26, K.COL.normal, { lw: 3.5, head: 11 }); }
  });
  st.onOver(() => {
    if (!r) return;
    const pa = r.mA * r.vA, pb = r.mB * r.vB;
    st.set('pa', `${pa.toFixed(3)} kg m/s`); st.set('pb', `${pb.toFixed(3)} kg m/s`); st.set('pt', `${(pa + pb).toFixed(3)} kg m/s`);
    st.set('ke', ke0 > 1e-6 ? `${Math.round(100 * ke() / ke0)}%` : '–');
    graph.draw();
  });

  // ---------- hands: grab a glider and push it
  const grab = (who) => ({
    id: who, cursor: 'grab',
    hit: (x, y) => { const gx = X(who === 'A' ? r.xA : r.xB); return Math.abs(x - gx) < gW() / 2 + 10 && y > Lay.y - 62 && y < Lay.y + 6 ? Math.abs(x - gx) : false; },
    down: (x) => { held = who; held_x = who === 'A' ? r.xA : r.xB; first = false; st.hint(null); st._dx = x - X(held_x); if (who === 'A') r.vA = 0; else r.vB = 0; r.touched = false; r.after = null; r.noted = false; r.stuck = false; },
    move: (x) => {
      const nx = (x - st._dx - Lay.x0) / Lay.s;
      if (who === 'A') { held_x = Math.max(HALF, Math.min(r.xB - 2 * HALF - 0.001, nx)); }
      else { held_x = Math.max(r.xA + 2 * HALF + 0.001, Math.min(TRACK - HALF, nx)); }
    },
    up: (x, y, vx) => {
      held = null;
      const v = Math.max(-1.5, Math.min(1.5, vx / Lay.s));
      if (who === 'A') r.vA = v; else r.vB = v;
      r.before = { vA: r.vA, vB: r.vB }; startE();
      if (Math.abs(v) > 0.05) sound.play('swing');
    },
  });
  st.handle(grab('A')); st.handle(grab('B'));
  st.hint('Grab glider A and push it toward B', { sticky: true });

  // ---------- why
  const go = (o) => { reset(o); r.before = { vA: r.vA, vB: r.vB }; startE(); };
  st.tour({
    title: 'What is kept in a crash?',
    steps: [
      { say: '**Momentum** is mass times velocity: how hard something would be to stop. Glider A has some (the arrow), B has none.', tools: { mom: true, energy: false, cm: false }, enter: (s) => { s.setSpeed(1); go({ bump: 'bump-spring', mA: 0.2, mB: 0.2, vA: 0.5 }); } },
      { say: 'In the crash, A pushes B and **B pushes A back just as hard, for just as long**. So whatever momentum A loses, B gains.', enter: (s) => { s.setSpeed(1 / 16); go({ bump: 'bump-spring', mA: 0.2, mB: 0.2, vA: 0.5, xA: 0.82 }); } },
      { say: 'So the **total stays the same** (the green arrow at the top). The **center of mass** glides on at a steady speed, as if nothing happened.', tools: { cm: true }, enter: (s) => { s.setSpeed(0.5); go({ bump: 'bump-spring', mA: 0.4, mB: 0.1, vA: 0.5 }); } },
      { say: 'Energy is another story. **Springy bumpers** give back almost all the motion energy. **Velcro** makes them stick: a lot of energy turns into heat and sound, yet the momentum is still all there.', tools: { cm: false, energy: true }, enter: (s) => { s.setSpeed(0.5); go({ bump: 'bump-velcro', mA: 0.2, mB: 0.2, vA: 0.6 }); } },
    ],
    onEnd: () => reset(),
  });

  // ---------- predict, watch, explain
  const until = (cond, then) => { pending = { until: cond, then }; };
  const after = () => { pending = null; reset(); };
  const done = () => r.after && r.t > r.after.t + 0.4;
  st.setChallenges([
    {
      id: 'swap', title: 'Equal gliders', card: 'airtrack.swap', lock: true, after,
      q: 'Two 200 g gliders with springy bumpers. A hits B, which is standing still. Afterwards…', choices: ['A stops and B moves off', 'both move on at half speed', 'A bounces back'], answer: 0,
      run: (s, finish) => { s.setSpeed(0.5); s.setTool('mom', true); go({ bump: 'bump-spring', mA: 0.2, mB: 0.2, vA: 0.5 }); until(done, () => finish(`A: ${r.after.vA.toFixed(2)} m/s, B: ${r.after.vB.toFixed(2)} m/s.`)); },
      explain: 'With equal masses and a bouncy hit, the gliders simply swap speeds, like the balls of Newton’s cradle. Both momentum and energy are kept that way.',
    },
    {
      id: 'half', title: 'Sticky crash', card: 'airtrack.half', lock: true, after,
      q: 'Two equal gliders with velcro: they stick together. How much of the motion energy is left afterwards?', choices: ['All of it', 'Half', 'None'], answer: 1,
      run: (s, finish) => { s.setSpeed(0.5); s.setTool('energy', true); go({ bump: 'bump-velcro', mA: 0.2, mB: 0.2, vA: 0.6 }); until(done, () => finish(`${Math.round(100 * ke() / ke0)}% is left.`)); },
      explain: 'Momentum is kept, so the pair moves at half the speed. Motion energy goes with the speed squared: twice the mass at half the speed has half the energy. The other half became heat and sound.',
    },
    {
      id: 'bounce', title: 'Light hits heavy', card: 'airtrack.bounce', lock: true, after,
      q: 'A 100 g glider with springy bumpers hits a 400 g glider at rest. The light one…', choices: ['stops dead', 'keeps going forward, slower', 'bounces back'], answer: 2,
      run: (s, finish) => { s.setSpeed(0.5); s.setTool('mom', true); go({ bump: 'bump-spring', mA: 0.1, mB: 0.4, vA: 0.6 }); until(done, () => finish(`A: ${r.after.vA.toFixed(2)} m/s (backwards), B: ${r.after.vB.toFixed(2)} m/s.`)); },
      explain: 'The heavy glider takes more momentum than the light one had, so the light one has to go backwards to keep the total. Like a ping-pong ball bouncing off a bowling ball.',
    },
  ]);

  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'track', label: 'Measure', build: tabTrack },
  { id: 'graph', label: 'Film', build: tabGraph },
];

export default bench;
