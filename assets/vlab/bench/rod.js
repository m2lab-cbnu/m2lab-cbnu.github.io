// 3F · Hammer a steel rod. The steel's domains want to line up with Earth's magnetic field
// (about 50 µT here, dipping 53° into the ground towards the north) but are pinned in place.
// Every hammer blow shakes them loose for a moment, and they settle a little closer to the field's
// choice: the rod slowly becomes a magnet along the part of Earth's field that runs along it.
// Our undergraduates measured this in 2026 with a field probe and a Kerr microscope.
// Model (magnetomechanical, in the spirit of Jiles–Atherton): each blow moves the pinned
// magnetisation a fraction k of the way to the anhysteretic value set by the axial field;
// a soft material also follows the field without being hit.

import { el } from '../ui/widgets.js';
import { rigStrip, current, phys, onRig, gauss } from './common.js';
import { rig } from '../rpg/state.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const B_EARTH = 50, DIP = 53;     // µT, degrees below the horizontal, pointing north
const B_FULL = 150;               // µT at the rod's end when steel is fully set by Earth's field
const RAD = Math.PI / 180;
const NSEG = 16;                  // domains drawn along the rod
const KX = 192, KY = 64;           // the Kerr image of the rod's surface

const bench = {
  id: 'rod', title: 'Hammer a steel rod', kicker: '3F · Magnonics Lab', icon: '⚒', floor: 3,
  blurb: 'Hit a steel rod and Earth’s field turns it into a magnet.',
  slots: [{ id: 'rod', label: 'Rod', options: ['rod-steel', 'rod-iron', 'rod-alu'], def: 'rod-steel' }],
};
bench.header = rigStrip(bench);

const S = { phi: 53 };            // direction of the red-painted end: degrees below north

