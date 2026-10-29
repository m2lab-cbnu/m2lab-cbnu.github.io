// 3F · Kerr microscope: magnetic domains. Polarised light reflected from a magnetic film turns
// slightly one way or the other with the magnetisation (the magneto-optical Kerr effect); an
// analyser turns that twist into light and dark, and the domains appear. Two films:
//  · a garnet whose domains curl into mazes (a Swift-Hohenberg pattern: up and down domains
//    of a preferred width, as the magnetic dipole forces in such films make them), and
//  · a Co/Pt film that switches in jumps (a random-field Ising model: domains start at weak
//    spots and their walls sweep on in avalanches), with a square loop and a long memory.

import { el } from '../ui/widgets.js';
import { rigStrip, current, phys, onRig } from './common.js';
import { rig } from '../rpg/state.js';
import { fft2 } from '../physics/fft.js';
import { Stage } from './stage.js';
import * as K from './kit.js';
import { sound } from '../rpg/sound.js';
import { gauss } from './common.js';

const NX = 128, NY = 64, N = NX * NY;
const KERR = 3 * Math.PI / 180;           // the Kerr rotation, made big enough to see

const bench = {
  id: 'domains', title: 'Kerr microscope: domains', kicker: '3F · Magnonics Lab', icon: '▦', floor: 3,
  blurb: 'Watch magnetic domains grow, shrink and remember.',
  slots: [{ id: 'film', label: 'Film', options: ['dom-garnet', 'dom-copt'], def: 'dom-garnet' }],
};
bench.header = rigStrip(bench);

// ---------------------------------------------------------------- the garnet: domains of a preferred width
function mazeFilm() {
  const r = 0.8, q0 = 2 * Math.PI / 12, dt = 0.5, NOISE = 0.03;
  const L = new Float64Array(N);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const kx = 2 * Math.PI * (x < NX / 2 ? x : x - NX) / NX, ky = 2 * Math.PI * (y < NY / 2 ? y : y - NY) / NY;
    L[y * NX + x] = r - (1 - (kx * kx + ky * ky) / (q0 * q0)) ** 2;
  }
  const psi = new Float64Array(N), re = new Float64Array(N), im = new Float64Array(N), nr = new Float64Array(N), ni = new Float64Array(N);
  const self = {
    kind: 'maze', Hmax: 12,
    reset(sign) { for (let i = 0; i < N; i++) psi[i] = sign ? sign : (Math.random() - 0.5) * 0.4; },
    step(HmT) {
      const h = HmT / 10;
      for (let i = 0; i < N; i++) { re[i] = psi[i]; im[i] = 0; nr[i] = -(psi[i] * psi[i] * psi[i]) + h; ni[i] = 0; }
      fft2(re, im, NX, NY); fft2(nr, ni, NX, NY);
      for (let i = 0; i < N; i++) { const d = 1 - dt * L[i]; re[i] = (re[i] + dt * nr[i]) / d; im[i] = (im[i] + dt * ni[i]) / d; }
      fft2(re, im, NX, NY, true);
      for (let i = 0; i < N; i++) psi[i] = re[i] + (Math.random() - 0.5) * NOISE;
    },
    value: (i) => Math.max(-1, Math.min(1, psi[i])),
    m() { let s = 0; for (let i = 0; i < N; i++) s += Math.max(-1, Math.min(1, psi[i])); return s / N; },
    paint(cx, cy, rad, sign) { for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) { if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue; const xx = (x + NX) % NX, yy = (y + NY) % NY; psi[yy * NX + xx] = sign; } },
  };
  self.reset(0);
  for (let k = 0; k < 120; k++) self.step(0);
  return self;
}

