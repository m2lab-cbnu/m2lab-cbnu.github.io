// Drawing kit for the experiment scenes, so every bench shares one look: chunky navy outlines,
// flat colours with one light and one dark tone, soft shadows, glows for anything that shines,
// and labels in small rounded tags. Like the pixel building, there are no neutral greys:
// metal is a cool blue and shadows are navy.

export const LINE = '#1B2440';
export const INK = '#12243A';
export const FONT = '"Plex", system-ui, sans-serif';
export const PIXF = '"Pixelify", "Galmuri", "Plex", system-ui, sans-serif';

// colours with a meaning, used the same way on every floor
export const COL = {
  gravity: '#E5534B',   // weight
  string: '#3D6FB6',    // tension, the pull of a string or rod
  net: '#7B5CF0',       // the total, or the part that does the work
  vel: '#1E9E68',       // velocity
  acc: '#D4459A',       // acceleration
  drag: '#D9822B',      // air drag and friction
  mag: '#E0457B',       // magnetic forces
  elec: '#E8A21C',      // electric forces
  normal: '#00A9D6',    // support from a surface
  spring: '#8C5CE0',    // springs
  pe: '#3D7FD6',        // energy of height
  ke: '#22B07A',        // energy of motion
  spe: '#9B6BF0',       // energy stored in a spring
  heat: '#F28A3C',      // energy turned into heat
  north: '#E5534B', south: '#3D7FD6',
};

// materials: [base, light, dark]
export const MAT = {
  steel: ['#A9C3DD', '#EAF4FF', '#5C7CA3'],
  chrome: ['#C4D8EC', '#FFFFFF', '#6886AC'],
  brass: ['#E2B84E', '#FFEDB0', '#A27C1E'],
  copper: ['#DE8650', '#FFC9A1', '#9C4E21'],
  alu: ['#C9DCEE', '#F6FBFF', '#86A2C2'],
  wood: ['#D9A066', '#F4C995', '#9A6236'],
  woodD: ['#B97A40', '#D9A066', '#7A4A26'],
  white: ['#FFFDF6', '#FFFFFF', '#C7DAEA'],
  cream: ['#FFF2D6', '#FFFBF0', '#E2C99A'],
  red: ['#E5534B', '#FF9F94', '#A12F38'],
  blue: ['#3D7FD6', '#9CCBFF', '#22508F'],
  navy: ['#2E4A7D', '#5F86C2', '#1B2C4E'],
  green: ['#3DBB7E', '#A3EBC6', '#1E7A52'],
  yellow: ['#FFD54F', '#FFF1B0', '#C99A1B'],
  orange: ['#F29E4C', '#FFD1A1', '#B9651F'],
  violet: ['#7B5CF0', '#C3B4FF', '#4B33B0'],
  pink: ['#FF8FAB', '#FFD0DC', '#C9446A'],
  tennis: ['#D9EE55', '#F7FFB8', '#93AE1C'],
  rubber: ['#2F3E66', '#5D73A6', '#1B2440'],
  glass: ['rgba(191,239,255,0.28)', 'rgba(255,255,255,0.75)', 'rgba(61,111,182,0.35)'],
  ferrite: ['#4A4E7A', '#8C90C0', '#2A2D52'],
  magnetN: ['#E5534B', '#FF9F94', '#A12F38'],
  magnetS: ['#3D7FD6', '#9CCBFF', '#22508F'],
};

// floor themes for backgrounds
export const THEME = {
  1: { wall: '#FFF4DE', wall2: '#F8E7C6', trim: '#D9A066', trimD: '#B97A40', floor: '#E9B77E', floorD: '#C98A4E', accent: '#E8C25A', sky: '#BFE6FF' },
  2: { wall: '#F3EEFF', wall2: '#E4DAFF', trim: '#9BE3C1', trimD: '#62C49A', floor: '#CDEFDD', floorD: '#93D6B5', accent: '#B9A8FF', sky: '#CFEFFF' },
  3: { wall: '#EAF6FC', wall2: '#D3EAF6', trim: '#7FC8EA', trimD: '#3D9AC6', floor: '#D6ECF7', floorD: '#A8D3EA', accent: '#00D4FF', sky: '#BFEFFF' },
  dark: { wall: '#16264A', wall2: '#1D3160', trim: '#2E4A7D', trimD: '#22325C', floor: '#132447', floorD: '#0E1C3A', accent: '#00D4FF', sky: '#0B1630' },
};

