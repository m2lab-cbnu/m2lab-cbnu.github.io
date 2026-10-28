// 1F · Vibrating string (Melde's experiment). A string runs from a vibrator over a pulley to a
// hanging mass. At the right frequencies it breaks into loops: standing waves. Swap the string,
// the hanging mass and the lighting, find the harmonics, and get the wave speed.

import { el, slider, button, group, readout, canvasBox, note, segmented, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, dataTable, fitProp, fitLine, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';

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

bench.tabs = [
  { id: 'string', label: 'String', build: tabString },
  { id: 'graph', label: 'Graph', build: tabGraph },
];

export default bench;
