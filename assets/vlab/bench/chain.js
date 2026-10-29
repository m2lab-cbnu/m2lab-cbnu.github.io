// 3F · Spin-wave machine. A row of spins in a field, each holding on to its neighbours
// (exchange). Tip one and the wobble runs along the row: a spin wave. An antenna at one end
// sends a steady train of them; the dispersion f(k) says how long the waves are at each
// frequency, and below the gap f = γB nothing travels at all. Every spin follows the
// Landau-Lifshitz-Gilbert equation with the exchange field of its two neighbours.

import { el } from '../ui/widgets.js';
import { rig } from '../rpg/state.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const GAMMA = 28, W2 = 2 * Math.PI * GAMMA;
const N = 48, J = 0.6;        // spins, exchange field between neighbours (T)
const SLOW = 0.22;            // ns of spin time per second on screen
const EL = 0.42, CE = Math.cos(EL), SE = Math.sin(EL);

const bench = { id: 'chain', title: 'Spin-wave machine', kicker: '3F · Magnonics Lab', icon: '〰', floor: 3, blurb: 'A row of spins: flick one end and a wave runs along.' };

const S = { B: 0.2, f: 10, drive: false, h1: 18 };
export const gapGHz = (B) => GAMMA * B;
// the wave number (rad per spin) of a spin wave at frequency f, or null below the gap / above the band
export function kOf(f, B) { const c = 1 - (f / GAMMA - B) / (2 * J); return c > 1 || c < -1 ? null : Math.acos(c); }
const fOf = (k, B) => GAMMA * (B + 2 * J * (1 - Math.cos(k)));