// ---------------------------------------------------------------- basics
export function rr(g, x, y, w, h, r = 4) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

// a panel with cel shading: base fill, a light band on top, a dark band at the bottom, outline
export function box(g, x, y, w, h, mat = MAT.steel, { r = 4, lw = 2, line = LINE, bands = true, vertical = false } = {}) {
  const [base, light, dark] = mat;
  g.save();
  rr(g, x, y, w, h, r);
  g.fillStyle = base; g.fill();
  if (bands) {
    g.clip();
    g.fillStyle = light;
    if (vertical) g.fillRect(x, y, Math.max(2, w * 0.22), h); else g.fillRect(x, y, w, Math.max(2, Math.min(6, h * 0.22)));
    g.fillStyle = dark;
    if (vertical) g.fillRect(x + w - Math.max(2, w * 0.18), y, w, h); else g.fillRect(x, y + h - Math.max(2, Math.min(5, h * 0.18)), w, h);
  }
  g.restore();
  if (lw) { rr(g, x, y, w, h, r); g.lineWidth = lw; g.strokeStyle = line; g.stroke(); }
}

// a cylinder seen from the side (rods, pipes, magnets), axis along x0,y0 -> x1,y1
export function rod(g, x0, y0, x1, y1, d, mat = MAT.steel, { lw = 2, cap = 'round' } = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  g.save();
  g.translate(x0, y0); g.rotate(Math.atan2(dy, dx));
  const [base, light, dark] = mat;
  const gr = g.createLinearGradient(0, -d / 2, 0, d / 2);
  gr.addColorStop(0, dark); gr.addColorStop(0.28, light); gr.addColorStop(0.55, base); gr.addColorStop(1, dark);
  g.beginPath();
  if (cap === 'round') { g.moveTo(0, -d / 2); g.lineTo(L, -d / 2); g.arc(L, 0, d / 2, -Math.PI / 2, Math.PI / 2); g.lineTo(0, d / 2); g.arc(0, 0, d / 2, Math.PI / 2, Math.PI * 1.5); }
  else g.rect(0, -d / 2, L, d);
  g.fillStyle = gr; g.fill();
  if (lw) { g.lineWidth = lw; g.strokeStyle = LINE; g.stroke(); }
  g.restore();
}

// a shiny ball; mat may be a material key or [base, light, dark]
export function ball(g, x, y, r, mat = MAT.steel, { lw = 2, pattern = null, spin = 0 } = {}) {
  const [base, light, dark] = typeof mat === 'string' ? MAT[mat] : mat;
  g.save();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.05);
  gr.addColorStop(0, light); gr.addColorStop(0.45, base); gr.addColorStop(1, dark);
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = gr; g.fill();
  if (pattern) { g.save(); g.clip(); pattern(g, x, y, r, spin); g.restore(); }
  // a crisp highlight
  g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
  if (lw) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = lw; g.strokeStyle = LINE; g.stroke(); }
  g.restore();
}

