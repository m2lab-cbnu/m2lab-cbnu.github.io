// 1F · Vibrating string (Melde's experiment). A string runs from a vibrator over a pulley to a
// hanging mass. At the right frequencies it breaks into loops: standing waves. Swap the string,
// the hanging mass and the lighting, find the harmonics, and get the wave speed.

import { el, slider, button, group, readout, canvasBox, note, segmented, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitProp, fitLine, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound as sfx } from '../rpg/sound.js';

const LEN = 1.20, G = 9.81;
const QS = { 'str-thin': 140, 'str-cord': 90, 'str-steel': 420, 'str-x': 160 };

const bench = {
  id: 'strings', title: 'Vibrating string', kicker: '1F · Classics Hall', icon: '∿', floor: 1,
  blurb: 'Standing waves, harmonics and tension.',
  slots: [
    { id: 'string', label: 'String', options: ['str-thin', 'str-cord', 'str-steel', 'str-x'], def: 'str-cord' },
    { id: 'mass', label: 'Hanging mass', options: ['m50', 'm100', 'm200', 'm500'], def: 'm200' },
    { id: 'light', label: 'Lighting', options: ['roomlight', 'strobe'], def: 'roomlight' },
    { id: 'sensor', label: 'Listen with', options: ['eyes', 'mic'], def: 'eyes' },
  ],
};
bench.header = rigStrip(bench);

const S = { f: 20, A0: 0.0005, t: 0, sound: false, n: 1 };

function params() {
  const s = phys(bench, 'string'), m = phys(bench, 'mass');
  const mu = s.id === 'str-x' ? rig.secret('stringMu') / 1000 : s.mu;
  const T = m.m * G, v = Math.sqrt(T / mu);
  return { mu, T, v, Q: QS[s.id] || 120, id: s.id };
}
// complex arithmetic for the steady state y(x) = A0 sin(k(L - x)) / sin(kL), with a lossy k
function csin(re, im) { return [Math.sin(re) * Math.cosh(im), Math.cos(re) * Math.sinh(im)]; }
function cdiv(a, b) { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }
export function shape(p, f, A0, n = 120) {
  const kr = 2 * Math.PI * f / p.v, ki = -kr / (2 * p.Q);
  const den = csin(kr * LEN, ki * LEN);
  const out = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const x = LEN * i / n, num = csin(kr * (LEN - x), ki * (LEN - x));
    out[i] = cdiv(num, den).map((v) => v * A0);   // complex amplitude [re, im]
  }
  return out;
}
function antinodeAmp(p, f, A0) {
  const sh = shape(p, f, A0, 60);
  let m = 0; for (const [a, b] of sh) m = Math.max(m, Math.hypot(a, b));
  return m;
}

const table = dataTable([
  { key: 'n', label: 'Loops n' },
  { key: 'f', label: 'Frequency (Hz)', fmt: (v) => v.toFixed(2) },
  { key: 'str', label: 'String', fmt: (v) => ITEMS[v].name },
  { key: 'M', label: 'Hanging mass', fmt: (v) => ITEMS[v].name },
], { caption: 'Resonances you found', onChange: () => bench._graph && bench._graph() });

let audio = null;
function sound(on, f, level) {
  try {
    if (!audio && on) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'sine'; osc.connect(gain); gain.connect(ctx.destination); gain.gain.value = 0; osc.start();
      audio = { ctx, osc, gain };
    }
    if (!audio) return;
    audio.osc.frequency.setTargetAtTime(Math.max(20, f), audio.ctx.currentTime, 0.02);
    audio.gain.gain.setTargetAtTime(on ? Math.min(0.18, level) : 0, audio.ctx.currentTime, 0.05);
  } catch (_) {}
}

