// 3F · Spin precession. One magnetic moment (a spin) in a magnetic field. Tip it and it goes
// round the field instead of falling back (precession), spiralling home as damping takes its
// energy. Shine microwaves on it that turn at its own pace and it swings wide open, or flips
// right over: ferromagnetic resonance. Solved with the Landau-Lifshitz-Gilbert equation.

import { el } from '../ui/widgets.js';
import { rigStrip, current, phys, onRig } from './common.js';
import { rig } from '../rpg/state.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const GAMMA = 28;            // GHz per tesla, for an electron spin
const W2 = 2 * Math.PI * GAMMA;
const SLOW = 0.5;            // nanoseconds of spin time for each second on screen
const EL = 0.36, AZ = -0.55, CE = Math.cos(EL), SE = Math.sin(EL), CA = Math.cos(AZ), SA = Math.sin(AZ);

const bench = {
  id: 'precess', title: 'Spin precession', kicker: '3F · Magnonics Lab', icon: '↻', floor: 3,
  blurb: 'A single spin in a field, and microwaves that flip it.',
  slots: [{ id: 'sample', label: 'Sample', options: ['sph-yig', 'sph-py'], def: 'sph-yig' }],
};
bench.header = rigStrip(bench);

const S = { B: 0.2, f: 5.6, h1: 8, drive: false, m: [Math.sin(0.6), 0, Math.cos(0.6)], t: 0 };

// dm/dt for the Landau-Lifshitz-Gilbert equation, time in ns, fields in T
function llg(m, B, alpha) {
  const g = W2 / (1 + alpha * alpha);
  const c = [m[1] * B[2] - m[2] * B[1], m[2] * B[0] - m[0] * B[2], m[0] * B[1] - m[1] * B[0]];
  const d = [m[1] * c[2] - m[2] * c[1], m[2] * c[0] - m[0] * c[2], m[0] * c[1] - m[1] * c[0]];
  return [-g * (c[0] + alpha * d[0]), -g * (c[1] + alpha * d[1]), -g * (c[2] + alpha * d[2])];
}
function field(t) {
  if (!S.drive) return [0, 0, S.B];
  const w = 2 * Math.PI * S.f * t, h = S.h1 / 1000;
  return [h * Math.cos(w), h * Math.sin(w), S.B];
}
function step(h, alpha) {
  const m = S.m, t = S.t;
  const k1 = llg(m, field(t), alpha);
  const m2 = m.map((v, i) => v + h / 2 * k1[i]), k2 = llg(m2, field(t + h / 2), alpha);
  const m3 = m.map((v, i) => v + h / 2 * k2[i]), k3 = llg(m3, field(t + h / 2), alpha);
  const m4 = m.map((v, i) => v + h * k3[i]), k4 = llg(m4, field(t + h), alpha);
  for (let i = 0; i < 3; i++) m[i] += h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  const n = Math.hypot(m[0], m[1], m[2]); m[0] /= n; m[1] /= n; m[2] /= n;
  S.t += h;
}
// the steady absorption of a field sweep, as the instrument records it (1 at the peak)
function lorentz(B, f, alpha) { const w = alpha * f, d = f - GAMMA * B; return w * w / (d * d + w * w); }

