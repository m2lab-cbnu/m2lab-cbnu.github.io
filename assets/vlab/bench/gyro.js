// 2F · Gyroscope. A spinning wheel on the end of an axle, resting on a pivot. Let go and it
// does not fall: it swings round the stand (precession), with a small fast wobble on top
// (nutation). Solved as a heavy symmetric top with Euler's angles.

import { el, slider, button, group, readout, canvasBox, note, checkbox } from '../ui/widgets.js';
import { Plot, COLORS } from '../ui/plot.js';
import { rigStrip, current, phys, onRig, loop, fitCanvas } from './common.js';
import { rig } from '../rpg/state.js';
import { ITEMS } from '../rpg/items.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const G = 9.81;

const bench = {
  id: 'gyro', title: 'Gyroscope', kicker: '2F · Physics Playground', icon: '◎', floor: 2,
  blurb: 'Precession and nutation.',
  slots: [
    { id: 'wheel', label: 'Wheel', options: ['gyrowheel', 'gyro-steel'], def: 'gyrowheel' },
    { id: 'weight', label: 'Extra weight', options: ['gw-none', 'gw-hang', 'gw-counter'], def: 'gw-none' },
    { id: 'watch', label: 'Watch with', options: ['eyes', 'stopwatch', 'camera'], def: 'eyes' },
  ],
};
bench.header = rigStrip(bench);

const S = { rpm: 3000, run: false, th: Math.PI / 2, thd: 0, ph: 0, t: 0, trail: [], trace: [], pphi: 0, watch: { on: false, t0: 0, acc: 0 }, friction: false };

function params() {
  const w = phys(bench, 'wheel'), x = phys(bench, 'weight');
  const I3 = 0.5 * w.m * w.R * w.R;
  const I1 = w.m * (0.25 * w.R * w.R + w.d * w.d) + x.mw * x.dw * x.dw + 0.02 * 0.12 * 0.12 / 3;
  const mgd = G * (w.m * w.d + x.mw * x.dw);
  return { I1, I3, mgd, d: w.d, R: w.R, wheel: w.id, weight: x.id };
}
// steady (slow) precession rate at angle th, from I1 Ω² cosθ − I3 ω3 Ω + m g d = 0
export function slowPrecession(p, w3, th = Math.PI / 2) {
  const c = Math.cos(th), L = p.I3 * w3;
  if (Math.abs(c) < 1e-9) return p.mgd / L;
  const disc = L * L - 4 * p.I1 * c * p.mgd;
  return disc < 0 ? NaN : (L - Math.sqrt(disc)) / (2 * p.I1 * c);
}

function release() {
  const p = params(), w3 = S.rpm * 2 * Math.PI / 60;
  S.w3 = w3; S.th = Math.PI / 2; S.thd = 0; S.ph = 0; S.t = 0; S.run = true; S.trail = []; S.trace = [];
  S.pphi = p.I3 * w3 * Math.cos(S.th);   // released from rest: no precession yet
  if (S.rpm === 3000 && p.wheel === 'gyrowheel' && p.weight === 'gw-none') rig.flag('gyroPeriod', Math.round(2 * Math.PI / slowPrecession(p, w3) * 100) / 100);
  rig.note({ bench: 'gyro', rpm: S.rpm, wheel: p.wheel, weight: p.weight });
}
function step(p, h) {
  const f = (th, thd) => {
    const s = Math.sin(th), c = Math.cos(th);
    const phd = (S.pphi - p.I3 * S.w3 * c) / (p.I1 * s * s);
    const thdd = (p.I1 * phd * phd * s * c - p.I3 * S.w3 * phd * s + p.mgd * s - 0.004 * thd) / p.I1;
    return [thd, thdd, phd];
  };
  const k1 = f(S.th, S.thd), k2 = f(S.th + h / 2 * k1[0], S.thd + h / 2 * k1[1]), k3 = f(S.th + h / 2 * k2[0], S.thd + h / 2 * k2[1]), k4 = f(S.th + h * k3[0], S.thd + h * k3[1]);
  S.th += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
  S.thd += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  S.ph += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  S.t += h;
  if (S.friction) {
    // the wheel's bearing slows the spin; the angular momentum about the vertical is unchanged
    S.w3 *= Math.exp(-h / 90);
  }
  if (S.th > Math.PI * 0.97) { S.th = Math.PI * 0.97; S.thd = 0; }
}

