// 2F · Slinky drop. Hold a slinky by its top and let it hang, then let go. The top rushes down,
// but the bottom stays exactly where it was until the collapse reaches it: the bottom does not
// "know" yet. The model: coils joined by springs that stop when the coils touch, and touching
// coils stick together (an inelastic collapse front).

import { el, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const G = 9.81, N = 60, FLOOR = 1.18;   // the floor, 1.18 m below the hand

const bench = {
  id: 'slinky', title: 'Slinky drop', kicker: '2F · Physics Playground', icon: '§', floor: 2,
  blurb: 'Let go of the top. The bottom waits.',
  slots: [
    { id: 'slinky', label: 'Slinky', options: ['slinky-metal', 'slinky-plastic'], def: 'slinky-metal' },
    { id: 'bottom', label: 'At the bottom', options: ['bottom-none', 'ball-tennis'], def: 'bottom-none' },
    { id: 'watch', label: 'Watch with', options: ['eyes', 'camera'], def: 'eyes' },
  ],
};
bench.header = rigStrip(bench);

function params() {
  const s = phys(bench, 'slinky'), b = current(bench, 'bottom');
  const mb = b === 'ball-tennis' ? ITEMS['ball-tennis'].phys.m : 0;
  return { M: s.M, k: s.k, h0: s.h0, mb, m: s.M / N, ks: (N - 1) * s.k, l0: s.h0 / (N - 1), id: s.id, bottom: b };
}
// hanging at rest from the top coil
function hang(p) {
  const y = new Float64Array(N), v = new Float64Array(N);
  y[0] = 0;
  for (let i = 0; i < N - 1; i++) {
    const below = (N - 1 - i) * p.m + p.mb;          // mass hanging under segment i
    y[i + 1] = y[i] + p.l0 + below * G / p.ks;
  }
  return { y, v };
}

// run the drop and return samples [t, yTop, yBottom, yCom, coils...]
export function simulate(p, T = 0.9, dt = 5e-5, floor = Infinity) {
  const { y, v } = hang(p);
  const a = new Float64Array(N);
  let c = 1;   // coils in the collapsed block at the top (the top coil starts alone)
  const out = [];
  const massOf = (i) => p.m + (i === N - 1 ? p.mb : 0);
  let t = 0, every = Math.round(0.002 / dt), k = 0, tMove = null;
  const y0Bottom = y[N - 1];
  while (t < T) {
    // forces: gravity everywhere, spring tension on stretched segments below the block
    a.fill(G);
    for (let i = c - 1; i < N - 1; i++) {
      const e = (y[i + 1] - y[i]) - p.l0;
      if (e > 0) { const F = p.ks * e; a[i] += F / (i < c ? c * p.m : massOf(i)); a[i + 1] -= F / massOf(i + 1); }
    }
    // the block moves as one
    const ab = a[c - 1];
    for (let i = 0; i < c; i++) { v[i] += ab * dt; }
    for (let i = c; i < N; i++) v[i] += a[i] * dt;
    for (let i = 0; i < N; i++) y[i] += v[i] * dt;
    for (let i = 1; i < c; i++) y[i] = y[0] + i * p.l0;
    // coils that catch up with the block stick to it
    while (c < N && y[c] - y[c - 1] <= p.l0) {
      const mBlock = c * p.m, mi = massOf(c);
      const V = (mBlock * v[0] + mi * v[c]) / (mBlock + mi);
      c++;
      for (let i = 0; i < c; i++) v[i] = V;
      for (let i = 1; i < c; i++) y[i] = y[0] + i * p.l0;
    }
    t += dt;
    if (tMove === null && y[N - 1] - y0Bottom > 0.0005) tMove = t;
    if (y[N - 1] >= floor) {
      // it lands: everything settles into a squashed pile on the floor
      const off = floor - y[N - 1];
      for (let i = 0; i < N; i++) { y[i] += off; v[i] = 0; }
      let com = 0, mt = 0; for (let i = 0; i < N; i++) { const mm = massOf(i); com += mm * y[i]; mt += mm; }
      out.push([t, y[0], y[N - 1], com / mt, Float64Array.from(y)]);
      break;
    }
    if (k++ % every === 0) {
      let com = 0, mt = 0; for (let i = 0; i < N; i++) { const mm = massOf(i); com += mm * y[i]; mt += mm; }
      out.push([t, y[0], y[N - 1], com / mt, Float64Array.from(y)]);
    }
  }
  return { samples: out, tMove, collapse: tMove };
}

const S = { run: null, t: 0, playing: false, hold: true };
const table = dataTable([
  { key: 'n', label: '#' },
  { key: 'slinky', label: 'Slinky', fmt: (v) => ITEMS[v].name },
  { key: 'bottom', label: 'At the bottom', fmt: (v) => ITEMS[v].name },
  { key: 'tm', label: 'Bottom starts to move (s)', fmt: (v) => (v === null ? 'not filmed' : v.toFixed(3)) },
], { caption: 'Your drops' });

function tabDrop(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'The slinky hangs from your hand, stretched by its own weight. Let go: the top collapses downwards, and the bottom hangs in the air until the collapse arrives. Meanwhile the centre of mass falls exactly as a stone would. Film it to see it slowly.' }));
  const box = canvasBox('', '3 / 4', 'The slinky, hanging');
  const go = button('Let go', () => drop(), 'go');
  const again = button('Pick it up', () => { S.run = null; S.playing = false; S.hold = true; draw(); }, 'quiet');
  const slow = checkbox({ label: 'Slow motion (the camera films at 1000 frames a second)', checked: true, onChange: () => {} });
  const tRo = readout('Time since you let go'), hRo = readout('Bottom hovered for');
  pane.append(el('div', { class: 'vp-cols' }, el('div', { class: 'vp-side' }, group('Drop', el('div', { class: 'vp-row' }, go, again), slow), el('div', { class: 'ros' }, tRo, hRo)), el('div', { class: 'vp-main' }, box)), table.el);
  function sync() { slow.hidden = current(bench, 'watch') !== 'camera'; S.run = null; S.hold = true; draw(); }
  onRig(bench, sync);

  function drop() {
    const p = params();
    S.run = simulate(p, 1.6, 5e-5, FLOOR); S.t = 0; S.playing = true; S.hold = false; S.p = p;
    const filmed = current(bench, 'watch') === 'camera';
    table.add({ n: table.rows.length + 1, slinky: p.id, bottom: p.bottom, tm: filmed ? S.run.tMove : null });
    if (filmed && p.id === 'slinky-metal' && p.bottom === 'bottom-none') rig.flag('slinkyHover', Math.round(S.run.tMove * 1000) / 1000);
    rig.note({ bench: 'slinky', tMove: S.run.tMove, slinky: p.id, bottom: p.bottom, filmed });
    bench._run = S.run; if (bench._graph) bench._graph();
  }
  const anim = loop((dt) => {
    if (S.playing && S.run) {
      const slowF = current(bench, 'watch') === 'camera' && slow.get() ? 0.08 : 1;
      S.t += dt * slowF;
      const last = S.run.samples[S.run.samples.length - 1][0];
      if (S.t >= last) { S.t = last; S.playing = false; }
    }
    draw();
  });
  function draw() {
    const p = S.p && S.run ? S.p : params();
    const { g, w, h } = fitCanvas(box.canvas);
    g.fillStyle = '#F1ECFF'; g.fillRect(0, 0, w, h);
    const top = h * 0.08, sc = (h * 0.86) / 1.22, cx = w * 0.5;
    let ys, frameT = 0;
    if (S.run) {
      const sm = S.run.samples; let i = Math.min(sm.length - 1, Math.floor(S.t / 0.002));
      ys = sm[i][4]; frameT = sm[i][0];
    } else ys = hang(p).y;
    // where the bottom started, and the floor
    const yb0 = hang(p).y[N - 1];
    g.strokeStyle = 'rgba(224,69,123,0.6)'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(cx - 70, top + yb0 * sc); g.lineTo(cx + 70, top + yb0 * sc); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#E0457B'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('where the bottom hung', cx + 74, top + yb0 * sc + 4);
    g.fillStyle = '#FFE9A8'; g.fillRect(0, top + FLOOR * sc + 4, w, h);
    // the hand
    if (S.hold) { g.fillStyle = '#FFD7B8'; g.strokeStyle = '#1B2440'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, top - 10, 30, 12, 0, 0, 7); g.fill(); g.stroke(); }
    // coils
    const [c1, c2] = ITEMS[p.id].icon.slice(1, 3);
    const rw = p.id === 'slinky-metal' ? 34 : 40;
    for (let i = N - 1; i >= 0; i--) {
      const y = top + ys[i] * sc;
      g.strokeStyle = i % 2 ? c2 : c1; g.lineWidth = 2.2; g.beginPath(); g.ellipse(cx, y, rw, 4, 0, 0, 7); g.stroke();
    }
    if (p.mb > 0) { const y = top + ys[N - 1] * sc + 14; g.fillStyle = '#DDF27A'; g.strokeStyle = '#1B2440'; g.beginPath(); g.arc(cx, y, 13, 0, 7); g.fill(); g.stroke(); }
    // centre of mass
    if (S.run) {
      const sm = S.run.samples, i = Math.min(sm.length - 1, Math.floor(S.t / 0.002)), com = sm[i][3];
      g.fillStyle = '#6B5BE6'; g.beginPath(); g.moveTo(cx + rw + 12, top + com * sc); g.lineTo(cx + rw + 22, top + com * sc - 6); g.lineTo(cx + rw + 22, top + com * sc + 6); g.fill();
      g.fillText('centre of mass', cx + rw + 26, top + com * sc + 4);
    }
    tRo.set(S.run ? `${frameT.toFixed(3)} s` : 'still holding it');
    hRo.set(S.run && current(bench, 'watch') === 'camera' && S.run.tMove ? `${S.run.tMove.toFixed(3)} s` : S.run ? 'film it to measure' : '–');
  }
  return { show() { anim.start(); draw(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Positions from the film: the top races down, the bottom stays flat until the collapse front arrives, and the centre of mass follows a parabola with acceleration g, from the very start.' }));
  const box = canvasBox('', '16 / 10', 'Positions against time');
  const plot = new Plot(box.canvas, { xlabel: 'Time after letting go (s)', ylabel: 'Distance fallen (cm)' });
  const need = note('Graphs need the <b>high-speed camera</b> (from the cabinet on 1F). Choose it in “Watch with”, then drop the slinky.');
  pane.append(el('div', { class: 'vp-main' }, need, box));
  function draw() {
    const cam = current(bench, 'watch') === 'camera', r = bench._run;
    need.hidden = cam; box.hidden = !cam;
    if (!cam || !r) return;
    const sm = r.samples, t = sm.map((q) => q[0]);
    const y0 = sm[0];
    const series = [
      { x: t, y: sm.map((q) => (q[1] - y0[1]) * 100), color: COLORS.signal, width: 2.2, label: 'top' },
      { x: t, y: sm.map((q) => (q[2] - y0[2]) * 100), color: COLORS.pink, width: 2.2, label: 'bottom' },
      { x: t, y: sm.map((q) => (q[3] - y0[3]) * 100), color: COLORS.violet, width: 2, dash: [5, 4], label: 'centre of mass' },
      { x: t, y: t.map((tt) => 0.5 * G * tt * tt * 100), color: COLORS.gold, width: 1.4, dash: [2, 3], label: '½ g t²' },
    ];
    plot.ylim = [-2, 140]; plot.setSeries(series).setVLines(r.tMove ? [{ x: r.tMove, color: COLORS.pink, dash: [4, 4] }] : []).draw();
  }
  bench._graph = draw;
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
const RAINBOW = ['#E5534B', '#F29E4C', '#FFD54F', '#3DBB7E', '#3D7FD6', '#7B5CF0'];
function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'pip', label: 'A slinky hanging from a hand. Tap the hand to let go.',
    hello: 'The slinky hangs from a hand. **Tap the hand** to let go, and keep your eye on the **bottom** of the slinky. (It is shown in slow motion: the whole drop takes half a second.)',
    aspect: 16 / 10.5,
    onReset: () => rehang(),
    keys: { action() { if (run) rehang(); else letGo(); } },
  });
  st.tool('tension', 'Stretch', { icon: K.COL.spring, on: true }).tool('cm', 'Centre of mass', { icon: K.COL.net }).tool('ball', 'Drop a ball too', { icon: '#D9EE55' })
    .tool('front', 'The news travelling down', { icon: K.COL.gravity }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('wait', 'Bottom stayed still for').readout('fall', 'Fall to the floor').readout('drop', 'Bottom started at').readout('m', 'Slinky');
  const graph = st.liveGraph({ series: [{ id: 'top', label: 'top (cm)', color: K.COL.string }, { id: 'bot', label: 'bottom (cm)', color: K.COL.gravity }, { id: 'cm', label: 'centre of mass (cm)', color: K.COL.net }], window: 0.7, ylabel: 'fallen (cm)' });
  let p = params(), rest = hang(p), samples = null, run = false, t = 0, tStill = null, pending = null, landed = false, first = true;
  let Lay = { w: 800, h: 500, top: 60, s: 320, cx: 400 };
  st.setSpeed(0.25);

  function rehang() { p = params(); rest = hang(p); samples = null; run = false; t = 0; tStill = null; landed = false; graph.clear(); }
  function letGo() {
    if (run) return;
    p = params(); rest = hang(p);
    const res = simulate(p, 0.9, 5e-5, FLOOR);
    samples = res.samples; tStill = res.tMove;
    run = true; t = 0; landed = false; first = false; st.hint(null);
    sound.play('pop');
    rig.note({ bench: 'slinky', hover: tStill, slinky: p.id, bottom: p.bottom });
  }
  onRig(bench, () => rehang());

  const at = (time) => {
    if (!samples) return null;
    let i = 0; while (i < samples.length - 1 && samples[i + 1][0] <= time) i++;
    return samples[i];
  };
  const comRest = () => { let c = 0, m = 0; for (let i = 0; i < N; i++) { const mm = p.m + (i === N - 1 ? p.mb : 0); c += mm * rest.y[i]; m += mm; } return c / m; };

  st.onStep((dt) => {
    if (!run || dt <= 0) return;
    t += dt;
    const q = at(t), y0 = samples[0];
    if (q) graph.push(t, { top: (q[1] - y0[1]) * 100, bot: (q[2] - y0[2]) * 100, cm: (q[3] - y0[3]) * 100 });
    const last = samples[samples.length - 1];
    if (!landed && t >= last[0]) { landed = true; sound.play(p.id === 'slinky-metal' ? 'clang' : 'thud', { vol: 0.6, pitch: 1.6 }); }
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
  });

  st.onResize((w, h) => { Lay = { w, h, top: 104, s: (h - 104 - 34) / FLOOR, cx: Math.round(w * 0.42) }; });
  const Y = (y) => Lay.top + y * Lay.s;

  function drawCoils(g, ys, cx) {
    const rx = Math.max(24, Math.min(40, Lay.w * 0.04)), ry = 5.5;
    const metal = p.id === 'slinky-metal';
    // tension colouring: how stretched each gap is compared with the top gap at rest
    const gap0 = Math.max(1e-6, rest.y[1] - rest.y[0] - p.l0);
    for (const front of [false, true]) {
      for (let i = N - 1; i >= 0; i--) {
        const y = Y(ys[i]);
        let col = metal ? '#A9C3DD' : RAINBOW[Math.floor(i / 4) % RAINBOW.length];
        if (st.on('tension') && i < N - 1) { const str = Math.max(0, (ys[i + 1] - ys[i] - p.l0) / gap0); col = K.mixHex(col, '#E5534B', Math.min(0.85, str * 0.85)); }
        g.beginPath(); g.ellipse(cx, y, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
        g.strokeStyle = front ? K.LINE : K.mixHex(K.LINE, '#FFFFFF', 0.3); g.lineWidth = front ? 4 : 3; g.stroke();
        g.strokeStyle = front ? col : K.mixHex(col, '#1B2440', 0.35); g.lineWidth = front ? 2.2 : 1.6; g.stroke();
      }
    }
    if (p.mb > 0) { const yb = Y(ys[N - 1]) + 16; K.ball(g, cx, yb, 15, 'tennis', { pattern: K.PATTERN.tennis }); }
  }

  function drawHand(g, cx, y, open) {
    g.save(); g.translate(cx, y);
    // a friendly cartoon hand, pinching the top coil
    g.fillStyle = '#FFD7B8'; g.strokeStyle = K.LINE; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(0, -24, 30, 20, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    const fingers = open ? [[-24, 6, -0.5], [24, 6, 0.5]] : [[-14, 4, -0.15], [14, 4, 0.15]];
    for (const [fx, fy, a] of fingers) { g.save(); g.translate(fx, fy - 10); g.rotate(a); g.beginPath(); g.ellipse(0, 6, 8, 14, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
    g.beginPath(); g.moveTo(-12, -40); g.lineTo(-12, -70); g.moveTo(12, -40); g.lineTo(12, -70); g.stroke();
    g.fillStyle = '#7FC8EA'; g.fillRect(-20, -80, 40, 30); g.strokeRect(-20, -80, 40, 30);
    g.restore();
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[2], { floorH: 34 / hh });
      K.rulerV(gg, 16, Y(0), Y(FLOOR), (v) => Y(v / 100), 0, 110, 5, { major: 2, fmt: (v) => String(v) });
      K.text(gg, 'cm', 22, Y(0) - 12, { size: 11, weight: 600 });
      // a tall board of stripes behind the slinky, like a photo backdrop
      for (let k = 0; k < 12; k++) { gg.fillStyle = k % 2 ? 'rgba(185,168,255,0.16)' : 'rgba(155,227,193,0.16)'; gg.fillRect(Lay.cx - 90, Y(k * 0.1), 180, 0.1 * Lay.s); }
    });
    const cx = Lay.cx;
    const q = run ? at(t) : null;
    const ys = q ? q[4] || null : null;
    // samples only keep the full coil list every so often; fall back to rest shape
    const coils = ys || (run && q ? null : rest.y);
    if (coils) drawCoils(g, coils, cx);
    else if (q) {
      // rebuild the coils from top, bottom and the collapse (approximate, for drawing)
      const yy = new Float64Array(N); const top = q[1], bot = q[2];
      for (let i = 0; i < N; i++) yy[i] = top + (bot - top) * (rest.y[i] - rest.y[0]) / (rest.y[N - 1] - rest.y[0]);
      drawCoils(g, yy, cx);
    }
    drawHand(g, cx, Y(rest.y[0]) - 4, run);
    if (st.hovering('hand') && !run) K.glow(g, cx, Y(0) - 30, 60, '#00D4FF', 0.35);
    // a ball dropped at the same moment from the bottom's height
    if (st.on('ball')) {
      const yb0 = rest.y[N - 1] + (p.mb ? 0.03 : 0), tt = run ? t : 0;
      const yb = Math.min(FLOOR - 0.03, yb0 + 0.5 * G * tt * tt);
      K.ball(g, cx + 120, Y(yb), 13, 'yellow');
      K.tag(g, 'ball dropped at the same time', cx + 120, Y(yb) - 26, { size: 11 });
    }
    if (st.on('cm')) {
      const yc = q ? q[3] : comRest();
      const cy = Y(yc);
      g.save(); g.beginPath(); g.moveTo(cx - 70, cy); g.lineTo(cx - 60, cy - 9); g.lineTo(cx - 50, cy); g.lineTo(cx - 60, cy + 9); g.closePath(); g.fillStyle = K.COL.net; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
      K.lineSeg(g, cx - 50, cy, cx - 34, cy, K.COL.net, 2, [3, 3]);
      K.tag(g, 'centre of mass', cx - 60, cy - 20, { size: 11, bg: '#DCD3FF' });
    }
    if (st.on('front') && q && !landed) {
      // where the collapse has got to: the first gap that is still stretched
      const yy = ys || null;
      let yf = q[1];
      if (yy) { for (let i = 0; i < N - 1; i++) { if (yy[i + 1] - yy[i] > p.l0 * 1.02) { yf = yy[i]; break; } } }
      K.arrow(g, cx + 70, Y(yf), cx + 44, Y(yf), K.COL.gravity, { label: null, lw: 4 });
      K.tag(g, 'the news "let go" has got this far', cx + 76, Y(yf), { align: 'left', size: 11, bg: '#FFD0DC' });
    }
    // floor marks where the bottom started
    K.lineSeg(g, cx - 60, Y(rest.y[N - 1]) + (p.mb ? 30 : 6), cx + 60, Y(rest.y[N - 1]) + (p.mb ? 30 : 6), K.hexA(K.COL.gravity, 0.6), 2, [5, 4]);
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.arrow(g, cx + 100 + k * 8, Y(0) - 40, cx + 40, Y(0) - 26, K.COL.normal, { lw: 3.5, head: 11 }); }
  });
  st.onOver(() => {
    st.set('wait', tStill ? `${(tStill * 1000).toFixed(0)} ms` : run ? 'still waiting…' : '–');
    st.set('fall', samples ? `${(samples[samples.length - 1][0] * 1000).toFixed(0)} ms` : '–');
    st.set('drop', `${(rest.y[N - 1] * 100).toFixed(0)} cm below the hand`);
    st.set('m', `${Math.round(p.M * 1000)} g${p.mb ? ' + ball' : ''}`);
    graph.draw();
  });

  st.handle({ id: 'hand', cursor: 'pointer', hit: (x, y) => (Math.abs(x - Lay.cx) < 50 && y > Y(0) - 90 && y < Y(0) + 10 ? 0 : false), click: () => (run ? rehang() : letGo()) });
  const goBtn = el('button', { type: 'button', class: 'stg-act', text: 'Let go' }), hangBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Hang it up again' });
  goBtn.addEventListener('click', () => letGo()); hangBtn.addEventListener('click', () => rehang());
  st.controls(el('div', { class: 'stg-row' }, goBtn, hangBtn));
  st.hint('Tap the hand to let go of the slinky', { sticky: true });

  // ---------- why
  st.tour({
    title: 'Why does the bottom wait?',
    steps: [
      { say: 'Hanging still, every coil is held up by the stretched coils above it. The top gaps are stretched most (red): they hold up the whole slinky. The bottom gaps hold up almost nothing.', tools: { tension: true, cm: false, ball: false, front: false }, enter: () => rehang() },
      { say: 'Let go! In slow motion: the top shoots down… and the bottom **does not move at all**.', enter: (s) => { s.setSpeed(1 / 16); rehang(); setTimeout(letGo, 400); } },
      { say: 'The message "let go" has to travel down the slinky, coil by coil, as a wave. Until it arrives, the bottom coils feel exactly what they felt before: **held up**. So they stay put.', tools: { front: true }, enter: (s) => { s.setSpeed(1 / 16); rehang(); setTimeout(letGo, 400); } },
      { say: 'Meanwhile the **centre of mass** falls exactly like a dropped ball. Gravity is the only thing pulling on the slinky from outside, and it does not care how the coils are arranged.', tools: { front: false, cm: true, ball: true }, enter: (s) => { s.setSpeed(0.25); rehang(); setTimeout(letGo, 400); } },
    ],
    onEnd: () => { rehang(); st.setSpeed(0.25); },
  });

  // ---------- challenges
  const until = (cond, then) => { pending = { until: cond, then }; };
  const after = () => { pending = null; rehang(); };
  const done = () => run && samples && t >= samples[samples.length - 1][0];
  st.setChallenges([
    {
      id: 'wait', title: 'Let go', card: 'slinky.wait', lock: true, after,
      q: 'The moment you let go of the top, the bottom of the slinky…', choices: ['falls at once', 'stays still for a moment', 'jumps up a little'], answer: 1,
      run: (s, finish) => { s.setSpeed(1 / 16); rehang(); setTimeout(letGo, 300); until(done, () => finish(`It stayed still for ${(tStill * 1000).toFixed(0)} ms.`)); },
      skip: () => { if (!run) letGo(); t = samples[samples.length - 1][0]; },
      explain: 'The bottom only learns that the top has been let go when the collapse reaches it. Until then the coils above still hold it up, just as before.',
    },
    {
      id: 'cm', title: 'The middle of the slinky', card: 'slinky.cm', lock: true, after,
      q: 'Compared with a ball dropped at the same moment, the slinky’s centre of mass falls…', choices: ['more slowly', 'exactly the same', 'faster'], answer: 1,
      run: (s, finish) => { s.setSpeed(0.25); s.setTool('cm', true); s.setTool('ball', true); rehang(); setTimeout(letGo, 300); until(done, () => finish()); },
      skip: () => { if (!run) letGo(); t = samples[samples.length - 1][0]; },
      explain: 'Inside forces (the coils pulling on each other) cancel out for the slinky as a whole. Only gravity is left, so the centre of mass falls at g, just like the ball.',
    },
    {
      id: 'ball', title: 'A ball on the bottom', card: 'slinky.ball', lock: true, after,
      q: 'Hang a tennis ball from the bottom coil. After you let go, the bottom waits…', choices: ['a shorter time', 'the same time', 'a longer time'], answer: 2,
      run: (s, finish) => { s.setSpeed(1 / 16); const before = (() => { rig.mount(bench.id, 'bottom', 'bottom-none', 'challenge'); rehang(); return simulate(params(), 0.9, 5e-5, FLOOR).tMove; })(); rig.mount(bench.id, 'bottom', 'ball-tennis', 'challenge'); rehang(); setTimeout(letGo, 300); until(done, () => finish(`Without the ball: ${(before * 1000).toFixed(0)} ms. With it: ${(tStill * 1000).toFixed(0)} ms.`)); },
      skip: () => { if (!run) letGo(); t = samples[samples.length - 1][0]; },
      explain: 'The heavier the slinky hangs, the more it is stretched and the longer the collapse takes to travel down. The ball hovers too, and only falls when the news arrives.',
    },
  ]);

  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'drop', label: 'Measure', build: tabDrop },
  { id: 'graph', label: 'Film', build: tabGraph },
];

export default bench;
