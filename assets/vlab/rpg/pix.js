// Pixel-art toolkit for the virtual building: the palette, a tiny painter, sprites from text rows,
// recolouring and an automatic outline pass. Everything in the game is drawn by this code; there
// are no image files. The palette has no neutral greys: "metal" is a cool blue, shadows are navy.

export const PAL = {
  out: '#1B2440',     // outline
  ink: '#22325C', navy: '#2E4A7D', blue: '#3D6FB6', sky: '#6FB7F0', ice: '#A8ECFF', mist: '#EAF6FC',
  snow: '#FFFDF6', cream: '#FFF2D6', sand: '#F2D9A6', tan: '#E0B47C',
  cyan: '#00D4FF', teal: '#00A9D6', deep: '#00739E',
  woodL: '#E9B77E', wood: '#C98A4E', woodD: '#8E5A35', bark: '#5C3A2A',
  red: '#E5534B', redD: '#B3243B', pink: '#FF8FAB', blush: '#FFB3C1', rose: '#E0457B',
  orange: '#F29E4C', orangeD: '#C96F2A', gold: '#E8C25A', yellow: '#FFE07A',
  green: '#4CB782', greenD: '#2F7D5B', mint: '#9BE3C1', leaf: '#62C46E', leafD: '#3A9A55',
  violet: '#6B5BE6', lav: '#B9A8FF', lilac: '#E4DCFF', plum: '#4A3A8C',
  steel: '#9DB8D3', steelL: '#CFE0F0', steelD: '#6A86A8', steelX: '#4F6A8F',
  copper: '#D9824A', copperL: '#F0A878', copperD: '#A85A2C', brass: '#D8B04A', brassD: '#A8842A',
  skin: '#FFD7B8', skinD: '#F2B48E',
  glass: '#BFEFFF', night: '#132447',
};

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return c;
}

// A painter bound to a 2D context. All coordinates are whole pixels.
export class Pix {
  constructor(w, h, ctx) {
    if (ctx) { this.g = ctx; this.c = ctx.canvas; } else { this.c = canvas(w, h); this.g = this.c.getContext('2d'); }
    this.w = w; this.h = h; this.ox = 0; this.oy = 0;
  }
  at(ox, oy) { this.ox = ox; this.oy = oy; return this; }
  px(x, y, c) { this.g.fillStyle = c; this.g.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, 1, 1); return this; }
  rect(x, y, w, h, c) { if (w <= 0 || h <= 0) return this; this.g.fillStyle = c; this.g.fillRect(Math.round(x) + this.ox, Math.round(y) + this.oy, Math.round(w), Math.round(h)); return this; }
  hl(x, y, w, c) { return this.rect(x, y, w, 1, c); }
  vl(x, y, h, c) { return this.rect(x, y, 1, h, c); }
  // filled circle that looks round at small sizes
  disc(cx, cy, r, c) {
    this.g.fillStyle = c;
    for (let y = -r; y <= r; y++) {
      const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y) + r * 0.35));
      this.g.fillRect(Math.round(cx - w) + this.ox, Math.round(cy + y) + this.oy, 2 * w + 1, 1);
    }
    return this;
  }
  // filled ellipse centred on a pixel grid (even sizes allowed through x0,y0,w,h)
  oval(x0, y0, w, h, c) {
    this.g.fillStyle = c;
    const rx = w / 2, ry = h / 2, cx = x0 + rx, cy = y0 + ry;
    for (let j = 0; j < h; j++) {
      const yy = (j + 0.5 - ry) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - yy * yy));
      const a = Math.round(cx - half), b = Math.round(cx + half);
      if (b > a) this.g.fillRect(a + this.ox, y0 + j + this.oy, b - a, 1);
    }
    return this;
  }
  ring(cx, cy, r, c) {
    let x = r, y = 0, err = 1 - r;
    const p = (a, b) => this.px(cx + a, cy + b, c);
    while (x >= y) {
      p(x, y); p(y, x); p(-y, x); p(-x, y); p(-x, -y); p(-y, -x); p(y, -x); p(x, -y);
      y++;
      if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
    }
    return this;
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 4000; i++) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  // checker dither inside a rectangle
  dither(x, y, w, h, c, phase = 0) {
    this.g.fillStyle = c;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (((i + j + phase) & 1) === 0) this.g.fillRect(x + i + this.ox, y + j + this.oy, 1, 1);
    return this;
  }
  // a block seen from above and the front: top face (w x d) over a front face (w x h)
  block(x, y, w, d, h, { top, front, edge, shade, rim } = {}) {
    this.rect(x, y, w, d, top);
    if (rim) this.hl(x, y, w, rim);
    this.rect(x, y + d, w, h, front);
    if (edge) this.hl(x, y + d, w, edge);
    if (shade) this.hl(x, y + d + h - 1, w, shade);
    return this;
  }
  draw(img, x, y, w, h) {
    if (w !== undefined) this.g.drawImage(img, Math.round(x) + this.ox, Math.round(y) + this.oy, w, h);
    else this.g.drawImage(img, Math.round(x) + this.ox, Math.round(y) + this.oy);
    return this;
  }
  text(s, x, y, c) { tinyText(this, s, x, y, c); return this; }
}

