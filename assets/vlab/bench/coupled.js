// 2F · Coupled pendulums. Two pendulums joined by a weak spring. Start one swinging and its
// energy drains into the other and back again, over and over. Tune one length past the other
// and the two "modes" refuse to cross: an avoided crossing, the same physics as magnons and
// photons sharing energy in the cavities on 3F.

import { el, slider, button, group, readout, canvasBox, note, segmented } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, fitCanvas } from './common.js';
import { fft } from '../physics/fft.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const G = 9.81, H = 0.45;   // the spring is fixed 45 cm below the pivots

const bench = {
  id: 'coupled', title: 'Coupled pendulums', kicker: '2F · Physics Playground', icon: '⚯', floor: 2,
  blurb: 'Energy sloshing between two swings.',
  slots: [
    { id: 'spring', label: 'Coupling spring', options: ['couple-weak', 'couple-mid', 'couple-strong'], def: 'couple-weak' },
    { id: 'bob1', label: 'Left bob', options: ['ball-steel', 'ball-wood', 'bob-brass'], def: 'ball-steel' },
    { id: 'bob2', label: 'Right bob', options: ['ball-steel', 'ball-wood', 'bob-brass'], def: 'ball-steel' },
    { id: 'watch', label: 'Watch with', options: ['eyes', 'camera'], def: 'eyes' },
  ],
};
bench.header = rigStrip(bench);

const S = { L1: 1.0, L2: 1.0, s: [0, 0, 0, 0], t: 0, run: false, trace: [], start: 'one' };