function tabPlay(pane) {
  let Lay = { w: 800, h: 500, cx: 330, cy: 260, R: 160 }, grab = false, first = true, pending = null, anim = null;
  let absorb = 0, trail = [], sweep = null, flipped = false, alphaOver = null;
  const hum = sound.hum('triangle');
  const alpha = () => alphaOver || phys(bench, 'sample').alpha;

  const st = new Stage(pane, {
    bench, npc: 'nova',
    label: 'A single spin, drawn as a red arrow inside a glass sphere, between the poles of a magnet. Drag the arrow to tip it.',
    hello: '**Tip the red spin** with your finger or mouse and let go. Watch what it does! Then try the **microwaves**.',
    aspect: 16 / 10, phoneAspect: 0.78, minH: 360,
    onReset: () => { S.m = [Math.sin(0.6), 0, Math.cos(0.6)]; S.B = 0.2; S.f = 5.6; S.h1 = 8; S.drive = false; sweep = null; trail = []; syncCtl(); first = true; },
    onHide: () => hum.set(200, 0),
    keys: { arrow: (dx, dy) => { if (dx) setB(S.B + dx * 0.005); if (dy) { S.f = Math.max(1, Math.min(10, S.f - dy * 0.05)); syncCtl(); } }, action: () => toggleDrive() },
  });
  st.tool('trail', 'Trail', { icon: K.COL.vel, on: true }).tool('field', 'Field', { icon: K.COL.mag, on: true })
    .tool('torque', 'Why it turns', { icon: K.COL.gravity }).tool('clock', 'Spin and microwave clock', { icon: '#F29E4C', on: true });
  st.readout('f0', 'The spin’s own pace').readout('tilt', 'Tilt from the field').readout('mw', 'Microwaves').readout('abs', 'Absorbing');

  // ---------- controls
  const mkRange = (label, min, max, stepv, get, set) => {
    const lab = el('span', { text: '' }), inp = el('input', { type: 'range', min, max, step: stepv, value: get(), 'aria-label': label });
    inp.addEventListener('input', () => { set(+inp.value); first = false; syncCtl(); });
    return { el: el('label', { class: 'stg-range' }, lab, inp), lab, inp };
  };
  const rB = mkRange('Magnetic field in tesla', 0.02, 0.35, 0.001, () => S.B, (v) => { S.B = v; sweep = null; });
  const rF = mkRange('Microwave frequency in gigahertz', 1, 10, 0.01, () => S.f, (v) => { S.f = v; });
  const rH = mkRange('Microwave strength in millitesla', 0.5, 20, 0.5, () => S.h1, (v) => { S.h1 = v; });
  const mwBtn = el('button', { type: 'button', class: 'stg-act' });
  const swBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Sweep the field' });
  const upBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Stand it up' });
  mwBtn.addEventListener('click', () => toggleDrive());
  swBtn.addEventListener('click', () => startSweep());
  upBtn.addEventListener('click', () => { S.m = [0, 0, 1]; trail = []; sound.play('click'); });
  st.controls(rB.el, el('div', { class: 'stg-row' }, mwBtn, swBtn), rF.el, rH.el, upBtn);
  function syncCtl() {
    rB.lab.textContent = `Magnetic field: ${S.B.toFixed(3)} T`; rB.inp.value = S.B;
    rF.lab.textContent = `Microwave frequency: ${S.f.toFixed(2)} GHz`; rF.inp.value = S.f;
    rH.lab.textContent = `Microwave strength: ${S.h1.toFixed(1)} mT`; rH.inp.value = S.h1;
    mwBtn.textContent = S.drive ? 'Microwaves off' : 'Microwaves on';
    rF.el.hidden = rH.el.hidden = !S.drive;
  }
  function setB(v) { S.B = Math.max(0.02, Math.min(0.35, v)); sweep = null; syncCtl(); }
  function toggleDrive(v) { S.drive = v === undefined ? !S.drive : v; first = false; syncCtl(); sound.play(S.drive ? 'zap' : 'click'); }
  function startSweep() {
    S.drive = true; syncCtl();
    sweep = { B0: Math.max(0.02, S.f / GAMMA - 0.12), B1: Math.min(0.35, S.f / GAMMA + 0.12), t0: st.simT, dur: 9, pts: [] };
    S.B = sweep.B0; syncCtl();
    sound.play('click');
  }
  onRig(bench, () => { syncCtl(); });
  syncCtl();

  // ---------- time
  st.onStep((sdt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const a = anim; anim = null; if (a.then) a.then(); }
    }
    if (sweep && !sweep.fixed) {
      const q = Math.min(1, (st.simT - sweep.t0) / sweep.dur);
      S.B = sweep.B0 + (sweep.B1 - sweep.B0) * q;
      const L = lorentz(S.B, S.f, alpha());
      sweep.pts.push([S.B, L * (1 + 0.03 * (Math.random() - 0.5)) + 0.01 * Math.random()]);
      if (q >= 1) sweep.fixed = true;
      syncCtl();
    }
    if (sdt > 0 && !grab) {
      let left = sdt * SLOW;
      while (left > 1e-9) { const h = Math.min(0.004, left); step(h, alpha()); left -= h; }
      // power taken from the microwaves: -m·dh/dt, as a share of the most it could be
      if (S.drive) {
        const w = 2 * Math.PI * S.f * S.t, P = -(S.m[0] * -Math.sin(w) + S.m[1] * Math.cos(w));
        absorb += (P - absorb) * Math.min(1, sdt * 1.5);
      } else absorb *= Math.exp(-sdt * 3);
    }
    const tilt = Math.acos(Math.max(-1, Math.min(1, S.m[2])));
    if (tilt > 150 * Math.PI / 180 && !flipped) { flipped = true; rig.note({ bench: 'precess', flip: true }); st.flash('Flipped right over!'); sound.play('chime'); }
    if (tilt < 0.5) flipped = false;
    if (st.on('trail')) { trail.push([S.m[0], S.m[1], S.m[2]]); if (trail.length > 320) trail.shift(); } else trail.length = 0;
    hum.set(140 + 55 * GAMMA * S.B, st.running ? 0.05 * Math.sin(tilt) : 0, 0.5);
    if (pending && pending.cond()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- geometry
  st.onResize((w, h, narrow) => {
    const R = narrow ? Math.min(w * 0.34, h * 0.26) : Math.min(h * 0.32, w * 0.24);
    Lay = { w, h, narrow, R, cx: narrow ? w * 0.5 : w * 0.36, cy: narrow ? h * 0.36 : h * 0.5 };
  });
  function proj(x, y, z) {
    const a = x * CA + y * SA, d = -x * SA + y * CA;
    return [Lay.cx + Lay.R * a, Lay.cy - Lay.R * (z * CE + d * SE), d * CE - z * SE];
  }
  // the point on the front of the sphere under the pointer
  function unproj(X, Y) {
    const a = (X - Lay.cx) / Lay.R, v = (Lay.cy - Y) / Lay.R;
    // a² + d² + ((v + d SE)/CE)² = 1, solve for d, take the front (smaller) root
    const A = 1 + SE * SE / (CE * CE), B = 2 * v * SE / (CE * CE), C = a * a + v * v / (CE * CE) - 1;
    const disc = B * B - 4 * A * C;
    let d;
    if (disc < 0) { const n = Math.hypot(a, v) || 1; return unproj(Lay.cx + Lay.R * a / n * 0.999, Lay.cy - Lay.R * v / n * 0.999); }
    d = (-B - Math.sqrt(disc)) / (2 * A);
    const z = (v + d * SE) / CE;
    return [a * CA - d * SA, a * SA + d * CA, z];
  }

  // ---------- drawing
  function drawMagnet(g, w, h) {
    const { cx, cy, R } = Lay, glow = Math.min(1, S.B / 0.3);
    const pw = R * 1.5, ph = Math.max(26, R * 0.32);
    for (const [y0, top] of [[cy - R - ph - 22, true], [cy + R + 22, false]]) {
      K.box(g, cx - pw / 2 - 20, y0 + (top ? -18 : ph), pw + 40, 18, K.MAT.steel, { r: 3, bands: false });
      K.box(g, cx - pw / 2, y0, pw, ph, K.MAT.copper, { r: 4 });
      g.save(); g.globalAlpha = 0.35; g.fillStyle = K.MAT.copper[2]; for (let k = 1; k < 6; k++) g.fillRect(cx - pw / 2 + 3, y0 + ph * k / 6, pw - 6, 1.5); g.restore();
      K.text(g, top ? 'S' : 'N', cx + pw / 2 + 8, y0 + ph / 2 + 5, { size: 14, weight: 700, color: top ? '#3D6FB6' : '#E5534B' });
      K.glow(g, cx, top ? y0 + ph : y0, R * 0.8 * glow, '#9CCBFF', 0.35 * glow);
    }
    if (!Lay.narrow) K.tag(g, `magnet: ${S.B.toFixed(2)} T`, cx - pw / 2 - 24, cy - R - 18, { align: 'right', size: 11.5 });
  }
  function ellipse(g, pts, color, lw, dashBack) {
    for (const back of [true, false]) {
      g.save(); g.beginPath(); let started = false;
      for (let i = 0; i <= pts.length; i++) {
        const p = pts[i % pts.length], isBack = p[2] > 0;
        if (isBack !== back) { started = false; continue; }
        if (!started) { g.moveTo(p[0], p[1]); started = true; } else g.lineTo(p[0], p[1]);
      }
      g.strokeStyle = color; g.lineWidth = lw; g.globalAlpha = back ? 0.35 : 0.9;
      if (back && dashBack) g.setLineDash([4, 4]);
      g.stroke(); g.restore();
    }
  }
  function drawSphere(g, front) {
    const { cx, cy, R } = Lay;
    if (!front) {
      const gr = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(221,246,255,0.75)'); gr.addColorStop(1, 'rgba(168,211,234,0.8)');
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = gr; g.fill();
      const eq = [], mer = [], mer2 = [];
      for (let i = 0; i < 72; i++) { const a = i / 72 * 2 * Math.PI; eq.push(proj(Math.cos(a), Math.sin(a), 0)); mer.push(proj(Math.cos(a), 0, Math.sin(a))); mer2.push(proj(0, Math.cos(a), Math.sin(a))); }
      ellipse(g, eq, '#3D9AC6', 1.6, true); ellipse(g, mer, '#A8D3EA', 1.2, true); ellipse(g, mer2, '#A8D3EA', 1.2, true);
      return;
    }
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.lineWidth = 2.5; g.strokeStyle = K.LINE; g.stroke();
    g.save(); g.globalAlpha = 0.5; g.beginPath(); g.arc(cx - R * 0.3, cy - R * 0.32, R * 0.42, Math.PI * 1.05, Math.PI * 1.45); g.lineWidth = 4; g.strokeStyle = '#FFFFFF'; g.stroke(); g.restore();
  }
  function drawSpin(g) {
    const m = S.m, o = proj(0, 0, 0), tip = proj(m[0] * 0.92, m[1] * 0.92, m[2] * 0.92);
    if (st.on('trail') && trail.length > 2) {
      g.save(); g.lineWidth = 2.5; g.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = proj(trail[i - 1][0] * 0.92, trail[i - 1][1] * 0.92, trail[i - 1][2] * 0.92), b = proj(trail[i][0] * 0.92, trail[i][1] * 0.92, trail[i][2] * 0.92);
        g.strokeStyle = K.hexA('#FF8FAB', 0.1 + 0.8 * i / trail.length); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
      g.restore();
    }
    // the cone it sweeps when precessing: a faint ring at its height
    const len = Math.hypot(tip[0] - o[0], tip[1] - o[1]);
    K.arrow(g, o[0], o[1], tip[0], tip[1], '#E5534B', { lw: Math.max(5, Lay.R * 0.05), head: Math.max(14, Lay.R * 0.11), halo: true });
    K.ball(g, o[0], o[1], Math.max(6, Lay.R * 0.05), 'chrome', { lw: 1.6 });
    if (grab || st.hovering('spin')) K.glow(g, tip[0], tip[1], 30, '#FFFFFF', 0.6);
    void len;
    return tip;
  }
  function drawField(g) {
    const { cx, cy, R } = Lay, a = proj(0, 0, -1.25), b = proj(0, 0, 1.3);
    K.arrow(g, a[0], a[1], b[0], b[1], K.COL.mag, { lw: 4, head: 12, label: 'field B', labelAt: 'tip', size: 11.5, alpha: 0.9 });
    void cx; void cy; void R;
  }
  function drawDrive(g) {
    if (!S.drive) return;
    const w = 2 * Math.PI * S.f * S.t, o = proj(0, 0, 0), e = proj(0.62 * Math.cos(w), 0.62 * Math.sin(w), 0);
    // the microwave coil round the middle
    const ring = []; for (let i = 0; i < 72; i++) { const a = i / 72 * 2 * Math.PI; ring.push(proj(1.08 * Math.cos(a), 1.08 * Math.sin(a), -0.05)); }
    ellipse(g, ring, '#F29E4C', 3, false);
    K.arrow(g, o[0], o[1], e[0], e[1], '#F29E4C', { lw: 3.5, head: 10, alpha: 0.95 });
  }
  function drawTorque(g, tip) {
    const m = S.m, B = [0, 0, S.B];
    const c = [m[1] * B[2] - m[2] * B[1], m[2] * B[0] - m[0] * B[2], m[0] * B[1] - m[1] * B[0]];
    const sideways = [-c[0], -c[1], -c[2]], n1 = Math.hypot(...sideways);
    if (n1 > 1e-6) {
      const e = proj(m[0] * 0.92 + sideways[0] / n1 * 0.35, m[1] * 0.92 + sideways[1] / n1 * 0.35, m[2] * 0.92 + sideways[2] / n1 * 0.35);
      K.arrow(g, tip[0], tip[1], e[0], e[1], '#F29E4C', { lw: 4, head: 11, label: 'the field twists it sideways', labelAt: 'tip', size: 11 });
      // damping: towards the field
      const home = [-m[0] * m[2], -m[1] * m[2], 1 - m[2] * m[2]], n2 = Math.hypot(...home);
      if (n2 > 1e-4) { const k = 0.18 + alpha() * 6; const f = proj(m[0] * 0.92 + home[0] / n2 * k, m[1] * 0.92 + home[1] / n2 * k, m[2] * 0.92 + home[2] / n2 * k); K.arrow(g, tip[0], tip[1], f[0], f[1], K.COL.ke, { lw: 3.5, head: 10, label: 'friction pulls it home', labelAt: 'tip', size: 11 }); }
    }
  }
  function drawClock(g) {
    const w = Lay.w, h = Lay.h, r = Lay.narrow ? Math.min(46, w * 0.12) : Math.min(62, h * 0.13);
    const x = Lay.narrow ? w - r - 16 : w * 0.78, y = Lay.narrow ? Lay.cy + Lay.R + 70 : h * 0.24;
    g.save(); g.beginPath(); g.arc(x, y, r + 8, 0, Math.PI * 2); g.fillStyle = '#FFFDF6'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    for (let k = 0; k < 12; k++) { const a = k / 12 * 2 * Math.PI; g.fillStyle = '#A8D3EA'; g.fillRect(x + (r - 4) * Math.cos(a) - 1.5, y + (r - 4) * Math.sin(a) - 1.5, 3, 3); }
    const am = Math.atan2(S.m[1], S.m[0]), tilt = Math.sqrt(S.m[0] ** 2 + S.m[1] ** 2);
    if (S.drive) { const aw = 2 * Math.PI * S.f * S.t; K.arrow(g, x, y, x + r * 0.78 * Math.cos(-aw), y + r * 0.78 * Math.sin(-aw), '#F29E4C', { lw: 4, head: 9, halo: false }); }
    if (tilt > 0.02) K.arrow(g, x, y, x + r * 0.95 * Math.cos(-am), y + r * 0.95 * Math.sin(-am), '#E5534B', { lw: 4, head: 10, halo: false });
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fillStyle = K.LINE; g.fill();
    const locked = S.drive && Math.abs(S.f - GAMMA * S.B) < Math.max(0.06, alpha() * S.f * 2);
    K.text(g, S.drive ? (locked ? 'turning together!' : 'out of step') : 'seen from above', x, y + r + 26, { size: 11.5, weight: 700, align: 'center', color: locked ? '#2F7D5B' : '#12243A' });
    // how much it absorbs
    if (S.drive) {
      const bw = r * 2, bx = x - r, by = y + r + 34, v = Math.max(0, Math.min(1, absorb));
      g.save(); K.rr(g, bx, by, bw, 10, 5); g.fillStyle = '#EAF6FC'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = K.LINE; g.stroke();
      if (v > 0.01) { K.rr(g, bx + 1.5, by + 1.5, (bw - 3) * v, 7, 3.5); g.fillStyle = '#F29E4C'; g.fill(); }
      g.restore();
      K.text(g, 'absorbing', x, by + 24, { size: 10.5, weight: 600, align: 'center', color: '#C96F2A' });
    }
  }
  function drawSweep(g) {
    if (!sweep) return;
    const w = Lay.w, h = Lay.h;
    const x0 = Lay.narrow ? 16 : w * 0.62, x1 = w - 16, y0 = Lay.narrow ? h - 120 : h * 0.6, y1 = Lay.narrow ? h - 14 : h * 0.93;
    g.save(); K.rr(g, x0, y0, x1 - x0, y1 - y0, 10); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const px0 = x0 + 12, px1 = x1 - 12, py0 = y0 + 26, py1 = y1 - 22;
    const X = (B) => px0 + (B - sweep.B0) / (sweep.B1 - sweep.B0) * (px1 - px0), Y = (v) => py1 - v * (py1 - py0);
    K.text(g, 'Field sweep: microwaves absorbed', x0 + 12, y0 + 18, { size: 11.5, weight: 700 });
    g.strokeStyle = '#D6ECF7'; g.lineWidth = 1; g.beginPath(); g.moveTo(px0, py1); g.lineTo(px1, py1); g.stroke();
    const pts = sweep.pts.map(([B, v]) => [X(B), Y(v)]);
    K.polyline(g, pts, '#C96F2A', 2.2);
    for (const B of [sweep.B0, (sweep.B0 + sweep.B1) / 2, sweep.B1]) K.text(g, `${B.toFixed(2)} T`, X(B), py1 + 14, { size: 10, weight: 600, align: 'center' });
    K.lineSeg(g, X(S.B), py0, X(S.B), py1, K.hexA(K.COL.mag, 0.7), 1.5, [4, 3]);
    const Bres = S.f / GAMMA;
    if (sweep.fixed || S.B > Bres + 0.01) { K.lineSeg(g, X(Bres), py0 - 4, X(Bres), py1, '#2F7D5B', 1.5, [2, 3]); K.text(g, `f = γB at ${Bres.toFixed(3)} T`, Math.min(px1 - 70, X(Bres) + 6), py0 + 4, { size: 10.5, weight: 600, color: '#2F7D5B' }); }
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[3], { floorH: 0.1 });
    });
    drawMagnet(g, w, h);
    drawSphere(g, false);
    if (st.on('field')) drawField(g);
    drawDrive(g);
    const tip = drawSpin(g);
    if (st.on('torque')) drawTorque(g, tip);
    drawSphere(g, true);
    if (st.on('clock')) drawClock(g);
    drawSweep(g);
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.arrow(g, tip[0] + 90 + k * 8, tip[1] - 50, tip[0] + 14, tip[1] - 8, K.COL.normal, { lw: 3.5, head: 11 }); K.tag(g, 'drag me', tip[0] + 96 + k * 8, tip[1] - 62, { size: 11.5, align: 'left' }); }
  });
  st.peek = () => { const t = proj(S.m[0] * 0.92, S.m[1] * 0.92, S.m[2] * 0.92); return { tip: t, L: Lay, m: S.m.slice(), B: S.B, drive: S.drive, absorb }; };   // for tests
  st.onOver(() => {
    const tilt = Math.acos(Math.max(-1, Math.min(1, S.m[2]))) * 180 / Math.PI;
    st.set('f0', `${(GAMMA * S.B).toFixed(2)} GHz`);
    st.set('tilt', `${tilt.toFixed(0)}°`);
    st.set('mw', S.drive ? `${S.f.toFixed(2)} GHz, ${S.h1.toFixed(1)} mT` : 'off');
    st.set('abs', S.drive ? `${Math.round(Math.max(0, Math.min(1, absorb)) * 100)}%` : '–');
  });

  // ---------- hands
  st.handle({
    id: 'spin', cursor: 'grab',
    hit: (x, y) => { const t = proj(S.m[0] * 0.92, S.m[1] * 0.92, S.m[2] * 0.92), d = Math.hypot(x - t[0], y - t[1]); return d < 26 ? d : Math.hypot(x - Lay.cx, y - Lay.cy) < Lay.R ? 40 : false; },
    down: (x, y) => { grab = true; first = false; S.m = unproj(x, y); trail = []; },
    move: (x, y) => { S.m = unproj(x, y); },
    up: () => { grab = false; sound.play('swing'); },
    click: (x, y) => { grab = false; S.m = unproj(x, y); trail = []; },
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  const tipTo = (deg) => { const a = deg * Math.PI / 180; S.m = [Math.sin(a), 0, Math.cos(a)]; trail = []; };
  st.tour({
    title: 'Why does it go round?',
    steps: [
      { say: 'Every electron is a tiny magnet that also **spins**, a bit like the gyroscope on 2F. Here is one spin (the red arrow), sitting in a magnetic field (blue, pointing up).',
        tools: { trail: true, field: true, torque: false, clock: false }, enter: () => { S.drive = false; sweep = null; syncCtl(); setB(0.2); tipTo(4); }, mark: () => { const t = proj(S.m[0] * 0.92, S.m[1] * 0.92, S.m[2] * 0.92); return [t[0], t[1], 24]; } },
      { say: 'Tip it over and let go. It does not simply fall back: the field **twists it sideways**, so it goes round and round the field. This is **precession**, just like the wobbling gyroscope.',
        tools: { torque: true }, enter: () => tipTo(55) },
      { say: 'A little friction (**damping**) slowly takes its energy, so it spirals back home towards the field. The green arrow shows that pull.',
        tools: { torque: true } },
      { say: 'How fast it goes round is set only by the field: **28 GHz for every tesla**. Double the field and it turns twice as fast. (Everything here is slowed down billions of times, so you can see it.)',
        tools: { torque: false, clock: true }, enter: () => { tipTo(50); anim = { t0: st.simT, from: 0.12, to: 0.3, dur: 4, set: (v) => setB(v) }; } },
      { say: 'Now add **microwaves** (the orange arrow) that turn at exactly the spin’s own pace. Every little push lands at the right moment, and the spin swings wide open: **resonance**.',
        enter: () => { anim = null; setB(0.2); tipTo(3); S.f = 5.6; S.h1 = 3; toggleDrive(true); } },
      { say: 'In the lab we keep the microwaves fixed and **sweep the field** instead. The spin soaks up microwaves only near f = γB: this is **ferromagnetic resonance**, the measurement our FMR setup makes every day.',
        enter: () => { tipTo(3); S.h1 = 3; startSweep(); } },
    ],
    onEnd: () => { sweep = null; },
  });

  // ---------- challenges
  const after = () => { pending = null; anim = null; alphaOver = null; };
  st.setChallenges([
    {
      id: 'double', title: 'Twice the field', card: 'precess.field', lock: true, after,
      setup: () => { S.drive = false; sweep = null; syncCtl(); setB(0.12); tipTo(45); st.setTool('clock', true); },
      q: 'The spin is going round in a field of 0.12 T. Now double the field to 0.24 T. The spin goes round…',
      choices: ['twice as fast', 'half as fast', 'just as fast'], answer: 0,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(3, () => { anim = { t0: st.simT, from: 0.12, to: 0.24, dur: 1.5, set: (v) => setB(v), then: () => wait(3, () => finish('3.4 GHz before, 6.7 GHz after.')) }; }); },
      explain: 'The field sets the pace: f = γB, with γ = 28 GHz per tesla for an electron. Twice the field, twice the pace. This is why we tune our FMR with the magnet.',
    },
    {
      id: 'tune', title: 'Find the resonance', card: 'precess.resonance', lock: true, after,
      setup: () => { sweep = null; tipTo(2); S.f = 5.6; S.h1 = 3; S.drive = false; setB(0.1); syncCtl(); },
      q: 'The microwaves turn at 5.6 GHz. At which field will they make the spin swing wide open?',
      choices: ['0.1 T', '0.2 T', '0.4 T'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); toggleDrive(true); wait(1, () => { startSweep(); until(() => sweep && sweep.fixed, () => finish(`The peak sits at ${(5.6 / GAMMA).toFixed(2)} T.`)); }); },
      explain: 'Resonance happens when the microwaves turn at the spin’s own pace: 5.6 GHz = 28 GHz/T × 0.2 T. Measuring where the peak sits tells us about the magnet the spin lives in.',
    },
    {
      id: 'damp', title: 'More friction', card: 'precess.damping', lock: true, after,
      setup: () => { sweep = null; tipTo(2); S.f = 5.6; S.h1 = 3; S.drive = true; setB(0.15); syncCtl(); alphaOver = 0.02; },
      q: 'Now a spin with three times more friction (damping). Its resonance line becomes…',
      choices: ['narrower and taller', 'wider and lower', 'exactly the same'], answer: 1,
      run: (s0, finish) => {
        s0.setPaused(false); s0.setSpeed(1);
        startSweep();
        until(() => sweep && sweep.fixed, () => { const firstPts = sweep.pts.slice(); alphaOver = 0.06; startSweep(); sweep.ghost = firstPts; until(() => sweep && sweep.fixed, () => finish('Same peak position, three times wider.')); });
      },
      explain: 'With more friction the spin answers a wider range of fields, but never as strongly. The width of an FMR line is how we measure a material’s damping, and low damping is what makes a good magnon material.',
    },
  ]);
  // draw the earlier sweep faintly underneath, when comparing
  st.onOver((g) => {
    if (!sweep || !sweep.ghost) return;
    const w = Lay.w, h = Lay.h;
    const x0 = Lay.narrow ? 16 : w * 0.62, x1 = w - 16, y0 = Lay.narrow ? h - 120 : h * 0.6, y1 = Lay.narrow ? h - 14 : h * 0.93;
    const px0 = x0 + 12, px1 = x1 - 12, py0 = y0 + 26, py1 = y1 - 22;
    const X = (B) => px0 + (B - sweep.B0) / (sweep.B1 - sweep.B0) * (px1 - px0), Y = (v) => py1 - v * (py1 - py0);
    K.polyline(g, sweep.ghost.map(([B, v]) => [X(B), Y(v)]), '#7B5CF0', 2, { alpha: 0.6, dash: [4, 3] });
  });

  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }];

export default bench;