// ---------------------------------------------------------------- Co/Pt: switching in avalanches
function switchFilm() {
  const J = 1, SIG = 1.6;
  const rnd = new Float64Array(N); for (let i = 0; i < N; i++) rnd[i] = SIG * gauss();
  const s = new Int8Array(N).fill(-1);
  const NB = new Int32Array(N * 4);
  for (let i = 0; i < N; i++) { const x = i % NX, y = (i / NX) | 0; NB[4 * i] = ((x + 1) % NX) + y * NX; NB[4 * i + 1] = ((x - 1 + NX) % NX) + y * NX; NB[4 * i + 2] = x + ((y + 1) % NY) * NX; NB[4 * i + 3] = x + ((y - 1 + NY) % NY) * NX; }
  let queue = [], H = 0;
  const unstable = (i) => { let f = H + rnd[i]; for (let k = 0; k < 4; k++) f += J * s[NB[4 * i + k]]; return s[i] * f < 0; };
  const self = {
    kind: 'switch', Hmax: 30,
    reset(sign) { s.fill(sign || -1); queue = []; },
    step(HmT) {
      const h = HmT / 5;
      if (h !== H) { H = h; queue = []; for (let i = 0; i < N; i++) if (unstable(i)) queue.push(i); }
      // let the avalanches spread a couple of cells a frame, so you can watch the walls move
      for (let gen = 0; gen < 2 && queue.length; gen++) {
        const next = [];
        for (const i of queue) {
          if (!unstable(i)) continue;
          s[i] = -s[i];
          for (let k = 0; k < 4; k++) { const j = NB[4 * i + k]; if (unstable(j)) next.push(j); }
        }
        queue = next;
      }
      if (queue.length) sound.play('sand', { vol: Math.min(1, queue.length / 300) * 0.5 });
    },
    value: (i) => s[i],
    m() { let t = 0; for (let i = 0; i < N; i++) t += s[i]; return t / N; },
    paint(cx, cy, rad, sign) {
      for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad) continue;
        const i = ((y + NY) % NY) * NX + (x + NX) % NX; s[i] = sign;
        for (let k = 0; k < 4; k++) queue.push(NB[4 * i + k]);
      }
    },
  };
  return self;
}

const S = { H: 0, ana: 4, pen: 1 };