function params() {
  const b1 = phys(bench, 'bob1'), b2 = phys(bench, 'bob2'), kc = phys(bench, 'spring').kc;
  const I1 = b1.m * S.L1 * S.L1 + 0.4 * b1.m * (b1.d / 2) ** 2, I2 = b2.m * S.L2 * S.L2 + 0.4 * b2.m * (b2.d / 2) ** 2;
  return { m1: b1.m, m2: b2.m, I1, I2, L1: S.L1, L2: S.L2, kap: kc * H * H, c: 2e-4, b1: b1.id, b2: b2.id };
}
function deriv(p, s) {
  const [a1, w1, a2, w2] = s;
  const F = p.kap * (Math.sin(a2) - Math.sin(a1));
  return [w1, (-p.m1 * G * p.L1 * Math.sin(a1) + F * Math.cos(a1) - p.c * w1) / p.I1,
          w2, (-p.m2 * G * p.L2 * Math.sin(a2) - F * Math.cos(a2) - p.c * w2) / p.I2];
}
function rk4(p, s, h) {
  const k1 = deriv(p, s), s2 = s.map((v, i) => v + h / 2 * k1[i]);
  const k2 = deriv(p, s2), s3 = s.map((v, i) => v + h / 2 * k2[i]);
  const k3 = deriv(p, s3), s4 = s.map((v, i) => v + h * k3[i]);
  const k4 = deriv(p, s4);
  for (let i = 0; i < 4; i++) s[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
// the two normal-mode angular frequencies of the small swings
export function modes(p) {
  const a = (p.m1 * G * p.L1 + p.kap) / p.I1, d = (p.m2 * G * p.L2 + p.kap) / p.I2;
  const b = p.kap / p.I1, c = p.kap / p.I2;
  const tr = a + d, det = a * d - b * c, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  return [Math.sqrt(tr / 2 - disc), Math.sqrt(tr / 2 + disc)];
}
function energies(p, s) {
  const e1 = 0.5 * p.I1 * s[1] ** 2 + p.m1 * G * p.L1 * (1 - Math.cos(s[0]));
  const e2 = 0.5 * p.I2 * s[3] ** 2 + p.m2 * G * p.L2 * (1 - Math.cos(s[2]));
  return [e1, e2];
}

function tabSwing(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Pull one pendulum aside and let go. Watch the energy bars: the swing passes slowly to the other pendulum and back. A stiffer spring makes the exchange quicker; different lengths make it incomplete.' }));
  const box = canvasBox('', '16 / 10', 'The two pendulums and the spring');
  const l1 = slider({ label: 'Left length', unit: 'm', min: 0.5, max: 1.5, step: 0.005, value: S.L1, digits: 4, onInput: (v) => { S.L1 = v; } });
  const l2 = slider({ label: 'Right length', unit: 'm', min: 0.5, max: 1.5, step: 0.005, value: S.L2, digits: 4, onInput: (v) => { S.L2 = v; } });
  const st = segmented({ label: 'Start', options: [{ value: 'one', label: 'Left one only' }, { value: 'same', label: 'Both, same way' }, { value: 'opp', label: 'Both, opposite' }], value: S.start, onChange: (v) => { S.start = v; } });
  const go = button('Let go', () => start(), 'go');
  const stop = button('Stop them', () => { S.run = false; S.s = [0, 0, 0, 0]; }, 'quiet');
  const fRo = readout('The two mode frequencies'), swRo = readout('Full swap takes (calculated)'), eRo = readout('Energy now, left : right');
  pane.append(el('div', { class: 'vp-cols' }, el('div', { class: 'vp-side' }, group('Lengths', l1, l2), group('Start', st, el('div', { class: 'vp-row' }, go, stop))), el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, eRo, fRo, swRo))));

  function start() {
    const a = 8 * Math.PI / 180;
    S.s = S.start === 'one' ? [a, 0, 0, 0] : S.start === 'same' ? [a, 0, a, 0] : [a, 0, -a, 0];
    S.t = 0; S.run = true; S.trace = [];
    const p = params();
    const [w1, w2] = modes(p);
    if (Math.abs(S.L1 - 1) < 0.011 && Math.abs(S.L2 - 1) < 0.011 && p.b1 === p.b2 && current(bench, 'spring') === 'couple-weak' && S.start === 'one') rig.flag('coupledSwap', Math.round(Math.PI / (w2 - w1) * 100) / 100);
    rig.note({ bench: 'coupled', L1: S.L1, L2: S.L2, start: S.start });
  }
  const anim = loop((dt) => {
    const p = params();
    if (S.run) {
      let left = dt; while (left > 1e-9) { const h = Math.min(0.002, left); rk4(p, S.s, h); S.t += h; left -= h; }
      const [e1, e2] = energies(p, S.s);
      S.trace.push([S.t, S.s[0], S.s[2], e1, e2]); if (S.trace.length > 9000) S.trace.shift();
    }
    draw(p);
  });
  function draw(p = params()) {
    const { g, w, h } = fitCanvas(box.canvas);
    g.fillStyle = '#F1ECFF'; g.fillRect(0, 0, w, h);
    const sc = h * 0.62 / 1.5, py = h * 0.08, x1 = w * 0.36, x2 = w * 0.64;
    g.fillStyle = '#9DB8D3'; g.fillRect(w * 0.15, py - 8, w * 0.7, 8);
    const pos = (x, L, a) => [x + L * sc * Math.sin(a), py + L * sc * Math.cos(a)];
    const [bx1, by1] = pos(x1, p.L1, S.s[0]), [bx2, by2] = pos(x2, p.L2, S.s[2]);
    const [sx1, sy1] = pos(x1, H, S.s[0]), [sx2, sy2] = pos(x2, H, S.s[2]);
    g.strokeStyle = '#1B2440'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x1, py); g.lineTo(bx1, by1); g.moveTo(x2, py); g.lineTo(bx2, by2); g.stroke();
    // the spring
    g.strokeStyle = { 'couple-weak': '#3FAF7E', 'couple-mid': '#00A9D6', 'couple-strong': '#6B5BE6' }[current(bench, 'spring')]; g.lineWidth = 1.8; g.beginPath();
    const n = 12; for (let i = 0; i <= n; i++) { const u = i / n, x = sx1 + (sx2 - sx1) * u, y = sy1 + (sy2 - sy1) * u + (i === 0 || i === n ? 0 : (i % 2 ? -5 : 5)); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
    const bob = (x, y, id) => { const it = ITEMS[id]; g.fillStyle = it.icon[1]; g.strokeStyle = '#1B2440'; g.beginPath(); g.arc(x, y, 6 + 10 * Math.cbrt(it.phys.m / 0.3), 0, 7); g.fill(); g.stroke(); };
    bob(bx1, by1, p.b1); bob(bx2, by2, p.b2);
    // energy bars
    const [e1, e2] = energies(p, S.s), et = e1 + e2 || 1;
    const bw = w * 0.3, by = h * 0.9;
    g.fillStyle = '#E4DCFF'; g.fillRect(w * 0.18, by, bw, 12); g.fillRect(w * 0.52, by, bw, 12);
    g.fillStyle = '#E5534B'; g.fillRect(w * 0.18, by, bw * e1 / et, 12); g.fillStyle = '#3D6FB6'; g.fillRect(w * 0.52, by, bw * e2 / et, 12);
    g.fillStyle = '#12243A'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'left'; g.fillText('energy, left', w * 0.18, by - 4); g.fillText('energy, right', w * 0.52, by - 4);
    eRo.set(S.run ? `${Math.round(100 * e1 / et)} : ${Math.round(100 * e2 / et)}` : '–');
    const [w1, w2] = modes(p);
    fRo.set(`${(w1 / 2 / Math.PI).toFixed(4)} and ${(w2 / 2 / Math.PI).toFixed(4)} Hz`);
    swRo.set(`${(Math.PI / (w2 - w1)).toFixed(1)} s`);
  }
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

function tabFilm(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'The camera’s record of the swing. The angles beat like two notes slightly out of tune; the spectrum shows the two mode frequencies that beat against each other.' }));
  const box = canvasBox('', '16 / 8', 'Angles against time');
  const plot = new Plot(box.canvas, { xlabel: 'Time (s)', ylabel: 'Angle (°)' });
  const box2 = canvasBox('', '16 / 7', 'Spectrum of the left pendulum');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Frequency (Hz)', ylabel: 'Strength' });
  const need = note('This needs the <b>high-speed camera</b> (from the cabinet on 1F) in the “Watch with” slot.');
  pane.append(el('div', { class: 'vp-main' }, need, box, box2));
  function draw() {
    const cam = current(bench, 'watch') === 'camera';
    need.hidden = cam; box.hidden = box2.hidden = !cam;
    if (!cam || S.trace.length < 10) return;
    const tr = S.trace, t = tr.map((q) => q[0]);
    plot.setSeries([{ x: t, y: tr.map((q) => q[1] * 180 / Math.PI), color: COLORS.pink, width: 1.4, label: 'left' }, { x: t, y: tr.map((q) => q[2] * 180 / Math.PI), color: COLORS.signal, width: 1.4, label: 'right' }]).draw();
    // spectrum from the recorded angle, resampled evenly
    const N = 4096, T = t[t.length - 1] - t[0];
    if (T < 4) return;
    const re = new Float64Array(N), im = new Float64Array(N);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const tt = t[0] + T * i / N; while (j < tr.length - 2 && tr[j + 1][0] < tt) j++;
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
      re[i] = tr[j][1] * w;
    }
    fft(re, im);
    const fs = [], amp = [];
    for (let k = 1; k < N / 2; k++) { const f = k / T; if (f > 1.6) break; if (f < 0.2) continue; fs.push(f); amp.push(Math.hypot(re[k], im[k])); }
    plot2.setSeries([{ x: fs, y: amp, color: COLORS.violet, width: 2 }]).draw();
  }
  let last = 0;
  const tick = loop(() => { const now = performance.now(); if (now - last > 400) { last = now; draw(); } });
  onRig(bench, draw);
  return { show() { tick.start(); draw(); }, hide() { tick.stop(); }, resize() { draw(); } };
}

