// 3F · Magnons meet photons. A garnet sphere sits inside a copper box that traps microwaves at
// one frequency. Tune the magnet until the magnons in the sphere keep the same pace as the
// microwaves, and the two trade energy back and forth (like the coupled pendulums on 2F); the
// spectrum shows two peaks that refuse to cross. Two coupled, damped oscillators in the frame
// that turns with the cavity, and the textbook transmission of a cavity with a magnet inside.

import { el } from '../ui/widgets.js';
import { rigStrip, current, phys, onRig } from './common.js';
import { rig } from '../rpg/state.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const GAMMA = 28, FC = 9.0, G = 0.09;   // GHz/T, cavity frequency (GHz), coupling g (GHz)
const SLOW = 1.0;                        // ns of time for each second on screen
const BRES = FC / GAMMA;                 // the field where the two meet
const FLO = 8.55, FHI = 9.45;            // the frequency window of the spectrum

const bench = {
  id: 'cavity', title: 'Magnons meet photons', kicker: '3F · Magnonics Lab', icon: '⧈', floor: 3,
  blurb: 'Microwaves and magnons trade energy and refuse to cross.',
  slots: [
    { id: 'sphere', label: 'Sphere', options: ['sph-yig', 'sph-py'], def: 'sph-yig' },
    { id: 'cavity', label: 'Cavity', options: ['cav-copper', 'cav-super'], def: 'cav-copper' },
  ],
};
bench.header = rigStrip(bench);

const S = { B: BRES - 0.012 };

// the losses, as half widths in GHz (the items give them in MHz)
function losses(lwOver) {
  return { gm: (lwOver || phys(bench, 'sphere').lw) / 1000, kc: phys(bench, 'cavity').kappa / 1000 };
}
// how much gets through the cavity at frequency f (1 = the bare cavity's peak)
function transmission(f, B, L) {
  const fm = GAMMA * B;
  // S21 = kc / (i(FC - f) + kc + g² / (i(fm - f) + gm)), complex arithmetic by hand
  const dr = L.gm, di = fm - f, n2 = dr * dr + di * di;
  const sr = G * G * dr / n2, si = -G * G * di / n2;
  const Dr = L.kc + sr, Di = (FC - f) + si;
  return (L.kc * L.kc) / (Dr * Dr + Di * Di);
}

