// 3F · Spin-wave logic. A chip with a Y-shaped magnetic waveguide. Each antenna launches a
// spin wave whose phase carries a bit (0: a crest; 1: the same wave half a wavelength on).
// Where the arms meet the waves add up or cancel, so the output spin wave answers a logic
// question: same or different (XNOR), different with a half-wave delay in one arm (XOR), or
// which phase is in the majority (the majority gate, a favourite of spin-wave computing).

import { el } from '../ui/widgets.js';
import { rig } from '../rpg/state.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';

const bench = { id: 'logic', title: 'Spin-wave logic', kicker: '3F · Magnonics Lab', icon: '⊕', floor: 3, blurb: 'Spin waves meet in a Y and compute.' };

const GATES = {
  xnor: { name: 'Same or different?', n: 2, delay: false, read: 'amp' },
  xor: { name: 'XOR, with a delay', n: 2, delay: true, read: 'amp' },
  maj: { name: 'Majority of three', n: 3, delay: false, read: 'phase' },
};
const S = { gate: 'xnor', bits: [0, 0, 0] };

function tabPlay(pane) {
  let Lay = { w: 800, h: 480 }, t = 0, first = true, pending = null, out = { amp: 1, ph: 0 }, outShown = { amp: 1, ph: 0 }, hover = -1;
  const tried = { xnor: new Set(), xor: new Set(), maj: new Set() };
  const NW = 4;                     // wavelengths along each input arm

  const st = new Stage(pane, {
    bench, npc: 'nova',
    label: 'A chip seen from above, with a Y-shaped magnetic waveguide. Antennas on the left send in spin waves; a lamp on the right reads the wave that comes out.',
    hello: '**Click an antenna** to switch its bit between 0 and 1, and watch what reaches the lamp. Then try the other gates.',
    aspect: 16 / 9, phoneAspect: 0.82, minH: 330,
    onReset: () => { S.bits = [0, 0, 0]; first = true; record(); },
    keys: { action: () => toggle(0), arrow: (dx, dy) => { if (dy) toggle(dy < 0 ? 0 : 1); } },
  });
  st.tool('crest', 'Wave crests', { icon: '#FFE07A', on: true }).tool('dials', 'Phase dials', { icon: '#7B5CF0', on: true });
  st.readout('in', 'Inputs').readout('out', 'Output wave').readout('bit', 'Answer');

  // ---------- controls: which gate, and the truth table so far
  const gateBtns = Object.entries(GATES).map(([id, gdef]) => {
    const b = el('button', { type: 'button', class: 'stg-act ghost', text: gdef.name });
    b.addEventListener('click', () => { S.gate = id; S.bits = [0, 0, 0]; sound.play('click'); syncCtl(); record(); });
    return [id, b];
  });
  const table = el('table', { class: 'stg-tt', 'aria-label': 'Truth table' });
  const note = el('p', { class: 'stg-small' });
  st.controls(el('div', { class: 'stg-col' }, ...gateBtns.map(([, b]) => b)), note, table);
  function syncCtl() {
    for (const [id, b] of gateBtns) { b.classList.toggle('ghost', id !== S.gate); b.setAttribute('aria-pressed', id === S.gate ? 'true' : 'false'); }
    const gd = GATES[S.gate], rows = [];
    for (let k = 0; k < (1 << gd.n); k++) rows.push(Array.from({ length: gd.n }, (_, i) => (k >> (gd.n - 1 - i)) & 1));
    const head = el('tr', {}, ...['A', 'B', 'C'].slice(0, gd.n).map((h) => el('th', { text: h })), el('th', { text: 'out' }));
    table.replaceChildren(head, ...rows.map((r) => {
      const key = r.join(''), seen = tried[S.gate].has(key), cur = r.every((v, i) => v === S.bits[i]);
      return el('tr', { class: cur ? 'is-cur' : '' }, ...r.map((v) => el('td', { text: String(v) })), el('td', { text: seen ? String(answer(r)) : '?' }));
    }));
    note.textContent = `${tried[S.gate].size} of ${rows.length} rows tried`;
  }
  // the output of the gate for some inputs: the wave sum, read the way the gate reads it
  function waveSum(bits) {
    const gd = GATES[S.gate];
    let re = 0, im = 0;
    for (let i = 0; i < gd.n; i++) { const ph = Math.PI * bits[i] + (gd.delay && i === 1 ? Math.PI : 0); re += Math.cos(ph); im += Math.sin(ph); }
    return { amp: Math.hypot(re, im) / gd.n, ph: Math.atan2(im, re) };
  }
  function answer(bits) {
    const w = waveSum(bits), gd = GATES[S.gate];
    if (gd.read === 'amp') return w.amp > 0.5 ? 1 : 0;
    return Math.cos(w.ph) > 0 ? 0 : 1;
  }
  function record() {
    const gd = GATES[S.gate], key = S.bits.slice(0, gd.n).join('');
    tried[S.gate].add(key);
    out = waveSum(S.bits);
    syncCtl();
    if (tried[S.gate].size === (1 << gd.n)) rig.note({ bench: 'logic', table: S.gate });
  }
  function toggle(i) {
    if (i >= GATES[S.gate].n) return;
    S.bits[i] ^= 1; first = false; sound.play('blip', { pitch: S.bits[i] ? 1.6 : 1 });
    record();
  }
  record();

  // ---------- time
  st.onStep((sdt) => {
    t += sdt;
    // the output takes a moment to change: the new waves have to arrive
    outShown.amp += (out.amp - outShown.amp) * Math.min(1, sdt * 2.5);
    let d = out.ph - outShown.ph; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    outShown.ph += d * Math.min(1, sdt * 2.5);
    if (pending && pending.cond()) { const f = pending.then; pending = null; f(); }
  });

  // ---------- layout: the arms are curves from each antenna to the junction, then one straight output
  st.onResize((w, h, narrow) => {
    const x0 = narrow ? 52 : w * 0.12, xj = narrow ? w * 0.56 : w * 0.5, x1 = narrow ? w - 58 : w * 0.8, cy = h * (narrow ? 0.42 : 0.5);
    Lay = { w, h, narrow, x0, xj, x1, cy, spread: h * (narrow ? 0.26 : 0.3), width: Math.max(14, h * 0.05) };
  });
  function arms() {
    const gd = GATES[S.gate], L = Lay, out2 = [];
    for (let i = 0; i < gd.n; i++) {
      const y = gd.n === 2 ? L.cy + (i ? 1 : -1) * L.spread * 0.75 : L.cy + (i - 1) * L.spread;
      const pts = [];
      for (let k = 0; k <= 60; k++) {
        const u = k / 60, x = L.x0 + (L.xj - L.x0) * u;
        pts.push([x, y + (L.cy - y) * (1 - Math.cos(Math.PI * u)) / 2]);
      }
      out2.push(pts);
    }
    return out2;
  }
  const pathLen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };

  // ---------- drawing
  function drawChip(g, w, h) {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => {
      K.room(gg, ww, hh, K.THEME[3], { floorH: 0.1 });
      const L = Lay, pad = 26;
      gg.save(); K.rr(gg, L.x0 - pad - 30, L.cy - L.spread - 70, L.x1 - L.x0 + 2 * pad + 100, 2 * L.spread + 140, 14);
      gg.fillStyle = '#4A3A8C'; gg.fill(); gg.lineWidth = 3; gg.strokeStyle = K.LINE; gg.stroke();
      gg.globalAlpha = 0.18; gg.strokeStyle = '#B9A8FF'; gg.lineWidth = 1;
      for (let x = L.x0 - pad; x < L.x1 + pad + 30; x += 18) { gg.beginPath(); gg.moveTo(x, L.cy - L.spread - 64); gg.lineTo(x, L.cy + L.spread + 64); gg.stroke(); }
      gg.restore();
      // little gold contacts round the edge of the chip
      gg.fillStyle = '#E8C25A';
      for (let x = L.x0 - pad; x < L.x1 + pad + 30; x += 30) { gg.fillRect(x, L.cy - L.spread - 76, 12, 6); gg.fillRect(x, L.cy + L.spread + 70, 12, 6); }
    });
  }
  function drawGuides(g) {
    const L = Lay, A = arms();
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pts of A) { K.polyline(g, pts, K.LINE, L.width + 5); K.polyline(g, pts, '#DCD3FF', L.width); }
    K.lineSeg(g, L.xj - 2, L.cy, L.x1, L.cy, K.LINE, L.width + 5); K.lineSeg(g, L.xj - 2, L.cy, L.x1, L.cy, '#DCD3FF', L.width);
    for (const pts of A) K.polyline(g, pts, '#DCD3FF', L.width);
    g.restore();
    // the delay: a short patch that holds the wave back by half a wavelength
    if (GATES[S.gate].delay) {
      const pts = A[1], p = pts[30];
      K.box(g, p[0] - 16, p[1] - L.width / 2 - 8, 32, L.width + 16, K.MAT.orange, { r: 4 });
      K.tag(g, 'half-wave delay', p[0], p[1] + L.width / 2 + 20, { size: 10.5, bg: '#FFE2CC' });
    }
    return A;
  }
  // crests: bright bars across the guide wherever the wave is at its top
  function crestsAlong(g, pts, phase0, amp, sOffset, total, extraAt = null) {
    if (amp < 0.03) return;
    const L = Lay, len = pathLen(pts), lam = total / NW;
    const ph = 2 * Math.PI * (t * 0.9);       // the waves move one wavelength every 1.1 s
    let s = 0;
    for (let i = 1; i < pts.length; i++) {
      const [xa, ya] = pts[i - 1], [xb, yb] = pts[i], seg = Math.hypot(xb - xa, yb - ya);
      for (let q = 0; q < seg; q += 1.5) {
        const ss = s + q, x = xa + (xb - xa) * q / seg, y = ya + (yb - ya) * q / seg;
        const extra = extraAt !== null && ss > extraAt ? Math.PI : 0;
        const v = Math.cos(2 * Math.PI * (ss + sOffset) / lam - ph + phase0 + extra);
        if (v > 0.92) {
          const nx = -(yb - ya) / seg, ny = (xb - xa) / seg, hw = L.width * 0.48;
          g.strokeStyle = `rgba(255, 224, 122, ${Math.min(1, amp) * (v - 0.92) / 0.08})`; g.lineWidth = 2.5;
          g.beginPath(); g.moveTo(x - nx * hw, y - ny * hw); g.lineTo(x + nx * hw, y + ny * hw); g.stroke();
        }
      }
      s += seg;
    }
    void len;
  }
  function dial(g, x, y, r, ph, amp, label, col) {
    g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = '#FFFDF6'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    if (amp > 0.03) K.arrow(g, x, y, x + r * 0.8 * amp * Math.cos(-ph), y + r * 0.8 * amp * Math.sin(-ph), col, { lw: 3, head: 8, halo: false });
    else { g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fillStyle = K.LINE; g.fill(); }
    if (label) K.text(g, label, x, y + r + 13, { size: 10, weight: 600, align: 'center', color: '#EAF6FC' });
  }

  st.onDraw((g, w, h) => {
    drawChip(g, w, h);
    const L = Lay, gd = GATES[S.gate], A = drawGuides(g);
    const lens = A.map(pathLen);
    // waves in each arm (each arm holds the same number of wavelengths, so they meet in step)
    if (st.on('crest')) {
      A.forEach((pts, i) => crestsAlong(g, pts, Math.PI * S.bits[i], 1, 0, lens[i], gd.delay && i === 1 ? lens[i] / 2 : null));
      const outPts = []; for (let k = 0; k <= 40; k++) outPts.push([L.xj + (L.x1 - L.xj) * k / 40, L.cy]);
      crestsAlong(g, outPts, outShown.ph, outShown.amp, lens[0], lens[0]);
    }
    // the antennas
    A.forEach((pts, i) => {
      const [x, y] = pts[0], on = S.bits[i] === 1;
      K.box(g, x - 34, y - 18, 22, 36, on ? K.MAT.yellow : K.MAT.steel, { r: 4 });
      K.text(g, String(S.bits[i]), x - 23, y + 6, { size: 15, weight: 700, align: 'center' });
      K.text(g, 'ABC'[i], x - 23, y - 24, { size: 11, weight: 700, align: 'center', color: '#EAF6FC' });
      if (hover === i && st.hovering('ant')) K.glow(g, x - 23, y, 30, '#FFFFFF', 0.5);
      if (st.on('dials')) dial(g, x + 18, y - L.width - 16, 12, Math.PI * S.bits[i], 1, null, '#F29E4C');
    });
    // the lamp at the end: brightness for the amplitude gates, colour for the majority
    const lx = L.x1 + 26, ly = L.cy, R = Math.max(18, L.width);
    const ans = gd.read === 'amp' ? (outShown.amp > 0.5 ? 1 : 0) : (Math.cos(outShown.ph) > 0 ? 0 : 1);
    if (gd.read === 'amp') { if (outShown.amp > 0.05) K.glow(g, lx, ly, R * 3.2, '#FFE07A', 0.7 * outShown.amp); K.ball(g, lx, ly, R, outShown.amp > 0.5 ? 'yellow' : 'navy', { lw: 2.5 }); }
    else { const col = ans ? '#FFE07A' : '#7FE4FF'; K.glow(g, lx, ly, R * 3, col, 0.6); K.ball(g, lx, ly, R, ans ? 'yellow' : 'blue', { lw: 2.5 }); }
    K.text(g, String(ans), lx, ly + 6, { size: 16, weight: 700, align: 'center' });
    K.text(g, gd.read === 'amp' ? 'wave or not?' : 'which phase?', lx, ly + R + 18, { size: 10.5, weight: 600, align: 'center', color: '#EAF6FC' });
    if (st.on('dials')) dial(g, (L.xj + L.x1) / 2, L.cy - L.width - 22, 14, outShown.ph, outShown.amp, 'output', '#7B5CF0');
    if (first) { const [x, y] = A[0][0], k = (Math.sin(st.t * 3) + 1) / 2; K.tag(g, 'click an antenna to flip its bit', x + 30 + k * 6, y - 40, { size: 11.5, bg: '#FFE07A', align: 'left' }); }
  });
  st.onOver(() => {
    const gd = GATES[S.gate];
    st.set('in', S.bits.slice(0, gd.n).join(' '));
    st.set('out', out.amp < 0.05 ? 'nothing: the waves cancel' : out.amp > 0.95 ? 'a full wave' : 'a third of a wave');
    st.set('bit', String(answer(S.bits)));
  });

  // ---------- hands
  st.handle({
    id: 'ant', cursor: 'pointer',
    hit: (x, y) => { const A = arms(); let best = -1, bd = 34; A.forEach((pts, i) => { const d = Math.hypot(x - (pts[0][0] - 23), y - pts[0][1]); if (d < bd) { bd = d; best = i; } }); hover = best; return best >= 0 ? bd : false; },
    click: () => { if (hover >= 0) toggle(hover); },
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const tt = st.simT; until(() => st.simT - tt >= sec, then); };
  const setGate = (id, bits) => { S.gate = id; S.bits = bits.slice(); record(); };
  st.tour({
    title: 'How can waves compute?',
    steps: [
      { say: 'This chip carries **spin waves** instead of electric currents. Each antenna on the left sends a spin wave down its arm of the magnetic waveguide.',
        tools: { crest: true, dials: false }, enter: () => setGate('xnor', [0, 0, 0]) },
      { say: 'A bit is written in the wave’s **phase**: a 1 is the same wave shifted by half a wavelength, with a crest where a 0 has a trough. The little dials show it.',
        tools: { dials: true }, enter: () => setGate('xnor', [0, 1, 0]) },
      { say: 'Where the arms meet, the waves add up. **Same** phase: crests on crests, a full wave goes on and the lamp lights. **Opposite**: crest meets trough, they cancel and the lamp stays dark.',
        enter: () => { setGate('xnor', [0, 0, 0]); wait(3, () => { S.bits = [0, 1, 0]; record(); }); } },
      { say: 'Put a **half-wave delay** in one arm and the rule flips: now it is different inputs that light the lamp. That is the XOR gate.',
        enter: () => setGate('xor', [1, 0, 0]) },
      { say: 'With **three** inputs, the wave that comes out takes the phase of the **majority**. This majority gate is a favourite of spin-wave computing: one junction does what takes many transistors.',
        enter: () => setGate('maj', [1, 1, 0]) },
      { say: 'No charges move, so there is no current to heat the chip. Making spin waves do useful work like this is part of what our lab studies (look for the waveguide paper in the gallery next door).',
        enter: () => setGate('xnor', [0, 0, 0]) },
    ],
    onEnd: () => { pending = null; },
  });

  // ---------- challenges
  const after = () => { pending = null; };
  st.setChallenges([
    {
      id: 'cancel', title: 'Opposite bits', card: 'logic.cancel', lock: true, after,
      setup: () => setGate('xnor', [0, 0, 0]),
      q: 'Both antennas send a 0 and the lamp is lit. Now switch input B to 1, so the two waves are opposite. The lamp…',
      choices: ['shines brighter than ever', 'goes dark', 'starts to flicker'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(2, () => { toggle(1); wait(2.5, () => finish()); }); },
      explain: 'Opposite phases mean a crest of one wave always meets a trough of the other. They cancel completely, and nothing travels on to the lamp.',
    },
    {
      id: 'xor', title: 'The delay', card: 'logic.xor', lock: true, after,
      setup: () => setGate('xor', [0, 0, 0]),
      q: 'Arm B has a half-wave delay. Now set both inputs to 1. The lamp is…',
      choices: ['lit', 'dark'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(1.5, () => { toggle(0); wait(1, () => { toggle(1); wait(2.5, () => finish()); }); }); },
      explain: 'Both inputs are shifted by half a wave, and the delay shifts B by another half: B ends up a whole wave on, opposite to A at the junction. They cancel: XOR gives 0 when both bits are equal.',
    },
    {
      id: 'maj', title: 'Who wins?', card: 'logic.majority', lock: true, after,
      setup: () => setGate('maj', [0, 0, 0]),
      q: 'Three inputs: 1, 1 and 0. The wave that comes out of the majority gate carries…',
      choices: ['a 0', 'a 1', 'nothing at all'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(1.5, () => { toggle(0); wait(0.8, () => { toggle(1); wait(2.5, () => finish('Two 1s beat one 0.')); }); }); },
      explain: 'Two of the three waves have the 1 phase. The 0 wave cancels one of them, and what is left travels on with the 1 phase, a third as big. The majority wins.',
    },
  ]);

  st.peek = () => ({ L: Lay, ant: arms().map((p) => [p[0][0] - 23, p[0][1]]), out });   // for tests
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }];

export default bench;
