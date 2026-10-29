// 3F · Microwave Bragg diffraction. Steel balls on a lattice play the atoms of a crystal and
// microwaves (about 3 cm long) play the X-rays, so the whole of X-ray crystallography fits on a
// turntable. Our undergraduates built this in 2026: simple cubic, body-centred and face-centred
// crystals of steel balls on a 3D-printed frame, and a pocket network analyser.
// The model: every ball scatters a little; in a θ–2θ scan the scattered waves add with phases
// 2k sinθ (r·n), so the signal is |Σ exp(i q r·n)|², with the extinctions of each lattice built in.

import { el } from '../ui/widgets.js';
import { rigStrip, current, phys, onRig, gauss } from './common.js';
import { rig } from '../rpg/state.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { tr, trf } from '../i18n.js';

const C = 0.2998;            // λ (m) = C / f (GHz)
const NC = 5;                // unit cells along each edge of the crystal
const TH0 = 5, TH1 = 75;     // the crystal angle θ (degrees); the receiver sits at 2θ
const RAD = Math.PI / 180;

const BASIS = {
  sc: [[0, 0, 0]],
  bcc: [[0, 0, 0], [0.5, 0.5, 0.5]],
  fcc: [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]],
};

const bench = {
  id: 'bragg', title: 'Microwave Bragg diffraction', kicker: '3F · Magnonics Lab', icon: '⁘', floor: 3,
  blurb: 'Steel-ball crystals and microwaves: find the angles where the reflections add up.',
  slots: [{ id: 'lattice', label: 'Crystal', options: ['lat-sc', 'lat-bcc', 'lat-fcc', 'lat-x'], def: 'lat-sc' }],
};
bench.header = rigStrip(bench);

const S = { th: 15, f: 10.5, face: 100 };

// a crystal: the balls, in units of a, turned so that the chosen face looks at the beam.
// x' runs along the planes, y' across them; the planes sit at whole numbers of the spacing d.
function build(kind, face) {
  const pts = [];
  for (let i = 0; i < NC; i++) for (let j = 0; j < NC; j++) for (let k = 0; k < NC; k++)
    for (const [bx, by, bz] of BASIS[kind]) pts.push([i + bx, j + by, k + bz]);
  const c = [0, 1, 2].map((ax) => pts.reduce((s, p) => s + p[ax], 0) / pts.length);
  const s2 = Math.SQRT1_2;
  const P = pts.map(([x, y, z]) => {
    x -= c[0]; y -= c[1]; z -= c[2];
    return face === 110 ? [(x - y) * s2, (x + y) * s2, z, x + y] : [x, y, z, y];
  });
  // d in units of a, and whether each ball sits on a plane (the planes through the corner balls)
  const d = face === 110 ? s2 : 1;
  const off = face === 110 ? -(c[0] + c[1]) * s2 : -c[1];
  for (const p of P) { const u = (p[1] - off) / d; p[4] = Math.abs(u - Math.round(u)) < 1e-6; }
  // top view: one ball per column
  const seen = new Map();
  for (const p of P) { const key = `${p[0].toFixed(3)},${p[1].toFixed(3)}`; if (!seen.has(key) || p[4]) seen.set(key, p); }
  return { pts: P, cols: [...seen.values()], d, off, n: P.length };
}

function lam() { return C / S.f; }
function signal(X, a, thDeg) {
  const q = 4 * Math.PI / lam() * Math.sin(thDeg * RAD) * a;
  let re = 0, im = 0;
  for (const p of X.pts) { re += Math.cos(q * p[1]); im += Math.sin(q * p[1]); }
  const pol = (1 + Math.cos(2 * thDeg * RAD) ** 2) / 2;
  return (re * re + im * im) / (X.n * X.n) * pol;
}