function tabPlay(pane) {
  const m = Array.from({ length: N }, () => [0, 0, 1]);
  const alpha = Array.from({ length: N }, (_, i) => 0.006 + 0.5 * Math.max(0, (i - (N - 12)) / 12) ** 2);
  let t = 0, Lay = { w: 800, h: 480 }, grab = -1, hover = -1, first = true, pending = null, anim = null, kick = 0, reached = false;

  const st = new Stage(pane, {
    bench, npc: 'nova',
    label: 'A row of 48 spins standing on a bench, an antenna at the left end and a soft absorber at the right. Drag any spin to tip it.',
    hello: '**Tip a spin** (drag its red tip) and let go: watch the wobble run along the row. Then switch on the **antenna**.',
    aspect: 16 / 9, phoneAspect: 0.85, minH: 330,
    onReset: () => { calm(); S.B = 0.2; S.f = 10; S.drive = false; syncCtl(); first = true; },
    keys: { arrow: (dx) => { if (dx) { S.f = Math.max(1, Math.min(24, S.f + dx * 0.2)); syncCtl(); } }, action: () => flick(0) },
  });
  st.tool('colour', 'Phase colors', { icon: '#B9A8FF', on: true }).tool('line', 'Wave shape', { icon: K.COL.vel, on: true })
    .tool('disp', 'Frequency and wavelength', { icon: K.COL.net });
  st.readout('gap', 'Lowest spin wave (the gap)').readout('fa', 'Antenna').readout('lam', 'Wavelength').readout('v', 'Speed along the row');

  // ---------- controls
  const mkRange = (label, min, max, stepv, get, set) => {
    const lab = el('span', { text: '' }), inp = el('input', { type: 'range', min, max, step: stepv, value: get(), 'aria-label': label });
    inp.addEventListener('input', () => { set(+inp.value); first = false; syncCtl(); });
    return { el: el('label', { class: 'stg-range' }, lab, inp), lab, inp };
  };
  const rB = mkRange('Magnetic field in tesla', 0.05, 0.4, 0.005, () => S.B, (v) => { S.B = v; });
  const rF = mkRange('Antenna frequency in gigahertz', 1, 24, 0.1, () => S.f, (v) => { S.f = v; });
  const aBtn = el('button', { type: 'button', class: 'stg-act' });
  const fBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Flick the first spin' });
  const cBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Calm them down' });
  aBtn.addEventListener('click', () => { S.drive = !S.drive; first = false; syncCtl(); sound.play(S.drive ? 'zap' : 'click'); });
  fBtn.addEventListener('click', () => flick(0));
  cBtn.addEventListener('click', () => { calm(); sound.play('pop'); });
  st.controls(el('div', { class: 'stg-row' }, aBtn, fBtn), rF.el, rB.el, cBtn);
  function syncCtl() {
    rB.lab.textContent = `Magnetic field: ${S.B.toFixed(3)} T`; rB.inp.value = S.B;
    rF.lab.textContent = `Antenna frequency: ${S.f.toFixed(1)} GHz`; rF.inp.value = S.f;
    aBtn.textContent = S.drive ? 'Antenna off' : 'Antenna on';
  }
  syncCtl();
  function calm() { for (const v of m) { v[0] = 0; v[1] = 0; v[2] = 1; } reached = false; }
  function flick(i, deg = 40) { const a = deg * Math.PI / 180; m[i] = [Math.sin(a), 0, Math.cos(a)]; first = false; sound.play('swing'); }

  // ---------- physics
  function deriv(mm, tt, out) {
    const w = 2 * Math.PI * S.f * tt, h = S.h1 / 1000;
    for (let i = 0; i < N; i++) {
      const a = mm[i], l = i > 0 ? mm[i - 1] : null, r = i < N - 1 ? mm[i + 1] : null;
      let bx = 0, by = 0, bz = S.B;
      if (l) { bx += J * l[0]; by += J * l[1]; bz += J * l[2]; }
      if (r) { bx += J * r[0]; by += J * r[1]; bz += J * r[2]; }
      // the antenna pushes the first two spins round, at its own frequency
      if (S.drive && i < 2) { bx += h * Math.cos(w); by += h * Math.sin(w); }
      const al = alpha[i], g = W2 / (1 + al * al);
      const cx = a[1] * bz - a[2] * by, cy = a[2] * bx - a[0] * bz, cz = a[0] * by - a[1] * bx;
      const dx = a[1] * cz - a[2] * cy, dy = a[2] * cx - a[0] * cz, dz = a[0] * cy - a[1] * cx;
      out[i][0] = -g * (cx + al * dx); out[i][1] = -g * (cy + al * dy); out[i][2] = -g * (cz + al * dz);
    }
  }
  const k1 = m.map(() => [0, 0, 0]), k2 = m.map(() => [0, 0, 0]), k3 = m.map(() => [0, 0, 0]), k4 = m.map(() => [0, 0, 0]), tmp = m.map(() => [0, 0, 0]);
  function step(h) {
    deriv(m, t, k1);
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) tmp[i][c] = m[i][c] + h / 2 * k1[i][c];
    deriv(tmp, t + h / 2, k2);
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) tmp[i][c] = m[i][c] + h / 2 * k2[i][c];
    deriv(tmp, t + h / 2, k3);
    for (let i = 0; i < N; i++) for (let c = 0; c < 3; c++) tmp[i][c] = m[i][c] + h * k3[i][c];
    deriv(tmp, t + h, k4);
    for (let i = 0; i < N; i++) {
      const a = m[i];
      for (let c = 0; c < 3; c++) a[c] += h / 6 * (k1[i][c] + 2 * k2[i][c] + 2 * k3[i][c] + k4[i][c]);
      const n = Math.hypot(a[0], a[1], a[2]); a[0] /= n; a[1] /= n; a[2] /= n;
    }
    t += h;
  }
  st.onStep((sdt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const a = anim; anim = null; if (a.then) a.then(); }
    }
    if (sdt > 0) {
      let left = sdt * SLOW;
      while (left > 1e-9) {
        const h = Math.min(0.0025, left);
        const keep = grab >= 0 ? m[grab].slice() : null;
        step(h);
        if (keep) { m[grab][0] = keep[0]; m[grab][1] = keep[1]; m[grab][2] = keep[2]; }
        left -= h;
      }
    }
    // a soft blip when the wave reaches the far end
    const far = Math.hypot(m[N - 14][0], m[N - 14][1]);
    if (far > 0.06 && !reached) { reached = true; sound.play('blip', { pitch: 1.5 }); if (S.drive) rig.note({ bench: 'chain', f: S.f, B: S.B, travelled: true }); }
    if (far < 0.01) reached = false;
    if (pending && pending.cond()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- layout
  st.onResize((w, h, narrow) => {
    const x0 = narrow ? 34 : 70, x1 = w - (narrow ? 34 : 70);
    Lay = { w, h, narrow, x0, x1, dx: (x1 - x0) / (N - 1), y0: Math.round(h * (narrow ? 0.56 : 0.64)), L: Math.min(narrow ? 56 : 100, h * 0.27) };
  });
  const X = (i) => Lay.x0 + i * Lay.dx;
  const tipOf = (i) => { const a = m[i]; return [X(i) + Lay.L * a[0], Lay.y0 - Lay.L * (a[2] * CE - a[1] * SE)]; };
  const hue = (i) => { const a = m[i], p = Math.atan2(a[1], a[0]), amp = Math.hypot(a[0], a[1]); return [p, amp]; };
  const hsl = (p, s, l) => `hsl(${Math.round(((p / (2 * Math.PI)) * 360 + 360) % 360)}, ${s}%, ${l}%)`;

  // ---------- drawing
  function drawBench(g, w, h) {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[3], { floorH: 0.16 });
      const y = Lay.y0 + 10;
      K.box(gg, Lay.x0 - 40, y, Lay.x1 - Lay.x0 + 80, 16, K.MAT.white, { r: 4 });
      K.box(gg, Lay.x0 - 34, y + 16, 10, hh * 0.84 - y - 16, K.MAT.steel, { r: 2, bands: false });
      K.box(gg, Lay.x1 + 24, y + 16, 10, hh * 0.84 - y - 16, K.MAT.steel, { r: 2, bands: false });
      // the absorber at the far end
      gg.save(); K.rr(gg, Lay.x1 - 12 * Lay.dx, y - 6, 12 * Lay.dx + 20, 8, 3); gg.fillStyle = '#2E4A7D'; gg.fill(); gg.restore();
      K.text(gg, 'soft absorber: no echoes', Lay.x1 - 6 * Lay.dx, y + 36, { size: 10.5, weight: 600, align: 'center', color: '#2E4A7D' });
    });
  }
  function drawAntenna(g) {
    const x = Lay.x0 - 30, y = Lay.y0 - 44;
    K.box(g, x - 18, y, 26, 54, K.MAT.copper, { r: 4 });
    g.save(); g.globalAlpha = 0.5; g.fillStyle = K.MAT.copper[2]; for (let k = 1; k < 8; k++) g.fillRect(x - 15, y + k * 6.5, 20, 1.5); g.restore();
    if (S.drive) { const k = (Math.sin(st.t * 10) + 1) / 2; K.glow(g, x + 10, y + 26, 34, '#F29E4C', 0.35 + 0.3 * k); for (let r = 0; r < 3; r++) { const rr = 10 + ((st.t * 40 + r * 14) % 42); g.save(); g.globalAlpha = Math.max(0, 1 - rr / 52); g.beginPath(); g.arc(x + 8, y + 26, rr, -0.5, 0.5); g.strokeStyle = '#F29E4C'; g.lineWidth = 2; g.stroke(); g.restore(); } }
    K.tag(g, 'antenna', x - 5, y - 14, { size: 10.5, bg: '#FFE2CC' });
  }
  function drawSpins(g) {
    const colour = st.on('colour');
    if (st.on('line')) {
      const pts = []; for (let i = 0; i < N; i++) pts.push([X(i) + Lay.L * m[i][0], Lay.y0 - Lay.L * 1.18 - Lay.L * 0.55 * m[i][0]]);
      K.polyline(g, pts.map(([x, y], i) => [X(i), y]), K.hexA(K.COL.vel, 0.85), 2.2);
    }
    for (let i = 0; i < N; i++) {
      const [tx, ty] = tipOf(i), [p, amp] = hue(i);
      const col = colour && amp > 0.03 ? hsl(p, 80, 52) : '#E5534B';
      // the cone each spin sweeps, faintly
      if (amp > 0.04) { g.save(); g.beginPath(); g.ellipse(X(i), Lay.y0 - Lay.L * Math.sqrt(1 - Math.min(1, amp * amp)) * CE, Lay.L * amp, Lay.L * amp * SE, 0, 0, Math.PI * 2); g.strokeStyle = K.hexA('#7FC8EA', 0.4); g.lineWidth = 1; g.stroke(); g.restore(); }
      g.save(); g.lineCap = 'round';
      g.strokeStyle = K.LINE; g.lineWidth = 5; g.beginPath(); g.moveTo(X(i), Lay.y0); g.lineTo(tx, ty); g.stroke();
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(X(i), Lay.y0); g.lineTo(tx, ty); g.stroke();
      g.restore();
      g.beginPath(); g.arc(tx, ty, Lay.narrow ? 3 : 4, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 1.5; g.strokeStyle = K.LINE; g.stroke();
      g.beginPath(); g.arc(X(i), Lay.y0, 2.5, 0, Math.PI * 2); g.fillStyle = K.MAT.steel[2]; g.fill();
      if (i === grab || (i === hover && st.hovering('spin'))) K.glow(g, tx, ty, 20, '#FFFFFF', 0.6);
    }
  }
  function drawDispersion(g) {
    const w = Lay.w, h = Lay.h, pw = Lay.narrow ? w - 32 : Math.min(320, w * 0.34), ph = Lay.narrow ? 120 : 150;
    const x0 = Lay.narrow ? 16 : w - pw - 16, y0 = 14;
    g.save(); K.rr(g, x0, y0, pw, ph, 10); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const px0 = x0 + 34, px1 = x0 + pw - 12, py0 = y0 + 24, py1 = y0 + ph - 24, fmax = 26;
    const Xk = (k) => px0 + k / 1.6 * (px1 - px0), Yf = (f) => py1 - f / fmax * (py1 - py0);
    K.text(g, 'frequency', px0 - 28, py0 - 8, { size: 10, weight: 600 });
    K.text(g, 'shorter waves →', px1, py1 + 15, { size: 10, weight: 600, align: 'right' });
    g.strokeStyle = '#D6ECF7'; g.lineWidth = 1; for (const f of [5, 10, 15, 20, 25]) { g.beginPath(); g.moveTo(px0, Yf(f)); g.lineTo(px1, Yf(f)); g.stroke(); K.text(g, String(f), px0 - 6, Yf(f) + 3, { size: 9.5, align: 'right' }); }
    // the gap: no spin waves below it
    g.save(); g.fillStyle = 'rgba(229,83,75,0.12)'; g.fillRect(px0, Yf(gapGHz(S.B)), px1 - px0, py1 - Yf(gapGHz(S.B))); g.restore();
    K.text(g, 'gap: nothing travels', px1 - 4, Yf(gapGHz(S.B)) + 12, { size: 10, weight: 600, align: 'right', color: '#B3243B' });
    const pts = []; for (let i = 0; i <= 80; i++) { const k = i / 80 * 1.6; pts.push([Xk(k), Yf(fOf(k, S.B))]); }
    g.save(); g.beginPath(); g.rect(px0, py0, px1 - px0, py1 - py0); g.clip(); K.polyline(g, pts, '#7B5CF0', 2.6); g.restore();
    if (S.drive) {
      K.lineSeg(g, px0, Yf(S.f), px1, Yf(S.f), '#F29E4C', 1.8, [5, 3]);
      const k = kOf(S.f, S.B);
      if (k !== null && k <= 1.6) { g.beginPath(); g.arc(Xk(k), Yf(S.f), 5, 0, Math.PI * 2); g.fillStyle = '#F29E4C'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = K.LINE; g.stroke(); }
    }
  }

  st.onDraw((g, w, h) => {
    drawBench(g, w, h);
    drawAntenna(g);
    drawSpins(g);
    if (st.on('disp')) drawDispersion(g);
    if (first) { const [tx, ty] = tipOf(6), k = (Math.sin(st.t * 3) + 1) / 2; K.arrow(g, tx + 70 + k * 8, ty - 60, tx + 8, ty - 8, K.COL.normal, { lw: 3.5, head: 11 }); K.tag(g, 'tip any spin', tx + 74 + k * 8, ty - 72, { size: 11.5, align: 'left' }); }
  });
  st.onOver(() => {
    const k = kOf(S.f, S.B);
    st.set('gap', `${gapGHz(S.B).toFixed(1)} GHz`);
    st.set('fa', S.drive ? `${S.f.toFixed(1)} GHz` : 'off');
    st.set('lam', !S.drive ? '–' : k === null ? (S.f < gapGHz(S.B) ? 'none: below the gap' : 'none: above the band') : `${(2 * Math.PI / k).toFixed(1)} spins`);
    // group velocity dω/dk, in spins per second of the slowed-down picture
    st.set('v', !S.drive || k === null ? '–' : `${(2 * Math.PI * GAMMA * 2 * J * Math.sin(k) * SLOW).toFixed(0)} spins a second`);
  });

  // ---------- hands
  st.handle({
    id: 'spin', cursor: 'grab',
    hit: (x, y) => {
      let best = -1, bd = 22;
      for (let i = 0; i < N; i++) { const [tx, ty] = tipOf(i), d = Math.hypot(x - tx, y - ty); if (d < bd) { bd = d; best = i; } }
      if (best < 0 && Math.abs(y - (Lay.y0 - Lay.L / 2)) < Lay.L * 0.7 && x > Lay.x0 - 10 && x < Lay.x1 + 10) { best = Math.round((x - Lay.x0) / Lay.dx); bd = 30; }
      hover = Math.max(0, Math.min(N - 1, best)); return best >= 0 ? bd : false;
    },
    down: () => { grab = hover; first = false; },
    move: (x, y) => {
      if (grab < 0) return;
      // tip the spin towards the pointer: sideways is x, up is z
      const dx = (x - X(grab)) / Lay.L, dz = (Lay.y0 - y) / (Lay.L * CE);
      const a = Math.atan2(Math.max(-1, Math.min(1, dx)), Math.max(0.05, dz));
      m[grab] = [Math.sin(a), 0, Math.cos(a)];
    },
    up: () => { grab = -1; sound.play('swing'); },
    click: () => { const i = hover; grab = -1; if (i >= 0) flick(i, 35); },
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  st.tour({
    title: 'What is a spin wave?',
    steps: [
      { say: 'A row of spins, each one like the single spin next door, all in the same field. Neighbors **hold on to each other** (this is called exchange): if one tips, it tugs at the next.',
        tools: { colour: true, line: true, disp: false }, enter: () => { calm(); S.drive = false; syncCtl(); wait(0.4, () => flick(0, 45)); }, mark: () => { const [x, y] = tipOf(0); return [x, y, 24]; } },
      { say: 'Watch the wobble travel: each spin passes it on to the next one, a little later. That traveling wobble is a **spin wave**, and its smallest possible piece is a **magnon**.',
        enter: () => { calm(); wait(0.3, () => flick(0, 45)); } },
      { say: 'The antenna on the left keeps shaking the first spins at one frequency, so a steady train of spin waves runs along. The colors show where each spin is in its turn: one rainbow is one wavelength.',
        enter: () => { calm(); S.f = 10; S.drive = true; syncCtl(); } },
      { say: 'Higher frequency, **shorter waves**. The curve in the corner (the dispersion) tells you which wavelength goes with which frequency.',
        tools: { disp: true }, enter: () => { anim = { t0: st.simT, from: 8, to: 18, dur: 6, set: (v) => { S.f = v; syncCtl(); } }; } },
      { say: 'Below the **gap** (the spins’ own pace, f = γB) no wave can travel at all: the wobble dies out next to the antenna. Turning up the field moves the gap up. Our lab tunes it with a magnet.',
        enter: () => { anim = null; calm(); S.f = 4; syncCtl(); } },
      { say: 'Spin waves carry signals without moving any electric charge, so there are no currents to heat things up. That is why we study them for future electronics: see the logic chip next door!',
        tools: { disp: false }, enter: () => { calm(); S.f = 12; syncCtl(); } },
    ],
    onEnd: () => { anim = null; },
  });

  // ---------- challenges
  const after = () => { pending = null; anim = null; };
  st.setChallenges([
    {
      id: 'shorter', title: 'A higher note', card: 'chain.shorter', lock: true, after,
      setup: () => { calm(); S.B = 0.2; S.f = 8; S.drive = true; syncCtl(); },
      q: 'The antenna sends spin waves at 8 GHz. Turn it up to 16 GHz. The waves along the row get…',
      choices: ['shorter', 'longer', 'no different'], answer: 0,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(4, () => { const a = 2 * Math.PI / kOf(8, S.B); anim = { t0: st.simT, from: 8, to: 16, dur: 2, set: (v) => { S.f = v; syncCtl(); }, then: () => wait(4, () => finish(`${a.toFixed(0)} spins long at 8 GHz, ${(2 * Math.PI / kOf(16, S.B)).toFixed(0)} spins at 16 GHz.`)) }; }); },
      explain: 'Shorter waves bend the row more sharply between neighbors, which costs more exchange energy, so they come at higher frequencies. That link between frequency and wavelength is the dispersion.',
    },
    {
      id: 'gap', title: 'Below the gap', card: 'chain.gap', lock: true, after,
      setup: () => { calm(); S.B = 0.2; S.f = 4; S.drive = false; syncCtl(); },
      q: 'In 0.2 T the spins’ own pace is 5.6 GHz. Drive the antenna at only 4 GHz. Down the row you will see…',
      choices: ['a long, slow wave', 'nothing: it dies out next to the antenna', 'a wave running backwards'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); S.drive = true; syncCtl(); wait(6, () => finish('The far end never moved.')); },
      explain: 'No spin wave exists below f = γB, the gap. The spins near the antenna wobble a little, but the wobble cannot travel. Raise the frequency above the gap and the waves run.',
    },
    {
      id: 'field', title: 'More field', card: 'chain.field', lock: true, after,
      setup: () => { calm(); S.B = 0.15; S.f = 10; S.drive = true; syncCtl(); },
      q: 'Keep the antenna at 10 GHz but turn the field up from 0.15 T to 0.3 T. The waves get…',
      choices: ['longer', 'shorter', 'no different'], answer: 0,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); st.setTool('disp', true); wait(4, () => { const a = 2 * Math.PI / kOf(10, 0.15); anim = { t0: st.simT, from: 0.15, to: 0.3, dur: 2, set: (v) => { S.B = v; syncCtl(); }, then: () => wait(4, () => finish(`${a.toFixed(0)} spins long before, ${(2 * Math.PI / kOf(10, 0.3)).toFixed(0)} spins after.`)) }; }); },
      explain: 'More field raises the whole dispersion curve, gap and all. At the same 10 GHz the wave then sits lower on the curve: smaller k, longer waves. A magnet is a tuning knob for spin waves.',
    },
  ]);

  st.peek = () => ({ L: Lay, tip0: tipOf(0), far: Math.hypot(m[N - 14][0], m[N - 14][1]) });   // for tests
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }];

export default bench;