function tabString(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Turn the frequency up slowly. Most of the time the string barely moves, then suddenly it swings in one loop, then two, three... Each resonance has <b>f<sub>n</sub> = n v / 2L</b>, with the wave speed <b>v = √(T/μ)</b> set by the tension and the mass per metre.' }));
  const box = canvasBox('', '16 / 6', 'The vibrating string');
  const fS = slider({ label: 'Vibrator frequency', unit: 'Hz', min: 2, max: 400, step: 0.01, value: S.f, digits: 5, onInput: (v) => { S.f = v; } });
  const fine = el('div', { class: 'vp-row' }, ...[-1, -0.1, 0.1, 1].map((d) => button(`${d > 0 ? '+' : '−'}${Math.abs(d)} Hz`, () => fS.set(Math.max(2, Math.min(400, Math.round((S.f + d) * 100) / 100))), 'quiet')));
  const aS = slider({ label: 'Vibrator amplitude', unit: 'mm', min: 0.1, max: 1.5, step: 0.05, value: S.A0 * 1000, digits: 3, onInput: (v) => { S.A0 = v / 1000; } });
  const snd = checkbox({ label: 'Listen (plays the frequency)', checked: false, onChange: (v) => { S.sound = v; if (!v) sound(false, S.f, 0); } });
  const nS = slider({ label: 'Loops you count', unit: '', min: 1, max: 12, step: 1, value: 1, digits: 2, onInput: (v) => { S.n = v; } });
  const rec = button('Record this resonance', () => {
    table.add({ n: S.n, f: S.f, str: current(bench, 'string'), M: current(bench, 'mass') });
    rig.note({ bench: 'strings', f: S.f, n: S.n, str: current(bench, 'string'), M: current(bench, 'mass') });
  }, 'secondary');
  const ampRo = readout('Biggest swing'), micRo = readout('Microphone'), vRo = readout('Tension');
  pane.append(el('div', { class: 'vp-cols' },
    el('div', { class: 'vp-side' }, group('Vibrator', fS, fine, aS, snd), group('Record', nS, rec)),
    el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ampRo, micRo, vRo))), table.el);

  let p = params(), sh = shape(p, S.f, S.A0), lastF = -1, lastKey = '';
  const anim = loop((dt) => {
    S.t += dt;
    const key = current(bench, 'string') + current(bench, 'mass') + S.A0;
    if (S.f !== lastF || key !== lastKey) { p = params(); sh = shape(p, S.f, S.A0); lastF = S.f; lastKey = key; }
    draw();
  });
  function draw() {
    const { g, w, h } = fitCanvas(box.canvas);
    const strobe = current(bench, 'light') === 'strobe';
    g.fillStyle = strobe ? '#0E1630' : '#EAF6FC'; g.fillRect(0, 0, w, h);
    const x0 = 70, x1 = w - 70, yc = h * 0.42, yScale = Math.min(h * 0.32, 60) / 0.012;   // 12 mm to 60 px at most
    // vibrator
    g.fillStyle = '#F29E4C'; g.fillRect(x0 - 50, yc - 24, 46, 48); g.fillStyle = '#C96F2A'; g.fillRect(x0 - 10, yc - 4, 12, 8);
    // pulley, hanging mass
    g.fillStyle = '#4F6A8F'; g.beginPath(); g.arc(x1 + 10, yc + 10, 10, 0, 7); g.fill();
    g.strokeStyle = strobe ? '#FFFDF6' : '#1B2440'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x1 + 20, yc + 10); g.lineTo(x1 + 20, h * 0.66); g.stroke();
    g.fillStyle = '#D8B04A'; g.fillRect(x1 + 8, h * 0.66, 24, 22); g.fillStyle = strobe ? '#FFFDF6' : '#12243A'; g.font = '600 11px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(ITEMS[current(bench, 'mass')].name.replace(' mass', ''), x1 + 20, h * 0.66 - 6);
    // the string
    const N = sh.length - 1, col = { 'str-thin': '#6FB7F0', 'str-cord': '#E08A3B', 'str-steel': '#4F6A8F', 'str-x': '#6B5BE6' }[current(bench, 'string')];
    let maxA = 0; for (const [a, b] of sh) maxA = Math.max(maxA, Math.hypot(a, b));
    const cap = (y) => Math.max(-h * 0.38, Math.min(h * 0.38, y));
    if (!strobe) {
      // a blur between the extremes, as the eye sees it
      g.fillStyle = col + '55'; g.beginPath();
      for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N, a = Math.hypot(sh[i][0], sh[i][1]) * yScale; if (i === 0) g.moveTo(x, yc - cap(a)); else g.lineTo(x, yc - cap(a)); }
      for (let i = N; i >= 0; i--) { const x = x0 + (x1 - x0) * i / N, a = Math.hypot(sh[i][0], sh[i][1]) * yScale; g.lineTo(x, yc + cap(a)); }
      g.fill();
      g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0, yc); g.lineTo(x1, yc); g.stroke();
    } else {
      // the strobe flashes 0.4 Hz off the vibrator, so the motion plays back in slow motion
      const ph = 2 * Math.PI * 0.4 * S.t;
      g.strokeStyle = '#FFE07A'; g.lineWidth = 2.2; g.beginPath();
      for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N, y = (sh[i][0] * Math.cos(ph) - sh[i][1] * Math.sin(ph)) * yScale; if (i === 0) g.moveTo(x, yc - cap(y)); else g.lineTo(x, yc - cap(y)); }
      g.stroke();
    }
    // a metre stick under the string
    g.fillStyle = strobe ? '#9DB8D3' : '#C98A4E'; g.fillRect(x0, h * 0.86, x1 - x0, 3);
    g.font = '500 10px "Plex", system-ui, sans-serif'; g.fillStyle = strobe ? '#CFE0F0' : '#8E5A35';
    for (let cm = 0; cm <= 120; cm += 10) { const x = x0 + (x1 - x0) * cm / 120; g.fillRect(x, h * 0.86 - 5, 1, 5); if (cm % 20 === 0) g.fillText(cm + '', x, h * 0.86 + 14); }
    const mm = maxA * 1000;
    ampRo.set(mm < 0.6 ? 'hardly moves' : `about ${mm < 3 ? mm.toFixed(1) : Math.round(mm)} mm`);
    const mic = current(bench, 'sensor') === 'mic';
    micRo.set(mic ? `${(20 * Math.log10(Math.max(1e-6, maxA) / 1e-5)).toFixed(1)} dB` : 'needs the microphone');
    vRo.set(`${p.T.toFixed(2)} N (from the mass)`);
    if (S.sound) sound(true, S.f, 0.02 + Math.min(1, maxA / 0.01) * 0.16);
  }
  onRig(bench, () => { lastKey = ''; });
  return { show() { anim.start(); }, hide() { anim.stop(); sound(false, S.f, 0); }, resize() { draw(); } };
}