function tabPlay(pane) {
  let Lay = { w: 800, h: 500 }, first = true, pending = null, anim = null, matOver = null;
  let mIrr = 0.03, blows = 0, hist = [], hit = -9, queue = 0, nextHit = 0, peakB = 0;
  const segR = Array.from({ length: NSEG }, () => Math.random() * 2 - 1);
  // a surface pattern for the Kerr image: long domains along the rod
  const field = new Float32Array(KX * KY);
  for (let w = 0; w < 9; w++) {
    const kx = (0.5 + Math.random() * 2.5) * 2 * Math.PI / KX, ky = (1 + Math.random() * 5) * 2 * Math.PI / KY, p = Math.random() * 6.3, q = Math.random() * 6.3;
    for (let y = 0; y < KY; y++) for (let x = 0; x < KX; x++) field[y * KX + x] += Math.sin(kx * x + p) * Math.cos(ky * y + q) + 0.15 * gauss();
  }
  const sorted = Float32Array.from(field).sort();
  const img = document.createElement('canvas'); img.width = KX; img.height = KY;
  const ig = img.getContext('2d'), idata = ig.createImageData(KX, KY);

  const mat = () => {
    const p = phys(bench, 'rod'), kind = matOver || p.kind;
    return kind === 'iron' ? { kind, soft: 1.6, keep: 0.25, gain: 2 } : kind === 'alu' ? { kind, soft: 0, keep: 0, gain: 0 } : { kind, soft: p.soft ?? 0.35, keep: 1, gain: 1 };
  };
  const axial = () => Math.cos((S.phi - DIP) * RAD);               // Earth's field along the rod, as a fraction of 50 µT
  const mNow = () => { const M = mat(); return M.gain ? M.keep * mIrr + (1 - M.keep) * axial() * 0.9 : 0; };
  const probe = () => B_FULL * mat().gain * mNow();

  const st = new Stage(pane, {
    bench, npc: 'nova',
    label: 'A steel rod on a stand, seen from the side with north to the right. Earth’s field dips into the ground. A hammer hits the rod; a probe at the red end reads the rod’s own field, plotted against the number of blows.',
    hello: 'Earth’s field dips into the ground here. Point the rod **along it** and press **Hammer!** Watch the probe at the **red end**.',
    aspect: 16 / 10, phoneAspect: 0.6, minH: 400,
    onReset: () => { S.phi = 53; fresh(); syncCtl(); first = true; },
    keys: { arrow: (dx) => { if (dx) setPhi(S.phi + dx * 2); }, action: () => strike(1) },
  });
  st.tool('domains', 'Domains', { icon: '#E5534B', on: true }).tool('earth', 'Earth’s field', { icon: '#22B07A', on: true })
    .tool('kerr', 'Kerr image', { icon: '#3D7FD6', on: true });
  st.readout('blows', 'Blows').readout('ax', 'Earth’s field along the rod').readout('B', 'Field at the red end');

  // ---------- controls
  const lab = el('span', { text: '' });
  const inp = el('input', { type: 'range', min: -180, max: 180, step: 1, value: S.phi, 'aria-label': 'Direction of the rod, degrees below north' });
  inp.addEventListener('input', () => { setPhi(+inp.value); first = false; });
  const h1 = el('button', { type: 'button', class: 'stg-act', text: 'Hammer!' });
  const h10 = el('button', { type: 'button', class: 'stg-act ghost', text: 'Hammer 10×' });
  h1.addEventListener('click', () => strike(1));
  h10.addEventListener('click', () => strike(10));
  const bAlong = el('button', { type: 'button', class: 'stg-act ghost', text: 'Along the field' });
  const bAcross = el('button', { type: 'button', class: 'stg-act ghost', text: 'Across it' });
  const bFlip = el('button', { type: 'button', class: 'stg-act ghost', text: 'Flip the rod' });
  const bNew = el('button', { type: 'button', class: 'stg-act ghost', text: 'A fresh rod' });
  bAlong.addEventListener('click', () => glide(53));
  bAcross.addEventListener('click', () => glide(-37));
  bFlip.addEventListener('click', () => glide(S.phi > 0 ? S.phi - 180 : S.phi + 180));
  bNew.addEventListener('click', () => { fresh(); sound.play('pop'); });
  st.controls(el('div', { class: 'stg-row' }, h1, h10), el('label', { class: 'stg-range' }, lab, inp), el('div', { class: 'stg-row' }, bAlong, bAcross), el('div', { class: 'stg-row' }, bFlip, bNew));
  function describe(p) {
    const a = ((p + 540) % 360) - 180;
    if (Math.abs(a) < 1) return 'level, red end north';
    if (Math.abs(Math.abs(a) - 180) < 1) return 'level, red end south';
    if (Math.abs(a - 90) < 1) return 'upright, red end down';
    if (Math.abs(a + 90) < 1) return 'upright, red end up';
    const down = a > 0, north = Math.abs(a) < 90, tilt = north ? Math.abs(a) : 180 - Math.abs(a);
    return `red end ${tilt}° ${down ? 'below' : 'above'} ${north ? 'north' : 'south'}`;
  }
  function syncCtl() { inp.value = S.phi; lab.textContent = `Rod: ${describe(S.phi)}`; }
  function setPhi(v) { S.phi = Math.max(-180, Math.min(180, Math.round(v))); syncCtl(); }
  function glide(v, then) { anim = { t0: st.simT, from: S.phi, to: v, dur: 1.2, set: (x) => { S.phi = x; syncCtl(); }, then }; first = false; sound.play('click'); }
  function fresh() { mIrr = (Math.random() - 0.5) * 0.06; blows = 0; hist = [[0, probe()]]; peakB = 0; queue = 0; }
  function strike(n) { queue += n; first = false; if (!nextHit || nextHit < st.simT) nextHit = st.simT; }
  onRig(bench, () => { fresh(); });
  fresh(); syncCtl();

  // one blow: the pinned magnetisation slips part of the way towards the field's choice
  function blow(quiet) {
    const M = mat();
    blows++; hit = quiet ? -9 : st.simT;
    if (M.soft > 0) {
      const k = (1 - Math.exp(-M.soft * 0.45)) * (0.8 + 0.4 * Math.random());
      mIrr += k * (axial() - mIrr);
    }
    if (!quiet) sound.play('hammer');
    const B = probe() + gauss() * 1.2;
    hist.push([blows, B]); if (hist.length > 400) hist.shift();
    peakB = Math.max(peakB, Math.abs(B));
    if (quiet) return;
    if (M.kind !== 'alu' && Math.abs(B) > 100) rig.note({ bench: 'rod', magnetised: true, kind: M.kind });
    if (M.kind !== 'alu' && peakB > 80 && Math.abs(B) < 12 && Math.abs(axial()) < 0.2) rig.note({ bench: 'rod', erased: true });
  }

  // ---------- time
  st.onStep((sdt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const x = anim; anim = null; if (x.then) x.then(); }
    }
    if (queue > 0 && st.simT >= nextHit) { queue--; nextHit = st.simT + 0.42; blow(); }
    if (pending && pending.cond()) { const x = pending.then; pending = null; x(); }
    void sdt;
  });

  // ---------- layout
  st.onResize((w, h, narrow) => {
    if (narrow) {
      const L = Math.min(w * 0.36, h * 0.17);
      Lay = { w, h, narrow, cx: w * 0.5, cy: h * 0.25, L, plot: { x: 10, y: h * 0.5, w: w - 20, h: h * 0.27 }, kerr: { x: 10, y: h * 0.79, w: w - 20, h: h * 0.19 } };
    } else {
      const L = Math.min(w * 0.17, h * 0.3);
      Lay = { w, h, narrow, cx: w * 0.29, cy: h * 0.5, L, plot: { x: w * 0.56, y: 16, w: w * 0.44 - 16, h: h * 0.52 }, kerr: { x: w * 0.56, y: h * 0.52 + 30, w: w * 0.44 - 16, h: h * 0.48 - 46 } };
    }
  });

  // ---------- drawing
  function drawEarth(g) {
    const { cx, cy, L } = Lay;
    // ground and directions
    const gy = cy + L * 1.12;
    g.fillStyle = 'rgba(126,90,52,0.35)'; g.fillRect(0, gy, Lay.narrow ? Lay.w : Lay.w * 0.54, 6);
    K.text(g, 'north →', Math.min(cx + L * 1.25, (Lay.narrow ? Lay.w : Lay.w * 0.54) - 12), gy + 20, { size: 11, weight: 700, align: 'right', color: '#FFFDF6', halo: '#14244A' });
    K.text(g, '← south', 12, gy + 20, { size: 11, weight: 700, color: '#FFFDF6', halo: '#14244A' });
    if (!st.on('earth')) return;
    // Earth's field: parallel lines dipping 53° into the ground
    g.save(); g.globalAlpha = 0.5;
    const ux = Math.cos(DIP * RAD), uy = Math.sin(DIP * RAD), span = Lay.narrow ? Lay.w : Lay.w * 0.54;
    for (let k = -6; k <= 6; k++) {
      const ox = cx + k * L * 0.42 / uy, x0 = ox - uy * 0 - ux * L * 2, y0 = cy - uy * L * 2;
      if (ox < -L || ox > span + L) continue;
      K.arrow(g, x0, y0, x0 + ux * L * 3.4, y0 + uy * L * 3.4, '#22B07A', { lw: 2, head: 9, halo: false });
    }
    g.restore();
    K.tag(g, 'Earth’s field: 50 µT, dipping 53° into the ground', Lay.narrow ? Lay.w / 2 : Lay.w * 0.27, 18, { size: 11, bg: '#D7F5E6', fg: '#1E7A52', border: '#1E7A52' });
  }
  function drawRod(g) {
    const { cx, cy, L } = Lay, M = mat(), m = mNow(), u = [Math.cos(S.phi * RAD), Math.sin(S.phi * RAD)];
    const A = [cx + u[0] * L, cy + u[1] * L], B = [cx - u[0] * L, cy - u[1] * L], d = Math.max(14, L * 0.13);
    // the stand
    K.box(g, cx - 8, cy, 16, L * 1.12, K.MAT.woodD, { r: 3, bands: false });
    K.box(g, cx - L * 0.35, cy + L * 1.06, L * 0.7, 10, K.MAT.woodD, { r: 3, bands: false });
    // the rod, with the red-painted end at A
    K.rod(g, B[0], B[1], A[0], A[1], d, M.kind === 'alu' ? K.MAT.alu : M.kind === 'iron' ? K.MAT.navy : K.MAT.steel);
    g.save(); g.lineCap = 'butt'; g.strokeStyle = '#E5534B'; g.lineWidth = d - 4;
    g.beginPath(); g.moveTo(A[0] - u[0] * 10, A[1] - u[1] * 10); g.lineTo(A[0], A[1]); g.stroke(); g.restore();
    K.ball(g, cx, cy, 5, 'brass', { lw: 1.5 });
    // domains: little magnets along the rod; more point the field's way as the rod is hit
    if (st.on('domains') && M.gain) {
      for (let i = 0; i < NSEG; i++) {
        const s0 = -L + (i + 0.18) / NSEG * 2 * L, s1 = -L + (i + 0.82) / NSEG * 2 * L;
        const toA = segR[i] < m;   // fraction (1 + m)/2 point towards A
        const [a0, a1] = toA ? [s0, s1] : [s1, s0];
        K.arrow(g, cx + u[0] * a0, cy + u[1] * a0, cx + u[0] * a1, cy + u[1] * a1, toA ? '#E5534B' : '#3D7FD6', { lw: 2.6, head: 6, halo: false });
      }
    }
    // poles
    if (Math.abs(m) > 0.08 && M.gain) {
      const nAtA = m > 0, P = (p, s) => [p[0] + u[0] * s * 26, p[1] + u[1] * s * 26];
      const pa = P(A, 1), pb = P(B, -1), al = Math.min(1, Math.abs(m) * 1.5);
      K.tag(g, nAtA ? 'N' : 'S', pa[0], pa[1] + 4, { size: 12, bg: nAtA ? '#FFD8D4' : '#D6E6FF', fg: nAtA ? '#A12F38' : '#22508F', border: nAtA ? '#A12F38' : '#22508F', alpha: al });
      K.tag(g, nAtA ? 'S' : 'N', pb[0], pb[1] + 4, { size: 12, bg: nAtA ? '#D6E6FF' : '#FFD8D4', fg: nAtA ? '#22508F' : '#A12F38', border: nAtA ? '#22508F' : '#A12F38', alpha: al });
    }
    // the probe at the red end
    const pp = [A[0] + u[0] * 52 + (u[1] > 0.7 ? 34 : 0), A[1] + u[1] * 52];
    K.lineSeg(g, A[0] + u[0] * 6, A[1] + u[1] * 6, pp[0], pp[1], '#12243A', 2);
    K.lcd(g, pp[0] - 34, pp[1] - 13, 68, 26, `${probe() >= 0 ? '+' : ''}${Math.round(probe())} µT`, { size: 12 });
    // the hammer strikes the rod's upper side, between the pivot and the plain end; it rests
    // raised, falls just before each blow and springs back after it
    const nUp = (-u[1] < 0 || (Math.abs(u[1]) > 0.999 && -u[1] === 0)) ? [-u[1], u[0]] : [u[1], -u[0]];
    const sgn = nUp[0] === -u[1] && nUp[1] === u[0] ? 1 : -1;
    const since = st.simT - hit, tn = nextHit - st.simT;
    let swing = since < 0.25 ? 0.9 * since / 0.25 : 0.9;
    if (queue > 0 && tn < 0.17) swing = Math.min(swing, 0.9 * Math.max(0, tn) / 0.17);
    const P0 = [cx - u[0] * L * 0.55, cy - u[1] * L * 0.55];
    const H0 = [P0[0] + nUp[0] * (d / 2 + 9), P0[1] + nUp[1] * (d / 2 + 9)];
    const G = [H0[0] - u[0] * L * 0.62, H0[1] - u[1] * L * 0.62];
    const ca = Math.cos(sgn * swing), sa = Math.sin(sgn * swing);
    const rotp = (p) => { const dx = p[0] - G[0], dy = p[1] - G[1]; return [G[0] + dx * ca - dy * sa, G[1] + dx * sa + dy * ca]; };
    K.rod(g, ...G, ...rotp(H0), 7, K.MAT.wood);
    K.rod(g, ...rotp([H0[0] - nUp[0] * 9, H0[1] - nUp[1] * 9]), ...rotp([H0[0] + nUp[0] * 15, H0[1] + nUp[1] * 15]), 20, K.MAT.steel);
    if (since >= 0 && since < 0.16) {
      g.save(); g.strokeStyle = '#FFE07A'; g.lineWidth = 2.5; g.globalAlpha = 1 - since / 0.16;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.moveTo(P0[0] + Math.cos(a) * 14, P0[1] + Math.sin(a) * 14); g.lineTo(P0[0] + Math.cos(a) * 28, P0[1] + Math.sin(a) * 28); g.stroke(); }
      g.restore();
    }
    // the part of Earth's field that runs along the rod
    if (st.on('earth')) {
      const ax = axial(), o = [-u[1] * (d + 16), u[0] * (d + 16)];
      if (Math.abs(ax) > 0.05) K.arrow(g, cx + o[0] - u[0] * L * 0.5 * ax, cy + o[1] - u[1] * L * 0.5 * ax, cx + o[0] + u[0] * L * 0.5 * ax, cy + o[1] + u[1] * L * 0.5 * ax, '#22B07A', { lw: 4, head: 11 });
      K.text(g, Math.abs(ax) > 0.05 ? `${Math.round(Math.abs(ax) * B_EARTH)} µT along the rod` : 'no field along the rod', cx + o[0] * 2.1, cy + o[1] * 2.1 + 4, { size: 10.5, weight: 700, align: 'center', color: '#B6F0D2', halo: '#14244A' });
    }
  }
  function drawPlot(g) {
    const P = Lay.plot, M = mat(), top = B_FULL * Math.max(1, M.gain) * 1.1;
    g.save(); K.rr(g, P.x, P.y, P.w, P.h, 10); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const x0 = P.x + 40, x1 = P.x + P.w - 14, y0 = P.y + 42, y1 = P.y + P.h - 24, nMax = Math.max(20, blows + 2);   // room for the title above the unit
    const X = (n) => x0 + n / nMax * (x1 - x0), Y = (b) => (y0 + y1) / 2 - b / top * (y1 - y0) / 2;
    K.text(g, 'Field at the red end, blow by blow', P.x + 12, P.y + 19, { size: 11.5, weight: 700 });
    g.strokeStyle = '#D6ECF7'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0, Y(0)); g.lineTo(x1, Y(0)); g.moveTo(x0, y0); g.lineTo(x0, y1); g.stroke();
    for (const b of [-B_FULL * Math.max(1, M.gain), B_FULL * Math.max(1, M.gain)]) K.text(g, `${b > 0 ? '+' : ''}${b}`, x0 - 4, Y(b) + 4, { size: 10, weight: 600, align: 'right' });
    K.text(g, '0', x0 - 4, Y(0) + 4, { size: 10, weight: 600, align: 'right' });
    K.text(g, 'µT', x0 - 4, y0 - 6, { size: 10, weight: 600, align: 'right' });
    K.text(g, `${nMax} blows`, x1, y1 + 15, { size: 10, weight: 600, align: 'right' });
    // where the hammering is heading for this direction of the rod
    if (M.gain) {
      const target = B_FULL * M.gain * (M.keep * axial() + (1 - M.keep) * axial() * 0.9);
      K.lineSeg(g, x0, Y(target), x1, Y(target), K.hexA('#22B07A', 0.9), 1.5, [5, 4]);
      K.text(g, 'where it is heading', x1 - 4, Y(target) + (target > 0 ? 14 : -6), { size: 10, weight: 600, align: 'right', color: '#1E7A52' });
    }
    if (hist.length > 1) K.polyline(g, hist.map(([n, b]) => [X(n), Y(b)]), '#E5534B', 2.2);
    for (const [n, b] of hist) { g.beginPath(); g.arc(X(n), Y(b), 2.8, 0, Math.PI * 2); g.fillStyle = '#E5534B'; g.fill(); }
  }
  // the rod's surface through a Kerr microscope: light domains point towards the red end
  function drawKerr(g) {
    const P = Lay.kerr, M = mat(), m = M.gain ? mNow() : 0;
    const q = Math.max(0, Math.min(1, (1 - m) / 2)), thr = sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    const d = idata.data, alu = !M.gain;
    for (let i = 0; i < KX * KY; i++) {
      const on = field[i] >= thr, o = i * 4;
      const c = alu ? [150, 196, 232] : on ? [190, 232, 255] : [24, 52, 104];
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ig.putImageData(idata, 0, 0);
    K.box(g, P.x - 6, P.y - 6, P.w + 12, P.h + 12, K.MAT.navy, { r: 10, bands: false });
    g.save(); K.rr(g, P.x, P.y, P.w, P.h, 6); g.clip(); g.imageSmoothingEnabled = true; g.drawImage(img, P.x, P.y, P.w, P.h); g.restore();
    K.text(g, alu ? 'aluminium: no domains to see' : 'Kerr image of the rod’s surface: light = towards the red end', P.x + 8, P.y + 16, { size: 10.5, weight: 700, color: '#FFFDF6', halo: '#14244A' });
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => { K.room(gg, ww, hh, K.THEME.dark, { floorH: 0.05 }); });
    drawEarth(g);
    drawRod(g);
    drawPlot(g);
    if (st.on('kerr')) drawKerr(g);
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.tag(g, 'press Hammer! a few times', Lay.cx, Lay.cy - Lay.L * 1.05 - k * 4, { size: 11.5, bg: '#FFE07A' }); }
  });
  st.onOver(() => {
    st.set('blows', String(blows));
    const ax = axial();
    st.set('ax', `${Math.round(Math.abs(ax) * B_EARTH)} µT${Math.abs(ax) < 0.05 ? '' : ax > 0 ? ', towards red' : ', away from red'}`);
    const b = probe();
    st.set('B', `${b >= 0 ? '+' : ''}${Math.round(b)} µT${Math.abs(b) < 8 ? '' : b > 0 ? ' (red end north)' : ' (red end south)'}`);
  });

  // turn the rod by dragging either end
  st.handle({
    id: 'rod', cursor: 'grab',
    hit: (x, y) => { const { cx, cy, L } = Lay, u = [Math.cos(S.phi * RAD), Math.sin(S.phi * RAD)]; const s = (x - cx) * u[0] + (y - cy) * u[1], dperp = Math.abs(-(x - cx) * u[1] + (y - cy) * u[0]); return Math.abs(s) > L * 0.3 && Math.abs(s) < L * 1.1 && dperp < 22 ? 1 : false; },
    down: () => {},
    move: (x, y) => { const { cx, cy } = Lay, u = [Math.cos(S.phi * RAD), Math.sin(S.phi * RAD)]; const s = (x - cx) * u[0] + (y - cy) * u[1]; let a = Math.atan2(y - cy, x - cx) / RAD; if (s < 0) a += 180; setPhi(((a + 540) % 360) - 180); first = false; },
    click: () => strike(1),
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  st.tour({
    title: 'Why does hitting it make a magnet?',
    steps: [
      { say: 'Steel is full of **domains**: tiny regions that are each a little magnet. In a fresh rod they point both ways and cancel, so the rod is not a magnet.',
        tools: { domains: true, earth: false, kerr: true }, enter: () => { matOver = 'steel'; fresh(); glide(53); } },
      { say: 'The Earth is a magnet too. Here its field is about **50 µT** and dips **53° into the ground**, pointing north. Only the part along the rod matters.',
        tools: { earth: true } },
      { say: 'The domains would like to follow that field, but their walls are **pinned** on defects in the steel. On its own, nothing happens.',
        enter: () => wait(0.1, () => {}) },
      { say: 'Each **hammer blow** shakes the walls loose for an instant, and they settle a little closer to the field’s choice. Blow after blow, the rod becomes a magnet, with its north pole at the bottom.',
        enter: () => strike(12) },
      { say: 'Turn the rod **across** the field and hammer again: now the field has nothing to say along the rod, the shaking scrambles the domains, and the magnet fades away.',
        enter: () => glide(-37, () => strike(14)) },
      { say: 'Our undergraduates measured exactly this in 2026: the field at the rod’s end with a probe, and the domains on its surface with a **Kerr microscope**.',
        enter: () => { queue = 0; } },
    ],
    onEnd: () => { matOver = null; queue = 0; },
  });

  // ---------- challenges
  const after = () => { pending = null; anim = null; queue = 0; matOver = null; };
  st.setChallenges([
    {
      id: 'align', title: 'Along the field', card: 'rod.hammer', lock: true, after,
      setup: () => { matOver = 'steel'; fresh(); S.phi = 53; syncCtl(); },
      q: 'The rod lies along Earth’s field, red end down and to the north. Hammer it 12 times. The red end becomes…',
      choices: ['a north pole', 'a south pole', 'nothing: hitting cannot make a magnet'], answer: 0,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); strike(12); until(() => queue === 0, () => wait(0.6, () => finish(`The probe now reads ${Math.round(probe())} µT.`))); },
      explain: 'The domains settle along Earth’s field, which points down into the ground to the north. Magnetisation pointing towards the red end makes it a north pole.',
    },
    {
      id: 'erase', title: 'Across the field', card: 'rod.erase', lock: true, after,
      setup: () => { matOver = 'steel'; fresh(); S.phi = 53; syncCtl(); for (let k = 0; k < 14; k++) blow(true); S.phi = -37; syncCtl(); },
      q: 'This rod is already a magnet. Now it lies across Earth’s field. Hammer it 14 times. Its magnet…',
      choices: ['gets stronger', 'fades away', 'flips round'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); strike(14); until(() => queue === 0, () => wait(0.6, () => finish(`Down to ${Math.round(probe())} µT.`))); },
      explain: 'With no field along the rod, each blow lets the domains settle with no preferred way, half one way, half the other. Shaking without a field erases a magnet.',
    },
    {
      id: 'iron', title: 'Soft iron', card: 'rod.soft', lock: true, after,
      setup: () => { matOver = 'iron'; fresh(); S.phi = 53; syncCtl(); for (let k = 0; k < 8; k++) blow(true); },
      q: 'A soft iron rod, hammered along the field: its red end is north. Flip it upside down, without hitting it. The red end…',
      choices: ['stays north, now at the top', 'turns south: the bottom end is north again', 'loses all its magnetism'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); glide(-127, () => wait(0.8, () => finish(`The red end reads ${Math.round(probe())} µT now.`))); },
      explain: 'Soft iron hardly holds on to its domains: they follow Earth’s field almost at once, so whichever end is at the bottom becomes north. Steel keeps its poles when flipped, which is why magnets are made of hard materials.',
    },
  ]);

  st.peek = () => ({ L: Lay, phi: S.phi, m: mNow(), B: probe(), blows, queue });   // for tests
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }];

export default bench;