// Sprite from rows of characters; key maps a character to a colour ('.' and ' ' are clear).
export function fromRows(rows, key, pad = 0) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const P = new Pix(w + 2 * pad, h + 2 * pad);
  for (let y = 0; y < h; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    if (ch === '.' || ch === ' ') continue;
    const col = key[ch];
    if (col) P.px(x + pad, y + pad, col);
  }
  return P.c;
}

// Add a one-pixel outline around everything opaque (4-neighbour, so corners stay soft).
export function outline(src, color = PAL.out, { diag = false } = {}) {
  const w = src.width, h = src.height;
  const g = src.getContext('2d');
  const im = g.getImageData(0, 0, w, h), d = im.data;
  const out = new Uint8ClampedArray(d);
  const [r, gg, b] = hex(color);
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] > 40) continue;
    let n = op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1);
    if (!n && diag) n = op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1);
    if (n) { out[i] = r; out[i + 1] = gg; out[i + 2] = b; out[i + 3] = 255; }
  }
  const c = canvas(w, h);
  c.getContext('2d').putImageData(new ImageData(out, w, h), 0, 0);
  return c;
}

// Swap colours: map of '#rrggbb' -> '#rrggbb'
export function recolor(src, map) {
  const w = src.width, h = src.height;
  const im = src.getContext('2d').getImageData(0, 0, w, h), d = im.data;
  const m = new Map(Object.entries(map).map(([a, b]) => [hex(a).join(','), hex(b)]));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const t = m.get(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    if (t) { d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; }
  }
  const c = canvas(w, h);
  c.getContext('2d').putImageData(im, 0, 0);
  return c;
}

export function flipX(src) {
  const c = canvas(src.width, src.height), g = c.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  return c;
}

export function hex(c) {
  const s = c.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// 3x5 pixel font for tiny labels drawn into the art (signs, screens, floor numbers)
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '010101101101010', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100110101010', 7: '111001010010010', 8: '010101010101010',
  9: '010101011001110', ' ': '000000000000000', '.': '000000000000010', ':': '000010000010000', '-': '000000111000000',
  '+': '000010111010000', '=': '000111000111000', '/': '001001010100100', '?': '110001010000010', '!': '010010010000010',
  '²': '110010100111000', '(': '010100100100010', ')': '010001001001010', '°': '010101010000000', '>': '100010001010100',
  '<': '001010100010001', '%': '101001010100101', '*': '000101010101000', ',': '000000000010100', "'": '010010000000000',
  'μ': '000101101110100', '×': '000101010101000', '~': '000011110000000', 'π': '111101101101101', 'Π': '111101101101101', 'Μ': '000101101110100', 'Ω': '010101101010101',
  'Λ': '010101101101101', '^': '010101000000000', '_': '000000000000111', '#': '101111101111101', '&': '010101010101011',
};
export function tinyText(P, s, x, y, c) {
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const f = FONT[ch] || FONT['?'];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (f[j * 3 + i] === '1') P.px(cx + i, y + j, c);
    cx += 4;
  }
  return cx - x - 1;
}
export function tinyWidth(s) { return String(s).length * 4 - 1; }

// Text in a Korean pixel font (Galmuri, SIL OFL): drawn at the font's own pixel size and snapped to
// whole pixels, so Hangul signs sit in the pixel art. size 8 = Galmuri7, 12 = Galmuri 11.
// The fonts must have loaded first (building.js waits for them); returns the width in pixels.
const hgCache = new Map();
function hangulMask(s, size) {
  const key = size + '|' + s;
  if (hgCache.has(key)) return hgCache.get(key);
  const fam = size <= 8 ? '"Galmuri7"' : '"Galmuri"';
  const w = Math.ceil(s.length * size * 1.1 + 4), h = Math.ceil(size * 1.4) + 2;
  const cv = canvas(w, h), g = cv.getContext('2d');
  g.font = `${size}px ${fam}, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif`;
  g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
  const asc = Math.round(size * (size <= 8 ? 1 : 1));
  g.fillText(s, 0, asc);
  const tw = Math.ceil(g.measureText(s).width), d = g.getImageData(0, 0, w, h).data, pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 110) pts.push(x, y);
  const m = { w: tw, h: size + 2, pts };
  hgCache.set(key, m);
  return m;
}
export function hangul(P, s, x, y, c, { size = 8 } = {}) {
  const m = hangulMask(s, size);
  for (let i = 0; i < m.pts.length; i += 2) P.px(x + m.pts[i], y + m.pts[i + 1], c);
  return m.w;
}
export function hangulWidth(s, size = 8) { return hangulMask(s, size).w; }