function tabSpin(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'Spin the wheel up, rest the axle on the pivot and let go. Gravity tries to tip it over, but a spinning wheel turns sideways instead: it <b>precesses</b>. Spin it slower and it wobbles more and precesses faster.' }));
  const box = canvasBox('', '4 / 3', 'The gyroscope on its stand');
  const topBox = canvasBox('', '1 / 1', 'The end of the axle, seen from above');
  const rpm = slider({ label: 'Wheel speed', unit: 'rpm', min: 600, max: 8000, step: 50, value: S.rpm, digits: 4, onInput: (v) => { S.rpm = v; } });
  const go = button('Spin and let go', () => { release(); watchReset(); }, 'go');
  const fr = checkbox({ label: 'Let the bearing slow the wheel down', checked: S.friction, onChange: (v) => { S.friction = v; } });
  const wDisp = el('div', { class: 'watch', text: '0.00 s' });
  const wBtn = button('Start', () => watchToggle(), 'go', { class: 'vbtn vbtn-go watch-btn' });
  const wGrp = group('Stopwatch', wDisp, el('div', { class: 'vp-row' }, wBtn, button('Reset', () => watchReset(), 'quiet')), el('p', { class: 'ctl-hint', text: 'Time one full turn around the stand.' }));
  const pRo = readout('Precession, measured'), tRo = readout('Precession, Ω = mgr / Iω'), nRo = readout('Wobble (nutation)');
  pane.append(el('div', { class: 'vp-cols' }, el('div', { class: 'vp-side' }, group('Wheel', rpm, go, fr), wGrp, topBox), el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, pRo, tRo, nRo))));
  function watchTime() { return S.watch.acc + (S.watch.on ? (performance.now() - S.watch.t0) / 1000 : 0); }
  function watchToggle() { if (S.watch.on) { S.watch.acc = watchTime(); S.watch.on = false; wBtn.textContent = 'Start'; } else { S.watch.t0 = performance.now(); S.watch.on = true; wBtn.textContent = 'Stop'; } }
  function watchReset() { S.watch = { on: false, t0: 0, acc: 0 }; wBtn.textContent = 'Start'; wDisp.textContent = '0.00 s'; }
  function sync() { wGrp.hidden = current(bench, 'watch') !== 'stopwatch'; topBox.hidden = current(bench, 'watch') !== 'camera'; }
  onRig(bench, () => { sync(); S.run = false; });
  sync();

  const anim = loop((dt) => {
    const p = params();
    if (S.run) {
      let left = dt; while (left > 1e-9) { const h = Math.min(0.0005, left); step(p, h); left -= h; }
      const n = [Math.sin(S.th) * Math.cos(S.ph), Math.sin(S.th) * Math.sin(S.ph)];
      S.trail.push(n); if (S.trail.length > 1500) S.trail.shift();
      S.trace.push([S.t, S.th, S.ph]); if (S.trace.length > 4000) S.trace.shift();
    }
    if (S.watch.on) wDisp.textContent = watchTime().toFixed(2) + ' s';
    draw(p);
  });
  function draw(p = params()) {
    drawGyro(box.canvas, p);
    if (!topBox.hidden) drawTop(topBox.canvas);
    const w3 = S.run ? S.w3 : S.rpm * 2 * Math.PI / 60;
    const Om = slowPrecession(p, w3);
    tRo.set(Number.isFinite(Om) ? `one turn in ${(2 * Math.PI / Om).toFixed(2)} s` : 'too slow: it falls');
    const cam = current(bench, 'watch') === 'camera';
    if (S.run && S.trace.length > 50 && cam) {
      const tr = S.trace, a = tr[0], b = tr[tr.length - 1];
      const rate = (b[2] - a[2]) / (b[0] - a[0]);
      pRo.set(`one turn in ${(2 * Math.PI / rate).toFixed(2)} s`);
      let lo = Infinity, hi = -Infinity; for (const q of tr.slice(-400)) { lo = Math.min(lo, q[1]); hi = Math.max(hi, q[1]); }
      nRo.set(`${((hi - lo) * 180 / Math.PI).toFixed(2)}° up and down`);
    } else { pRo.set(cam ? '–' : current(bench, 'watch') === 'stopwatch' ? 'use the stopwatch' : 'film it to measure'); nRo.set(cam ? '–' : 'film it to measure'); }
  }
  function drawGyro(c, p) {
    const { g, w, h } = fitCanvas(c);
    g.fillStyle = '#F1ECFF'; g.fillRect(0, 0, w, h);
    const sc = h * 2.6, el = 0.33, ce = Math.cos(el), se = Math.sin(el);
    const P0 = [w * 0.5, h * 0.42];
    const proj = (x, y, z) => [P0[0] + x * sc, P0[1] - (z * ce + y * se) * sc, y * ce - z * se];
    // stand
    g.fillStyle = '#B9A8FF'; g.beginPath(); g.ellipse(P0[0], P0[1] + 0.13 * sc * ce, 0.07 * sc, 0.07 * sc * se, 0, 0, 7); g.fill();
    g.fillStyle = '#6B5BE6'; g.fillRect(P0[0] - 4, P0[1], 8, 0.13 * sc * ce);
    const th = S.th, ph = S.ph;
    const n = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)];
    // axle: from behind the pivot to past the wheel
    const a0 = proj(-0.03 * n[0], -0.03 * n[1], -0.03 * n[2]), a1 = proj(0.09 * n[0], 0.09 * n[1], 0.09 * n[2]);
    // wheel: a circle at distance d along the axle
    const u = [Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), -Math.sin(th)], v = [-Math.sin(ph), Math.cos(ph), 0];
    const cx = p.d * n[0], cy = p.d * n[1], cz = p.d * n[2];
    const pts = [];
    for (let i = 0; i < 40; i++) { const al = i / 40 * 2 * Math.PI, ca = Math.cos(al), sa = Math.sin(al); pts.push(proj(cx + p.R * (u[0] * ca + v[0] * sa), cy + p.R * (u[1] * ca + v[1] * sa), cz + p.R * (u[2] * ca + v[2] * sa))); }
    const wheelBehind = proj(cx, cy, cz)[2] > 0;
    const drawAxle = () => { g.strokeStyle = '#4F6A8F'; g.lineWidth = 3; g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(a1[0], a1[1]); g.stroke(); };
    if (wheelBehind) drawAxle();
    const col = p.wheel === 'gyro-steel' ? '#9DB8D3' : '#D8B04A';
    g.fillStyle = col; g.strokeStyle = '#1B2440'; g.lineWidth = 1.5; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.stroke();
    // spokes that turn with the wheel
    const sp = S.run ? (S.t * S.w3) % (2 * Math.PI) : 0;
    g.strokeStyle = 'rgba(27,36,64,0.45)'; g.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { const al = sp + k * 2 * Math.PI / 3; const q = proj(cx + 0.8 * p.R * (u[0] * Math.cos(al) + v[0] * Math.sin(al)), cy + 0.8 * p.R * (u[1] * Math.cos(al) + v[1] * Math.sin(al)), cz + 0.8 * p.R * (u[2] * Math.cos(al) + v[2] * Math.sin(al))); const o = proj(cx, cy, cz); g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(q[0], q[1]); g.stroke(); }
    if (!wheelBehind) drawAxle();
    // weights
    const x = phys(bench, 'weight');
    if (x.mw > 0) { const q = proj(x.dw * n[0], x.dw * n[1], x.dw * n[2]); g.fillStyle = '#D8B04A'; g.fillRect(q[0] - 6, q[1] - 6, 12, 12); g.strokeStyle = '#1B2440'; g.strokeRect(q[0] - 6, q[1] - 6, 12, 12); }
    g.fillStyle = '#4A3A8C'; g.beginPath(); g.arc(P0[0], P0[1], 4, 0, 7); g.fill();
    if (!S.run) { g.fillStyle = '#12243A'; g.font = '500 12px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Your hand holds the end of the axle level', w / 2, h - 14); }
  }
  function drawTop(c) {
    const { g, w, h } = fitCanvas(c);
    g.fillStyle = '#0E1630'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(168,236,255,0.2)'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, 7); g.stroke();
    g.strokeStyle = '#FFE07A'; g.lineWidth = 1.2; g.beginPath();
    S.trail.forEach(([x, y], i) => { const X = w / 2 + x * w * 0.42, Y = h / 2 - y * w * 0.42; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
    g.stroke();
    g.fillStyle = '#A8ECFF'; g.font = '500 11px "Plex", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('axle tip from above (camera)', w / 2, h - 8);
  }
  return { show() { anim.start(); }, hide() { anim.stop(); }, resize() { draw(); } };
}

function tabGraph(pane) {
  pane.append(el('p', { class: 'vp-intro', html: 'How the precession depends on the spin. In the fast-top limit the period of one turn round the stand is <b>T = 2π I ω / (m g r)</b>: proportional to the spin. The curve is the exact steady precession; it breaks away at low speed, where the gyroscope can no longer hold itself up.' }));
  const box = canvasBox('', '16 / 10', 'Precession period against wheel speed');
  const plot = new Plot(box.canvas, { xlabel: 'Wheel speed (rpm)', ylabel: 'One turn round the stand (s)' });
  pane.append(el('div', { class: 'vp-main' }, box));
  function draw() {
    const p = params(), xs = [], ys = [], yf = [];
    for (let r = 600; r <= 8000; r += 50) { const w3 = r * 2 * Math.PI / 60, Om = slowPrecession(p, w3, Math.PI / 2 + 0.02); xs.push(r); ys.push(Number.isFinite(Om) ? 2 * Math.PI / Om : NaN); yf.push(2 * Math.PI * p.I3 * w3 / p.mgd); }
    plot.setSeries([{ x: xs, y: yf, color: COLORS.gold, dash: [5, 4], width: 1.6, label: 'fast-top formula' }, { x: xs, y: ys, color: COLORS.violet, width: 2.4, label: 'steady precession' }]).setVLines([{ x: S.rpm, color: COLORS.pink, dash: [4, 4] }]).draw();
  }
  onRig(bench, draw);
  return { show() { draw(); }, resize() { draw(); } };
}

// ---------------------------------------------------------------- the hands-on stage
const EL = 0.36, CE = Math.cos(EL), SE = Math.sin(EL), THMAX = 2.25;
const RPM = (w) => w * 60 / (2 * Math.PI), RAD = (r) => r * 2 * Math.PI / 60;

function tabPlay(pane) {
  let held = true, fallen = false, spinA = 0, first = true, pending = null, anim = null, grab = null, hist = [], thHist = [];
  const trail3 = [];
  let Lay = { w: 800, h: 480, sc: 1500, P0: [400, 170], fy: 400 };
  const hum = sound.hum('sine');
  // the wheel starts still, held level by your hand
  S.th = Math.PI / 2; S.thd = 0; S.ph = -0.6; S.w3 = S.run ? S.w3 : 0; S.run = false; S.t = 0;

  const st = new Stage(pane, {
    bench, npc: 'pip',
    label: 'A gyroscope: a wheel on the end of an axle, resting on a pivot on top of a stand. A hand holds the far end of the axle.',
    hello: '**Spin the wheel** (drag round it, or press Spin it up), then **let go** of the axle. Why doesn’t it fall?',
    aspect: 16 / 10, phoneAspect: 0.85, minH: 340,
    onReset: () => { anim = null; pending = null; catchIt(); S.w3 = 0; first = true; },
    onHide: () => hum.set(60, 0),
    keys: { action: () => (held ? letGo() : catchIt()), arrow: (dx, dy) => { if (dy && held) spinTo(Math.max(0, RPM(S.w3) - dy * 500)); } },
  });
  st.tool('L', 'Spin arrow', { icon: K.COL.net, on: true }).tool('torque', 'Gravity’s twist', { icon: K.COL.gravity })
    .tool('trail', 'Path', { icon: K.COL.vel });
  st.readout('rpm', 'Wheel speed').readout('T', 'One turn round the stand').readout('Tp', 'Predicted: 2πIω / mgr').readout('wob', 'Wobble up and down');

  // ---------- controls
  const spinBtn = el('button', { type: 'button', class: 'stg-act', text: 'Spin it up' });
  const goBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Let go' });
  const frBtn = el('button', { type: 'button', class: 'stg-act ghost' });
  const rpmSl = el('input', { type: 'range', min: 600, max: 8000, step: 100, value: S.rpm, 'aria-label': 'Wheel speed in revolutions per minute' });
  const rpmLab = el('span', { text: '' });
  spinBtn.addEventListener('click', () => { if (!held) catchIt(); spinTo(S.rpm); });
  goBtn.addEventListener('click', () => (held ? letGo() : catchIt()));
  frBtn.addEventListener('click', () => { S.friction = !S.friction; sync(); sound.play('click'); });
  rpmSl.addEventListener('input', () => { S.rpm = +rpmSl.value; sync(); });
  st.controls(el('label', { class: 'stg-range' }, rpmLab, rpmSl), el('div', { class: 'stg-row' }, spinBtn, goBtn), frBtn);
  function sync() {
    rpmLab.textContent = `Spin it up to ${S.rpm} rpm`;
    goBtn.textContent = held ? 'Let go' : 'Catch it';
    frBtn.textContent = S.friction ? 'The bearing slows the wheel: on' : 'The bearing slows the wheel: off';
  }
  onRig(bench, () => { hist = []; });
  sync();

  // ---------- holding, spinning, letting go
  function spinTo(rpm, then) {
    first = false;
    anim = { t0: st.simT, from: S.w3, to: RAD(rpm), dur: 0.9, set: (v) => { S.w3 = v; }, then };
    sound.play('whoosh', { vol: 0.8 });
  }
  function letGo() {
    const p = params();
    held = false; fallen = false; first = false;
    S.th = Math.PI / 2; S.thd = 0; S.pphi = p.I3 * S.w3 * Math.cos(S.th);
    hist = []; thHist = []; trail3.length = 0;
    if (Math.abs(RPM(S.w3) - 3000) < 40 && p.wheel === 'gyrowheel' && p.weight === 'gw-none') rig.flag('gyroPeriod', Math.round(2 * Math.PI / slowPrecession(p, S.w3) * 100) / 100);
    rig.note({ bench: 'gyro', rpm: Math.round(RPM(S.w3)), wheel: p.wheel, weight: p.weight, how: 'play' });
    sound.play('click'); sync();
  }
  function catchIt() { held = true; fallen = false; S.th = Math.PI / 2; S.thd = 0; hist = []; thHist = []; sync(); }

  // ---------- physics: a heavy symmetric top, in Euler's angles
  function adv(p, h) {
    const f = (th, thd) => {
      const s = Math.sin(th), c = Math.cos(th);
      const phd = (S.pphi - p.I3 * S.w3 * c) / (p.I1 * s * s);
      return [thd, (p.I1 * phd * phd * s * c - p.I3 * S.w3 * phd * s + p.mgd * s - 0.00035 * thd) / p.I1, phd];
    };
    const k1 = f(S.th, S.thd), k2 = f(S.th + h / 2 * k1[0], S.thd + h / 2 * k1[1]), k3 = f(S.th + h / 2 * k2[0], S.thd + h / 2 * k2[1]), k4 = f(S.th + h * k3[0], S.thd + h * k3[1]);
    S.th += h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    S.thd += h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    S.ph += h / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    S.t += h;
    if (S.th > THMAX) {
      // the wheel tips down against the stand
      S.th = THMAX; fallen = true;
      if (S.thd > 0.4) sound.play('clack', { vol: Math.min(1, S.thd / 3) });
      S.thd = 0;
    }
  }
  st.onStep((dt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const a = anim; anim = null; if (a.then) a.then(); }
    }
    const p = params();
    if (dt > 0) {
      if (S.friction) S.w3 *= Math.exp(-dt / 90);
      if (!held && !fallen) {
        // keep the angular momentum about the vertical up to date if the wheel slows down
        let left = dt; while (left > 1e-9) { const h = Math.min(0.0005, left); adv(p, h); left -= h; }
        hist.push([S.t, S.ph]); while (hist.length && S.t - hist[0][0] > 8) hist.shift();
        thHist.push([S.t, S.th]); while (thHist.length && S.t - thHist[0][0] > 1.2) thHist.shift();
        const c = wheelC(p); trail3.push(c); if (trail3.length > 900) trail3.shift();
      }
      // the drawn spokes turn at a speed the eye can follow; above that they blur
      spinA += Math.min(S.w3, 22) * dt;
    }
    const w = S.w3;
    hum.set(55 + RPM(w) / 45, w > 8 && st.running ? 0.02 + 0.035 * Math.min(1, w / 600) : 0, 0.5);
    if (pending && pending.cond()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- geometry
  st.onResize((w, h, narrow) => {
    const sc = Math.min(w * (narrow ? 2.2 : 2.5), h * 3.2);
    const P0 = [Math.round(w * 0.5), Math.round(h * 0.37)];
    Lay = { w, h, narrow, sc, P0, fy: Math.round(P0[1] + 0.13 * sc * CE - 0.03 * sc) };
  });
  const proj = (x, y, z) => [Lay.P0[0] + x * Lay.sc, Lay.P0[1] - (z * CE + y * SE) * Lay.sc, y * CE - z * SE];
  const axis = () => [Math.sin(S.th) * Math.cos(S.ph), Math.sin(S.th) * Math.sin(S.ph), Math.cos(S.th)];
  const wheelC = (p) => { const n = axis(); return [p.d * n[0], p.d * n[1], p.d * n[2]]; };
  const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];

  // ---------- drawing
  function drawBack(g, w, h) {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[2], { floorH: 1 - Lay.fy / hh });
      // a round rug under the stand
      const [rx, ry] = proj(0, 0, -0.13);
      gg.save(); gg.beginPath(); gg.ellipse(rx, ry + 4, 0.095 * Lay.sc, 0.095 * Lay.sc * SE, 0, 0, Math.PI * 2);
      gg.fillStyle = 'rgba(185,168,255,0.35)'; gg.fill(); gg.lineWidth = 2; gg.strokeStyle = 'rgba(123,92,240,0.35)'; gg.stroke(); gg.restore();
      // a poster: the spinning top and its arrow
      if (!Lay.narrow && ww > 700) {
        const nx = 30, ny = Math.round(hh * 0.12), nw = 132, nh = 112;
        gg.save(); gg.translate(nx + nw / 2, ny + nh / 2); gg.rotate(0.03); gg.translate(-nw / 2, -nh / 2);
        K.box(gg, 0, 0, nw, nh, K.MAT.cream, { r: 4, bands: false });
        gg.fillStyle = '#9BE3C1'; gg.beginPath(); gg.arc(nw / 2, 5, 4.5, 0, Math.PI * 2); gg.fill();
        K.text(gg, 'spin wins', 12, 24, { size: 12, weight: 600, font: K.PIXF });
        gg.strokeStyle = '#1B2440'; gg.lineWidth = 2;
        gg.beginPath(); gg.ellipse(64, 70, 26, 9, 0, 0, Math.PI * 2); gg.stroke();
        gg.beginPath(); gg.moveTo(64, 79); gg.lineTo(64, 98); gg.stroke();
        K.arrow(gg, 64, 64, 64, 34, '#7B5CF0', { lw: 3, head: 8, halo: false });
        gg.beginPath(); gg.arc(64, 70, 34, Math.PI * 0.15, Math.PI * 0.85); gg.strokeStyle = '#E5534B'; gg.setLineDash([4, 3]); gg.stroke(); gg.setLineDash([]);
        gg.restore();
      }
    });
  }
  function drawStand(g) {
    const [bx, by] = proj(0, 0, -0.13), r = 0.055 * Lay.sc;
    K.shadow(g, bx, by + 6, r * 1.15, r * SE * 1.2, 0.28);
    g.save(); g.beginPath(); g.ellipse(bx, by + 6, r, r * SE, 0, 0, Math.PI); g.lineTo(bx - r, by); g.ellipse(bx, by, r, r * SE, 0, Math.PI, 0, true); g.closePath();
    g.fillStyle = K.MAT.violet[2]; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    g.beginPath(); g.ellipse(bx, by, r, r * SE, 0, 0, Math.PI * 2); g.fillStyle = K.MAT.violet[0]; g.fill(); g.stroke(); g.restore();
    const [tx, ty] = proj(0, 0, -0.008);
    K.rod(g, bx, by, tx, ty, Math.max(7, 0.012 * Lay.sc), K.MAT.steel, { lw: 2 });
  }
  function drawPivot(g) {
    const [x, y] = proj(0, 0, 0);
    g.save(); g.beginPath(); g.arc(x, y + 3, Math.max(6, 0.01 * Lay.sc), 0, Math.PI); g.fillStyle = K.MAT.steel[2]; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    K.ball(g, x, y, Math.max(4.5, 0.007 * Lay.sc), 'chrome', { lw: 1.6 });
  }
  function ring(g, c, n, u, v, r0, r1, fill) {
    const N = 48, P = (r, a) => proj(...add(add(c, u, r * Math.cos(a)), v, r * Math.sin(a)));
    g.beginPath();
    for (let i = 0; i <= N; i++) { const q = P(r1, i / N * 2 * Math.PI); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }
    if (r0 > 0) for (let i = N; i >= 0; i--) { const q = P(r0, i / N * 2 * Math.PI); g.lineTo(q[0], q[1]); }
    g.closePath(); g.fillStyle = fill; g.fill('evenodd'); g.lineWidth = 1.6; g.strokeStyle = K.LINE; g.stroke();
    void n;
  }
  function drawWheel(g, p) {
    const n = axis(), c = wheelC(p), R = p.R, tw = 0.006;
    const u = [Math.cos(S.th) * Math.cos(S.ph), Math.cos(S.th) * Math.sin(S.ph), -Math.sin(S.th)], v = [-Math.sin(S.ph), Math.cos(S.ph), 0];
    const mat = p.wheel === 'gyro-steel' ? K.MAT.steel : K.MAT.brass;
    const towards = n[1] * CE - n[2] * SE < 0;      // the +n face looks at you
    const cNear = add(c, n, towards ? tw : -tw), cFar = add(c, n, towards ? -tw : tw);
    // far face, the rim, then the near face with its spokes
    ring(g, cFar, n, u, v, R * 0.74, R, mat[2]);
    const N = 48;
    for (let i = 0; i < N; i++) {
      const a0 = i / N * 2 * Math.PI, a1 = (i + 1) / N * 2 * Math.PI;
      const q = [proj(...add(add(cFar, u, R * Math.cos(a0)), v, R * Math.sin(a0))), proj(...add(add(cFar, u, R * Math.cos(a1)), v, R * Math.sin(a1))), proj(...add(add(cNear, u, R * Math.cos(a1)), v, R * Math.sin(a1))), proj(...add(add(cNear, u, R * Math.cos(a0)), v, R * Math.sin(a0)))];
      g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(q[k][0], q[k][1]); g.closePath();
      g.fillStyle = mat[0]; g.fill();
    }
    ring(g, cNear, n, u, v, R * 0.74, R, mat[1]);
    // spokes, blurred into a disc when the wheel spins fast
    const fast = S.w3 > 25;
    const spokes = (a, alpha) => {
      g.save(); g.globalAlpha = alpha; g.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const al = a + k * Math.PI / 2, e = proj(...add(add(cNear, u, R * 0.76 * Math.cos(al)), v, R * 0.76 * Math.sin(al))), o = proj(...cNear);
        g.strokeStyle = K.LINE; g.lineWidth = 5; g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(e[0], e[1]); g.stroke();
        g.strokeStyle = mat[0]; g.lineWidth = 2.6; g.beginPath(); g.moveTo(o[0], o[1]); g.lineTo(e[0], e[1]); g.stroke();
      }
      g.restore();
    };
    if (fast) { ring(g, cNear, n, u, v, R * 0.16, R * 0.74, K.hexA(mat[0], 0.45)); for (let k = 0; k < 4; k++) spokes(spinA + k * 0.18, 0.28); }
    else spokes(spinA, 1);
    ring(g, cNear, n, u, v, 0, R * 0.17, mat[0]);
    // a little paint mark on the rim, so you can see it turn
    const m = proj(...add(add(cNear, u, R * 0.87 * Math.cos(spinA)), v, R * 0.87 * Math.sin(spinA)));
    if (!fast) { g.beginPath(); g.arc(m[0], m[1], 3.2, 0, Math.PI * 2); g.fillStyle = '#E5534B'; g.fill(); }
  }
  function drawAxle(g, a, b) { const A = proj(...a), B = proj(...b); K.rod(g, A[0], A[1], B[0], B[1], Math.max(4, 0.006 * Lay.sc), K.MAT.steel, { lw: 1.6 }); }
  function drawWeight(g, p) {
    const x = phys(bench, 'weight'); if (!(x.mw > 0)) return;
    const n = axis(), q = proj(...add([0, 0, 0], n, x.dw)), r = Math.max(8, 0.016 * Lay.sc);
    K.box(g, q[0] - r, q[1] - r, 2 * r, 2 * r, K.MAT.brass, { r: 3 });
    K.text(g, x.mw >= 0.1 ? '150 g' : '50 g', q[0], q[1] + 4, { size: 9.5, weight: 700, align: 'center' });
    void p;
  }
  function drawHand(g, p) {
    const n = axis(), end = add([0, 0, 0], n, p.d + 0.045), [x, y] = proj(...end), k = Math.max(0.65, Math.min(1.1, Lay.sc / 1500));
    g.save(); g.translate(x, y); g.scale(k, k);
    if (st.hovering('hand')) K.glow(g, 0, 0, 44, '#00D4FF', 0.35);
    g.fillStyle = '#FFD7B8'; g.strokeStyle = K.LINE; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(14, 4, 22, 16, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-2 + i * 0, -8 + i * 8, 11, 5.5, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
    g.fillStyle = '#7FC8EA'; g.fillRect(30, -8, 26, 26); g.strokeRect(30, -8, 26, 26);
    g.restore();
    if (st.hovering('hand')) K.tag(g, 'click to let go', x + 40, y - 34, { size: 11.5 });
  }
  function drawVectors(g, p) {
    const n = axis(), c = wheelC(p), sc = Lay.sc;
    const Lref = 0.5 * 0.25 * 0.04 * 0.04 * RAD(3000), Lnow = p.I3 * S.w3;
    let tipL = c;
    if (st.on('L') && Lnow > 1e-6) {
      const len = Math.min(190, 120 * Lnow / Lref) / sc;
      tipL = add(c, n, p.R * 0.2 + len);
      const A = proj(...add(c, n, p.R * 0.2)), B = proj(...tipL);
      K.arrow(g, A[0], A[1], B[0], B[1], K.COL.net, { lw: 6, head: 15, label: 'spin', labelAt: 'tip', size: 12 });
    }
    if (st.on('torque')) {
      const t = [-n[1], n[0], 0], tl = Math.hypot(t[0], t[1]) || 1, th = [t[0] / tl, t[1] / tl, 0];
      const mgd0 = 9.81 * 0.25 * 0.05, len = Math.min(120, 80 * Math.sqrt(p.mgd / mgd0)) / sc;
      const C = proj(...c), D = proj(...add(c, [0, 0, -1], 55 / sc));
      K.arrow(g, C[0], C[1], D[0], D[1], K.COL.gravity, { lw: 4, head: 11, label: 'weight', labelAt: 'tip', size: 11 });
      const E = proj(...add(c, th, len));
      K.arrow(g, C[0], C[1], E[0], E[1], '#E5534B', { lw: 5, head: 13, label: 'twist', labelAt: 'tip', size: 12, dash: [8, 5] });
      if (st.on('L') && p.I3 * S.w3 > 1e-6) {
        const F = proj(...tipL), G2 = proj(...add(tipL, th, 0.45 * len));
        K.arrow(g, F[0], F[1], G2[0], G2[1], '#E5534B', { lw: 3, head: 10, label: 'turns this way', labelAt: 'tip', size: 11 });
      }
    }
  }
  function drawTrail(g) {
    if (trail3.length < 2) return;
    g.save(); g.lineWidth = 2.5; g.lineJoin = 'round';
    for (let i = 1; i < trail3.length; i++) {
      const a = proj(...trail3[i - 1]), b = proj(...trail3[i]);
      g.strokeStyle = K.hexA(K.COL.vel, 0.15 + 0.75 * i / trail3.length);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    g.restore();
  }

  st.onDraw((g, w, h) => {
    const p = params();
    drawBack(g, w, h);
    if (st.on('trail')) drawTrail(g);
    const n = axis(), c = wheelC(p), x = phys(bench, 'weight');
    const back = Math.min(-0.03, x.dw < 0 ? x.dw - 0.012 : -0.03), out = Math.max(p.d + 0.045, x.dw > 0 ? x.dw + 0.012 : 0);
    const towards = n[1] * CE - n[2] * SE < 0;
    const inner = () => drawAxle(g, add([0, 0, 0], n, back), c), outer = () => drawAxle(g, c, add([0, 0, 0], n, out));
    const wheelFirst = proj(...c)[2] > 0;          // the wheel is behind the stand
    const parts = () => { if (towards) { inner(); drawWheel(g, p); outer(); } else { outer(); drawWheel(g, p); inner(); } drawWeight(g, p); };
    if (wheelFirst) { parts(); drawStand(g); drawPivot(g); } else { drawStand(g); parts(); drawPivot(g); }
    if (held) drawHand(g, p);
    drawVectors(g, p);
    if (first) {
      const C = proj(...c), k = (Math.sin(st.t * 3) + 1) / 2, r = p.R * Lay.sc;
      K.arrow(g, C[0] - r - 90 - k * 8, C[1] - r - 30, C[0] - r * 0.8, C[1] - r * 0.4, K.COL.normal, { lw: 3.5, head: 11 });
      K.tag(g, 'drag round the wheel to spin it', C[0] - r - 96 - k * 8, C[1] - r - 42, { size: 11.5, align: 'right' });
    }
    if (fallen) K.tag(g, S.w3 < 5 ? 'no spin: it just falls' : 'too slow: it fell', Lay.P0[0], Lay.fy + 24, { size: 12.5, bg: '#FFD0DC' });
  });
  st.onOver(() => {
    const p = params(), w3 = S.w3;
    st.set('rpm', `${Math.round(RPM(w3))} rpm`);
    let T = '–';
    if (!held && !fallen && hist.length > 2) { const a = hist[0], b = hist[hist.length - 1]; if (b[0] - a[0] > 1.5) { const rate = (b[1] - a[1]) / (b[0] - a[0]); T = Math.abs(rate) > 1e-3 ? `${(2 * Math.PI / Math.abs(rate)).toFixed(2)} s` : '–'; } else T = 'timing…'; }
    st.set('T', T);
    st.set('Tp', w3 > 1 ? `${(2 * Math.PI * p.I3 * w3 / p.mgd).toFixed(2)} s` : '–');
    if (!held && !fallen && thHist.length > 10) { let lo = Infinity, hi = -Infinity; for (const [, th] of thHist) { lo = Math.min(lo, th); hi = Math.max(hi, th); } st.set('wob', `${((hi - lo) * 180 / Math.PI).toFixed(1)}°`); } else st.set('wob', '–');
  });

  // ---------- hands
  st.handle({
    id: 'wheel', cursor: 'grab',
    hit: (x, y) => { const p = params(), C = proj(...wheelC(p)), d = Math.hypot(x - C[0], y - C[1]); return d < p.R * Lay.sc * 1.15 + 6 ? d : false; },
    down: (x, y) => { if (!held) { catchIt(); sound.play('clack', { vol: 0.4 }); grab = null; return; } const C = proj(...wheelC(params())); grab = { a: Math.atan2(y - C[1], x - C[0]), t: performance.now() }; first = false; },
    move: (x, y) => {
      if (!grab) return;
      const C = proj(...wheelC(params())), a = Math.atan2(y - C[1], x - C[0]);
      let da = a - grab.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      grab.a = a;
      S.w3 = Math.min(RAD(8000), S.w3 + Math.abs(da) * 45);
      if (Math.abs(da) > 0.15) sound.play('whoosh', { vol: 0.25 });
    },
    up: () => { grab = null; },
    click: () => { grab = null; },
  });
  st.handle({
    id: 'hand', cursor: 'pointer', enabled: () => held,
    hit: (x, y) => { const p = params(), [hx, hy] = proj(...add([0, 0, 0], axis(), p.d + 0.045)); const d = Math.hypot(x - hx - 14, y - hy); return d < 34 ? d + 1 : false; },
    click: () => letGo(),
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  const wheelMark = () => { const p = params(), C = proj(...wheelC(p)); return [C[0], C[1], p.R * Lay.sc + 14]; };
  st.tour({
    title: 'Why doesn’t it fall?',
    steps: [
      { say: 'A wheel sits on the end of an axle, and the axle rests on a pivot. With the wheel **not spinning**, let go and it simply **falls**, like anything heavy.',
        tools: { L: true, torque: false, trail: false }, enter: () => { anim = null; catchIt(); S.w3 = 0; wait(0.9, letGo); }, mark: () => { const [x, y] = proj(0, 0, 0); return [x, y, 26]; } },
      { say: 'Now spin it fast. A spinning wheel carries **angular momentum**, drawn as the purple arrow along the axle. The faster it spins, the longer the arrow.',
        enter: () => { pending = null; catchIt(); spinTo(3000); }, mark: wheelMark },
      { say: 'Gravity pulls the wheel **down**. Around the pivot that pull becomes a **twist** (the red dashed arrow), and the twist points **sideways**, not down.',
        tools: { torque: true } },
      { say: 'A twist changes the spin arrow **in the direction of the twist**: sideways. So the axle swings round and round the stand instead of falling. This is **precession**.',
        tools: { trail: true }, enter: () => letGo() },
      { say: 'Spin it slower and the arrow is shorter, so the same twist turns it faster, with a wobble on top (**nutation**; try ⅟₁₆× slow motion). Spin faster and it goes round more slowly.',
        enter: () => { catchIt(); spinTo(1500, letGo); } },
      { say: 'Electrons spin too. In a magnetic field each one precesses like this little wheel. On 3F that precession is exactly what our lab measures: it is called ferromagnetic resonance.',
        tools: { torque: false }, enter: () => { catchIt(); spinTo(3000, letGo); } },
    ],
    onEnd: () => { pending = null; },
  });

  // ---------- challenges
  const period = () => { if (hist.length < 3) return NaN; const a = hist[0], b = hist[hist.length - 1]; return 2 * Math.PI / Math.abs((b[1] - a[1]) / (b[0] - a[0])); };
  const after = () => { pending = null; anim = null; };
  st.setChallenges([
    {
      id: 'faster', title: 'Twice the spin', card: 'gyro.faster', lock: true, after,
      setup: () => { anim = null; pending = null; catchIt(); rig.mount(bench.id, 'weight', 'gw-none', 'challenge'); S.w3 = RAD(3000); },
      q: 'Spin the wheel twice as fast, from 3000 to 6000 rpm. One turn round the stand now takes…',
      choices: ['half as long', 'twice as long', 'just as long'], answer: 1,
      run: (s0, finish) => {
        s0.setPaused(false); s0.setSpeed(1);
        letGo();
        wait(4, () => { const T1 = period(); catchIt(); spinTo(6000, () => { letGo(); wait(5, () => finish(`At 3000 rpm: ${T1.toFixed(1)} s per turn. At 6000 rpm: ${period().toFixed(1)} s.`)); }); });
      },
      explain: 'Twice the spin makes the spin arrow twice as long. Gravity’s twist is the same, so it takes twice as long to turn the arrow all the way round: Ω = mgr / (Iω).',
    },
    {
      id: 'nospin', title: 'No spin at all', card: 'gyro.nospin', lock: true, after,
      setup: () => { anim = null; pending = null; catchIt(); S.w3 = 0; },
      q: 'This time the wheel is not spinning at all. Let go of the axle. It…',
      choices: ['still turns slowly round the stand', 'falls down, like anything heavy', 'stays level in the air'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); letGo(); until(() => fallen, () => wait(0.8, () => finish('Down it went.'))); },
      explain: 'With no spin there is no angular momentum for the twist to turn sideways, so gravity’s twist just tips the wheel down. The spin is the whole trick.',
    },
    {
      id: 'torque', title: 'More weight on the end', card: 'gyro.torque', lock: true, after,
      setup: () => { anim = null; pending = null; catchIt(); rig.mount(bench.id, 'weight', 'gw-none', 'challenge'); S.w3 = RAD(3000); },
      q: 'Hang an extra 50 g weight far out on the axle (a bigger twist). The gyroscope now goes round the stand…',
      choices: ['faster', 'more slowly', 'just as fast'], answer: 0,
      run: (s0, finish) => {
        s0.setPaused(false); s0.setSpeed(1);
        letGo();
        wait(4, () => { const T1 = period(); catchIt(); rig.mount(bench.id, 'weight', 'gw-hang', 'challenge'); S.w3 = RAD(3000); wait(0.6, () => { letGo(); wait(4, () => finish(`Without the weight: ${T1.toFixed(1)} s per turn. With it: ${period().toFixed(1)} s.`)); }); });
      },
      explain: 'A bigger twist turns the same spin arrow faster, so the gyroscope goes round sooner. Ω = (twist) / (spin).',
    },
  ]);

  st.peek = () => { const p = params(), C = proj(...wheelC(p)), H = proj(...add([0, 0, 0], axis(), p.d + 0.045)); return { C, R: p.R * Lay.sc, H, rpm: RPM(S.w3), held, fallen, th: S.th, ph: S.ph }; };   // for tests
  return st.ctl;
}

bench.tabs = [
  { id: 'play', label: 'Play', build: tabPlay },
  { id: 'spin', label: 'Measure', build: tabSpin },
  { id: 'graph', label: 'Speed and precession', build: tabGraph },
];

export default bench;