function tabCross(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Keep the left pendulum at its length and change the right one. Without the spring, the two frequencies would simply cross (dashed). With it they <b>repel</b>: the gap at the crossing is set by the coupling. This picture appears in every field of physics; on 3F it is magnons meeting microwave photons.' }));
  const box = canvasBox('', '16 / 10', 'Mode frequencies against the right length');
  const plot = new Plot(box.canvas, { xlabel: 'Right pendulum length (m)', ylabel: 'Frequency (Hz)' });
  const gapRo = readout('Smallest gap');
  pane.append(el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, gapRo)));
  function draw() {
    const save = S.L2, xs = [], lo = [], hi = [], u1 = [], u2 = [];
    let gap = Infinity, gapAt = 0;
    for (let L = 0.6; L <= 1.4001; L += 0.005) {
      S.L2 = L; const p = params(); const [w1, w2] = modes(p);
      xs.push(L); lo.push(w1 / 2 / Math.PI); hi.push(w2 / 2 / Math.PI);
      u1.push(Math.sqrt(p.m1 * G * p.L1 / p.I1) / 2 / Math.PI); u2.push(Math.sqrt(p.m2 * G * p.L2 / p.I2) / 2 / Math.PI);
      if (w2 - w1 < gap) { gap = w2 - w1; gapAt = L; }
    }
    S.L2 = save;
    plot.setSeries([{ x: xs, y: u1, color: COLORS.gold, dash: [5, 4], width: 1.4, label: 'left alone' }, { x: xs, y: u2, color: COLORS.gold, dash: [2, 3], width: 1.4, label: 'right alone' },
      { x: xs, y: lo, color: COLORS.signal, width: 2.4, label: 'lower mode' }, { x: xs, y: hi, color: COLORS.pink, width: 2.4, label: 'upper mode' }]).setVLines([{ x: S.L2, color: COLORS.violet, dash: [4, 4] }]).draw();
    gapRo.set(`${(gap / 2 / Math.PI * 1000).toFixed(1)} mHz, at ${gapAt.toFixed(2)} m`);
  }
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
const BOB_LOOK = {
  'ball-steel': { mat: 'chrome', pattern: null },
  'ball-wood': { mat: 'wood', pattern: K.PATTERN.wood },
  'bob-brass': { mat: 'brass', pattern: null },
};
const SPRING_LOOK = { 'couple-weak': ['#9BE3C1', '#3FAF7E'], 'couple-mid': ['#8FDDF5', '#00A9D6'], 'couple-strong': ['#CFC4FF', '#6B5BE6'] };