// patterns painted inside a ball
export const PATTERN = {
  wood(g, x, y, r) { g.strokeStyle = 'rgba(122,74,38,0.35)'; g.lineWidth = Math.max(1, r * 0.08); for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(x + k * r * 0.18, y, r * (0.9 - Math.abs(k) * 0.12), r * 1.2, 0.25, 0, Math.PI * 2); g.stroke(); } },
  tennis(g, x, y, r, s) { g.strokeStyle = '#FFFDF6'; g.lineWidth = Math.max(1.5, r * 0.12); g.beginPath(); g.arc(x - r * 1.05, y, r * 0.75, -0.9 + s, 0.9 + s); g.stroke(); g.beginPath(); g.arc(x + r * 1.05, y, r * 0.75, Math.PI - 0.9 + s, Math.PI + 0.9 + s); g.stroke(); },
  golf(g, x, y, r) { g.fillStyle = 'rgba(97,130,168,0.28)'; for (let i = 0; i < 26; i++) { const a = i * 2.4, q = Math.sqrt((i + 0.5) / 26) * r * 0.9; g.beginPath(); g.arc(x + Math.cos(a) * q, y + Math.sin(a) * q, Math.max(0.8, r * 0.07), 0, Math.PI * 2); g.fill(); } },
  pingpong(g, x, y, r) { g.strokeStyle = 'rgba(122,150,190,0.45)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r, r * 0.22, 0.3, 0, Math.PI * 2); g.stroke(); },
  stripe(g, x, y, r, s) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.save(); g.translate(x, y); g.rotate(s); g.fillRect(-r, -r * 0.18, 2 * r, r * 0.36); g.restore(); },
};

// a soft shadow on the floor
export function shadow(g, x, y, rx, ry, a = 0.22) {
  if (rx <= 0 || ry <= 0) return;
  g.save();
  g.translate(x, y); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(19,36,71,${a})`); gr.addColorStop(0.65, `rgba(19,36,71,${a * 0.55})`); gr.addColorStop(1, 'rgba(19,36,71,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
  g.restore();
}

// light that adds up: lasers, LEDs, hot spots
export function glow(g, x, y, r, color = '#00D4FF', a = 0.6) {
  if (r <= 0) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, hexA(color, a)); gr.addColorStop(0.4, hexA(color, a * 0.45)); gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function hexA(hex, a) {
  if (hex.startsWith('rgba')) return hex;
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const gg = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bb = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | bb).toString(16).slice(1);
}

export function lineSeg(g, x0, y0, x1, y1, color = LINE, lw = 2, dash = null) {
  g.save(); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1);
  g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  if (dash) g.setLineDash(dash);
  g.stroke(); g.restore();
}

export function polyline(g, pts, color = LINE, lw = 2, { dash = null, alpha = 1, close = false } = {}) {
  if (pts.length < 2) return;
  g.save(); g.globalAlpha = alpha; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
  g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round';
  if (dash) g.setLineDash(dash);
  g.stroke(); g.restore();
}

// ---------------------------------------------------------------- arrows and labels
// A bold arrow with a pale halo so it reads on any background. Returns the label box.
export function arrow(g, x0, y0, x1, y1, color, { lw = 4.5, head = 13, label = null, labelAt = 'tip', side = 1, dash = null, alpha = 1, halo = true, size = 12.5 } = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
  if (L < 2) return null;
  const ux = dx / L, uy = dy / L, h = Math.min(head, L * 0.6);
  const bx = x1 - ux * h * 0.85, by = y1 - uy * h * 0.85;
  g.save();
  g.globalAlpha = alpha;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const shaft = () => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(bx, by); };
  const tip = () => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - ux * h - uy * h * 0.55, y1 - uy * h + ux * h * 0.55); g.lineTo(x1 - ux * h + uy * h * 0.55, y1 - uy * h - ux * h * 0.55); g.closePath(); };
  if (halo) {
    g.strokeStyle = 'rgba(255,253,246,0.9)'; g.lineWidth = lw + 4; shaft(); g.stroke();
    tip(); g.lineWidth = 4; g.stroke();
  }
  g.strokeStyle = color; g.lineWidth = lw;
  if (dash) g.setLineDash(dash);
  shaft(); g.stroke();
  g.setLineDash([]);
  tip(); g.fillStyle = color; g.fill(); g.lineWidth = 1.2; g.strokeStyle = LINE; g.stroke();
  g.restore();
  if (label) {
    let lx, ly;
    if (labelAt === 'mid' || labelAt === 'side') { const off = (labelAt === 'side' ? 20 : 16) * side; lx = (x0 + x1) / 2 - uy * off; ly = (y0 + y1) / 2 + ux * off; }
    else { g.save(); g.font = `600 ${size}px ${FONT}`; const tw = g.measureText(label).width / 2 + 6; g.restore(); lx = x1 + ux * (12 + Math.abs(ux) * tw); ly = y1 + uy * (14 + Math.abs(uy) * 2); }
    return tag(g, label, lx, ly, { bg: color, fg: '#FFFFFF', size, alpha });
  }
  return null;
}

// a small rounded label. Text may contain _x for a subscript on one character run.
export function tag(g, text, x, y, { bg = '#FFFDF6', fg = INK, border = LINE, size = 12.5, weight = 600, font = FONT, align = 'center', pad = 5, r = 7, alpha = 1, lw = 1.5 } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${weight} ${size}px ${font}`;
  const w = g.measureText(text).width + pad * 2, h = size + pad * 1.4;
  let bx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  const by = y - h / 2;
  rr(g, bx, by, w, h, r);
  g.fillStyle = bg; g.fill();
  if (border) { g.lineWidth = lw; g.strokeStyle = border; g.stroke(); }
  g.fillStyle = fg; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(text, bx + pad, y + 0.5);
  g.restore();
  return { x: bx, y: by, w, h };
}

