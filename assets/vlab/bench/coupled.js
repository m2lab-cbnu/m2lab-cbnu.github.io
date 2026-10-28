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

bench.tabs = [
  { id: 'swing', label: 'Swing', build: tabSwing },
  { id: 'film', label: 'Film and spectrum', build: tabFilm },
  { id: 'cross', label: 'Avoided crossing', build: tabCross },
];

export default bench;