function tabPlay(pane) {
  let a = [0, 0], m = [0, 0];               // complex amplitudes of the cavity field and the magnon
  let Lay = { w: 800, h: 500 }, first = true, pending = null, anim = null, alphaOver = null;
  let map = null, sweep = null, spinA = 0, wave = 0, maxSwap = 0;
  const hum = sound.hum('sine');

  const st = new Stage(pane, {
    bench, npc: 'nova',
    label: 'A copper box between the poles of a magnet, with a little garnet sphere inside it. Beside it, the energy of the microwaves and of the magnons, and the spectrum.',
    hello: 'The box traps **microwaves** at 9 GHz; the sphere’s **magnons** follow the magnet. **Tune the magnet** until they match, then **ping the box**.',
    aspect: 16 / 10, phoneAspect: 0.72, minH: 380,
    onReset: () => { a = [0, 0]; m = [0, 0]; S.B = BRES - 0.012; map = null; sweep = null; syncCtl(); first = true; },
    onHide: () => hum.set(200, 0),
    keys: { arrow: (dx) => { if (dx) setB(S.B + dx * 0.0005); }, action: () => ping() },
  });
  st.tool('bars', 'Energy', { icon: K.COL.ke, on: true }).tool('spec', 'Spectrum', { icon: '#7B5CF0', on: true })
    .tool('map', 'Field sweep map', { icon: '#F29E4C' }).tool('bare', 'Without coupling', { icon: K.COL.gravity });
  st.readout('fm', 'Magnons in the sphere').readout('fc', 'Microwaves in the box').readout('gap', 'Gap between the peaks').readout('share', 'Energy, box : sphere');

  // ---------- controls
  const lab = el('span', { text: '' });
  const inp = el('input', { type: 'range', min: BRES - 0.03, max: BRES + 0.03, step: 0.0002, value: S.B, 'aria-label': 'Magnetic field in tesla' });
  inp.addEventListener('input', () => { setB(+inp.value); first = false; });
  const pBtn = el('button', { type: 'button', class: 'stg-act', text: 'Ping the box' });
  const sBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Sweep the field' });
  const mBtn = el('button', { type: 'button', class: 'stg-act ghost', text: 'Match the paces' });
  pBtn.addEventListener('click', () => ping());
  sBtn.addEventListener('click', () => startSweep());
  mBtn.addEventListener('click', () => { glideB(BRES); sound.play('click'); });
  st.controls(el('label', { class: 'stg-range' }, lab, inp), el('div', { class: 'stg-row' }, pBtn, sBtn), mBtn);
  function syncCtl() { lab.textContent = `Magnet: ${(S.B * 1000).toFixed(1)} mT`; inp.value = S.B; }
  function setB(v) { S.B = Math.max(BRES - 0.03, Math.min(BRES + 0.03, v)); syncCtl(); }
  function glideB(v, then) { anim = { t0: st.simT, from: S.B, to: v, dur: 1.2, set: setB, then }; first = false; }
  function ping() { a = [1, 0]; m = [0, 0]; maxSwap = 0; first = false; sound.play('zap'); }
  function startSweep() { st.setTool('map', true); map = { cols: [], B0: BRES - 0.025, B1: BRES + 0.025 }; sweep = { t0: st.simT, dur: 8 }; setB(map.B0); sound.play('click'); }
  onRig(bench, () => { map = null; });
  syncCtl();

  // ---------- time: two coupled oscillators, in the frame turning with the cavity
  st.onStep((sdt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const x = anim; anim = null; if (x.then) x.then(); }
    }
    if (sweep) {
      const q = Math.min(1, (st.simT - sweep.t0) / sweep.dur);
      setB(map.B0 + (map.B1 - map.B0) * q);
      const col = []; for (let i = 0; i < 90; i++) col.push(transmission(FLO + (FHI - FLO) * i / 89, S.B, losses(alphaOver)));
      map.cols.push([S.B, col]);
      if (q >= 1) { sweep = null; rig.note({ bench: 'cavity', swept: true, sphere: current(bench, 'sphere') }); }
    }
    const L = losses(alphaOver), dm = 2 * Math.PI * (GAMMA * S.B - FC), k = 2 * Math.PI * L.kc, gm = 2 * Math.PI * L.gm, g = 2 * Math.PI * G;
    let left = sdt * SLOW;
    while (left > 1e-9) {
      const h = Math.min(0.01, left);
      // da/dt = -k a - i g m ;  dm/dt = -i dm m - gm m - i g a   (exact enough with small steps, RK2)
      const f = (A, M) => [[-k * A[0] + g * M[1], -k * A[1] - g * M[0]], [dm * M[1] - gm * M[0] + g * A[1], -dm * M[0] - gm * M[1] - g * A[0]]];
      const [da1, dm1] = f(a, m);
      const a2 = [a[0] + h / 2 * da1[0], a[1] + h / 2 * da1[1]], m2 = [m[0] + h / 2 * dm1[0], m[1] + h / 2 * dm1[1]];
      const [da2, dm2] = f(a2, m2);
      a = [a[0] + h * da2[0], a[1] + h * da2[1]]; m = [m[0] + h * dm2[0], m[1] + h * dm2[1]];
      left -= h;
    }
    const ea = a[0] * a[0] + a[1] * a[1], em = m[0] * m[0] + m[1] * m[1];
    if (ea + em > 0.02) maxSwap = Math.max(maxSwap, em / (ea + em));
    spinA += sdt * 6; wave += sdt * 8;
    hum.set(220, st.running ? 0.04 * Math.min(1, ea) : 0, 1);
    if (pending && pending.cond()) { const x = pending.then; pending = null; x(); }
  });

  // ---------- layout
  st.onResize((w, h, narrow) => {
    if (narrow) Lay = { w, h, narrow, ax: w / 2, ay: h * 0.23, as: Math.min(w * 0.42, h * 0.18), bars: { x: 16, y: h * 0.43, w: w - 32, h: 70 }, spec: { x: 16, y: h * 0.43 + 82, w: w - 32, h: h * 0.57 - 96 } };
    else Lay = { w, h, narrow, ax: w * 0.25, ay: h * 0.46, as: Math.min(w * 0.2, h * 0.3), bars: { x: w * 0.5, y: 18, w: w * 0.5 - 18, h: 92 }, spec: { x: w * 0.5, y: 124, w: w * 0.5 - 18, h: h - 142 } };
  });

  // ---------- drawing
  function drawApparatus(g) {
    const { ax, ay, as } = Lay, ea = a[0] * a[0] + a[1] * a[1], em = m[0] * m[0] + m[1] * m[1];
    // the magnet's poles, glowing with the field
    for (const s of [-1, 1]) {
      const x = ax + s * as * 0.95, w = as * 0.42;
      K.box(g, x - w / 2, ay - as * 0.5, w, as, K.MAT.copper, { r: 5 });
      g.save(); g.globalAlpha = 0.35; g.fillStyle = K.MAT.copper[2]; for (let k = 1; k < 9; k++) g.fillRect(x - w / 2 + 3, ay - as * 0.5 + as * k / 9, w - 6, 1.5); g.restore();
      K.box(g, x - (s > 0 ? w / 2 + 10 : -w / 2), ay - as * 0.2, 10, as * 0.4, K.MAT.steel, { r: 2, bands: false });
    }
    K.tag(g, `magnet ${(S.B * 1000).toFixed(1)} mT`, ax, ay + as * 0.62, { size: 11.5 });
    // the cavity, cut open: the trapped microwave is a standing wave whose glow shows its energy
    const cw = as * 1.05, chh = as * 0.8, cx0 = ax - cw / 2, cy0 = ay - chh / 2;
    K.box(g, cx0, cy0, cw, chh, K.MAT.copper, { r: 6 });
    g.save(); K.rr(g, cx0 + 8, cy0 + 8, cw - 16, chh - 16, 4); g.fillStyle = '#2B1A12'; g.fill(); g.clip();
    const glow = Math.min(1, ea);
    for (let i = 0; i < cw - 16; i += 2) {
      const u = i / (cw - 16), amp = Math.sin(Math.PI * u) * Math.cos(wave) * glow;
      g.fillStyle = `rgba(255, ${Math.round(180 + 60 * glow)}, 120, ${0.15 + 0.6 * Math.abs(amp)})`;
      g.fillRect(cx0 + 8 + i, cy0 + 8, 2, chh - 16);
    }
    g.restore();
    K.text(g, 'microwaves', ax, cy0 - 8, { size: 11, weight: 600, align: 'center', color: '#A85A2C' });
    // the sphere and its precessing spin; the cone opens with the magnon energy
    const r = Math.max(9, as * 0.1), sx = ax, sy = ay + chh * 0.12;
    K.ball(g, sx, sy, r, 'red', { lw: 2 });
    const tilt = Math.min(1.1, Math.sqrt(em) * 1.2), ph = spinA;
    const tx = sx + r * 2.6 * Math.sin(tilt) * Math.cos(ph), ty = sy - r * 2.6 * Math.cos(tilt) + r * 0.8 * Math.sin(tilt) * Math.sin(ph);
    K.arrow(g, sx, sy, tx, ty, '#FFE07A', { lw: 3.5, head: 9 });
    if (em > 0.05) K.glow(g, sx, sy, r * 3, '#FF8FAB', 0.5 * Math.min(1, em));
  }
  function drawBars(g) {
    const B = Lay.bars, ea = a[0] * a[0] + a[1] * a[1], em = m[0] * m[0] + m[1] * m[1], tot = Math.max(1e-9, ea + em), E0 = Math.max(tot, 1e-9);
    g.save(); K.rr(g, B.x, B.y, B.w, B.h, 10); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const bw = B.w - 150, by = [B.y + 26, B.y + 58];
    [['microwaves (photons)', ea, '#F29E4C'], ['spins (magnons)', em, '#E5534B']].forEach(([name, e, col], i) => {
      K.text(g, name, B.x + 12, by[i] + 10, { size: 11.5, weight: 600 });
      const x = B.x + 140, f = Math.min(1, e / Math.max(1, E0));
      g.save(); K.rr(g, x, by[i], bw, 14, 7); g.fillStyle = '#EAF6FC'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = K.LINE; g.stroke();
      if (f > 0.005) { K.rr(g, x + 2, by[i] + 2, (bw - 4) * f, 10, 5); g.fillStyle = col; g.fill(); }
      g.restore();
    });
    if (tot < 0.01) K.text(g, 'quiet: ping the box to put some microwaves in', B.x + B.w - 12, B.y + B.h - 8, { size: 10.5, weight: 600, align: 'right', color: '#5B4BC4' });
  }
  function drawSpectrum(g) {
    const P = Lay.spec, showMap = st.on('map') && map && map.cols.length;
    g.save(); K.rr(g, P.x, P.y, P.w, P.h, 10); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const x0 = P.x + 44, x1 = P.x + P.w - 14, y0 = P.y + 28, y1 = P.y + P.h - 26;
    const L = losses(alphaOver);
    if (showMap) {
      // the measured map: field across, frequency up, brightness = how much gets through
      K.text(g, 'Field sweep: microwaves getting through', P.x + 12, P.y + 18, { size: 11.5, weight: 700 });
      const n = map.cols.length, cwid = (x1 - x0) / Math.max(1, Math.round(8 * 60));
      for (const [Bv, col] of map.cols) {
        const x = x0 + (Bv - map.B0) / (map.B1 - map.B0) * (x1 - x0);
        for (let i = 0; i < col.length; i++) {
          const v = Math.min(1, col[i]);
          g.fillStyle = `rgba(123, 92, 240, ${v})`;
          g.fillRect(x, y1 - (i + 1) / col.length * (y1 - y0), Math.max(2, cwid + 1), (y1 - y0) / col.length + 0.6);
        }
      }
      void n;
      if (st.on('bare')) {
        K.lineSeg(g, x0, y1 - (FC - FLO) / (FHI - FLO) * (y1 - y0), x1, y1 - (FC - FLO) / (FHI - FLO) * (y1 - y0), K.hexA('#F29E4C', 0.9), 1.5, [5, 4]);
        const yAt = (Bv) => y1 - (GAMMA * Bv - FLO) / (FHI - FLO) * (y1 - y0), xAt = (Bv) => x0 + (Bv - map.B0) / (map.B1 - map.B0) * (x1 - x0);
        g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip(); K.lineSeg(g, xAt(map.B0), yAt(map.B0), xAt(map.B1), yAt(map.B1), K.hexA('#E5534B', 0.9), 1.5, [5, 4]); g.restore();
      }
      const xb = x0 + (S.B - map.B0) / (map.B1 - map.B0) * (x1 - x0);
      K.lineSeg(g, xb, y0, xb, y1, '#12243A', 1.2, [3, 3]);
      K.text(g, 'field →', x1, y1 + 16, { size: 10, weight: 600, align: 'right' });
    } else {
      K.text(g, 'Spectrum: microwaves getting through the box', P.x + 12, P.y + 18, { size: 11.5, weight: 700 });
      const pts = []; for (let i = 0; i <= 240; i++) { const f = FLO + (FHI - FLO) * i / 240; pts.push([x0 + (x1 - x0) * i / 240, y1 - Math.min(1.05, transmission(f, S.B, L)) * (y1 - y0) * 0.92]); }
      g.save(); g.beginPath(); g.moveTo(x0, y1); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(x1, y1); g.closePath(); g.fillStyle = 'rgba(185,168,255,0.45)'; g.fill(); g.restore();
      K.polyline(g, pts, '#7B5CF0', 2.4);
      if (st.on('bare')) {
        const xf = (f) => x0 + (f - FLO) / (FHI - FLO) * (x1 - x0);
        K.lineSeg(g, xf(FC), y0, xf(FC), y1, K.hexA('#F29E4C', 0.9), 1.5, [5, 4]); K.text(g, 'box alone', xf(FC) + 4, y0 + 10, { size: 10, weight: 600, color: '#C96F2A' });
        const fm = GAMMA * S.B; if (fm > FLO && fm < FHI) { K.lineSeg(g, xf(fm), y0, xf(fm), y1, K.hexA('#E5534B', 0.9), 1.5, [5, 4]); K.text(g, 'sphere alone', xf(fm) + 4, y0 + 24, { size: 10, weight: 600, color: '#B3243B' }); }
      }
      for (const f of [8.6, 8.8, 9.0, 9.2, 9.4]) { const x = x0 + (f - FLO) / (FHI - FLO) * (x1 - x0); g.fillStyle = '#12243A'; g.fillRect(x, y1, 1.5, 4); K.text(g, f === 9.4 ? '9.4 GHz' : f.toFixed(1), x, y1 + 15, { size: 10, weight: 600, align: f === 9.4 ? 'right' : 'center' }); }
    }
    K.text(g, Lay.narrow ? '' : 'how much', P.x + 10, y0 + 4, { size: 10, weight: 600 });
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => { K.room(gg, ww, hh, K.THEME[3], { floorH: 0.12 }); });
    drawApparatus(g);
    if (st.on('bars')) drawBars(g);
    if (st.on('spec') || st.on('map')) drawSpectrum(g);
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.tag(g, 'use the magnet slider, then “Ping the box”', Lay.ax, Lay.ay - Lay.as * 0.75 - k * 4, { size: 11.5, bg: '#FFE07A' }); }
  });
  st.onOver(() => {
    const L = losses(alphaOver), ea = a[0] * a[0] + a[1] * a[1], em = m[0] * m[0] + m[1] * m[1], tot = ea + em;
    st.set('fm', `${(GAMMA * S.B).toFixed(3)} GHz`);
    st.set('fc', `${FC.toFixed(3)} GHz`);
    const strong = G > L.kc && G > L.gm;
    st.set('gap', Math.abs(GAMMA * S.B - FC) < 0.05 ? (strong ? `${Math.round(2 * G * 1000)} MHz` : 'blurred: too lossy') : 'tune them together');
    st.set('share', tot > 0.01 ? `${Math.round(100 * ea / tot)} : ${Math.round(100 * em / tot)}` : '–');
  });

  // tap the map to pick a field
  st.handle({
    id: 'map', cursor: 'crosshair', enabled: () => st.on('map') && !!map,
    hit: (x, y) => { const P = Lay.spec; return x > P.x + 44 && x < P.x + P.w - 14 && y > P.y + 28 && y < P.y + P.h - 26 ? 1 : false; },
    down: (x) => { const P = Lay.spec; setB(map.B0 + (x - P.x - 44) / (P.w - 58) * (map.B1 - map.B0)); },
    move: (x) => { const P = Lay.spec; setB(map.B0 + (x - P.x - 44) / (P.w - 58) * (map.B1 - map.B0)); },
    click: (x) => { const P = Lay.spec; setB(map.B0 + (x - P.x - 44) / (P.w - 58) * (map.B1 - map.B0)); },
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  st.tour({
    title: 'Why two peaks?',
    steps: [
      { say: 'Two kinds of waves share this box. **Microwaves** bounce between its copper walls (their quanta are photons), and the spins of the garnet sphere wobble together (**magnons**).',
        tools: { bars: true, spec: true, map: false, bare: false }, enter: () => { anim = null; a = [0, 0]; m = [0, 0]; setB(BRES - 0.012); } },
      { say: 'Each has its own pace. The box always rings at **9 GHz**; the magnons follow the magnet, at f = γB. Right now they are out of tune, so the spectrum shows just the box’s peak.',
        tools: { bare: true }, enter: () => ping() },
      { say: 'Tune the magnet so that the two keep the same pace, and ping the box again. Now the energy flows into the magnons and back, over and over, **just like the coupled pendulums** on 2F.',
        tools: { bare: false }, enter: () => glideB(BRES, () => ping()) },
      { say: 'And the spectrum shows **two peaks** instead of one. The microwaves and the magnons have mixed into two new waves, each part light and part magnet: **magnon-polaritons**.',
        tools: { bare: true } },
      { say: 'Sweep the field and the two never cross: they push each other apart and leave a **gap** of 2g. When that gap is bigger than the losses, it is called **strong coupling**.',
        tools: { map: true }, enter: () => startSweep() },
      { say: 'This is how magnons can pass information to and from microwave circuits, even superconducting qubits: **quantum magnonics**, one of our lab’s research lines.',
        tools: { map: false, bare: false }, enter: () => { sweep = null; glideB(BRES, () => ping()); } },
    ],
    onEnd: () => { sweep = null; anim = null; },
  });

  // ---------- challenges
  const after = () => { pending = null; anim = null; alphaOver = null; sweep = null; };
  st.setChallenges([
    {
      id: 'swap', title: 'In tune', card: 'cavity.swap', lock: true, after,
      setup: () => { a = [0, 0]; m = [0, 0]; anim = null; setB(BRES); st.setTool('bars', true); },
      q: 'The magnons and the box are tuned to the same pace. Ping the box. What happens to the energy?',
      choices: ['it stays in the box', 'it moves into the magnons and back, again and again', 'it disappears into the sphere for good'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); ping(); wait(8, () => finish(`At most ${Math.round(maxSwap * 100)}% of it was in the magnons at one time.`)); },
      explain: 'Tuned together, the two trade energy back and forth, swapping every 1/(2g) of time, while losses slowly drain both. Same physics as the coupled pendulums.',
    },
    {
      id: 'cross', title: 'Do they cross?', card: 'cavity.gap', lock: true, after,
      setup: () => { a = [0, 0]; m = [0, 0]; map = null; setB(BRES - 0.025); },
      q: 'Sweep the field so that the magnon frequency passes right through the box’s 9 GHz. The two peaks…',
      choices: ['cross each other', 'push each other apart and never cross', 'both disappear'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); st.setTool('bare', true); startSweep(); until(() => !sweep, () => finish(`The gap at the closest point is ${Math.round(2 * G * 1000)} MHz.`)); },
      explain: 'Coupled waves repel: where they would cross, they mix and push apart, leaving a gap of twice the coupling g. This avoided crossing is the fingerprint of strong coupling.',
    },
    {
      id: 'lossy', title: 'A lossy sphere', card: 'cavity.lossy', lock: true, after,
      setup: () => { a = [0, 0]; m = [0, 0]; setB(BRES); st.setTool('map', false); st.setTool('spec', true); },
      q: 'Swap the garnet for a metal sphere with five times more friction. At the crossing, the two peaks…',
      choices: ['split even further apart', 'blur into one wide, low bump', 'stay exactly the same'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(2.5, () => { alphaOver = 150; sound.play('click'); wait(3, () => finish('The magnons die out faster than they can trade.')); }); },
      explain: 'The energy must swap before it leaks away. If the losses beat the coupling g, there is no time to trade, and the two peaks merge into one broad bump: weak coupling. Low-loss garnet is why magnon labs love it.',
    },
  ]);

  st.peek = () => ({ L: Lay, B: S.B, a, m, maxSwap });   // for tests
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }];

export default bench;