function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Frequency against the number of loops is a straight line through the origin, with slope <b>v / 2L</b> (L = 1.20 m). From v and the tension T = Mg you get the mass per metre, <b>μ = T / v²</b>.' }));
  const box = canvasBox('', '16 / 10', 'Resonant frequency against number of loops');
  const plot = new Plot(box.canvas, { xlabel: 'Loops n', ylabel: 'Frequency (Hz)' });
  const vRo = readout('Wave speed v'), muRo = readout('Mass per metre μ');
  pane.append(el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, vRo, muRo), note('Points are fitted for the string and hanging mass now on the bench.')));
  function draw() {
    const str = current(bench, 'string'), M = current(bench, 'mass');
    const rows = table.rows.filter((r) => r.str === str && r.M === M);
    const x = rows.map((r) => r.n), y = rows.map((r) => r.f);
    const fit = x.length ? fitProp(x, y) : null;
    const series = [{ x, y, points: true, r: 4.5, color: COLORS.signal, label: 'your resonances' }];
    if (fit) series.push({ x: [0, 12], y: [0, 12 * fit.a], color: COLORS.pink, dash: [6, 4], width: 2, label: 'best line through 0' });
    plot.xlim = [0, Math.max(6, ...x) + 1]; plot.setSeries(series).draw();
    if (fit) {
      const v = 2 * LEN * fit.a, T = ITEMS[M].phys.m * G;
      vRo.set(`${v.toFixed(2)} m/s`); muRo.set(`${(T / (v * v) * 1000).toFixed(3)} g/m`);
    } else { vRo.set('–'); muRo.set('–'); }
  }
  bench._graph = draw;
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
const NM = 28;                 // modes kept for a plucked string
const UP = 8;                  // sounds are played three octaves up, so laptop speakers can manage them
function shapeL(p, f, A0, Lv, n = 120) {
  const kr = 2 * Math.PI * f / p.v, ki = -kr / (2 * p.Q);
  const den = csin(kr * Lv, ki * Lv);
  const out = new Array(n + 1);
  for (let i = 0; i <= n; i++) { const x = Lv * i / n, num = csin(kr * (Lv - x), ki * (Lv - x)); out[i] = cdiv(num, den).map((v) => v * A0); }
  return out;
}