export function text(g, s, x, y, { size = 13, weight = 500, color = INK, align = 'left', baseline = 'alphabetic', font = FONT, alpha = 1, halo = null } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align; g.textBaseline = baseline;
  if (halo) { g.lineWidth = 4; g.strokeStyle = halo; g.lineJoin = 'round'; g.strokeText(s, x, y); }
  g.fillStyle = color; g.fillText(s, x, y);
  g.restore();
}

// an angle arc with a label
export function angleArc(g, cx, cy, r, a0, a1, color = COL.net, label = null) {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, a0, a1, a1 < a0);
  g.strokeStyle = color; g.lineWidth = 2.5; g.stroke();
  g.restore();
  if (label) { const am = (a0 + a1) / 2; tag(g, label, cx + Math.cos(am) * (r + 16), cy + Math.sin(am) * (r + 16), { bg: '#FFFDF6', fg: color, border: color, size: 12 }); }
}

// ---------------------------------------------------------------- energy bars
// items: [{ label, value, color }], max: the full scale. Draws a little bar chart in a card.
export function bars(g, x, y, w, h, items, max, { title = 'Energy', total = true, unit = '' } = {}) {
  g.save();
  rr(g, x, y, w, h, 10);
  g.fillStyle = 'rgba(255,253,246,0.93)'; g.fill();
  g.lineWidth = 2; g.strokeStyle = LINE; g.stroke();
  text(g, title, x + 10, y + 18, { size: 12.5, weight: 600 });
  const n = items.length, top = y + 30, bot = y + h - 26, H = bot - top;
  const bw = Math.min(30, (w - 20) / n - 10), gap = (w - 20 - n * bw) / Math.max(1, n);
  let sum = 0;
  items.forEach((it, i) => {
    const bx = x + 10 + gap / 2 + i * (bw + gap);
    const v = Math.max(0, Math.min(1.2, it.value / (max || 1)));
    sum += it.value;
    g.fillStyle = hexA(it.color, 0.16); rr(g, bx, top, bw, H, 4); g.fill();
    if (v > 0.002) { box(g, bx, bot - H * v, bw, H * v, [it.color, mixHex(it.color, '#FFFFFF', 0.45), mixHex(it.color, '#12243A', 0.3)], { r: 4, lw: 1.5, vertical: true }); }
    text(g, it.label, bx + bw / 2, y + h - 10, { size: 11, weight: 600, color: mixHex(it.color, '#12243A', 0.35), align: 'center' });
  });
  if (total && max) {
    const ty = bot - H * Math.min(1.2, sum / max);
    g.setLineDash([4, 3]); g.strokeStyle = LINE; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 8, ty); g.lineTo(x + w - 8, ty); g.stroke(); g.setLineDash([]);
  }
  g.restore();
}

