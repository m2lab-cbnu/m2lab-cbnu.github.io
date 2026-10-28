// Procedural textures drawn on canvases: floor, walls, breadboard, wood, pegboard, books,
// instrument front panels and screens. Nothing is downloaded except the TV photo.

import * as THREE from '../vendor/three.js';

let seed = 12345;
export function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export function reseed(s) { seed = s; }

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function tex(c, { repeat = null, srgb = true, aniso = 8, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}

// ---------------------------------------------------------------- surfaces
export function terrazzo() {
  reseed(7);
  const s = 1024, c = canvas(s, s), g = c.getContext('2d');
  g.fillStyle = '#D9D3C6'; g.fillRect(0, 0, s, s);
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const x = rand() * s, y = rand() * s, r = 20 + rand() * 70;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rand() * 0.06, warm = rand() < 0.5;
    grd.addColorStop(0, warm ? `rgba(206,196,176,${a})` : `rgba(240,238,232,${a})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const chips = ['#5B5348', '#3E3A35', '#7A6E5E', '#9C8F7B', '#B9AC97', '#2F2C29', '#857A69', '#A49A8A'];
  const drawChip = (x, y, r) => {
    g.beginPath();
    const n = 5 + (rand() * 4 | 0);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2, rr = r * (0.6 + rand() * 0.5);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath(); g.fill();
  };
  for (let i = 0; i < 9000; i++) {
    const x = rand() * s, y = rand() * s, r = 0.6 + Math.pow(rand(), 3) * 5.5;
    g.fillStyle = chips[(rand() * chips.length) | 0];
    g.globalAlpha = 0.55 + rand() * 0.45;
    drawChip(x, y, r);
    // wrap at the edges so the tile repeats without seams
    if (x < 8) drawChip(x + s, y, r); if (x > s - 8) drawChip(x - s, y, r);
    if (y < 8) drawChip(x, y + s, r); if (y > s - 8) drawChip(x, y - s, r);
  }
  g.globalAlpha = 1;
  // tile joints (the floor is laid in ~60 cm squares; this tile covers one square)
  g.strokeStyle = 'rgba(120,108,92,0.35)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2);
  return tex(c, { repeat: [1, 1] });
}

export function plaster(base = '#EFE8DA', spots = 600) {
  reseed(11);
  const s = 512, c = canvas(s, s), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < spots; i++) {
    const x = rand() * s, y = rand() * s, r = 2 + rand() * 26;
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,250,0.03)' : 'rgba(170,150,120,0.018)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return tex(c, { repeat: [1, 1] });
}

export function breadboard() {
  const s = 64, c = canvas(s, s), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, s, s);
  grd.addColorStop(0, '#B6BFC6'); grd.addColorStop(1, '#AAB4BC');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  // brushed lines
  for (let y = 0; y < s; y += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + 0.04 * Math.random()})`; g.fillRect(0, y, s, 1); }
  g.fillStyle = '#2B3036'; g.beginPath(); g.arc(s / 2, s / 2, 7.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4A525A'; g.beginPath(); g.arc(s / 2 - 1.5, s / 2 - 1.5, 5, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1C2025'; g.beginPath(); g.arc(s / 2, s / 2, 4.2, 0, Math.PI * 2); g.fill();
  return tex(c, { repeat: [1, 1] });
}

export function pegboard() {
  const s = 64, c = canvas(s, s), g = c.getContext('2d');
  g.fillStyle = '#CDA779'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,105,60,${0.05 + Math.random() * 0.06})`; g.fillRect(0, Math.random() * s, s, 1 + Math.random() * 2); }
  g.fillStyle = '#4A3420'; g.beginPath(); g.arc(s / 2, s / 2, 5, 0, Math.PI * 2); g.fill();
  return tex(c, { repeat: [1, 1] });
}

export function wood(base = '#8A5A33', dark = '#5E3A1F', w = 512, h = 512, vertical = false) {
  reseed(23);
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const L = vertical ? h : w, N = vertical ? w : h;
  for (let i = 0; i < 70; i++) {
    const p = rand() * N, a = 0.05 + rand() * 0.12, amp = 2 + rand() * 6, fr = 0.004 + rand() * 0.01, ph = rand() * 6;
    g.strokeStyle = rand() < 0.6 ? hexA(dark, a) : `rgba(255,236,200,${a * 0.6})`;
    g.lineWidth = 0.6 + rand() * 2.2;
    g.beginPath();
    for (let t = 0; t <= L; t += 8) {
      const q = p + Math.sin(t * fr + ph) * amp;
      vertical ? (t ? g.lineTo(q, t) : g.moveTo(q, t)) : (t ? g.lineTo(t, q) : g.moveTo(t, q));
    }
    g.stroke();
  }
  return tex(c);
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

export function books(n = 26, seedv = 3) {
  reseed(seedv);
  const w = 512, h = 128, c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#3B2615'; g.fillRect(0, 0, w, h);
  const cols = ['#F2EEE3', '#E8E1CF', '#C9D9E8', '#1F3B63', '#7A2E2E', '#2F5D4A', '#D9C27A', '#FFFFFF', '#E2B66B', '#5A6E9C', '#B5523B', '#EAE6DA', '#33475B', '#8DB3C7'];
  let x = 2;
  while (x < w - 6) {
    const bw = 8 + rand() * 18, bh = h * (0.62 + rand() * 0.36), col = cols[(rand() * cols.length) | 0];
    g.fillStyle = col; g.fillRect(x, h - bh, bw, bh);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + bw - 2, h - bh, 2, bh);
    if (rand() < 0.7) { g.fillStyle = 'rgba(30,30,40,0.35)'; g.fillRect(x + 2, h - bh + 8 + rand() * 20, bw - 4, 3); g.fillRect(x + 2, h - 18, bw - 4, 2); }
    x += bw + 0.5 + (rand() < 0.1 ? 6 : 0);
  }
  return tex(c);
}

export function windowView() {
  const w = 512, h = 256, c = canvas(w, h), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#DDEFF8'); grd.addColorStop(0.6, '#F4F1E8'); grd.addColorStop(1, '#E7DFCF');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  // corridor shelves and a door seen through the glass
  g.fillStyle = 'rgba(80,70,60,0.18)'; g.fillRect(40, 70, 110, 150); g.fillRect(330, 60, 140, 170);
  g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 4; i++) g.fillRect(48, 82 + i * 34, 94, 3);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(120, 0); g.lineTo(0, 120); g.fill();
  return tex(c);
}

export function acGrille() {
  const s = 256, c = canvas(s, s), g = c.getContext('2d');
  g.fillStyle = '#F4F3EF'; g.fillRect(0, 0, s, s);
  g.fillStyle = '#E2E2DD';
  for (let i = 0; i < 4; i++) { // four outlet slots
    g.save(); g.translate(s / 2, s / 2); g.rotate(i * Math.PI / 2); g.fillRect(-90, -118, 180, 22); g.restore();
  }
  g.fillStyle = '#E7E7E2'; g.fillRect(70, 70, 116, 116);
  g.strokeStyle = 'rgba(120,120,110,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(70, 70 + i * 6.5); g.lineTo(186, 70 + i * 6.5); g.stroke(); g.beginPath(); g.moveTo(70 + i * 6.5, 70); g.lineTo(70 + i * 6.5, 186); g.stroke(); }
  return tex(c);
}

// ---------------------------------------------------------------- blackboard
export function blackboardCanvas() {
  const c = canvas(1600, 640);
  paintBlackboard(c.getContext('2d'), c.width, c.height);
  return c;
}
export function paintBlackboard(g, w, h) {
  reseed(31);
  g.fillStyle = '#21493B'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { // smudges from old erasing
    const x = rand() * w, y = rand() * h, rx = 40 + rand() * 160, ry = 10 + rand() * 40;
    g.fillStyle = `rgba(230,240,230,${0.015 + rand() * 0.03})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, rand() * 0.6 - 0.3, 0, Math.PI * 2); g.fill();
  }
}
export function chalk(g, fn, color = 'rgba(246,244,232,0.92)', width = 3) {
  g.save(); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  fn(g); g.restore();
}