function tabPlay(pane) {
  const st = new Stage(pane, {
    bench, npc: 'hoo', label: 'A stretched string held by a weight. Pull it sideways and let go to pluck it, or switch on the vibrator.',
    hello: 'Pull the string sideways and **let go** to pluck it: you will hear its note. Slide the **bridge** to shorten it, or switch on the **vibrator** and look for standing waves.',
    aspect: 16 / 8.4,
    onReset: () => { modes.fill(0); finger = null; drive.on = false; Lv = LEN; syncDrive(); },
    onHide: () => hum.set(100, 0),
    keys: { arrow(dx) { if (dx) setF(drive.f * (dx > 0 ? 1.01 : 1 / 1.01)); }, action() { pluckAt(Lv * 0.25, 0.02); } },
  });
  st.tool('nodes', 'Nodes', { icon: K.COL.gravity }).tool('waves', 'Two travelling waves', { icon: K.COL.vel }).tool('harm', 'Harmonics', { icon: K.COL.net, on: true }).tool('graph', 'Graph', { icon: K.COL.pe });
  st.readout('f1', 'Its note (lowest harmonic)').readout('v', 'Wave speed').readout('T', 'Tension').readout('L', 'Vibrating length');
  const graph = st.liveGraph({ series: [{ id: 'y', label: 'string at the marked point (mm)', color: K.COL.net }], window: 1.5, ylabel: 'mm', sym: true });

  let Lv = LEN, finger = null, drag = null, first = true, t = 0, pending = null;
  const modes = new Float64Array(NM + 1);        // amplitude of each harmonic (m), plucked
  const drive = { on: false, f: 20, A: 0.0006, ph: 0 };
  let Lay = { w: 800, h: 420, x0: 70, s: 500, y: 200, ys: 1800 };
  const hum = sfx.hum('sawtooth');

  const fIn = el('input', { type: 'range', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'Vibrator frequency' });
  const fLab = el('span');
  const toF = (u) => 3 * Math.pow(100, u / 1000), toU = (f) => Math.round(1000 * Math.log(f / 3) / Math.log(100));
  fIn.addEventListener('input', () => setF(toF(+fIn.value)));
  const dBtn = el('button', { type: 'button', class: 'stg-act', text: 'Vibrator on' });
  const nBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Next standing wave' });
  dBtn.addEventListener('click', () => { drive.on = !drive.on; if (drive.on) modes.fill(0); syncDrive(); sfx.play('click'); });
  nBtn.addEventListener('click', () => { const p = params(), f1 = p.v / (2 * Lv); const n = Math.floor(drive.f / f1 + 0.02) + 1; setF(n * f1); if (!drive.on) { drive.on = true; syncDrive(); } });
  st.controls(el('label', { class: 'stg-range' }, fLab, fIn), el('div', { class: 'stg-row' }, dBtn, nBtn));
  function setF(f) { drive.f = Math.max(3, Math.min(300, f)); fIn.value = toU(drive.f); fLab.textContent = `Vibrator: ${drive.f.toFixed(1)} shakes a second`; }
  function syncDrive() { dBtn.textContent = drive.on ? 'Vibrator off' : 'Vibrator on'; }
  setF(20);

  const omega = (p, n) => n * Math.PI * p.v / Lv;
  const damp = (p, n) => omega(p, n) / (2 * p.Q) + 0.4 + (finger !== null && Math.abs(Math.sin(n * Math.PI * finger / Lv)) > 0.06 ? 60 : 0);
  function pluckAt(xp, h) {
    // a triangle with its peak h at xp, written as a sum of harmonics
    for (let n = 1; n <= NM; n++) modes[n] = 2 * h * Lv * Lv / (n * n * Math.PI * Math.PI * xp * (Lv - xp)) * Math.sin(n * Math.PI * xp / Lv);
    t = 0; drive.on = false; syncDrive();
    const p = params(), f1 = p.v / (2 * Lv);
    const amps = []; for (let n = 1; n <= 16; n++) amps.push(Math.abs(modes[n]) * Math.sqrt(n) * (finger !== null && Math.abs(Math.sin(n * Math.PI * finger / Lv)) > 0.06 ? 0 : 1));
    sfx.pluck(f1 * UP, amps, { decay: Math.min(3.5, 0.5 + p.Q / 60), vol: Math.min(0.5, 0.15 + Math.abs(h) * 8) });
    rig.note({ bench: 'strings', pluck: true, f1, L: Lv });
  }
  const yPluck = (x) => { let y = 0; for (let n = 1; n <= NM; n++) if (modes[n]) y += modes[n] * Math.sin(n * Math.PI * x / Lv); return y; };

  // ---------- physics: each harmonic rings at its own frequency and dies away at its own rate
  st.onStep((dt) => {
    if (drag || dt <= 0) return;
    const p = params();
    t += dt;
    for (let n = 1; n <= NM; n++) if (modes[n]) { modes[n] *= Math.exp(-damp(p, n) * dt); if (Math.abs(modes[n]) < 1e-7) modes[n] = 0; }
    drive.ph += 2 * Math.PI * drive.f * dt;
    hum.set(drive.f * UP, drive.on ? 0.05 : 0, 0.5);
    graph.push(st.simT, { y: yAt(Lv * 0.25) * 1000 });
    if (pending && pending.until()) { const f = pending.then; pending = null; f(); }
  });
  // displacement at x right now
  function yAt(x) {
    const p = params();
    if (drive.on) { const sh = shapeL(p, drive.f, drive.A, Lv, 60), i = Math.round(x / Lv * 60); const [re, im] = sh[Math.max(0, Math.min(60, i))]; return re * Math.cos(drive.ph) - im * Math.sin(drive.ph); }
    let y = 0; for (let n = 1; n <= NM; n++) if (modes[n]) y += modes[n] * Math.cos(omega(p, n) * t) * Math.sin(n * Math.PI * x / Lv);
    return y;
  }

  // ---------- drawing
  st.onResize((w, h, narrow) => {
    const x0 = narrow ? 40 : 86, x1 = w - (narrow ? 60 : 110);
    Lay = { w, h, x0, s: (x1 - x0) / LEN, y: Math.round(h * 0.42), ys: Math.min(2400, h * 4.6), narrow };
  });
  const X = (x) => Lay.x0 + x * Lay.s;

  function drawApparatus(g, w, h) {
    K.room(g, w, h, K.THEME[1], { floorH: 0.1 });
    K.benchTop(g, 10, Lay.y + 84, w - 20, 14, 22, K.MAT.wood);
    // vibrator on the left
    K.box(g, X(0) - 58, Lay.y - 26, 50, 108, K.MAT.navy, { r: 6 });
    K.text(g, 'vibrator', X(0) - 33, Lay.y - 34, { size: 11, weight: 600, align: 'center' });
    // the pulley and the hanging mass on the right
    const px = X(LEN) + 14;
    K.box(g, px - 4, Lay.y + 10, 8, 76, K.MAT.steel, { r: 2 });
    g.save(); g.beginPath(); g.arc(px, Lay.y + 10, 12, 0, Math.PI * 2); g.fillStyle = '#C4D8EC'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
  }

  function drawMass(g) {
    const px = X(LEN) + 26, m = params().T / G;
    const k = Math.cbrt(m / 0.1), mw = 26 + 12 * k, mh = 16 + 12 * k, y0 = Lay.y + 34;
    K.lineSeg(g, px, Lay.y + 10, px, y0, K.LINE, 2);
    K.box(g, px - mw / 2, y0, mw, mh, K.MAT.brass, { r: 4 });
    K.text(g, `${Math.round(m * 1000)} g`, px, y0 + mh / 2 + 4, { size: 11, weight: 700, align: 'center' });
  }

  function stringPoints(fn, n = 160) { const pts = []; for (let i = 0; i <= n; i++) { const x = Lv * i / n; pts.push([X(x), Lay.y - fn(x) * Lay.ys]); } return pts; }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, drawApparatus);
    const p = params(), f1 = p.v / (2 * Lv);
    // the vibrator's rod
    const rodY = drive.on ? Math.sin(drive.ph) * drive.A * Lay.ys : 0;
    K.box(g, X(0) - 14, Lay.y - 6 - rodY, 14, 12, K.MAT.steel, { r: 2 });
    if (drive.on) K.glow(g, X(0) - 33, Lay.y - 12, 10, '#22B07A', 0.9);
    // the part of the string beyond the bridge, to the pulley (it does not vibrate)
    K.lineSeg(g, X(Lv), Lay.y, X(LEN) + 14, Lay.y - 12, K.LINE, 2.4);
    drawMass(g);
    // the vibrating part
    const strCol = { 'str-thin': '#7FC8EA', 'str-cord': '#F29E4C', 'str-steel': '#9DB8D3', 'str-x': '#B9A8FF' }[current(bench, 'string')] || '#F29E4C';
    if (drive.on) {
      const sh = shapeL(p, drive.f, drive.A, Lv, 160);
      // without the strobe, a string shaking this fast is a blur: draw its envelope
      if (current(bench, 'light') !== 'strobe') {
        g.save(); g.beginPath();
        sh.forEach(([re, im], i) => { const a = Math.hypot(re, im); const x = X(Lv * i / 160); if (i) g.lineTo(x, Lay.y - a * Lay.ys); else g.moveTo(x, Lay.y - a * Lay.ys); });
        for (let i = 160; i >= 0; i--) { const [re, im] = sh[i]; g.lineTo(X(Lv * i / 160), Lay.y + Math.hypot(re, im) * Lay.ys); }
        g.closePath(); g.fillStyle = K.hexA(strCol, 0.28); g.fill(); g.restore();
      }
      const ph = current(bench, 'light') === 'strobe' ? 2 * Math.PI * 0.8 * st.simT : drive.ph;   // the strobe slows it down to 0.8 Hz
      const pts = sh.map(([re, im], i) => [X(Lv * i / 160), Lay.y - (re * Math.cos(ph) - im * Math.sin(ph)) * Lay.ys]);
      K.polyline(g, pts, K.LINE, 5); K.polyline(g, pts, strCol, 3);
      if (st.on('waves')) {
        // the standing wave as two equal waves running in opposite directions
        const k = 2 * Math.PI * drive.f / p.v, A = Math.max(...sh.map(([re, im]) => Math.hypot(re, im))) / 2;
        const wR = stringPoints((x) => A * Math.sin(k * x - ph)), wL = stringPoints((x) => -A * Math.sin(k * x + ph));
        K.polyline(g, wR, K.hexA('#E0457B', 0.8), 2.5, { dash: [8, 6] }); K.polyline(g, wL, K.hexA('#3D7FD6', 0.8), 2.5, { dash: [8, 6] });
        K.tag(g, '→ wave going right', X(Lv * 0.2), Lay.y - Lay.ys * A * 2.4 - 20, { size: 11, bg: '#FFD0DC' }); K.tag(g, 'wave going left ←', X(Lv * 0.75), Lay.y - Lay.ys * A * 2.4 - 20, { size: 11, bg: '#BFE6FF' });
      }
      if (st.on('nodes')) {
        const n = Math.round(drive.f / f1);
        if (n >= 1 && Math.abs(drive.f / f1 - n) < 0.08) for (let j = 0; j <= n; j++) { const x = X(Lv * j / n); K.tag(g, 'N', x, Lay.y + 30, { size: 11, bg: '#FFD0DC' }); if (j < n) K.tag(g, 'A', X(Lv * (j + 0.5) / n), Lay.y + 30, { size: 11, bg: '#E6FBF1' }); }
      }
    } else {
      const fn = drag ? (x) => (x < drag.x ? drag.h * x / drag.x : drag.h * (Lv - x) / (Lv - drag.x)) : (x) => yAt(x);
      const pts = stringPoints(fn);
      if (st.hovering('string') && !drag) K.polyline(g, pts, K.hexA('#00D4FF', 0.45), 12);
      K.polyline(g, pts, K.LINE, 5); K.polyline(g, pts, strCol, 3);
      if (drag) { K.ball(g, X(drag.x), Lay.y - drag.h * Lay.ys, 8, 'pink', { lw: 2 }); }
    }
    // the bridge you can slide
    const bx = X(Lv);
    K.box(g, bx - 8, Lay.y + 4, 16, 80, K.MAT.woodD, { r: 3 });
    g.save(); g.beginPath(); g.moveTo(bx - 10, Lay.y + 6); g.lineTo(bx, Lay.y - 2); g.lineTo(bx + 10, Lay.y + 6); g.closePath(); g.fillStyle = '#FFF2D6'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    if (st.hovering('bridge')) K.tag(g, '↔ slide the bridge', bx, Lay.y + 104, { size: 11.5 });
    // a light finger touch
    if (finger !== null) { const fx = X(finger); g.save(); g.beginPath(); g.ellipse(fx, Lay.y - 22, 9, 14, 0, 0, Math.PI * 2); g.fillStyle = '#FFD7B8'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore(); K.tag(g, 'light touch', fx, Lay.y - 50, { size: 11 }); }
    // where the graph listens
    K.lineSeg(g, X(Lv * 0.25), Lay.y - 70, X(Lv * 0.25), Lay.y + 70, K.hexA(K.COL.pe, st.on('graph') ? 0.6 : 0), 1.5, [3, 4]);
    // the harmonics in the sound
    if (st.on('harm')) {
      const bw = Lay.narrow ? 150 : 200, bh = 90, x = 16, y = Lay.h - bh - 14;
      K.box(g, x, y, bw, bh, K.MAT.cream, { r: 10, lw: 2, bands: false });
      K.text(g, 'harmonics in the sound', x + 10, y + 17, { size: 11.5, weight: 600 });
      const n = 10, cw = (bw - 20) / n;
      let mx = 1e-9; const amps = [];
      for (let k = 1; k <= n; k++) { const a = drive.on ? (Math.abs(drive.f / f1 - k) < 0.08 ? 1 : 0) : Math.abs(modes[k]); amps.push(a); mx = Math.max(mx, a); }
      amps.forEach((a, i) => { const hh = (bh - 42) * a / mx; K.box(g, x + 10 + i * cw + 2, y + bh - 20 - hh, cw - 4, Math.max(1, hh), [K.COL.net, '#C3B4FF', '#4B33B0'], { r: 2, lw: 1 }); K.text(g, String(i + 1), x + 10 + i * cw + cw / 2, y + bh - 7, { size: 9.5, weight: 600, align: 'center' }); });
    }
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.arrow(g, X(Lv * 0.3) - 10, Lay.y - 90 - k * 8, X(Lv * 0.3), Lay.y - 14, K.COL.normal, { lw: 3.5, head: 11 }); }
  });
  st.onOver(() => {
    const p = params(), f1 = p.v / (2 * Lv);
    st.set('f1', `${f1.toFixed(1)} Hz`);
    st.set('v', `${p.v.toFixed(1)} m/s`);
    st.set('T', `${p.T.toFixed(2)} N`);
    st.set('L', `${(Lv * 100).toFixed(0)} cm`);
    graph.draw();
  });

  // ---------- hands
  st.handle({
    id: 'bridge', cursor: 'ew-resize',
    hit: (x, y) => { const d = Math.abs(x - X(Lv)); return d < 14 && y > Lay.y - 6 && y < Lay.y + 90 ? d : false; },
    move: (x) => { Lv = Math.max(0.2, Math.min(LEN, (x - Lay.x0) / Lay.s)); modes.fill(0); if (finger !== null && finger > Lv) finger = null; first = false; },
  });
  st.handle({
    id: 'string', cursor: 'grab',
    hit: (x, y) => { if (x < X(0.02) || x > X(Lv - 0.02)) return false; const d = Math.abs(y - (Lay.y - yAt((x - Lay.x0) / Lay.s) * Lay.ys)); return d < 16 ? d + 2 : false; },
    down: (x, y) => { first = false; st.hint(null); drive.on = false; syncDrive(); modes.fill(0); drag = { x: (x - Lay.x0) / Lay.s, h: 0 }; },
    move: (x, y) => { drag.x = Math.max(0.03, Math.min(Lv - 0.03, (x - Lay.x0) / Lay.s)); drag.h = Math.max(-0.035, Math.min(0.035, (Lay.y - y) / Lay.ys)); },
    up: () => { const d = drag; drag = null; if (Math.abs(d.h) > 0.001) pluckAt(d.x, d.h); },
    click: (x) => { drag = null; const xx = (x - Lay.x0) / Lay.s; finger = finger !== null && Math.abs(finger - xx) < 0.03 ? null : xx; sfx.play('click'); },
  });
  st.hint('Pull the string sideways and let go. A click puts a light finger on it.', { sticky: true });

  // ---------- why
  st.tour({
    title: 'Where does the note come from?',
    steps: [
      { say: 'Pluck it and watch in super slow motion: the kink splits into **two bumps running opposite ways**, and they bounce back off each end.', tools: { harm: false, nodes: false, waves: false }, enter: (s) => { finger = null; Lv = LEN; s.setSpeed(1 / 16); pluckAt(0.3, 0.02); } },
      { say: 'Both ends are held still, so only waves that **fit a whole number of half-wavelengths** can last. Those are the harmonics. The lowest sets the note: **f₁ = v / 2L**.', tools: { harm: true }, enter: (s) => { s.setSpeed(1); pluckAt(0.3, 0.02); } },
      { say: 'The wave speed is **v = √(T/μ)**: a tighter string (a heavier weight) or a lighter string carries waves faster, so the note goes up. A shorter string also goes up: slide the bridge and pluck.', enter: (s) => { s.setSpeed(1); Lv = 0.6; pluckAt(0.15, 0.015); } },
      { say: 'Now shake one end at exactly a harmonic. The string settles into a **standing wave**: still points (**nodes**) and big loops (**antinodes**).', tools: { nodes: true, harm: false }, enter: () => { Lv = LEN; modes.fill(0); const p = params(); setF(3 * p.v / (2 * Lv)); drive.on = true; syncDrive(); } },
      { say: 'A standing wave is really **two equal waves running in opposite directions**. Where they always cancel you get a node.', tools: { waves: true }, enter: (s) => { s.setSpeed(0.25); } },
    ],
    onEnd: () => { drive.on = false; syncDrive(); modes.fill(0); Lv = LEN; },
  });

  // ---------- challenges
  const after = () => { pending = null; finger = null; };
  st.setChallenges([
    {
      id: 'tension', title: 'Four times the weight', card: 'strings.tension', after,
      q: 'You hang a weight four times heavier on the string. Its note…', choices: ['goes up an octave (twice the frequency)', 'goes four times higher', 'goes down'], answer: 0,
      run: (s, finish) => {
        finger = null; Lv = LEN; drive.on = false; syncDrive();
        rig.mount(bench.id, 'mass', 'm50', 'challenge');
        const before = params().v / (2 * Lv);
        pluckAt(0.3, 0.02);
        setTimeout(() => {
          rig.mount(bench.id, 'mass', 'm200', 'challenge'); pluckAt(0.3, 0.02);
          setTimeout(() => finish(`50 g: ${before.toFixed(1)} Hz. 200 g: ${(params().v / (2 * Lv)).toFixed(1)} Hz.`), 1400);
        }, 1800);
      },
      explain: 'The wave speed goes with the square root of the tension, √4 = 2, so every harmonic doubles: one octave up. To go up a whole octave on a guitar you need four times the pull.',
    },
    {
      id: 'touch', title: 'A light touch', card: 'strings.touch', after,
      q: 'Rest a finger lightly at the exact middle of the string, then pluck it. You hear…', choices: ['the same note', 'a note an octave higher', 'nothing at all'], answer: 1,
      run: (s, finish) => { Lv = LEN; drive.on = false; syncDrive(); finger = LEN / 2; s.setTool('harm', true); setTimeout(() => { pluckAt(0.25, 0.02); setTimeout(() => finish(), 1600); }, 600); },
      explain: 'The finger stops every harmonic that wants to move at the middle: the 1st, 3rd, 5th… Only harmonics with a node there survive, the 2nd, 4th…, and the lowest of those is an octave above the normal note. Guitarists call it a harmonic.',
    },
    {
      id: 'middle', title: 'Pluck in the middle', card: 'strings.middle', after,
      q: 'Pluck the string exactly at its middle. Which harmonics are missing from the sound?', choices: ['The odd ones: 1, 3, 5…', 'The even ones: 2, 4, 6…', 'None of them'], answer: 1,
      run: (s, finish) => { finger = null; Lv = LEN; drive.on = false; syncDrive(); s.setTool('harm', true); setTimeout(() => { pluckAt(LEN / 2, 0.025); setTimeout(() => finish(), 1500); }, 500); },
      explain: 'The even harmonics all have a node at the middle, and you cannot start a wave by pulling at a point that it keeps still. So a middle pluck sounds hollow and soft; plucking near the end brings them all in and sounds bright.',
    },
  ]);

  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'string', label: 'Measure', build: tabString },
  { id: 'graph', label: 'Graph', build: tabGraph },
];

export default bench;