// ---------------------------------------------------------------- springs, strings, rulers
// a coil spring from (x0,y0) to (x1,y1). The back of each turn is darker, so it looks 3D.
export function spring(g, x0, y0, x1, y1, { coils = 12, r = 9, lw = 2.6, color = '#8FA9C8', dark = '#4F6A8F', ends = 6 } = {}) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const body = Math.max(1, L - 2 * ends);
  const P = (s, ph) => { const along = ends + s * body; const off = Math.sin(ph) * r; return [x0 + ux * along + nx * off, y0 + uy * along + ny * off]; };
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  // straight ends
  const a = [x0 + ux * ends, y0 + uy * ends], b = [x1 - ux * ends, y1 - uy * ends];
  g.strokeStyle = LINE; g.lineWidth = lw + 2;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(a[0], a[1]); g.moveTo(b[0], b[1]); g.lineTo(x1, y1); g.stroke();
  g.strokeStyle = color; g.lineWidth = lw;
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(a[0], a[1]); g.moveTo(b[0], b[1]); g.lineTo(x1, y1); g.stroke();
  const N = coils * 16;
  // back halves first, then the front halves
  for (const front of [false, true]) {
    for (let i = 0; i < N; i++) {
      const s0 = i / N, s1 = (i + 1) / N, ph0 = s0 * coils * Math.PI * 2, ph1 = s1 * coils * Math.PI * 2;
      const isFront = Math.cos((ph0 + ph1) / 2) > 0;
      if (isFront !== front) continue;
      const p0 = P(s0, ph0), p1 = P(s1, ph1);
      g.strokeStyle = LINE; g.lineWidth = lw + (front ? 2 : 1.4);
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
      g.strokeStyle = front ? color : dark; g.lineWidth = lw;
      g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
    }
  }
  g.restore();
}

// a vertical ruler with ticks every `step` world units; Y(v) maps a value to screen y
export function rulerV(g, x, yTop, yBot, Y, v0, v1, step, { label = 'm', w = 26, major = 5, fmt = (v) => v.toFixed(1) } = {}) {
  box(g, x, Math.min(yTop, yBot) - 8, w, Math.abs(yBot - yTop) + 16, MAT.cream, { r: 3, lw: 1.5 });
  g.save(); g.strokeStyle = LINE; g.fillStyle = INK; g.font = `600 9.5px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  let k = 0;
  for (let v = v0; v <= v1 + 1e-9; v += step, k++) {
    const y = Y(v), big = k % major === 0;
    g.lineWidth = big ? 1.5 : 1;
    g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w - (big ? 9 : 5), y); g.stroke();
    if (big) g.fillText(fmt(v), x + 2, y);
  }
  g.restore();
}

// a horizontal ruler
export function rulerH(g, xL, xR, y, X, v0, v1, step, { h = 20, major = 5, fmt = (v) => v.toFixed(0) } = {}) {
  box(g, Math.min(xL, xR) - 4, y, Math.abs(xR - xL) + 8, h, MAT.cream, { r: 3, lw: 1.5 });
  g.save(); g.strokeStyle = LINE; g.fillStyle = INK; g.font = `500 10px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'bottom';
  let k = 0;
  for (let v = v0; v <= v1 + 1e-9; v += step, k++) {
    const x = X(v), big = k % major === 0;
    g.lineWidth = big ? 1.5 : 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (big ? 8 : 4)); g.stroke();
    if (big) g.fillText(fmt(v), x, y + h - 1);
  }
  g.restore();
}

// ---------------------------------------------------------------- devices
// a little LCD with glowing digits
export function lcd(g, x, y, w, h, s, { color = '#7CFFB2', label = null, size = null, bg = '#0B1A33' } = {}) {
  box(g, x, y, w, h, ['#22325C', '#3D5A92', '#16213F'], { r: 6, lw: 2 });
  g.save();
  rr(g, x + 5, y + 5, w - 10, h - 10, 4); g.fillStyle = bg; g.fill();
  const fs = size || Math.min(h - 14, 24);
  g.font = `600 ${fs}px ${PIXF}`; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 8;
  g.fillStyle = color; g.fillText(s, x + w - 11, y + h / 2 + 1);
  g.restore();
  if (label) text(g, label, x + w / 2, y - 6, { size: 11, weight: 600, align: 'center', color: INK });
}