// ---------------------------------------------------------------- instruments
// Paint a front panel. spec: { w, h, base, frame, screen: {x,y,w,h, paint}, knobs: [[x,y,r]], buttons: [{x,y,cols,rows,bw,bh,gap,color}],
//                               leds: [{x,y,w,h,text,color}], ports: [[x,y,r]], label: {x,y,text} }
export function panelCanvas(spec) {
  const c = canvas(spec.w, spec.h);
  paintPanel(c.getContext('2d'), spec);
  return c;
}
export function paintPanel(g, spec) {
  const { w, h } = spec;
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, shade(spec.base, 0.06)); grd.addColorStop(1, shade(spec.base, -0.06));
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.strokeStyle = spec.frame || 'rgba(0,0,0,0.25)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  // rack ears
  if (spec.ears) { g.fillStyle = shade(spec.base, -0.12); g.fillRect(0, 0, 18, h); g.fillRect(w - 18, 0, 18, h); }
  for (const b of spec.buttons || []) {
    for (let r = 0; r < b.rows; r++) for (let q = 0; q < b.cols; q++) {
      const x = b.x + q * (b.bw + b.gap), y = b.y + r * (b.bh + b.gap);
      g.fillStyle = (b.colors && b.colors[(r * b.cols + q) % b.colors.length]) || b.color || '#D8D8D2';
      roundRect(g, x, y, b.bw, b.bh, 3); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + b.bh - 2, b.bw, 2);
    }
  }
  for (const k of spec.knobs || []) {
    const [x, y, r] = k;
    const kg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    kg.addColorStop(0, '#9AA3AA'); kg.addColorStop(1, '#2C3136');
    g.fillStyle = kg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r * 0.7, y - r * 0.5); g.stroke();
  }
  for (const p of spec.ports || []) {
    const [x, y, r] = p;
    g.fillStyle = '#C9B37A'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#E8DDBA'; g.beginPath(); g.arc(x, y, r * 0.62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5C4B26'; g.beginPath(); g.arc(x, y, r * 0.22, 0, Math.PI * 2); g.fill();
  }
  for (const l of spec.leds || []) {
    g.fillStyle = l.bg || '#1A0606'; g.fillRect(l.x, l.y, l.w, l.h);
    g.font = `700 ${Math.round(l.h * 0.78)}px "Plex", monospace`; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.fillStyle = l.color || '#FF3B2F'; g.shadowColor = l.color || '#FF3B2F'; g.shadowBlur = 8;
    g.fillText(l.text, l.x + l.w - 6, l.y + l.h / 2 + 1); g.shadowBlur = 0;
  }
  if (spec.label) {
    g.font = `600 ${spec.label.size || 16}px "Plex", sans-serif`; g.fillStyle = spec.label.color || 'rgba(20,30,40,0.75)';
    g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(spec.label.text, spec.label.x, spec.label.y);
  }
  if (spec.screen) {
    const s = spec.screen;
    g.fillStyle = '#111'; g.fillRect(s.x - 4, s.y - 4, s.w + 8, s.h + 8);
    g.save(); g.translate(s.x, s.y); g.beginPath(); g.rect(0, 0, s.w, s.h); g.clip();
    if (s.paint) s.paint(g, s.w, s.h); else { g.fillStyle = '#04121F'; g.fillRect(0, 0, s.w, s.h); }
    g.restore();
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); gg = Math.round((t - gg) * p + gg); b = Math.round((t - b) * p + b);
  return `rgb(${r},${gg},${b})`;
}

// Generic code-editor screen for the PC monitor when nothing is running
export function paintCodeScreen(g, w, h, lines) {
  g.fillStyle = '#0B1D30'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#12304F'; g.fillRect(0, 0, w, 26);
  g.fillStyle = '#A8ECFF'; g.font = '600 15px "Plex", sans-serif'; g.textBaseline = 'middle'; g.fillText('sim.mx3', 12, 13);
  g.font = '500 14px ui-monospace, Menlo, Consolas, monospace'; g.textBaseline = 'top';
  lines.forEach((ln, i) => {
    g.fillStyle = 'rgba(168,236,255,0.45)'; g.fillText(String(i + 1).padStart(2, ' '), 8, 36 + i * 19);
    g.fillStyle = ln.startsWith('//') ? '#6FB7C9' : '#E6F8FF'; g.fillText(ln, 40, 36 + i * 19);
  });
}
