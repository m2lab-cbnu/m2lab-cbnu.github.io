// 2F · Slinky drop. Hold a slinky by its top and let it hang, then let go. The top rushes down,
// but the bottom stays exactly where it was until the collapse reaches it: the bottom does not
// "know" yet. The model: coils joined by springs that stop when the coils touch, and touching
// coils stick together (an inelastic collapse front).

import { el, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

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

bench.tabs = [
  { id: 'drop', label: 'Drop', build: tabDrop },
  { id: 'graph', label: 'Film', build: tabGraph },
];

export default bench;