function tabPlay(pane) {
  let Lay = { w: 800, h: 500 }, first = true, pending = null, anim = null, scan = null;
  let X = null, key = '', kindOver = null, aOver = null, data = [], phase = 0, lastPeak = 0, meas = 0;
  const hum = sound.hum('sine');

  const lattice = () => {
    const id = current(bench, 'lattice');
    const ph = phys(bench, 'lattice');
    return { id, kind: kindOver || ph.kind, a: aOver || (id === 'lat-x' && !kindOver ? rig.secret('latX') / 100 : ph.a) };   // Crystal #9: a different spacing for every visitor
  };
  const ensure = () => {
    const L = lattice(), k = `${L.kind}|${S.face}`;
    if (k !== key) { key = k; X = build(L.kind, S.face); }
    return { X, a: L.a, kind: L.kind, id: L.id };
  };

  const st = new Stage(pane, {
    bench, npc: 'nova',
    label: 'Seen from above: a crystal of steel balls on a turntable, a microwave transmitter, and a receiver on an arm at twice the crystal angle. Beside it, the signal against the angle.',
    hello: 'Microwaves bounce off a **crystal of steel balls**. Turn the crystal (the receiver follows at twice the angle) or press **Scan**, and find the angles where the signal jumps.',
    aspect: 16 / 10, phoneAspect: 0.62, minH: 400,
    onReset: () => { S.th = 15; S.f = 10.5; S.face = 100; data = []; scan = null; kindOver = null; aOver = null; syncCtl(); first = true; },
    onHide: () => hum.set(330, 0),
    keys: { arrow: (dx) => { if (dx) setTh(S.th + dx * 0.5); }, action: () => startScan() },
  });
  st.tool('planes', 'Planes', { icon: '#00A9D6', on: true }).tool('waves', 'Waves', { icon: '#F2B33D', on: true })
    .tool('paths', 'Path difference', { icon: '#E5534B' }).tool('bragg', 'Bragg’s law lines', { icon: '#7B5CF0' });
  st.readout('th', 'Crystal angle').readout('lam', 'Wavelength').readout('path', 'Extra path').readout('sig', 'Signal');

  // ---------- controls
  const mk = (label, min, max, stepv, get, set) => {
    const lab = el('span', { text: '' }), inp = el('input', { type: 'range', min, max, step: stepv, value: get(), 'aria-label': label });
    inp.addEventListener('input', () => { set(+inp.value); first = false; syncCtl(); });
    return { el: el('label', { class: 'stg-range' }, lab, inp), lab, inp };
  };
  const rT = mk('Crystal angle in degrees', TH0, TH1, 0.1, () => S.th, (v) => { scan = null; S.th = v; });
  const rF = mk('Microwave frequency in gigahertz', 8, 14, 0.05, () => S.f, (v) => { S.f = v; data = []; });
  const scB = el('button', { type: 'button', class: 'stg-act', text: 'Scan' });
  const clB = el('button', { type: 'button', class: 'stg-act ghost', text: 'Clear' });
  scB.addEventListener('click', () => startScan());
  clB.addEventListener('click', () => { data = []; sound.play('pop'); });
  const f100 = el('button', { type: 'button', class: 'stg-act', text: 'Cube face' });
  const f110 = el('button', { type: 'button', class: 'stg-act ghost', text: 'Diagonal' });
  f100.addEventListener('click', () => setFace(100));
  f110.addEventListener('click', () => setFace(110));
  st.controls(rT.el, el('div', { class: 'stg-row' }, scB, clB), el('span', { class: 'stg-small', text: 'Facing the beam:' }), el('div', { class: 'stg-row' }, f100, f110), rF.el);
  function syncCtl() {
    rT.inp.value = S.th; rT.lab.textContent = `Crystal: ${S.th.toFixed(1)}°, receiver at ${(2 * S.th).toFixed(1)}°`;
    rF.inp.value = S.f; rF.lab.textContent = `Microwaves: ${S.f.toFixed(2)} GHz (λ = ${(lam() * 100).toFixed(2)} cm)`;
    f100.classList.toggle('ghost', S.face !== 100); f110.classList.toggle('ghost', S.face !== 110);
  }
  function setTh(v) { S.th = Math.max(TH0, Math.min(TH1, v)); scan = null; first = false; syncCtl(); }
  function setFace(fc) { if (S.face !== fc) { S.face = fc; data = []; sound.play('click'); } syncCtl(); }
  function glideTh(v, then) { scan = null; anim = { t0: st.simT, from: S.th, to: v, dur: 1.6, set: (x) => { S.th = x; syncCtl(); }, then }; first = false; }
  function startScan(from = TH0, to = TH1, dur = 12) { anim = null; data = []; scan = { t0: st.simT, from, to, dur }; first = false; sound.play('click'); }
  onRig(bench, () => { data = []; key = ''; });
  syncCtl();

  // ---------- time
  st.onStep((sdt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const x = anim; anim = null; if (x.then) x.then(); }
    }
    const { X: Xc, a, id } = ensure();
    if (scan) {
      const q = Math.min(1, (st.simT - scan.t0) / scan.dur);
      S.th = scan.from + (scan.to - scan.from) * q; syncCtl();
      if (q >= 1) { scan = null; rig.note({ bench: 'bragg', scan: true, lattice: id, face: S.face }); st.flash('Scan done'); }
    }
    const I = signal(Xc, a, S.th);
    meas = Math.max(0, I + 0.006 + 0.01 * gauss());
    if (sdt > 0 && (scan || st.running)) {
      const last = data[data.length - 1];
      if (scan && (!last || Math.abs(last[0] - S.th) > 0.12)) data.push([S.th, meas]);
    }
    phase += sdt * 5;
    hum.set(300 + 500 * Math.min(1, I), st.running ? 0.05 * Math.min(1, I * 1.4) : 0, 0.5);
    // a peak found by hand
    const n = Math.round(2 * a * X.d * Math.sin(S.th * RAD) / lam());
    if (!scan && !anim && I > 0.45 && n !== lastPeak) { lastPeak = n; st.flash('Bragg peak!'); sound.play('chime'); rig.note({ bench: 'bragg', peak: n, lattice: id }); }
    if (I < 0.15) lastPeak = 0;
    if (pending && pending.cond()) { const x = pending.then; pending = null; x(); }
  });

  // ---------- layout
  st.onResize((w, h, narrow) => {
    if (narrow) {
      const R = Math.min(w * 0.15, h * 0.1), Lh = R * 2.05;
      const ay = Math.max(h * 0.27, Lh + R * 0.8 + 10);
      const y1 = ay + R + 50;
      Lay = { w, h, narrow, R, Lh, ax: w / 2, ay, plot: { x: 10, y: y1, w: w - 20, h: h - y1 - 10 }, inset: { x: 10, y: y1, w: w - 20, h: Math.min(170, h * 0.24) } };
    } else {
      const R = Math.min(h * 0.16, w * 0.08), Lh = R * 2.05, ax = 24 + R * 3.1;
      Lay = { w, h, narrow, R, Lh, ax, ay: Math.max(h * 0.5, Lh + R * 0.9), plot: { x: w * 0.55, y: 16, w: w * 0.45 - 16, h: h * 0.6 }, inset: { x: w * 0.55, y: h * 0.6 + 28, w: w * 0.45 - 16, h: h * 0.4 - 44 } };
    }
  });

  // ---------- drawing
  const rot = (th) => {   // crystal (x' along the planes, y' across) to the screen
    const c = Math.cos(th * RAD), s = Math.sin(th * RAD);
    return (x, y) => [x * c + y * s, -x * s + y * c];
  };
  function horn(g, x, y, ang, label, glowA) {
    // a pyramidal horn whose mouth faces along ang (radians, screen), body behind it
    const R = Lay.R, c = Math.cos(ang), s = Math.sin(ang), L = R * 0.62, m = R * 0.34, b = R * 0.12;
    const P = (u, v) => [x + u * c - v * s, y + u * s + v * c];
    if (glowA > 0.02) K.glow(g, ...P(L * 0.2, 0), R * 0.9, '#FFE07A', 0.55 * glowA);
    g.save();
    g.beginPath(); const p1 = P(-L, -b), p2 = P(0, -m), p3 = P(0, m), p4 = P(-L, b);
    g.moveTo(...p1); g.lineTo(...p2); g.lineTo(...p3); g.lineTo(...p4); g.closePath();
    g.fillStyle = K.MAT.brass[0]; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    g.beginPath(); const q1 = P(-L - R * 0.32, -b - 3), q2 = P(-L, -b - 3), q3 = P(-L, b + 3), q4 = P(-L - R * 0.32, b + 3);
    g.moveTo(...q1); g.lineTo(...q2); g.lineTo(...q3); g.lineTo(...q4); g.closePath();
    g.fillStyle = K.MAT.copper[0]; g.fill(); g.stroke();
    g.restore();
    const lp = P(-L * 0.5, -m - 14);
    K.text(g, label, lp[0], lp[1], { size: 10.5, weight: 700, align: 'center', color: '#FFFDF6', halo: '#14244A' });
  }
  function drawRig(g) {
    const { ax, ay, R, Lh } = Lay, { X: Xc, a } = ensure(), I = signal(Xc, a, S.th), th = S.th;
    // turntable and the receiver's arm
    g.save(); g.beginPath(); g.arc(ax, ay, R, 0, Math.PI * 2); g.fillStyle = '#E9F3FA'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = K.LINE; g.stroke();
    for (let k = 0; k < 36; k++) { const u = k * 10 * RAD; g.beginPath(); g.moveTo(ax + Math.cos(u) * R * 0.9, ay + Math.sin(u) * R * 0.9); g.lineTo(ax + Math.cos(u) * R, ay + Math.sin(u) * R); g.lineWidth = k % 9 ? 1 : 2; g.strokeStyle = '#7FA6C9'; g.stroke(); }
    g.restore();
    const r2 = 2 * th * RAD, rx = ax + Lh * Math.cos(r2), ry = ay - Lh * Math.sin(r2);
    K.rod(g, ax, ay, rx, ry, 7, K.MAT.alu);
    // the crystal: scale it to fit the turntable
    const span = ((NC - 1) / 2 + 0.6) * Math.SQRT2, pxa = R * 0.86 / span, T = rot(th);
    const L = lam() / a * pxa;   // the wavelength on screen
    // waves: in from the transmitter, out towards the receiver (as strong as the signal)
    const tx = ax - Lh, ty = ay;
    if (st.on('waves')) {
      g.save(); g.lineCap = 'round';
      const inLen = Lh - R * 0.95, M = Lay.R * 0.3;
      for (let s = (phase * L / (2 * Math.PI)) % L; s < inLen; s += L) {
        const x = tx + s + 2; g.strokeStyle = `rgba(242,179,61,${0.75 * (1 - s / inLen * 0.4)})`; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x, ty - M); g.lineTo(x, ty + M); g.stroke();
      }
      const amp = Math.sqrt(Math.min(1, I)), ux = Math.cos(r2), uy = -Math.sin(r2);
      if (amp > 0.03) for (let s = R * 0.9 + (phase * L / (2 * Math.PI)) % L; s < Lh - R * 0.6; s += L) {
        const x = ax + ux * s, y = ay + uy * s, M2 = M * (0.6 + 0.4 * amp);
        g.strokeStyle = `rgba(242,179,61,${0.85 * amp})`; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(x - uy * M2, y + ux * M2); g.lineTo(x + uy * M2, y - ux * M2); g.stroke();
      }
      g.restore();
    }
    // the planes: lines across the crystal, spaced d, lit up near a Bragg angle
    const showPl = st.on('planes'), dpx = Xc.d * pxa;
    if (showPl) {
      const nPl = Math.ceil(span / Xc.d) + 1, lit = Math.min(1, I * 1.5);
      g.save(); g.beginPath(); g.arc(ax, ay, R * 0.95, 0, Math.PI * 2); g.clip();
      for (let m = -nPl; m <= nPl; m++) {
        const y0 = Xc.off + m * Xc.d;
        const [x1, y1] = T(-span, y0), [x2, y2] = T(span, y0);
        g.strokeStyle = lit > 0.2 ? `rgba(0,169,214,${0.5 + 0.5 * lit})` : 'rgba(0,169,214,0.45)'; g.lineWidth = lit > 0.2 ? 2 + lit * 1.5 : 1.5;
        g.setLineDash(lit > 0.2 ? [] : [5, 4]);
        g.beginPath(); g.moveTo(ax + x1 * pxa, ay + y1 * pxa); g.lineTo(ax + x2 * pxa, ay + y2 * pxa); g.stroke();
      }
      g.restore(); g.setLineDash([]);
    }
    // the balls (one per column, seen from above)
    const br = Math.max(2.5, Math.min(pxa * 0.26, 8));
    for (const p of Xc.cols) {
      const [sx, sy] = T(p[0], p[1]);
      const off = showPl && !p[4];
      K.ball(g, ax + sx * pxa, ay + sy * pxa, br, off ? 'orange' : 'steel', { lw: 1.5 });
    }
    // transmitter and receiver
    horn(g, tx, ty, 0, 'transmitter', 0);
    horn(g, rx, ry, Math.PI - r2, 'receiver', Math.min(1, I));
    // a little level meter behind the receiver, out along its arm
    const mx = ax + (Lh + R * 1.2) * Math.cos(r2) - 7, my = ay - (Lh + R * 1.2) * Math.sin(r2) - 22;
    g.save(); K.rr(g, mx - 2, my - 2, 16, 46, 4); g.fillStyle = '#12243A'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#5F86C2'; g.stroke();
    const lv = Math.min(1, meas);
    for (let k = 0; k < 8; k++) { const on = (k + 0.5) / 8 < lv; g.fillStyle = on ? (k > 5 ? '#FF8F84' : k > 3 ? '#FFE07A' : '#7CFFB2') : '#24406B'; g.fillRect(mx + 1, my + 38 - k * 5, 10, 3.5); }
    g.restore();
    // what is on the turntable
    const { kind, id } = ensure();
    const name = id === 'lat-x' && !kindOver ? 'Crystal #9' : { sc: 'simple cubic', bcc: 'body-centred', fcc: 'face-centred' }[kind];
    const lines = [[trf('{0}, {1} to the beam', tr(name), tr(S.face === 100 ? 'cube face' : 'diagonal')), '#FFFDF6']];
    if (showPl && !Lay.narrow) lines.push([`planes ${(Xc.d * a * 100).toFixed(1)} cm apart`, '#CFE8F7']);
    if (showPl && Xc.cols.some((p) => !p[4])) lines.push(['orange balls sit between the planes', '#FFD1A1']);
    lines.forEach(([t, col], i) => K.text(g, t, ax, ay + R + 18 + i * 14, { size: 10.5, weight: 700, align: 'center', color: col, halo: '#14244A' }));
    // the angle between beam and planes
    if (!Lay.narrow) K.text(g, `θ = ${th.toFixed(1)}°`, ax + R * 0.2, ay - R - 10, { size: 11, weight: 700, color: '#FFFDF6', halo: '#14244A' });
    return { rx, ry };
  }
  function drawPlot(g) {
    const P = { ...Lay.plot }, { X: Xc, a } = ensure();
    if (Lay.narrow && st.on('paths')) { P.y = Lay.inset.y + Lay.inset.h + 10; P.h = Lay.h - P.y - 10; }
    g.save(); K.rr(g, P.x, P.y, P.w, P.h, 10); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const x0 = P.x + 34, x1 = P.x + P.w - 14, y0 = P.y + 30, y1 = P.y + P.h - 24;
    const X = (t) => x0 + (t - TH0) / (TH1 - TH0) * (x1 - x0), Y = (v) => y1 - Math.min(1.05, v) * (y1 - y0) / 1.05;
    K.text(g, 'Signal against crystal angle', P.x + 12, P.y + 19, { size: 11.5, weight: 700 });
    for (let t = 10; t <= 70; t += 10) { g.fillStyle = '#12243A'; g.fillRect(X(t), y1, 1.5, 4); K.text(g, `${t}°`, X(t), y1 + 15, { size: 10, weight: 600, align: 'center' }); }
    g.strokeStyle = '#D6ECF7'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x1, y1); g.moveTo(x0, y0); g.lineTo(x0, y1); g.stroke();
    if (st.on('bragg')) {
      const d = Xc.d * a;
      for (let n = 1; n < 8; n++) {
        const s = n * lam() / (2 * d); if (s >= 1) break;
        const t = Math.asin(s) / RAD; if (t < TH0 || t > TH1) continue;
        K.lineSeg(g, X(t), y0, X(t), y1, K.hexA('#7B5CF0', 0.8), 1.5, [5, 4]);
        K.text(g, `n = ${n}`, X(t) + 3, y0 + 10 + (n % 2) * 12, { size: 10, weight: 700, color: '#5B3FD0' });
      }
    }
    if (data.length > 1) {
      const pts = data.map(([t, v]) => [X(t), Y(v)]);
      g.save(); g.beginPath(); g.moveTo(pts[0][0], y1); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(pts[pts.length - 1][0], y1); g.closePath(); g.fillStyle = 'rgba(242,179,61,0.25)'; g.fill(); g.restore();
      K.polyline(g, pts, '#D9822B', 2.2);
    } else if (!scan) K.text(g, 'press Scan to record a whole sweep', (x0 + x1) / 2, (y0 + y1) / 2, { size: 11, weight: 600, align: 'center', color: '#5B4BC4' });
    g.beginPath(); g.arc(X(S.th), Y(meas), 6, 0, Math.PI * 2); g.fillStyle = '#FFE07A'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
  }
  // the reason: two planes, two rays, and the extra path of the lower one
  function drawPaths(g) {
    const P = Lay.inset, { X: Xc, a } = ensure();
    g.save(); K.rr(g, P.x, P.y, P.w, P.h, 10); g.fillStyle = 'rgba(255,253,246,0.97)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
    g.beginPath(); g.rect(P.x + 2, P.y + 2, P.w - 4, P.h - 4); g.clip();
    const th = S.th * RAD, dpx = Math.min(P.h * 0.24, 44), lpx = lam() / (Xc.d * a) * dpx;
    const yA = P.y + Math.max(40, P.h * 0.36), yB = yA + dpx, A = [P.x + P.w * 0.46, yA], B = [A[0], yB];
    for (const y of [yA, yB]) {
      K.lineSeg(g, P.x + 12, y, P.x + P.w - 12, y, '#00A9D6', 2);
      for (let k = -4; k <= 4; k++) K.ball(g, A[0] + k * dpx * 1.1, y, 4.5, 'steel', { lw: 1.2 });
    }
    const ui = [Math.cos(th), Math.sin(th)], uo = [Math.cos(th), -Math.sin(th)], ds = dpx * Math.sin(th);
    const F1 = [B[0] - ds * ui[0], B[1] - ds * ui[1]], F2 = [B[0] + ds * uo[0], B[1] + ds * uo[1]];
    const Lin = P.w * 0.4, Lout = P.w * 0.36;
    // incoming rays and the outgoing waves; the lower one is late by 2d sinθ
    K.lineSeg(g, A[0] - Lin * ui[0], A[1] - Lin * ui[1], A[0], A[1], '#D9822B', 2);
    K.lineSeg(g, F1[0] - Lin * ui[0], F1[1] - Lin * ui[1], B[0], B[1], '#D9822B', 2);
    const extra = 2 * Xc.d * a * Math.sin(th) / lam();
    [[A, 0], [F2, extra]].forEach(([p0, lag], i) => {
      if (i === 1) K.lineSeg(g, B[0], B[1], p0[0], p0[1], '#D9822B', 2);
      const pts = [];
      for (let s = 0; s <= Lout; s += 2) {
        const yv = 5.5 * Math.sin(2 * Math.PI * (s / lpx - lag) - phase);
        pts.push([p0[0] + s * uo[0] - yv * uo[1], p0[1] + s * uo[1] + yv * uo[0]]);
      }
      K.polyline(g, pts, i ? '#3D7FD6' : '#E5534B', 2.4);
    });
    // the extra path, in two halves of d sinθ
    K.lineSeg(g, F1[0], F1[1], B[0], B[1], '#7B5CF0', 5); K.lineSeg(g, B[0], B[1], F2[0], F2[1], '#7B5CF0', 5);
    K.lineSeg(g, A[0], A[1], F1[0], F1[1], '#12243A', 1.2, [3, 3]); K.lineSeg(g, A[0], A[1], F2[0], F2[1], '#12243A', 1.2, [3, 3]);
    K.lineSeg(g, P.x + 22, yA, P.x + 22, yB, '#12243A', 1.5);
    K.text(g, 'd', P.x + 28, (yA + yB) / 2 + 4, { size: 11, weight: 700 });
    K.angleArc(g, A[0], A[1], 26, Math.PI + th, Math.PI, '#D9822B', 'θ');
    g.restore();
    const whole = Math.abs(extra - Math.round(extra)) < 0.08 && Math.round(extra) > 0;
    K.text(g, 'Why only some angles?', P.x + 12, P.y + 19, { size: 11.5, weight: 700 });
    K.text(g, `extra path 2d sinθ = ${extra.toFixed(2)} λ`, P.x + 12, P.y + P.h - 26, { size: 11.5, weight: 700, color: '#5B3FD0' });
    K.text(g, whole ? 'a whole number of wavelengths: the waves add up' : 'not a whole number: the planes’ waves cancel', P.x + 12, P.y + P.h - 10, { size: 11, weight: 600, color: whole ? '#1E7A52' : '#A12F38' });
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => { K.room(gg, ww, hh, K.THEME.dark, { floorH: 0.06 }); });
    drawRig(g);
    if (st.on('paths')) drawPaths(g);
    drawPlot(g);
    if (first && !Lay.narrow) { const k = (Math.sin(st.t * 3) + 1) / 2; K.tag(g, 'drag the receiver round, or press Scan', Lay.ax, Lay.ay + Lay.R + 70 + k * 3, { size: 11.5, bg: '#FFE07A' }); }
  });
  st.onOver(() => {
    const { X: Xc, a } = ensure(), extra = 2 * Xc.d * a * Math.sin(S.th * RAD) / lam();
    st.set('th', `${S.th.toFixed(1)}°`);
    st.set('lam', `${(lam() * 100).toFixed(2)} cm`);
    st.set('path', `${extra.toFixed(2)} λ`);
    st.set('sig', `${Math.round(Math.min(1, meas) * 100)}%`);
  });

  // ---------- hands: drag the receiver round the turntable
  const angAt = (x, y) => Math.atan2(Lay.ay - y, x - Lay.ax) / RAD / 2;
  st.handle({
    id: 'receiver', cursor: 'grab',
    hit: (x, y) => { const r2 = 2 * S.th * RAD, rx = Lay.ax + Lay.Lh * Math.cos(r2), ry = Lay.ay - Lay.Lh * Math.sin(r2); return Math.hypot(x - rx, y - ry) < Lay.R * 0.75 ? 1 : false; },
    down: (x, y) => { setTh(angAt(x, y)); },
    move: (x, y) => { setTh(angAt(x, y)); },
    click: () => {},
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  const firstPeak = () => { const { X: Xc, a } = ensure(); return Math.asin(Math.min(1, lam() / (2 * Xc.d * a))) / RAD; };
  st.tour({
    title: 'Why only certain angles?',
    steps: [
      { say: 'Steel balls 4 cm apart and microwaves 3 cm long: a giant copy of how **X-rays** find the atoms in a crystal (there the waves are 0.1 nm and the atoms 0.3 nm apart).',
        tools: { waves: true, planes: false, paths: false, bragg: false }, enter: () => { kindOver = 'sc'; aOver = 0.04; S.face = 100; S.f = 10.5; data = []; glideTh(15); } },
      { say: 'Every ball scatters a little of the wave. At most angles the little waves arrive out of step and **cancel**: the receiver hears almost nothing.',
        tools: { planes: true } },
      { say: 'The balls line up in **planes**. A wave that bounces off the next plane down travels further, by **2d sinθ**, where d is the spacing between planes.',
        tools: { paths: true } },
      { say: 'Turn the crystal until that extra path is **exactly one wavelength**. Now every plane’s wave arrives in step and they all add up: a **Bragg peak**. That is Bragg’s law, 2d sinθ = nλ.',
        enter: () => glideTh(firstPeak()) },
      { say: 'Scan the angle and record the signal: peaks wherever the extra path is 1, 2, 3… wavelengths. The purple lines show where Bragg’s law puts them.',
        tools: { paths: false, bragg: true }, enter: () => startScan(TH0, TH1, 10) },
      { say: 'Now the **body-centred** crystal: an extra ball in the middle of each cube, exactly halfway between the planes. Its waves arrive half a wavelength late and cancel the first peak. **Missing peaks reveal the structure.**',
        enter: () => { kindOver = 'bcc'; startScan(TH0, TH1, 10); } },
    ],
    onEnd: () => { kindOver = null; aOver = null; scan = null; anim = null; data = []; },
  });

  // ---------- challenges
  const after = () => { pending = null; anim = null; scan = null; kindOver = null; aOver = null; };
  st.setChallenges([
    {
      id: 'first', title: 'The first peak', card: 'bragg.law', lock: true, after,
      setup: () => { kindOver = 'sc'; aOver = 0.04; S.face = 100; S.f = 10.5; data = []; S.th = TH0; syncCtl(); st.setTool('bragg', false); },
      q: 'Planes 4 cm apart, microwaves 2.86 cm long. At what crystal angle is the first peak?',
      choices: ['about 10°', 'about 21°', 'about 45°'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); startScan(TH0, 40, 6); until(() => !scan, () => { const best = data.reduce((b, p) => (p[1] > b[1] ? p : b), [0, 0]); finish(`The signal peaked at ${best[0].toFixed(1)}°.`); }); },
      explain: 'The first peak comes when the extra path 2d sinθ is one wavelength: sinθ = 2.86 / (2 × 4) = 0.36, so θ ≈ 21°. Measure the angle, and you can work out the spacing: that is how crystallographers measure atoms.',
    },
    {
      id: 'missing', title: 'One more ball', card: 'bragg.missing', lock: true, after,
      setup: () => { kindOver = 'bcc'; aOver = 0.04; S.face = 100; S.f = 10.5; data = []; S.th = TH0; syncCtl(); st.setTool('bragg', true); st.setTool('planes', true); },
      q: 'This crystal has an extra ball in the middle of every cube. The peak at 21°…',
      choices: ['gets stronger, with more balls', 'disappears', 'moves to a bigger angle'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); startScan(TH0, 55, 8); until(() => !scan, () => finish()); },
      explain: 'The middle balls sit exactly halfway between the planes, so their waves arrive half a wavelength late and cancel the corner balls’ waves at 21°. At 46° they are a whole wavelength late and add up again. The pattern of missing peaks tells which lattice you have.',
    },
    {
      id: 'shorter', title: 'Shorter waves', card: 'bragg.freq', lock: true, after,
      setup: () => { kindOver = 'sc'; aOver = 0.04; S.face = 100; S.f = 10.5; data = []; syncCtl(); glideTh(firstPeak()); },
      q: 'Raise the frequency from 10.5 to 13 GHz (shorter waves). The peak moves to…',
      choices: ['a smaller angle', 'a bigger angle', 'nowhere: it stays put'], answer: 0,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); anim = { t0: st.simT, from: 10.5, to: 13, dur: 2, set: (v) => { S.f = v; syncCtl(); }, then: () => wait(0.5, () => { glideTh(firstPeak(), () => finish(`At 13 GHz the first peak is at ${firstPeak().toFixed(1)}°.`)); }) }; },
      explain: 'A shorter wavelength needs less extra path, so a smaller angle does it: sinθ = λ / 2d. That is why X-rays (0.1 nm) are just right for atoms 0.3 nm apart.',
    },
  ]);

  st.peek = () => ({ L: Lay, th: S.th, f: S.f, face: S.face, I: signal(ensure().X, ensure().a, S.th), meas, n: data.length, first: firstPeak() });   // for tests
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }];

export default bench;