// a stopwatch you can click; t in seconds
export function stopwatch(g, x, y, r, t, running, { hover = false } = {}) {
  g.save();
  shadow(g, x + 3, y + r + 6, r * 0.9, r * 0.25, 0.25);
  // crown and ears
  box(g, x - 5, y - r - 11, 10, 8, MAT.steel, { r: 2, lw: 2 });
  rod(g, x - r * 0.72, y - r * 0.62, x - r * 0.95, y - r * 0.9, 6, MAT.steel, { lw: 1.6 });
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#D6E9F7');
  g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = running ? '#22B07A' : '#3D6FB6'; g.stroke();
  g.lineWidth = 2; g.strokeStyle = LINE; g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.stroke();
  // ticks
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, big = i % 5 === 0;
    g.strokeStyle = big ? LINE : '#6A86A8'; g.lineWidth = big ? 1.6 : 1;
    g.beginPath(); g.moveTo(x + Math.sin(a) * (r - 3), y - Math.cos(a) * (r - 3)); g.lineTo(x + Math.sin(a) * (r - (big ? 8 : 5)), y - Math.cos(a) * (r - (big ? 8 : 5))); g.stroke();
  }
  // digits
  g.font = `600 ${Math.round(r * 0.36)}px ${PIXF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = INK;
  g.fillText(t.toFixed(2), x, y + r * 0.38);
  // hand
  const a = (t % 60) / 60 * Math.PI * 2;
  g.strokeStyle = COL.gravity; g.lineWidth = 2.5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * (r - 9), y - Math.cos(a) * (r - 9)); g.stroke();
  g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fillStyle = LINE; g.fill();
  if (hover) { g.beginPath(); g.arc(x, y, r + 7, 0, Math.PI * 2); g.strokeStyle = 'rgba(0,169,214,0.55)'; g.lineWidth = 3; g.stroke(); }
  g.restore();
}

// ring that pulses, to point at something in a walkthrough
export function pulse(g, x, y, r, t, color = '#00A9D6') {
  const k = (t * 1.6) % 1;
  g.save();
  g.strokeStyle = hexA(color, 0.9 * (1 - k)); g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, r + k * r * 0.6, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = hexA(color, 0.85); g.lineWidth = 2.5; g.setLineDash([6, 5]); g.lineDashOffset = -t * 20;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- backgrounds
// the back wall of a room with a floor in front; returns { floorY }
export function room(g, w, h, theme = THEME[1], { floorH = 0.16, panels = true, window = null } = {}) {
  const fy = Math.round(h * (1 - floorH));
  const gr = g.createLinearGradient(0, 0, 0, fy);
  gr.addColorStop(0, mixHex(theme.wall, '#FFFFFF', 0.25)); gr.addColorStop(1, theme.wall);
  g.fillStyle = gr; g.fillRect(0, 0, w, fy);
  if (panels) {
    g.strokeStyle = hexA(theme.wall2, 0.9); g.lineWidth = 2;
    const step = Math.max(90, w / 7);
    for (let x = step / 2; x < w; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, fy - 14); g.stroke(); }
    g.beginPath(); g.moveTo(0, fy * 0.42); g.lineTo(w, fy * 0.42); g.stroke();
  }
  if (window) window(g, fy);
  // skirting board
  g.fillStyle = theme.trim; g.fillRect(0, fy - 14, w, 14);
  g.fillStyle = theme.trimD; g.fillRect(0, fy - 4, w, 4);
  g.fillStyle = mixHex(theme.trim, '#FFFFFF', 0.4); g.fillRect(0, fy - 14, w, 2);
  // floor
  const fg = g.createLinearGradient(0, fy, 0, h);
  fg.addColorStop(0, theme.floor); fg.addColorStop(1, theme.floorD);
  g.fillStyle = fg; g.fillRect(0, fy, w, h - fy);
  g.strokeStyle = hexA(theme.floorD, 0.55); g.lineWidth = 1;
  for (let k = 1; k < 4; k++) { const yy = fy + (h - fy) * (k / 4) ** 1.4; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke(); }
  // boards running towards you, spreading out as they come closer
  g.strokeStyle = hexA(theme.floorD, 0.4);
  const vx = w / 2, n = Math.ceil(w / 70) + 6;
  for (let i = -n; i <= n; i++) { const x0 = vx + i * 42, x1 = vx + i * 42 * 1.9; g.beginPath(); g.moveTo(x0, fy); g.lineTo(x1, h); g.stroke(); }
  // a soft shadow where the wall meets the floor
  const sg = g.createLinearGradient(0, fy, 0, fy + 18);
  sg.addColorStop(0, 'rgba(19,36,71,0.18)'); sg.addColorStop(1, 'rgba(19,36,71,0)');
  g.fillStyle = sg; g.fillRect(0, fy, w, 18);
  return { floorY: fy };
}

// a wooden lab bench top seen slightly from above: top surface from y to y+d, front face below
export function benchTop(g, x, y, w, d, face = 18, mat = MAT.wood) {
  const [base, light, dark] = mat;
  g.save();
  g.fillStyle = light; g.fillRect(x, y, w, d);
  g.strokeStyle = hexA(dark, 0.25); g.lineWidth = 1;
  for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x, y + d * k / 4); g.lineTo(x + w, y + d * k / 4); g.stroke(); }
  g.fillStyle = base; g.fillRect(x, y + d, w, face);
  g.fillStyle = dark; g.fillRect(x, y + d + face - 4, w, 4);
  g.lineWidth = 2; g.strokeStyle = LINE; g.strokeRect(x, y, w, d + face);
  g.beginPath(); g.moveTo(x, y + d); g.lineTo(x + w, y + d); g.stroke();
  g.restore();
}

// a window to somewhere else, used by the gravity rooms (Earth, Moon, Mars, ...)
export function scenery(g, x, y, w, h, kind, t = 0) {
  g.save();
  rr(g, x, y, w, h, 8); g.clip();
  const sky = {
    earth: ['#8FD3FF', '#D9F2FF'], moon: ['#0B1630', '#22325C'], mars: ['#E8A47A', '#F7D2B0'],
    jupiter: ['#0B1630', '#3A2F6B'], x: ['#2B1B5E', '#7B5CF0'], vac: ['#0B1630', '#1D3160'],
  }[kind] || ['#8FD3FF', '#D9F2FF'];
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  if (kind === 'moon' || kind === 'jupiter' || kind === 'x' || kind === 'vac') {
    for (let i = 0; i < 26; i++) { const sx = x + ((i * 97) % w), sy = y + ((i * 53) % (h * 0.7)); g.fillStyle = `rgba(255,255,255,${0.4 + 0.5 * Math.abs(Math.sin(i + t * 0.7))})`; g.fillRect(sx, sy, 2, 2); }
  }
  if (kind === 'earth') {
    for (let k = 0; k < 3; k++) { const cx = x + ((k * 0.37 * w + t * 8) % (w + 60)) - 30, cy = y + h * (0.2 + k * 0.12); g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(cx, cy, 22, 7, 0, 0, Math.PI * 2); g.ellipse(cx + 12, cy - 5, 12, 7, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#7CCB8A'; g.beginPath(); g.moveTo(x, y + h); g.quadraticCurveTo(x + w * 0.3, y + h * 0.68, x + w * 0.6, y + h * 0.8); g.quadraticCurveTo(x + w * 0.85, y + h * 0.9, x + w, y + h * 0.74); g.lineTo(x + w, y + h); g.fill();
  } else if (kind === 'moon') {
    g.fillStyle = '#C9D6E6'; g.beginPath(); g.ellipse(x + w * 0.5, y + h * 1.05, w * 0.9, h * 0.35, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#A9BCD3'; for (const [cx, cy, rr2] of [[0.3, 0.86, 0.08], [0.62, 0.92, 0.05], [0.8, 0.84, 0.04]]) { g.beginPath(); g.ellipse(x + w * cx, y + h * cy, w * rr2, w * rr2 * 0.35, 0, 0, Math.PI * 2); g.fill(); }
    ball(g, x + w * 0.8, y + h * 0.25, Math.min(w, h) * 0.12, ['#4C9BE8', '#BFE6FF', '#1F5FA8'], { lw: 0 });
  } else if (kind === 'mars') {
    g.fillStyle = '#C9663F'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + h * 0.75); g.lineTo(x + w * 0.25, y + h * 0.6); g.lineTo(x + w * 0.45, y + h * 0.72); g.lineTo(x + w * 0.7, y + h * 0.55); g.lineTo(x + w, y + h * 0.7); g.lineTo(x + w, y + h); g.fill();
    g.fillStyle = '#E38B5C'; g.fillRect(x, y + h * 0.86, w, h);
  } else if (kind === 'jupiter') {
    const R = Math.max(w, h) * 0.7, cx = x + w * 0.65, cy = y + h * 1.15;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    const bands = ['#F2D2A6', '#D9A066', '#F7E2C2', '#C98A4E', '#EFC9A0', '#B97A40'];
    for (let i = 0; i < 12; i++) { g.fillStyle = bands[i % bands.length]; g.fillRect(cx - R, cy - R + i * (2 * R / 12), 2 * R, 2 * R / 12 + 1); }
    g.fillStyle = '#C9563F'; g.beginPath(); g.ellipse(cx - R * 0.3, cy - R * 0.55, R * 0.12, R * 0.06, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  } else if (kind === 'x') {
    g.fillStyle = '#4B33B0'; g.beginPath(); g.ellipse(x + w * 0.5, y + h * 1.1, w * 0.9, h * 0.38, 0, 0, Math.PI * 2); g.fill();
    ball(g, x + w * 0.25, y + h * 0.3, Math.min(w, h) * 0.1, ['#FF8FAB', '#FFD0DC', '#C9446A'], { lw: 0 });
    ball(g, x + w * 0.75, y + h * 0.22, Math.min(w, h) * 0.06, ['#9BE3C1', '#E0FFF0', '#3FAF7E'], { lw: 0 });
  }
  g.restore();
  // frame
  rr(g, x, y, w, h, 8); g.lineWidth = 6; g.strokeStyle = '#FFFDF6'; g.stroke();
  g.lineWidth = 2; g.strokeStyle = LINE; rr(g, x - 3, y - 3, w + 6, h + 6, 10); g.stroke(); rr(g, x + 3, y + 3, w - 6, h - 6, 6); g.stroke();
}

// ---------------------------------------------------------------- particles
export class Particles {
  constructor(max = 400) { this.p = []; this.max = max; }
  emit(n, f) { for (let i = 0; i < n && this.p.length < this.max; i++) this.p.push(f(i)); }
  update(dt, gravity = 0) {
    for (const q of this.p) { q.vy += (q.g ?? gravity) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; if (q.spin) q.a = (q.a || 0) + q.spin * dt; }
    this.p = this.p.filter((q) => q.life > 0);
  }
  draw(g) {
    for (const q of this.p) {
      const a = Math.max(0, Math.min(1, q.life / (q.fade || 0.4)));
      g.save(); g.globalAlpha = a;
      if (q.kind === 'confetti') { g.translate(q.x, q.y); g.rotate(q.a || 0); g.fillStyle = q.c; g.fillRect(-q.s, -q.s * 0.45, q.s * 2, q.s * 0.9); }
      else if (q.kind === 'spark') { glow(g, q.x, q.y, q.s * 3, q.c, 0.8); }
      else { g.fillStyle = q.c; g.beginPath(); g.arc(q.x, q.y, q.s, 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
  }
  clear() { this.p = []; }
}

export const CONFETTI = ['#E5534B', '#FFD54F', '#22B07A', '#3D7FD6', '#B9A8FF', '#FF8FAB', '#00D4FF'];
export function confetti(parts, x, y, n = 40) {
  parts.emit(n, () => ({ kind: 'confetti', x, y, vx: (Math.random() - 0.5) * 360, vy: -120 - Math.random() * 260, g: 520, life: 1.2 + Math.random() * 0.8, fade: 0.5, s: 3 + Math.random() * 3, c: CONFETTI[(Math.random() * CONFETTI.length) | 0], spin: (Math.random() - 0.5) * 12 }));
}