function tabPlay(pane) {
  const s = [0, 0, 0, 0];                 // left angle, left angular speed, right angle, right angular speed
  let held = -1, grabV = 0, lastA = 0, lastT = 0, first = true, pending = null, anim = null;
  let flow = 0, flowMax = 1e-6, Eref = 0, maxShare = 0, kick = 0;
  let Lay = { w: 800, h: 480, fy: 400, py: 52, sc: 220, x1: 300, x2: 500 };
  const COLL = '#E5534B', COLR = '#3D7FD6';
  const MAXA = 35 * Math.PI / 180;

  const st = new Stage(pane, {
    bench, npc: 'pip',
    label: 'Two pendulums hanging side by side, joined by a soft spring. Drag a bob aside and let go.',
    hello: 'Pull the **left** bob aside and **let go**, then keep an eye on the **energy bars** on the floor. Where does its swing go?',
    aspect: 16 / 10, phoneAspect: 0.8, minH: 340,
    onReset: () => { S.L1 = 1; S.L2 = 1; syncLen(); stopAll(); first = true; },
    keys: {
      arrow(dx, dy) { if (dx) { held = -1; s[0] = Math.max(-MAXA, Math.min(MAXA, s[0] + dx * 2 * Math.PI / 180)); s[1] = 0; frozen = true; } if (dy) setLen(1, S.L2 - dy * 0.02); },
      action() { frozen = false; sound.play('swing'); afterRelease(); },
    },
  });
  let frozen = false;                    // the left bob waits, held by the keyboard
  st.tool('energy', 'Energy', { icon: K.COL.ke, on: true }).tool('pull', 'Spring pull', { icon: K.COL.spring })
    .tool('modes', 'Two simple swings', { icon: K.COL.net }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('share', 'Energy, left : right').readout('swap', 'One full swap takes').readout('lens', 'String lengths').readout('k', 'Spring');
  const graph = st.liveGraph({ series: [{ id: 'a1', label: 'left (°)', color: COLL }, { id: 'a2', label: 'right (°)', color: COLR }], window: 24, ylabel: 'angle (°)', sym: true });

  // ---------- controls
  const mk = (t, cls = 'stg-act ghost') => el('button', { type: 'button', class: cls, text: t });
  const b1 = mk('Left one only', 'stg-act'), b2 = mk('Both together'), b3 = mk('Both opposite'), b4 = mk('Stop them');
  b1.addEventListener('click', () => startMode('one')); b2.addEventListener('click', () => startMode('same'));
  b3.addEventListener('click', () => startMode('opp')); b4.addEventListener('click', () => { stopAll(); sound.play('pop'); });
  const lenSl = el('input', { type: 'range', min: 0.6, max: 1.4, step: 0.01, value: S.L2, 'aria-label': 'Right string length in metres' });
  lenSl.addEventListener('input', () => setLen(1, +lenSl.value));
  st.controls(el('div', { class: 'stg-row' }, b1, b2), el('div', { class: 'stg-row' }, b3, b4), el('label', { class: 'stg-range' }, el('span', { text: 'Right string length' }), lenSl));
  function syncLen() { lenSl.value = S.L2; }
  function setLen(i, L) { L = Math.max(0.6, Math.min(1.4, Math.round(L * 100) / 100)); if (i === 0) S.L1 = L; else S.L2 = L; syncLen(); first = false; }

  // ---------- starting and stopping
  function stopAll() { held = -1; frozen = false; s.fill(0); flow = 0; Eref = 0; maxShare = 0; graph.clear(); }
  function startMode(kind, deg = 9) {
    const a = deg * Math.PI / 180;
    held = -1; frozen = false; first = false;
    s[0] = a; s[1] = 0; s[2] = kind === 'one' ? 0 : kind === 'same' ? a : -a; s[3] = 0;
    flow = 0; Eref = 0; maxShare = 0; graph.clear();
    sound.play('swing');
    afterRelease(kind);
  }
  function afterRelease(kind) {
    const p = params(), [w1, w2] = modes(p);
    const oneOnly = kind === 'one' || (kind === undefined && Math.abs(s[2]) < 0.01 && Math.abs(s[3]) < 0.05 && Math.abs(s[0]) > 0.03);
    if (oneOnly && Math.abs(S.L1 - 1) < 0.011 && Math.abs(S.L2 - 1) < 0.011 && p.b1 === p.b2 && current(bench, 'spring') === 'couple-weak') rig.flag('coupledSwap', Math.round(Math.PI / (w2 - w1) * 100) / 100);
    rig.note({ bench: 'coupled', L1: S.L1, L2: S.L2, start: kind || 'hand', how: 'play' });
    Eref = 0; maxShare = 0;
  }
  onRig(bench, () => { Eref = 0; });

  // ---------- physics
  const springE = (p) => 0.5 * p.kap * (Math.sin(s[2]) - Math.sin(s[0])) ** 2;
  st.onStep((dt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const a = anim; anim = null; if (a.then) a.then(); }
    }
    const p = params();
    if (dt > 0) {
      let left = dt;
      while (left > 1e-9) {
        const h = Math.min(0.002, left);
        if (held >= 0) { const a = s[2 * held]; rk4(p, s, h); s[2 * held] = a; s[2 * held + 1] = grabV; }
        else if (frozen) { const a = s[0]; rk4(p, s, h); s[0] = a; s[1] = 0; }
        else rk4(p, s, h);
        left -= h;
      }
      // the energy flowing through the spring into the right pendulum, averaged over about a swing
      const F = p.kap * (Math.sin(s[2]) - Math.sin(s[0]));
      const P = -F * Math.cos(s[2]) * s[3];
      flow += (P - flow) * Math.min(1, dt / 1.1);
      flowMax = Math.max(flowMax * (1 - dt * 0.05), Math.abs(flow));
      if (held < 0 && !frozen) graph.push(st.simT, { a1: s[0] * 180 / Math.PI, a2: s[2] * 180 / Math.PI });
      const [e1, e2] = energies(p, s), et = e1 + e2 + springE(p);
      Eref = Math.max(Eref * (1 - dt * 0.02), et);
      if (et > 1e-6) maxShare = Math.max(maxShare, e2 / (e1 + e2));
      // a soft tick whenever the right bob passes the middle with some energy: the swap is audible
      if (Math.sign(s[2]) !== kick && Math.abs(s[3]) > 0.02) { if (e2 / (et || 1) > 0.15) sound.play('tick', { vol: Math.min(0.6, e2 / (et || 1)), pitch: 1.25 }); kick = Math.sign(s[2]); }
    }
    if (pending && pending.cond()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- layout
  st.onResize((w, h, narrow) => {
    const fy = Math.round(h * 0.84), py = 52;
    const sc = (fy - py - 34) / 1.48;
    const gap = narrow ? w * 0.38 : Math.min(w * 0.27, 270);
    Lay = { w, h, narrow, fy, py, sc, x1: Math.round(w / 2 - gap / 2), x2: Math.round(w / 2 + gap / 2), gap };
  });
  const L = (i) => (i === 0 ? S.L1 : S.L2);
  const px = (i) => (i === 0 ? Lay.x1 : Lay.x2);
  const at = (i, len) => [px(i) + len * Lay.sc * Math.sin(s[2 * i]), Lay.py + len * Lay.sc * Math.cos(s[2 * i])];
  const bobR = (i) => { const b = phys(bench, i === 0 ? 'bob1' : 'bob2'); return Math.max(12, Math.min(24, b.d / 2 * Lay.sc * 2.6)); };

  // ---------- drawing
  function drawBack(g, w, h) {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[2], { floorH: 1 - Lay.fy / hh });
      K.box(gg, -8, 0, ww + 16, 24, K.MAT.steel, { r: 0, lw: 2 });
      gg.fillStyle = K.MAT.steel[2];
      for (let x = 30; x < ww; x += 80) { gg.beginPath(); gg.arc(x, 12, 2.5, 0, Math.PI * 2); gg.fill(); }
      // Kongi's note on the wall: two swings taking turns
      if (!Lay.narrow && Lay.x1 > 230) {
        const nx = Math.round(Lay.x1 * 0.18), ny = Math.round(hh * 0.44), nw = 150, nh = 104;
        gg.save(); gg.translate(nx + nw / 2, ny + nh / 2); gg.rotate(-0.035); gg.translate(-nw / 2, -nh / 2);
        K.box(gg, 0, 0, nw, nh, K.MAT.cream, { r: 4, bands: false });
        gg.fillStyle = '#B9A8FF'; gg.beginPath(); gg.arc(nw / 2, 5, 4.5, 0, Math.PI * 2); gg.fill();
        K.text(gg, 'taking turns', 12, 24, { size: 12, weight: 600, font: K.PIXF });
        for (const [c, ph, y0] of [['#E5534B', 0, 48], ['#3D7FD6', Math.PI / 2, 80]]) {
          gg.beginPath();
          for (let x = 0; x <= nw - 24; x++) { const u = x / (nw - 24), env = Math.abs(Math.cos(Math.PI * u + ph)), y = y0 + 11 * env * Math.sin(u * 2 * Math.PI * 7); if (x) gg.lineTo(12 + x, y); else gg.moveTo(12 + x, y); }
          gg.strokeStyle = c; gg.lineWidth = 1.8; gg.stroke();
        }
        gg.restore();
      }
      // a plant in the corner
      const k = Lay.narrow ? 0.7 : 1, px0 = ww - 44 * k, py0 = Lay.fy + 8;
      K.shadow(gg, px0, py0 + 2, 26 * k, 7 * k, 0.25);
      const leaf = (a, l, c) => { gg.save(); gg.translate(px0, py0 - 34 * k); gg.rotate(a); gg.beginPath(); gg.ellipse(0, -l * k / 2, 9 * k, l * k / 2, 0, 0, Math.PI * 2); gg.fillStyle = c; gg.fill(); gg.lineWidth = 2; gg.strokeStyle = K.LINE; gg.stroke(); gg.restore(); };
      leaf(-0.9, 46, '#3A9A55'); leaf(0.9, 44, '#3A9A55'); leaf(-0.35, 58, '#62C46E'); leaf(0.4, 54, '#62C46E'); leaf(0, 66, '#4CB782');
      K.box(gg, px0 - 20 * k, py0 - 36 * k, 40 * k, 38 * k, K.MAT.violet, { r: 6 });
    });
  }
  function drawClamp(g, i, hover) {
    const x = px(i), y = Lay.py;
    K.rod(g, x, 18, x, y - 6, 8, K.MAT.steel, { lw: 2 });
    K.box(g, x - 13, y - 12, 26, 14, K.MAT.steel, { r: 3 });
    K.ball(g, x + (i === 0 ? -19 : 19), y - 5, 6.5, hover ? 'yellow' : 'brass', { lw: 2 });
    if (hover) K.tag(g, '↕ drag to change the length', x + (i === 0 ? -30 : 30), y - 5, { align: i === 0 ? 'right' : 'left', size: 11.5 });
  }
  function drawBob(g, i) {
    const [bx, by] = at(i, L(i)), r = bobR(i), id = current(bench, i === 0 ? 'bob1' : 'bob2'), look = BOB_LOOK[id] || BOB_LOOK['ball-steel'];
    const hgt = Math.max(0, Lay.fy - by);
    K.shadow(g, bx, Lay.fy + 8, r * (1.3 - Math.min(0.6, hgt / 900)), r * 0.32, 0.22 * (1 - Math.min(0.7, hgt / 700)));
    K.lineSeg(g, px(i), Lay.py, bx, by, K.LINE, 2.2);
    if (st.hovering('bob' + i) || held === i) K.glow(g, bx, by, r * 2.2, '#00D4FF', 0.35);
    K.ball(g, bx, by, r, look.mat, { pattern: look.pattern });
    // a coloured band, so you can tell left from right on the graph and the bars
    g.save(); g.beginPath(); g.arc(bx, by, r + 3.5, -Math.PI * 0.85, -Math.PI * 0.15); g.strokeStyle = i === 0 ? COLL : COLR; g.lineWidth = 3.5; g.lineCap = 'round'; g.stroke(); g.restore();
    if (st.hovering('bob' + i) && held < 0) K.tag(g, 'drag me', bx, by - r - 16, { size: 11.5 });
  }
  function drawSpring(g) {
    const p = params(), [a1x, a1y] = at(0, H), [a2x, a2y] = at(1, H);
    const [c, d] = SPRING_LOOK[current(bench, 'spring')] || SPRING_LOOK['couple-weak'];
    const stiff = current(bench, 'spring') === 'couple-strong' ? 1.3 : current(bench, 'spring') === 'couple-mid' ? 1.12 : 1;
    K.spring(g, a1x, a1y, a2x, a2y, { coils: 11, r: 6.5 * stiff, lw: 2.2 * stiff, color: c, dark: d, ends: 8 });
    for (const [x, y] of [[a1x, a1y], [a2x, a2y]]) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fillStyle = K.MAT.steel[0]; g.fill(); g.lineWidth = 1.8; g.strokeStyle = K.LINE; g.stroke(); }
    if (st.on('pull')) {
      const dx = H * (Math.sin(s[2]) - Math.sin(s[0])), sc = 40 / (H * 0.06);
      const len = Math.max(-70, Math.min(70, dx * sc));
      if (Math.abs(len) > 4) {
        K.arrow(g, a1x, a1y, a1x + len, a1y, K.COL.spring, { lw: 4, head: 11, label: Math.abs(len) > 26 ? (len > 0 ? 'pull' : 'push') : null, labelAt: 'tip', size: 11 });
        K.arrow(g, a2x, a2y, a2x - len, a2y, K.COL.spring, { lw: 4, head: 11 });
      }
    }
    if (st.on('energy') && flowMax > 1e-7) {
      const k = Math.min(1, Math.abs(flow) / flowMax);
      if (k > 0.08) {
        const ym = Math.min(a1y, a2y) - 26, from = flow > 0 ? a1x + 14 : a2x - 14, to = flow > 0 ? a2x - 14 : a1x + 14;
        g.save(); g.globalAlpha = 0.25 + 0.75 * k;
        K.arrow(g, from, ym, to, ym, flow > 0 ? COLR : COLL, { lw: 3 + 7 * k, head: 10 + 8 * k });
        g.restore();
        if (k > 0.35) K.tag(g, 'energy', (a1x + a2x) / 2, ym - 18, { size: 11, bg: '#FFF4C7' });
      }
    }
    void p;
  }
  function drawBars(g) {
    const p = params(), [e1, e2] = energies(p, s), es = springE(p), ref = Math.max(Eref, 1e-9);
    const bw = Math.min(Lay.gap * 0.86, 170), bh = 14, y = Lay.fy + (Lay.h - Lay.fy) * 0.42;
    [[0, e1, COLL], [1, e2, COLR]].forEach(([i, e, col]) => {
      const x = px(i) - bw / 2;
      g.save(); K.rr(g, x, y, bw, bh, 7); g.fillStyle = 'rgba(255,253,246,0.92)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
      const f = Math.max(0, Math.min(1, e / ref));
      if (f > 0.004) { K.rr(g, x + 2, y + 2, (bw - 4) * f, bh - 4, 5); g.fillStyle = col; g.fill(); }
      g.restore();
      K.text(g, `${i === 0 ? 'left' : 'right'}: ${Math.round(f * 100)}%`, px(i), y - 6, { size: 11.5, weight: 600, align: 'center', color: K.mixHex(col, '#12243A', 0.35) });
    });
    if (es / ref > 0.03) K.text(g, `in the spring: ${Math.round(es / ref * 100)}%`, Lay.w / 2, y + bh + 14, { size: 10.5, weight: 600, align: 'center', color: '#2E7D5B' });
  }
  function drawModes(g) {
    const p = params(), [w1, w2] = modes(p);
    const qp = (s[0] + s[2]) / 2, qm = (s[0] - s[2]) / 2, vp = (s[1] + s[3]) / 2, vm = (s[1] - s[3]) / 2;
    const Ap = Math.hypot(qp, vp / w1), Am = Math.hypot(qm, vm / w2), Amax = Math.max(1e-6, Ap + Am);
    const iw = Lay.narrow ? 92 : Math.min(176, Lay.w * 0.2), ih = Lay.narrow ? 92 : 128;
    const box = (x, title, sub, a1, a2, A) => {
      g.save(); K.rr(g, x, 32, iw, ih, 10); g.fillStyle = 'rgba(255,253,246,0.95)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
      K.text(g, title, x + iw / 2, 48, { size: Lay.narrow ? 11 : 12.5, weight: 700, align: 'center' });
      const cx = x + iw / 2, gp = iw * 0.34, ly = 58, ll = ih - (Lay.narrow ? 46 : 58), mag = 1.6;
      g.fillStyle = K.MAT.steel[1]; g.fillRect(cx - gp / 2 - 12, ly - 3, gp + 24, 4);
      const ends = [[cx - gp / 2, a1 * mag, COLL], [cx + gp / 2, a2 * mag, COLR]].map(([x0, a, col]) => {
        const bx = x0 + ll * Math.sin(a), by = ly + ll * Math.cos(a);
        K.lineSeg(g, x0, ly, bx, by, K.LINE, 1.5);
        g.beginPath(); g.arc(bx, by, 6, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = K.LINE; g.stroke();
        return [x0 + ll * 0.45 * Math.sin(a), ly + ll * 0.45 * Math.cos(a)];
      });
      K.lineSeg(g, ends[0][0], ends[0][1], ends[1][0], ends[1][1], '#3FAF7E', 2, [3, 2]);
      // how big this way of swinging is: it never changes while the pendulums trade energy
      const by = 32 + ih - (Lay.narrow ? 14 : 30);
      g.fillStyle = '#E4DAFF'; g.fillRect(x + 10, by, iw - 20, 6);
      g.fillStyle = K.COL.net; g.fillRect(x + 10, by, (iw - 20) * Math.min(1, A / Amax), 6);
      if (!Lay.narrow) K.text(g, sub, x + iw / 2, by + 20, { size: 10.5, weight: 600, align: 'center', color: '#5B4BC4' });
    };
    box(10, 'Together', `${(w1 / 2 / Math.PI).toFixed(3)} swings/s`, qp, qp, Ap);
    box(Lay.w - 10 - iw, 'Opposite', `${(w2 / 2 / Math.PI).toFixed(3)} swings/s`, qm, -qm, Am);
  }

  st.onDraw((g, w, h) => {
    drawBack(g, w, h);
    drawClamp(g, 0, st.hovering('len0')); drawClamp(g, 1, st.hovering('len1'));
    if (st.on('modes')) drawModes(g);
    drawBob(g, 0); drawBob(g, 1);
    drawSpring(g);
    if (st.on('energy')) drawBars(g);
    if (first) {
      const [bx, by] = at(0, L(0)), k = (Math.sin(st.t * 3) + 1) / 2;
      K.arrow(g, bx - 110 - k * 8, by - 40, bx - bobR(0) - 8, by - 6, K.COL.normal, { lw: 3.5, head: 11 });
      K.tag(g, 'pull me aside', bx - 116 - k * 8, by - 52, { size: 11.5, align: 'right' });
    }
  });
  st.onOver(() => {
    const p = params(), [e1, e2] = energies(p, s), [w1, w2] = modes(p), tot = e1 + e2;
    st.set('share', tot > 1e-7 ? `${Math.round(100 * e1 / tot)} : ${Math.round(100 * e2 / tot)}` : '–');
    st.set('swap', `${(Math.PI / (w2 - w1)).toFixed(1)} s`);
    st.set('lens', `${S.L1.toFixed(2)} m and ${S.L2.toFixed(2)} m`);
    st.set('k', ITEMS[current(bench, 'spring')].name.replace(' coupling spring', ''));
    graph.draw();
  });

  // ---------- hands
  for (const i of [0, 1]) {
    st.handle({
      id: 'bob' + i, cursor: 'grab',
      hit: (x, y) => { const [bx, by] = at(i, L(i)), d = Math.hypot(x - bx, y - by); return d < bobR(i) + 14 ? d : false; },
      down: () => { held = i; frozen = false; grabV = 0; lastA = s[2 * i]; lastT = performance.now(); first = false; },
      move: (x, y) => {
        const a = Math.max(-MAXA, Math.min(MAXA, Math.atan2(x - px(i), Math.max(10, y - Lay.py))));
        const now = performance.now(), dtm = Math.max(0.008, (now - lastT) / 1000);
        grabV = grabV * 0.5 + 0.5 * (a - lastA) / dtm; lastA = a; lastT = now;
        s[2 * i] = a;
      },
      up: () => { const v = Math.max(-2.5, Math.min(2.5, grabV)); held = -1; s[2 * i + 1] = performance.now() - lastT < 80 ? v : 0; if (Math.abs(s[2 * i]) > 0.03) sound.play('swing'); afterRelease(); },
    });
    st.handle({
      id: 'len' + i, cursor: 'ns-resize',
      hit: (x, y) => { const kx = px(i) + (i === 0 ? -19 : 19); const d = Math.hypot(x - kx, y - (Lay.py - 5)); return d < 16 ? d : false; },
      down: () => { first = false; },
      move: (x, y) => { setLen(i, (y - Lay.py + 30) / Lay.sc + 0.3); },
    });
  }

  // ---------- why it happens
  const bobAt = (i) => { const [x, y] = at(i, L(i)); return [x, y, bobR(i) + 14]; };
  st.tour({
    title: 'Where does the swing go?',
    steps: [
      { say: 'Here the **left** pendulum is pulled aside and let go. At first the right one hardly moves. Watch the energy bars on the floor.',
        tools: { energy: true, pull: false, modes: false, graph: false }, enter: () => { S.L1 = 1; S.L2 = 1; syncLen(); startMode('one'); }, mark: () => bobAt(0) },
      { say: 'The spring is the messenger. Every swing, the left pendulum gives the right string a **tiny tug**. Both pendulums have the same length, so the tugs always come at the right moment and add up, just like pushing a friend on a swing.',
        tools: { pull: true }, mark: () => { const [x1, y1] = at(0, H), [x2, y2] = at(1, H); return [(x1 + x2) / 2, (y1 + y2) / 2, 30]; } },
      { say: 'After a while the left one is almost still and the right one swings fully. Then it all flows **back**. Nothing is lost on the way: the two bars always add up to the same total.',
        tools: { pull: false } },
      { say: 'There are two special ways to swing that never swap. **Together**: the spring never stretches, so each swings at its own pace. **Opposite**: the spring pulls every swing, so they go a little faster.',
        tools: { modes: true }, enter: () => startMode('same') },
      { say: 'Every other swing is a **mix of these two**. Their paces differ a little, so they slowly drift in and out of step. In step, they add up on the left and cancel on the right; half a beat later, the other way round. The size of each never changes (the purple bars).',
        enter: () => startMode('one') },
      { say: 'Make the right pendulum **shorter**: now their paces no longer match, so only part of the energy gets across, and it comes back sooner. On 3F the same thing happens between magnons and microwave photons.',
        tools: { modes: false, graph: true }, enter: () => { S.L2 = 0.8; syncLen(); startMode('one'); }, leave: () => { S.L2 = 1; syncLen(); } },
    ],
    onEnd: () => { S.L2 = 1; syncLen(); startMode('one'); },
  });

  // ---------- challenges
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  const swapT = () => { const [w1, w2] = modes(params()); return Math.PI / (w2 - w1); };
  const share = () => { const [e1, e2] = energies(params(), s); return e2 / Math.max(1e-12, e1 + e2); };
  const base = () => { S.L1 = 1; S.L2 = 1; syncLen(); stopAll(); };
  st.setChallenges([
    {
      id: 'stiff', title: 'A stiffer spring', card: 'coupled.stiff', lock: true, after: () => { pending = null; },
      setup: () => { base(); rig.mount(bench.id, 'spring', 'couple-weak', 'challenge'); },
      q: 'Swap the soft spring for a stiffer one, then start the left pendulum again. The energy now crosses over…',
      choices: ['faster', 'slower', 'just as fast'], answer: 0,
      run: (s0, finish) => {
        s0.setPaused(false); s0.setSpeed(1);
        const tSoft = swapT();
        rig.mount(bench.id, 'spring', 'couple-mid', 'challenge'); startMode('one');
        const tStiff = swapT();
        wait(Math.min(9, tStiff * 1.15), () => finish(`Soft spring: ${tSoft.toFixed(1)} s per swap. Stiffer spring: ${tStiff.toFixed(1)} s.`));
      },
      explain: 'A stiffer spring gives bigger tugs every swing, so the energy is handed over in fewer swings. Swap time = π / (difference of the two paces).',
    },
    {
      id: 'together', title: 'Both at once', card: 'coupled.mode', lock: true, after: () => { pending = null; },
      setup: () => { base(); },
      q: 'Pull both pendulums the same way, side by side, and let go together. What happens over time?',
      choices: ['the energy still swaps back and forth', 'they keep swinging together, nothing swaps', 'they slowly stop each other'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); st.setTool('modes', true); startMode('same'); wait(10, () => finish('Ten seconds on, still in step.')); },
      explain: 'Swinging together, the spring is never stretched, so it never tugs and nothing is handed over. This is one of the two "modes"; any other swing is a mix of the two.',
    },
    {
      id: 'detune', title: 'Out of tune', card: 'coupled.detune', lock: true, after: () => { pending = null; anim = null; },
      setup: () => { base(); },
      q: 'Make the right pendulum 20 cm shorter, then start the left one. How much of the swing reaches the right pendulum?',
      choices: ['all of it, just later', 'only part of it', 'none at all'], answer: 1,
      run: (s0, finish) => {
        s0.setPaused(false); s0.setSpeed(1);
        anim = { t0: st.simT, from: 1, to: 0.8, dur: 1.4, set: (v) => { S.L2 = Math.round(v * 100) / 100; syncLen(); }, then: () => { startMode('one'); wait(Math.min(10, swapT() * 1.3), () => finish(`At most ${Math.round(maxShare * 100)}% of the energy got across.`)); } };
      },
      explain: 'The tugs only add up when they come at the right moment. With different lengths they drift out of time, so part of the energy is handed back before the swap is done. Matching paces is called resonance.',
    },
  ]);

  st.peek = () => ({ bob0: at(0, L(0)), bob1: at(1, L(1)), s: s.slice(), share: share(), maxShare });   // for tests
  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'swing', label: 'Measure', build: tabSwing },
  { id: 'film', label: 'Film and spectrum', build: tabFilm },
  { id: 'cross', label: 'Avoided crossing', build: tabCross },
];

export default bench;