function tabPlay(pane) {
  let film = null, filmKind = '', filmOver = null, Lay = { w: 800, h: 480 }, first = true, pending = null, anim = null;
  let loop = [], sweep = null, drawing = false, ext = 0, flips = 0;
  const img = document.createElement('canvas'); img.width = NX; img.height = NY;
  const ig = img.getContext('2d'), idata = ig.createImageData(NX, NY);
  const ensure = () => {
    const k = filmOver || phys(bench, 'film').kind;
    if (k !== filmKind) { filmKind = k; film = k === 'maze' ? mazeFilm() : switchFilm(); if (k === 'switch') film.reset(-1); loop = []; ext = 0; flips = 0; S.H = Math.max(-film.Hmax, Math.min(film.Hmax, S.H)); syncCtl(); }
    return film;
  };

  const st = new Stage(pane, {
    bench, npc: 'nova',
    label: 'A Kerr microscope image of a magnetic film: light and dark patches are domains magnetised up and down. Beside it, the magnetisation against the field.',
    hello: 'Light and dark patches are **magnetic domains**. Push them with the **field** slider, draw your own with the **magnetic pen**, or turn the **analyser**.',
    aspect: 16 / 9, phoneAspect: 0.78, minH: 340,
    onReset: () => { S.H = 0; S.ana = 4; filmKind = ''; ensure(); sweep = null; first = true; },
    keys: { arrow: (dx) => { if (dx) setH(S.H + dx * ensure().Hmax / 30); } },
  });
  st.tool('loop', 'Loop', { icon: '#E5534B', on: true }).tool('arrows', 'Spin arrows', { icon: K.COL.net });
  st.readout('H', 'Field').readout('M', 'Magnetisation').readout('ana', 'Analyser');

  // ---------- controls
  const mk = (label, min, max, stepv, get, set) => {
    const lab = el('span', { text: '' }), inp = el('input', { type: 'range', min, max, step: stepv, value: get(), 'aria-label': label });
    inp.addEventListener('input', () => { set(+inp.value); first = false; syncCtl(); });
    return { el: el('label', { class: 'stg-range' }, lab, inp), lab, inp };
  };
  const rH = mk('Magnetic field in millitesla', -12, 12, 0.1, () => S.H, (v) => { sweep = null; S.H = v; });
  const rA = mk('Analyser angle in degrees', -8, 8, 0.1, () => S.ana, (v) => { S.ana = v; });
  const upB = el('button', { type: 'button', class: 'stg-act' }), dnB = el('button', { type: 'button', class: 'stg-act ghost' });
  upB.addEventListener('click', () => { S.pen = 1; syncCtl(); sound.play('click'); });
  dnB.addEventListener('click', () => { S.pen = -1; syncCtl(); sound.play('click'); });
  const swB = el('button', { type: 'button', class: 'stg-act ghost', text: 'Sweep a loop' });
  const clB = el('button', { type: 'button', class: 'stg-act ghost', text: 'Clear the loop' });
  swB.addEventListener('click', () => startSweep());
  clB.addEventListener('click', () => { loop = []; sound.play('pop'); });
  st.controls(rH.el, el('div', { class: 'stg-row' }, swB, clB), el('div', { class: 'stg-row' }, upB, dnB), rA.el);
  function syncCtl() {
    const Hm = film ? film.Hmax : 12;
    rH.inp.min = -Hm; rH.inp.max = Hm; rH.inp.value = S.H; rH.lab.textContent = `Field: ${S.H.toFixed(1)} mT`;
    rA.inp.value = S.ana; rA.lab.textContent = `Analyser: ${S.ana >= 0 ? '+' : ''}${S.ana.toFixed(1)}° from crossed`;
    upB.textContent = 'Pen: write up'; dnB.textContent = 'Pen: write down';
    upB.classList.toggle('ghost', S.pen !== 1); dnB.classList.toggle('ghost', S.pen !== -1);
  }
  function setH(v) { const f = ensure(); S.H = Math.max(-f.Hmax, Math.min(f.Hmax, v)); sweep = null; syncCtl(); }
  function startSweep() { const f = ensure(); sweep = { t0: st.simT, dur: 18, Hm: f.Hmax }; loop = []; sound.play('click'); }
  onRig(bench, () => { ensure(); });
  ensure();

  // ---------- time
  st.onStep((sdt) => {
    if (anim) {
      const q = Math.min(1, (st.simT - anim.t0) / anim.dur);
      anim.set(anim.from + (anim.to - anim.from) * (0.5 - 0.5 * Math.cos(Math.PI * q)));
      if (q >= 1) { const x = anim; anim = null; if (x.then) x.then(); }
    }
    const f = ensure();
    if (sweep) {
      const q = (st.simT - sweep.t0) / sweep.dur;
      // 0 → +max → -max → +max
      const u = Math.min(1, q), v = u < 0.25 ? u * 4 : u < 0.75 ? 1 - (u - 0.25) * 4 : -1 + (u - 0.75) * 4;
      S.H = sweep.Hm * v; syncCtl();
      if (q >= 1) sweep = null;
    }
    if (sdt > 0) {
      f.step(S.H);
      const m = f.m();
      const last = loop[loop.length - 1];
      if (!last || Math.abs(last[0] - S.H) > f.Hmax / 200 || Math.abs(last[1] - m) > 0.02) { loop.push([S.H, m]); if (loop.length > 1500) loop.shift(); }
      // a whole loop: all the way one way, then the other, then back again
      const e = m > 0.9 ? 1 : m < -0.9 ? -1 : 0;
      if (e && e !== ext) { if (ext) flips++; ext = e; }
      if (flips >= 2) { flips = 0; rig.note({ bench: 'domains', loop: true, film: filmKind }); st.flash('A whole loop!'); }
    }
    if (pending && pending.cond()) { const x = pending.then; pending = null; x(); }
  });

  // ---------- layout
  st.onResize((w, h, narrow) => {
    if (narrow) { const iw = w - 24; Lay = { w, h, narrow, ix: 12, iy: 14, iw, ih: iw / 2, lx: 12, ly: 14 + iw / 2 + 64, lw: w - 24, lh: h - (14 + iw / 2 + 64) - 14 }; }
    else { const iw = Math.min(w * 0.58, (h - 90) * 2); Lay = { w, h, narrow, ix: 18, iy: 20, iw, ih: iw / 2, lx: 18 + iw + 22, ly: 20, lw: w - (18 + iw + 22) - 16, lh: Math.min(h - 40, iw / 2 + 60) }; }
  });

  // ---------- drawing
  // brightness behind the analyser for magnetisation v (−1…1): Malus' law on the Kerr-twisted light
  const NORM = Math.sin(8.5 * Math.PI / 180) ** 2;
  const bright = (v) => Math.min(1, Math.sin(S.ana * Math.PI / 180 + KERR * v) ** 2 / NORM + 0.04);
  // navy → blue → ice: stays blue all the way, never a grey
  const tint = (I) => {
    const q = Math.pow(I, 0.8), A = [20, 36, 74], B = [44, 110, 190], C = [214, 244, 255];
    const [p, r, u] = q < 0.5 ? [A, B, q * 2] : [B, C, q * 2 - 1];
    return [p[0] + (r[0] - p[0]) * u, p[1] + (r[1] - p[1]) * u, p[2] + (r[2] - p[2]) * u];
  };
  const css = (c) => `rgb(${c.map(Math.round).join(',')})`;
  function renderImage() {
    const f = ensure(), d = idata.data;
    for (let i = 0; i < N; i++) {
      const c = tint(bright(f.value(i))), o = i * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
    ig.putImageData(idata, 0, 0);
  }
  // how the camera sees domains: lamp → polariser → film → analyser → camera, with the twist
  // drawn three times bigger than in the model so the eye can follow it
  function drawPath(g) {
    if (Lay.narrow) return;
    const x = Lay.ix, w = Lay.iw, y = Lay.iy + Lay.ih + 48, hh = Lay.h * 0.92 - 10 - y;
    if (hh < 110) return;
    const EX = 3, top = y + 30, fy = y + hh - 18;
    const lamp = [x + 22, top], pol = [x + w * 0.22, top + (fy - top) * 0.42], film = [x + w * 0.44, fy];
    const ana = [x + w * 0.68, top + (fy - top) * 0.42], cam = [x + w * 0.86, top];
    K.text(g, 'How the light shows the domains', x, y + 6, { size: 11.5, weight: 700, color: '#FFFDF6', halo: '#14244A' });
    // the beam: in, then two rays back out (one from an up domain, one from a down domain)
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,224,122,0.85)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(lamp[0], lamp[1]); g.lineTo(film[0], film[1]); g.stroke();
    [[1, '#F28A84'], [-1, '#8DB8F2']].forEach(([v, col]) => {
      const off = v * 7;
      g.strokeStyle = col; g.lineWidth = 3; g.globalAlpha = 0.5 + 0.5 * bright(v);
      g.beginPath(); g.moveTo(film[0] + off, film[1]); g.lineTo(ana[0] + off, ana[1]); g.stroke();
      g.globalAlpha = 0.25 + 0.75 * bright(v);
      g.beginPath(); g.moveTo(ana[0] + off, ana[1]); g.lineTo(cam[0] - 16 + off * 1.6, cam[1] + 6); g.stroke();
      g.globalAlpha = 1;
    });
    // lamp
    K.glow(g, lamp[0], lamp[1], 22, '#FFE07A', 0.5);
    g.fillStyle = '#FFE07A'; g.beginPath(); g.arc(lamp[0], lamp[1], 9, 0, Math.PI * 2); g.fill();
    // the film: an up half and a down half where the light lands
    const fw = 92;
    g.fillStyle = '#E5534B'; g.fillRect(film[0] - fw / 2, film[1], fw / 2, 9);
    g.fillStyle = '#3D7FD6'; g.fillRect(film[0], film[1], fw / 2, 9);
    K.text(g, 'up', film[0] - fw / 4, film[1] + 24, { size: 10.5, weight: 700, align: 'center', color: '#FFB3AD', halo: '#14244A' });
    K.text(g, 'down', film[0] + fw / 4, film[1] + 24, { size: 10.5, weight: 700, align: 'center', color: '#B9D4FF', halo: '#14244A' });
    // a polariser or analyser, seen along the beam: a ring with its pass direction
    const disc = (p, angDeg, label, arrows) => {
      const r = 21;
      g.fillStyle = 'rgba(20,36,74,0.92)'; g.beginPath(); g.arc(p[0], p[1], r, 0, Math.PI * 2); g.fill();
      g.lineWidth = 2.5; g.strokeStyle = '#CFE8F7'; g.stroke();
      const a = angDeg * Math.PI / 180, dx = Math.sin(a) * (r - 4), dy = -Math.cos(a) * (r - 4);
      g.strokeStyle = '#FFE07A'; g.lineWidth = 2.5; g.setLineDash([4, 3]);
      g.beginPath(); g.moveTo(p[0] - dx, p[1] - dy); g.lineTo(p[0] + dx, p[1] + dy); g.stroke(); g.setLineDash([]);
      (arrows || []).forEach(([deg, col]) => {   // the light's polarisation: a double-headed arrow
        const sx = Math.sin(deg * Math.PI / 180) * 14, sy = Math.cos(deg * Math.PI / 180) * 14;
        K.arrow(g, p[0], p[1], p[0] + sx, p[1] - sy, col, { lw: 2.4, head: 6, halo: false });
        K.arrow(g, p[0], p[1], p[0] - sx, p[1] + sy, col, { lw: 2.4, head: 6, halo: false });
      });
      K.text(g, label, p[0], p[1] - r - 7, { size: 10.5, weight: 700, align: 'center', color: '#FFFDF6', halo: '#14244A' });
    };
    const kd = KERR * 180 / Math.PI * EX;
    disc(pol, 0, 'polariser');
    disc(ana, 90 + S.ana * EX, 'analyser', [[kd, '#F28A84'], [-kd, '#8DB8F2']]);
    // camera: what each domain looks like
    const sw = 26;
    [[1, '#E5534B', 'up'], [-1, '#3D7FD6', 'down']].forEach(([v, col, lab], i) => {
      const sx = cam[0] - 4 + i * (sw + 8), sy = cam[1] - sw / 2 + 6;
      g.fillStyle = css(tint(bright(v))); g.fillRect(sx, sy, sw, sw);
      g.lineWidth = 2.5; g.strokeStyle = col; g.strokeRect(sx, sy, sw, sw);
      K.text(g, lab, sx + sw / 2, sy + sw + 14, { size: 10.5, weight: 700, align: 'center', color: '#FFFDF6', halo: '#14244A' });
    });
    K.text(g, 'camera', cam[0] + sw / 2 + 4, cam[1] - sw / 2 - 4, { size: 10.5, weight: 700, align: 'center', color: '#FFFDF6', halo: '#14244A' });
    K.text(g, 'twist drawn 3× bigger', ana[0] + 30, ana[1] + 30, { size: 10, weight: 600, color: '#CFE8F7', halo: '#14244A' });
  }
  function drawScope(g) {
    const { ix, iy, iw, ih } = Lay;
    K.box(g, ix - 8, iy - 8, iw + 16, ih + 16, K.MAT.navy, { r: 12, bands: false });
    renderImage();
    g.save(); K.rr(g, ix, iy, iw, ih, 6); g.clip(); g.imageSmoothingEnabled = true; g.drawImage(img, ix, iy, iw, ih);
    if (st.on('arrows')) {
      const f = ensure();
      for (let y = 4; y < NY; y += 8) for (let x = 4; x < NX; x += 8) {
        const v = f.value(y * NX + x), px = ix + (x + 0.5) / NX * iw, py = iy + (y + 0.5) / NY * ih;
        g.fillStyle = v > 0 ? '#E5534B' : '#3D7FD6';
        g.beginPath(); g.arc(px, py, 4.5, 0, Math.PI * 2); g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#FFFDF6'; g.stroke();
        g.fillStyle = '#FFFDF6';
        if (v > 0) { g.beginPath(); g.arc(px, py, 1.4, 0, Math.PI * 2); g.fill(); } else { g.fillRect(px - 2.5, py - 0.6, 5, 1.2); g.fillRect(px - 0.6, py - 2.5, 1.2, 5); }
      }
    }
    g.restore();
    // a scale bar, and the eyepiece's crosshair
    const bar = iw * 20 / 200;
    g.fillStyle = '#FFFDF6'; g.fillRect(ix + iw - bar - 14, iy + ih - 14, bar, 4);
    K.text(g, '20 µm', ix + iw - bar / 2 - 14, iy + ih - 20, { size: 10.5, weight: 700, align: 'center', color: '#FFFDF6', halo: '#14244A' });
    K.text(g, filmKind === 'maze' ? 'garnet film, seen from above' : 'Co/Pt film, seen from above', ix + 10, iy + 18, { size: 10.5, weight: 700, color: '#FFFDF6', halo: '#14244A' });
    if (Math.abs(S.ana) < 0.6) K.tag(g, 'analyser crossed: the twist is invisible', ix + iw / 2, iy + ih / 2, { size: 12, bg: '#FFE07A' });
    // the field: arrows up or down the side
    const Hm = ensure().Hmax, frac = S.H / Hm;
    if (Math.abs(frac) > 0.03) {
      const cx = ix - 26 < 6 ? ix + iw + 18 : ix - 26;
      void cx;
    }
  }
  function drawLoop(g) {
    const { lx, ly, lw, lh } = Lay, f = ensure();
    g.save(); K.rr(g, lx, ly, lw, lh, 10); g.fillStyle = 'rgba(255,253,246,0.96)'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke(); g.restore();
    const x0 = lx + 30, x1 = lx + lw - 12, y0 = ly + 30, y1 = ly + lh - 26;
    const X = (H) => x0 + (H / f.Hmax + 1) / 2 * (x1 - x0), Y = (m) => y1 - (m + 1) / 2 * (y1 - y0);
    K.text(g, 'Magnetisation against field', lx + 12, ly + 19, { size: 11.5, weight: 700 });
    g.strokeStyle = '#D6ECF7'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x0, Y(0)); g.lineTo(x1, Y(0)); g.moveTo(X(0), y0); g.lineTo(X(0), y1); g.stroke();
    K.text(g, 'up', x0 - 4, Y(1) + 4, { size: 10, weight: 600, align: 'right' }); K.text(g, 'down', x0 - 4, Y(-1) + 4, { size: 10, weight: 600, align: 'right' });
    K.text(g, `−${f.Hmax} mT`, x0, y1 + 15, { size: 10, weight: 600 }); K.text(g, `+${f.Hmax} mT`, x1, y1 + 15, { size: 10, weight: 600, align: 'right' });
    if (st.on('loop') && loop.length > 1) K.polyline(g, loop.map(([H, m]) => [X(H), Y(m)]), '#E5534B', 2.2);
    const m = f.m();
    g.beginPath(); g.arc(X(S.H), Y(m), 6, 0, Math.PI * 2); g.fillStyle = '#FFE07A'; g.fill(); g.lineWidth = 2; g.strokeStyle = K.LINE; g.stroke();
  }

  st.onDraw((g, w, h) => {
    st.cache('bg', `${w}x${h}`, (gg, ww, hh) => { K.room(gg, ww, hh, K.THEME.dark, { floorH: 0.08 }); });
    drawScope(g);
    drawPath(g);
    drawLoop(g);
    if (first) { const k = (Math.sin(st.t * 3) + 1) / 2; K.tag(g, 'draw on the film with the magnetic pen', Lay.ix + Lay.iw / 2, Lay.iy + Lay.ih + 24 + k * 3, { size: 11.5, bg: '#FFE07A' }); }
  });
  st.onOver(() => {
    const f = ensure(), m = f.m();
    st.set('H', `${S.H.toFixed(1)} mT`);
    st.set('M', `${m >= 0 ? '+' : ''}${Math.round(m * 100)}%`);
    st.set('ana', Math.abs(S.ana) < 0.6 ? 'crossed: no contrast' : `${S.ana > 0 ? '+' : ''}${S.ana.toFixed(1)}°, ${S.ana > 0 ? 'up looks light' : 'up looks dark'}`);
  });

  // ---------- hands: the magnetic pen
  const toCell = (x, y) => [(x - Lay.ix) / Lay.iw * NX, (y - Lay.iy) / Lay.ih * NY];
  st.handle({
    id: 'pen', cursor: 'crosshair',
    hit: (x, y) => (x > Lay.ix && x < Lay.ix + Lay.iw && y > Lay.iy && y < Lay.iy + Lay.ih ? 1 : false),
    down: (x, y) => { drawing = true; first = false; const [cx, cy] = toCell(x, y); ensure().paint(cx, cy, 3, S.pen); sound.play('blip', { pitch: S.pen > 0 ? 1.4 : 0.9 }); },
    move: (x, y) => { if (!drawing) return; const [cx, cy] = toCell(x, y); ensure().paint(cx, cy, 3, S.pen); },
    up: () => { drawing = false; },
    click: (x, y) => { drawing = false; const [cx, cy] = toCell(x, y); ensure().paint(cx, cy, 4, S.pen); },
  });

  // ---------- why it happens
  const until = (cond, then) => { pending = { cond, then }; };
  const wait = (sec, then) => { const t0 = st.simT; until(() => st.simT - t0 >= sec, then); };
  st.tour({
    title: 'How do we see domains?',
    steps: [
      { say: 'This is a **Kerr microscope** looking at a thin magnetic film. Polarised light bounces off the film, and its polarisation turns a tiny bit: one way where the film points **up**, the other way where it points **down**.',
        tools: { loop: false, arrows: true }, enter: () => { filmOver = 'maze'; ensure(); sweep = null; S.ana = 4; setH(0); } },
      { say: 'That twist is invisible on its own. A second polariser, the **analyser**, turns it into light and dark. Exactly crossed, there is no contrast at all; turn it a little and the domains appear.',
        tools: { arrows: false }, enter: () => { anim = { t0: st.simT, from: 0, to: 4, dur: 3, set: (v) => { S.ana = v; syncCtl(); } }; } },
      { say: 'Each light or dark patch is a **magnetic domain**: all its spins point the same way. Thin **walls** separate them. In this garnet they curl up into mazes of a set width.',
        tools: { arrows: true } },
      { say: 'Turn on a field pointing up. Up domains **grow**, down domains shrink into thin stripes and little bubbles, and finally vanish.',
        tools: { arrows: false, loop: true }, enter: () => { anim = { t0: st.simT, from: 0, to: 9, dur: 5, set: (v) => { S.H = v; syncCtl(); } }; } },
      { say: 'Sweep the field down and back up while drawing the magnetisation: it does not come back the same way. That is **hysteresis**: a magnet remembers where it came from.',
        enter: () => { anim = null; startSweep(); } },
      { say: 'A hard magnet like this **Co/Pt** film remembers even better: its loop is square. Try the magnetic pen on it: hard disks store their bits as tiny up and down domains just like these.',
        enter: () => { sweep = null; filmOver = 'switch'; ensure(); film.reset(1); S.H = 0; syncCtl(); } },
    ],
    onEnd: () => { filmOver = null; anim = null; sweep = null; ensure(); },
  });

  // ---------- challenges
  const after = () => { pending = null; anim = null; sweep = null; filmOver = null; ensure(); };
  st.setChallenges([
    {
      id: 'grow', title: 'Push with a field', card: 'domains.grow', lock: true, after,
      setup: () => { filmOver = 'maze'; ensure(); film.reset(0); for (let k = 0; k < 80; k++) film.step(0); S.H = 0; S.ana = 4; syncCtl(); },
      q: 'The light patches point up. Turn on a field that also points up. The light patches…',
      choices: ['grow', 'shrink', 'stay just as they are'], answer: 0,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(1, () => { anim = { t0: st.simT, from: 0, to: 6, dur: 3, set: (v) => { S.H = v; syncCtl(); }, then: () => wait(1.5, () => finish(`Now ${Math.round((ensure().m() + 1) * 50)}% of the film points up.`)) }; }); },
      explain: 'Spins that point along the field have lower energy, so the walls move to make those domains bigger. The magnetisation of the whole film grows with the field.',
    },
    {
      id: 'memory', title: 'Does it remember?', card: 'domains.memory', lock: true, after,
      setup: () => { filmOver = 'switch'; ensure(); film.reset(-1); S.H = 0; loop = []; syncCtl(); },
      q: 'This Co/Pt film points down. Push it all the way up with a strong field, then turn the field back to zero. The film is now…',
      choices: ['back to half up, half down', 'still pointing up', 'pointing down again'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); anim = { t0: st.simT, from: 0, to: 30, dur: 4, set: (v) => { S.H = v; syncCtl(); }, then: () => { anim = { t0: st.simT, from: 30, to: 0, dur: 3, set: (v) => { S.H = v; syncCtl(); }, then: () => wait(1.5, () => finish(`At zero field it is still ${Math.round((ensure().m() + 1) * 50)}% up.`)) }; } }; },
      explain: 'A hard magnet keeps its magnetisation when the field is gone: that is its memory (remanence). It takes a field the other way to switch it back. Hard disks rely on exactly this.',
    },
    {
      id: 'kerr', title: 'The other side', card: 'domains.kerr', lock: true, after,
      setup: () => { filmOver = 'maze'; ensure(); S.H = 0; S.ana = 4; syncCtl(); },
      q: 'The analyser sits 4° to one side of crossed. Turn it to 4° on the other side. The picture…',
      choices: ['stays the same', 'flips: light and dark swap places', 'goes completely dark'], answer: 1,
      run: (s0, finish) => { s0.setPaused(false); s0.setSpeed(1); wait(1, () => { anim = { t0: st.simT, from: 4, to: -4, dur: 3, set: (v) => { S.ana = v; syncCtl(); }, then: () => wait(1, () => finish()) }; }); },
      explain: 'Up domains turn the light one way and down domains the other. Which of them gets closer to the analyser, and so looks brighter, depends on which side of crossed you are. Cross it exactly and they look the same.',
    },
  ]);

  st.peek = () => ({ L: Lay, m: ensure().m(), H: S.H, kind: filmKind });   // for tests
  return st.ctl;
}

bench.tabs = [{ id: 'play', label: 'Play', build: tabPlay }];

export default bench;
