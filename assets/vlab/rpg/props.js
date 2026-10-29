// Furniture and apparatus. Each type has a footprint in tiles, a sprite drawn once (and
// outlined), and optionally an animation painted every frame on top of the sprite.
// Sprites stand on the bottom edge of their footprint and are centred on it.

import { PAL, Pix, outline, tinyText, tinyWidth, mix, hangul, hangulWidth } from './pix.js';
import { isKo } from '../i18n.js';

const C = PAL;

// paint a sprite of w x h with a one-pixel margin for the outline
function make(w, h, fn, line = true) {
  const P = new Pix(w + 2, h + 2).at(1, 1);
  fn(P);
  return line ? outline(P.c) : P.c;
}

export const TONES = {
  teal: ['#3FC1D9', '#1F95B0', '#8FE3F2'],
  rose: ['#FF8FAB', '#E0457B', '#FFC2D1'],
  lav: ['#B9A8FF', '#8C76F0', '#DCD3FF'],
  gold: ['#FFD27A', '#E0A93B', '#FFE9B3'],
  mint: ['#7FDDB0', '#3FAF7E', '#C2F2DA'],
  navy: ['#3D6FB6', '#2E4A7D', '#6FB7F0'],
  orange: ['#FFB46B', '#E08A3B', '#FFD5A8'],
};

// ---------------------------------------------------------------- decor
const D = {};

D.plant = { w: 1, h: 1, sprite: (o) => make(16, 26, (P) => {
  if (o.kind === 'tall') {
    for (const [x, h, c] of [[4, 14, C.leafD], [7, 18, C.leaf], [10, 15, C.leafD], [12, 11, C.leaf], [6, 10, C.leaf]]) {
      P.rect(x, 18 - h, 2, h, c); P.px(x, 18 - h, C.mint);
    }
  } else {
    P.disc(5, 9, 4, C.leafD); P.disc(10, 7, 5, C.leaf); P.disc(4, 14, 3, C.leaf); P.disc(12, 13, 3, C.leafD); P.disc(8, 4, 3, C.leaf);
    P.px(10, 5, C.mint); P.px(9, 6, C.mint); P.px(11, 6, C.mint); P.px(4, 12, C.mint); P.px(7, 3, C.mint); P.px(5, 8, C.leaf);
    P.vl(8, 11, 8, C.leafD);
  }
  const pot = o.pot || 'copper';
  const [a, b, d] = pot === 'copper' ? [C.copper, C.copperL, C.copperD] : TONES[pot] ? [TONES[pot][0], TONES[pot][2], TONES[pot][1]] : [C.snow, '#FFFFFF', C.steelL];
  P.rect(3, 18, 10, 2, b); P.rect(4, 20, 8, 6, a); P.vl(10, 20, 6, d); P.hl(4, 25, 8, d);
}) };

D.sofa = { w: 3, h: 1, sprite: (o) => make(48, 24, (P) => {
  const [m, s, h] = TONES[o.tone || 'teal'];
  P.rect(4, 0, 40, 10, m); P.hl(4, 0, 40, h); P.hl(4, 9, 40, s);
  P.rect(5, 10, 38, 7, h); P.vl(17, 10, 7, m); P.vl(30, 10, 7, m);
  P.rect(4, 17, 40, 6, s); P.hl(4, 22, 40, mix(s, C.out, 0.4));
  P.rect(0, 5, 6, 18, m); P.hl(0, 5, 6, h); P.rect(42, 5, 6, 18, m); P.hl(42, 5, 6, h);
  P.vl(5, 6, 17, s); P.vl(42, 6, 17, s);
  P.rect(2, 23, 2, 1, C.woodD); P.rect(44, 23, 2, 1, C.woodD);
}) };

D.armchair = { w: 1, h: 1, sprite: (o) => make(16, 20, (P) => {
  const [m, s, h] = TONES[o.tone || 'gold'];
  P.rect(2, 0, 12, 8, m); P.hl(2, 0, 12, h);
  P.rect(3, 8, 10, 5, h); P.rect(2, 13, 12, 6, s);
  P.rect(0, 4, 3, 15, m); P.rect(13, 4, 3, 15, m); P.hl(0, 4, 3, h); P.hl(13, 4, 3, h);
}) };

D.table = { w: 2, h: 1, sprite: (o) => make(32, 16, (P) => {
  P.rect(0, 0, 32, 7, C.woodL); P.hl(0, 0, 32, '#F6CF9C'); P.rect(0, 7, 32, 3, C.wood); P.hl(0, 9, 32, C.woodD);
  P.rect(1, 10, 2, 6, C.woodD); P.rect(29, 10, 2, 6, C.woodD);
  if (o.cups !== false) {
    P.rect(6, 1, 4, 3, C.snow); P.hl(6, 1, 4, C.bark); P.px(10, 2, C.snow);
    P.rect(21, 2, 6, 3, C.rose); P.hl(21, 2, 6, C.pink);
    P.rect(14, 1, 3, 3, C.snow); P.hl(14, 1, 3, C.teal);
  }
}) };

D.counter = { w: 3, h: 1, sprite: () => make(48, 22, (P) => {
  P.rect(0, 0, 48, 8, C.snow); P.hl(0, 0, 48, '#FFFFFF'); P.hl(0, 7, 48, C.steelL);
  P.rect(0, 8, 48, 14, C.navy); P.hl(0, 8, 48, C.blue); P.hl(0, 21, 48, C.ink);
  P.rect(0, 11, 48, 2, C.cyan);
  tinyText(P, 'WELCOME', 10, 15, C.ice);
  // a bell and a little screen
  P.rect(5, 3, 5, 2, C.gold); P.px(7, 2, C.gold);
  P.rect(36, 1, 8, 5, C.steelD); P.rect(37, 2, 6, 3, C.night); P.hl(38, 3, 3, C.cyan);
}) };

D.directory = { w: 3, h: 1, sprite: (o) => {
  // Korean: the floor number sits in the coloured square, so the names fit
  if (isKo) return make(66, 42, (P) => {
    P.rect(30, 30, 6, 12, C.steelD); P.rect(25, 40, 16, 2, C.steelX);
    P.rect(0, 0, 66, 31, C.night); P.rect(1, 1, 64, 29, '#1A3566'); P.hl(1, 1, 64, C.cyan);
    [['3', '마그논 연구실'], ['2', '물리 놀이터'], ['1', '고전 물리관']].forEach(([n, t], i) => {
      P.rect(3, 4 + i * 9, 7, 7, [C.cyan, C.lav, C.gold][i]); tinyText(P, n, 5, 5 + i * 9, '#14244A');
      hangul(P, t, 12, 3 + i * 9, '#DDF6FF', { size: 8 });
    });
  });
  return make(60, 34, (P) => {
    P.rect(27, 22, 6, 12, C.steelD); P.rect(22, 32, 16, 2, C.steelX);
    P.rect(0, 0, 60, 23, C.night); P.rect(1, 1, 58, 21, '#1A3566');
    P.hl(1, 1, 58, C.cyan);
    const lines = o.lines || ['3F MAGNONICS', '2F PLAYGROUND', '1F CLASSICS'];
    lines.forEach((t, i) => { P.rect(3, 4 + i * 6, 3, 4, [C.cyan, C.lav, C.gold][i % 3]); tinyText(P, t, 7, 4 + i * 6, '#DDF6FF'); });
  });
} };

D.coffee = { w: 1, h: 1, sprite: () => make(16, 26, (P) => {
  P.rect(1, 0, 14, 26, C.redD); P.rect(1, 0, 14, 3, C.red); P.hl(1, 0, 14, C.pink);
  P.rect(3, 5, 10, 5, C.night); P.hl(4, 7, 4, C.cyan); P.px(10, 7, C.yellow);
  P.rect(4, 12, 8, 7, C.out); P.rect(6, 15, 4, 4, C.snow); P.hl(6, 15, 4, C.bark);
  P.rect(1, 21, 14, 5, C.ink); P.hl(1, 21, 14, C.navy);
}) };

D.vending = { w: 1, h: 1, sprite: (o) => make(16, 30, (P) => {
  const [m, s, h] = TONES[o.tone || 'rose'];
  P.rect(0, 0, 16, 30, m); P.hl(0, 0, 16, h); P.vl(15, 0, 30, s);
  P.rect(2, 3, 9, 19, C.glass);
  const cols = [C.red, C.yellow, C.green, C.cyan, C.violet, C.orange];
  for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) { P.rect(3 + i * 3, 4 + r * 5, 2, 3, cols[(r * 3 + i) % 6]); P.hl(2, 7 + r * 5, 9, C.steelD); }
  P.rect(12, 5, 3, 6, C.night); P.px(13, 7, C.cyan);
  P.rect(2, 24, 9, 4, C.out); P.hl(3, 25, 7, C.navy);
}) };

D.bookshelf = { w: 2, h: 1, sprite: () => make(32, 34, (P) => {
  P.rect(0, 0, 32, 34, C.wood); P.hl(0, 0, 32, C.woodL); P.vl(31, 0, 34, C.woodD);
  const cols = [C.red, C.teal, C.gold, C.violet, C.green, C.rose, C.navy, C.orange, C.sky];
  for (let s = 0; s < 3; s++) {
    const y = 2 + s * 10;
    P.rect(2, y, 28, 8, C.bark);
    let x = 3, k = s * 3;
    while (x < 28) {
      const w = 2 + ((k * 7) % 3 === 0 ? 1 : 0), hh = 6 + (k % 3 === 0 ? 0 : 1), c = cols[k % cols.length];
      if (k % 5 !== 4) { P.rect(x, y + 8 - hh, w, hh, c); P.px(x, y + 8 - hh + 1, mix(c, '#FFFFFF', 0.5)); }
      x += w + (k % 4 === 0 ? 1 : 0); k++;
    }
    P.hl(1, y + 8, 30, C.woodL);
  }
}) };

D.desk = { w: 2, h: 1, sprite: (o) => make(32, 22, (P) => {
  P.rect(0, 6, 32, 7, C.snow); P.hl(0, 6, 32, '#FFFFFF'); P.rect(0, 13, 32, 3, C.steelL); P.hl(0, 15, 32, C.steel);
  P.rect(1, 16, 2, 6, C.steelD); P.rect(29, 16, 2, 6, C.steelD);
  // laptop
  P.rect(9, 0, 14, 9, C.steelD); P.rect(10, 1, 12, 7, C.night);
  if (o.screen !== 'off') { P.hl(11, 3, 6, C.cyan); P.hl(11, 5, 9, C.lav); }
  P.rect(8, 9, 16, 2, C.steel);
  P.rect(26, 7, 3, 3, C.rose);
}) };

D.chair = { w: 1, h: 1, sprite: (o) => make(14, 18, (P) => {
  const [m, s, h] = TONES[o.tone || 'navy'];
  P.rect(2, 0, 10, 8, m); P.hl(2, 0, 10, h);
  P.rect(1, 8, 12, 4, h); P.hl(1, 11, 12, s);
  P.vl(6, 12, 4, C.steelX); P.hl(2, 16, 10, C.steelX); P.px(2, 17, C.out); P.px(11, 17, C.out);
}) };

D.beanbag = { w: 1, h: 1, sprite: (o) => make(16, 14, (P) => {
  const [m, s, h] = TONES[o.tone || 'lav'];
  P.oval(0, 2, 16, 12, m); P.oval(2, 0, 10, 7, h); P.hl(3, 12, 10, s); P.px(4, 2, '#FFFFFF');
}) };

D.lamp = { w: 1, h: 1, sprite: () => make(12, 30, (P) => {
  P.oval(0, 0, 12, 8, C.yellow); P.hl(2, 0, 8, '#FFF6C8'); P.hl(1, 7, 10, C.gold);
  P.vl(5, 8, 20, C.steelX); P.rect(2, 27, 8, 3, C.steelX);
}) };

D.cooler = { w: 1, h: 1, sprite: () => make(14, 28, (P) => {
  P.rect(3, 0, 8, 10, C.ice); P.hl(4, 1, 6, '#FFFFFF'); P.rect(5, 2, 2, 6, '#D9F7FF');
  P.rect(1, 10, 12, 18, C.snow); P.vl(12, 10, 18, C.steelL); P.rect(4, 14, 2, 2, C.red); P.rect(8, 14, 2, 2, C.teal);
}) };

D.sign = { w: 1, h: 1, sprite: (o) => {
  const t = o.text || 'HELLO', w = t.length * 4 + 7;
  return make(w, 22, (P) => {
    const [m, s, h] = TONES[o.tone || 'teal'];
    P.rect(0, 0, w, 11, s); P.rect(1, 1, w - 2, 9, m); P.hl(1, 1, w - 2, h);
    tinyText(P, t, 4, 3, C.out);
    P.vl(Math.floor(w / 2) - 1, 11, 10, C.woodD); P.vl(Math.floor(w / 2), 11, 10, C.wood);
    P.rect(Math.floor(w / 2) - 3, 20, 6, 2, C.woodD);
  });
} };

D.boxes = { w: 1, h: 1, sprite: () => make(16, 16, (P) => {
  P.rect(0, 6, 10, 10, C.tan); P.hl(0, 6, 10, C.sand); P.vl(4, 6, 10, C.wood); P.hl(0, 10, 10, C.wood);
  P.rect(8, 0, 8, 9, C.sand); P.hl(8, 0, 8, C.cream); P.vl(11, 0, 9, C.tan);
}) };

D.arcade = { w: 1, h: 1, sprite: () => make(16, 30, (P) => {
  P.rect(0, 0, 16, 30, C.violet); P.hl(0, 0, 16, C.lav); P.vl(15, 0, 30, C.plum);
  P.rect(2, 3, 12, 4, C.plum); tinyText(P, 'GO', 4, 3, C.yellow);
  P.rect(2, 8, 12, 9, C.night); P.rect(4, 10, 3, 3, C.pink); P.rect(9, 12, 3, 3, C.cyan); P.hl(3, 15, 10, C.green);
  P.rect(1, 18, 14, 4, C.ink); P.px(4, 19, C.red); P.px(8, 19, C.yellow); P.px(10, 20, C.cyan);
}) };

D.snackbar = { w: 3, h: 1, sprite: () => make(48, 26, (P) => {
  P.rect(0, 6, 48, 6, C.woodL); P.hl(0, 6, 48, '#F6CF9C');
  P.rect(0, 12, 48, 14, C.orange); P.hl(0, 12, 48, C.yellow); P.hl(0, 25, 48, C.orangeD);
  for (let i = 0; i < 48; i += 8) P.rect(i, 12, 4, 14, '#FFC98F');
  // fruit bowl, a jar of cookies, cups
  P.oval(4, 0, 10, 7, C.snow); P.disc(7, 2, 2, C.red); P.disc(11, 2, 2, C.gold); P.disc(9, 1, 1, C.green);
  P.rect(20, 0, 7, 7, C.glass); P.rect(21, 3, 5, 3, C.tan); P.px(22, 4, C.bark); P.px(24, 3, C.bark); P.hl(20, 0, 7, C.steelD);
  P.rect(33, 2, 3, 4, C.snow); P.rect(38, 2, 3, 4, C.pink); P.rect(43, 2, 3, 4, C.ice);
}) };

D.server = { w: 1, h: 1, sprite: (o) => make(16, 30, (P) => {
  P.rect(0, 0, 16, 30, C.ink); P.hl(0, 0, 16, C.navy); P.vl(15, 0, 30, C.out);
  for (let r = 0; r < 6; r++) { P.rect(2, 2 + r * 4, 12, 3, C.night); P.hl(3, 3 + r * 4, 6, '#1A3566'); }
}), anim(P, x, y, t, o) {
  for (let r = 0; r < 6; r++) {
    const on = ((Math.floor(t * 3 + r * 1.7 + (o.seed || 0)) % 3) !== 0);
    P.px(x + 12, y + 4 + r * 4, on ? C.cyan : C.navy);
    P.px(x + 10, y + 4 + r * 4, ((Math.floor(t * 5 + r)) % 4) ? C.green : C.navy);
  }
} };

D.trash = { w: 1, h: 1, sprite: () => make(10, 12, (P) => {
  P.rect(0, 0, 10, 2, C.teal); P.rect(1, 2, 8, 10, C.deep); P.vl(3, 3, 8, C.teal); P.vl(6, 3, 8, C.teal);
}) };

D.whiteboard = { w: 2, h: 1, sprite: (o) => make(32, 30, (P) => {
  P.rect(0, 0, 32, 20, C.steelL); P.rect(1, 1, 30, 18, '#FFFFFF');
  P.line(4, 14, 9, 6, C.blue); P.line(9, 6, 14, 14, C.blue); P.line(14, 14, 19, 6, C.blue); P.line(19, 6, 24, 14, C.blue);
  P.hl(4, 16, 22, C.red); tinyText(P, o.text || 'F=MA', 4, 2, C.ink);
  P.vl(4, 20, 10, C.steelD); P.vl(27, 20, 10, C.steelD); P.hl(2, 29, 6, C.steelX); P.hl(25, 29, 6, C.steelX);
}) };

// a rug lies on the floor (no outline, not solid)
D.rug = { w: 3, h: 2, floor: true, sprite: (o) => {
  const w = (o.w || 3) * 16, h = (o.h || 2) * 16, [m, s, hh] = TONES[o.tone || 'teal'];
  const P = new Pix(w, h);
  P.rect(0, 0, w, h, s); P.rect(2, 2, w - 4, h - 4, m);
  for (let j = 4; j < h - 4; j++) for (let i = 4; i < w - 4; i++) if (((i + j) % 8 === 0) || ((i - j + 64) % 8 === 0)) P.px(i, j, hh);
  P.rect(0, 0, w, 1, mix(s, C.out, 0.3)); P.rect(0, h - 1, w, 1, mix(s, C.out, 0.3));
  for (let i = 1; i < w; i += 3) { P.px(i, 0, hh); P.px(i, h - 1, hh); }
  return P.c;
} };

D.doormat = { w: 2, h: 1, floor: true, sprite: () => {
  const P = new Pix(32, 16);
  P.rect(1, 3, 30, 11, C.bark); P.rect(3, 5, 26, 7, C.woodD);
  for (let i = 4; i < 29; i += 2) P.vl(i, 6, 5, C.wood);
  return P.c;
} };

// a painted patch on the floor: x marks and lane numbers
D.marks = { w: 1, h: 1, floor: true, sprite: (o) => {
  const w = (o.w || 1) * 16, h = (o.h || 1) * 16, P = new Pix(w, h);
  if (o.kind === 'zone') { P.rect(0, 0, w, 1, C.gold); P.rect(0, h - 1, w, 1, C.gold); P.rect(0, 0, 1, h, C.gold); P.rect(w - 1, 0, 1, h, C.gold); for (let i = 2; i < w - 2; i += 6) { P.hl(i, 0, 3, C.out); P.hl(i, h - 1, 3, C.out); } }
  return P.c;
} };

// ---------------------------------------------------------------- wall pieces (drawn on the wall face)
D.poster = { w: 1, h: 2, wall: true, sprite: (o) => {
  const P = new Pix(16, 22);
  const k = o.kind || 'wave';
  const bg = { wave: C.ice, fma: C.cream, magnet: C.lilac, kittel: '#DDF6FF', planet: C.night, atom: C.mint, lens: C.cream, m2: C.navy, cat: C.blush }[k] || C.ice;
  P.rect(0, 0, 16, 22, C.out); P.rect(1, 1, 14, 20, bg);
  if (k === 'wave') { for (let i = 2; i < 14; i++) P.px(i, 8 + Math.round(3 * Math.sin(i * 0.9)), C.blue); P.hl(2, 15, 12, C.teal); P.hl(2, 17, 8, C.teal); }
  if (k === 'fma') { tinyText(P, 'F=MA', 1, 4, C.redD); P.disc(8, 14, 3, C.blue); P.line(11, 14, 14, 14, C.red); P.px(13, 13, C.red); P.px(13, 15, C.red); }
  if (k === 'magnet') { P.rect(3, 9, 5, 4, C.red); P.rect(8, 9, 5, 4, C.blue); P.ring(8, 11, 6, C.violet); tinyText(P, 'N', 4, 3, C.redD); }
  if (k === 'kittel') { P.line(2, 18, 13, 3, C.deep); P.line(2, 18, 8, 10, C.teal); P.line(8, 10, 13, 6, C.teal); tinyText(P, 'F', 2, 2, C.deep); }
  if (k === 'planet') { P.disc(8, 10, 4, C.orange); P.hl(2, 10, 12, C.gold); P.px(3, 3, '#FFFFFF'); P.px(12, 5, '#FFFFFF'); P.px(4, 17, '#FFFFFF'); P.px(13, 16, C.ice); }
  if (k === 'atom') { P.ring(8, 11, 5, C.greenD); P.hl(3, 11, 11, C.greenD); P.vl(8, 6, 11, C.greenD); P.disc(8, 11, 1, C.red); }
  if (k === 'lens') { P.oval(6, 4, 4, 14, C.ice); P.line(1, 8, 7, 8, C.orange); P.line(8, 8, 14, 14, C.orange); P.line(1, 14, 7, 14, C.orange); P.line(8, 14, 14, 8, C.orange); }
  if (k === 'm2') { tinyText(P, 'M²', 3, 4, C.cyan); for (let i = 1; i < 15; i++) P.px(i, 14 + Math.round(2 * Math.sin(i * 0.8)), C.ice); }
  if (k === 'cat') { P.disc(8, 11, 4, C.snow); P.px(5, 6, C.snow); P.px(11, 6, C.snow); P.px(6, 10, C.out); P.px(10, 10, C.out); P.px(8, 12, C.rose); }
  return P.c;
} };

D.clock = { w: 1, h: 1, wall: true, sprite: () => {
  const P = new Pix(14, 14);
  P.disc(7, 7, 6, C.out); P.disc(7, 7, 5, C.snow); P.vl(7, 3, 5, C.out); P.hl(7, 7, 3, C.red);
  return P.c;
} };

D.blackboard = { w: 4, h: 2, wall: true, sprite: () => {
  const P = new Pix(64, 28);
  P.rect(0, 0, 64, 26, C.woodD); P.rect(2, 2, 60, 22, '#2B6E54'); P.dither(2, 2, 60, 22, '#2F7559', 0);
  const ch = '#EFFBF5';
  tinyText(P, 'T=2π', 5, 4, ch); P.px(5 + 12, 4, ch);
  P.line(5, 19, 12, 12, ch); P.line(12, 12, 18, 19, ch);
  P.disc(12, 12, 1, ch);
  P.line(24, 6, 24, 20, ch); P.line(24, 20, 40, 20, ch);
  for (let i = 0; i < 15; i++) P.px(25 + i, 19 - Math.round(12 * Math.exp(-((i - 7) * (i - 7)) / 6)), '#FFE07A');
  tinyText(P, 'G=9.8', 44, 5, ch); tinyText(P, 'KX', 44, 13, '#FFC2D1');
  P.rect(0, 25, 64, 3, C.wood); P.rect(8, 24, 4, 1, '#FFFFFF'); P.rect(15, 24, 3, 1, C.yellow);
  return P.c;
} };

D.holoboard = { w: 4, h: 2, wall: true, sprite: () => {
  const P = new Pix(64, 28);
  P.rect(0, 0, 64, 28, C.out); P.rect(1, 1, 62, 26, '#0B2140'); P.rect(2, 2, 60, 24, '#0F2B52');
  for (let i = 6; i < 60; i += 8) P.vl(i, 3, 22, '#16386A');
  for (let j = 6; j < 26; j += 6) P.hl(3, j, 58, '#16386A');
  return P.c;
}, anim(P, x, y, t) {
  // spin-wave dispersion: a few branches and a travelling marker
  for (let i = 0; i < 56; i++) {
    const k = i / 55;
    const f1 = 22 - Math.round(16 * Math.sqrt(0.08 + k * 0.9));
    const f2 = 22 - Math.round(10 * Math.sqrt(0.08 + k * 0.4) - 3 * k);
    P.px(x + 4 + i, y + f1, C.cyan);
    P.px(x + 4 + i, y + f2, (i % 2) ? C.lav : C.violet);
  }
  const m = Math.floor((t * 12) % 56), k = m / 55;
  P.rect(x + 3 + m, y + 21 - Math.round(16 * Math.sqrt(0.08 + k * 0.9)), 3, 3, C.yellow);
  tinyText(P, 'F(K)', x + 44, y + 3, C.ice);
} };

D.holodoor = { w: 2, h: 2, wall: true, sprite: () => {
  const P = new Pix(32, 32);
  P.rect(0, 2, 32, 30, C.steelX); P.rect(2, 4, 28, 28, C.ink); P.hl(2, 4, 28, C.navy);
  P.rect(6, 0, 20, 4, C.night); tinyText(P, 'HOLO', 8, 0, C.cyan);
  return P.c;
}, anim(P, x, y, t) {
  for (let j = 5; j < 32; j++) {
    const a = 0.5 + 0.5 * Math.sin(j * 0.7 - t * 4);
    P.g.fillStyle = `rgba(0, 212, 255, ${0.25 + 0.45 * a})`;
    P.g.fillRect(x + 3 + P.ox, y + j + P.oy, 26, 1);
  }
  for (let k = 0; k < 6; k++) {
    const yy = 30 - ((t * 14 + k * 5) % 26);
    P.px(x + 6 + ((k * 7) % 20), y + yy, '#FFFFFF');
  }
} };

// ---------------------------------------------------------------- cabinets
// contents: list of colours for the items still inside
D.cabinet = { w: 2, h: 1, sprite: (o) => make(32, 38, (P) => {
  const [m, s, h] = TONES[o.tone || 'teal'];
  P.rect(0, 0, 32, 38, m); P.hl(0, 0, 32, h); P.vl(31, 0, 38, s); P.hl(0, 37, 32, s);
  for (const dx of [2, 17]) {
    P.rect(dx, 3, 13, 28, '#DDF6FF'); P.vl(dx, 3, 28, C.glass);
    for (const sy of [11, 20, 29]) P.hl(dx, sy, 13, C.steelD);
  }
  P.vl(15, 6, 4, C.out); P.vl(16, 6, 4, C.out);
  tinyText(P, o.label || 'ITEMS', 3, 32, C.out);
}), anim(P, x, y, t, o) {
  // what is still on the shelves
  const items = (o.contents && o.contents()) || [];
  items.slice(0, 12).forEach((c, i) => {
    const col = i % 4, rowi = Math.floor(i / 4);
    const ix = x + 4 + col * 7 + (col > 1 ? 2 : 0), iy = y + 6 + rowi * 9;
    P.rect(ix, iy, 4, 5, C.out); P.rect(ix + 1, iy + 1, 2, 4, c);
  });
  if (o.sparkle && items.length) { const s = Math.floor(t * 2) % 2; P.px(x + 28, y + 3 + s, '#FFFFFF'); P.px(x + 27 + s, y + 4, '#FFFFFF'); }
} };

// ---------------------------------------------------------------- 1F apparatus
const A = {};

A.pendulum = { w: 2, h: 2, sprite: () => make(32, 54, (P) => {
  P.block(0, 42, 32, 6, 6, { top: C.woodL, front: C.wood, edge: '#F6CF9C', shade: C.woodD });
  // protractor arc on the base
  for (let a = -5; a <= 5; a++) P.px(16 + a * 2, 45 - Math.round(Math.sqrt(36 - a * a * 1.2) * 0.4), C.woodD);
  P.rect(2, 2, 3, 41, C.steelL); P.vl(4, 2, 41, C.steelD);
  P.rect(27, 2, 3, 41, C.steelL); P.vl(29, 2, 41, C.steelD);
  P.rect(1, 0, 30, 4, C.steel); P.hl(1, 0, 30, C.steelL); P.hl(1, 3, 30, C.steelD);
  P.rect(14, 3, 4, 2, C.steelX);
}), anim(P, x, y, t, o) {
  const amp = 0.38, th = amp * Math.sin(t * Math.PI);   // a slow two-second swing
  const px = x + 17, py = y + 5, L = 27;
  const bx = px + L * Math.sin(th), by = py + L * Math.cos(th);
  P.line(px, py, bx, by, C.out);
  const col = o.bob ? o.bob() : C.steel;
  P.disc(bx, by + 1, 4, C.out); P.disc(bx, by + 1, 3, col); P.px(bx - 1, by - 1, '#FFFFFF');
} };

A.spring = { w: 2, h: 2, sprite: () => make(32, 52, (P) => {
  P.block(0, 44, 32, 4, 4, { top: C.snow, front: C.steelL, shade: C.steel });
  P.rect(3, 2, 3, 43, C.steelL); P.vl(5, 2, 43, C.steelD);
  P.rect(3, 2, 22, 3, C.steel); P.hl(3, 2, 22, C.steelL);
  P.rect(16, 4, 12, 8, C.navy); P.hl(16, 4, 12, C.blue); P.px(25, 7, C.cyan); P.px(25, 9, C.green);
  // sensor under the mass
  P.rect(17, 40, 8, 4, C.ink); P.hl(18, 41, 6, C.teal);
}), anim(P, x, y, t, o) {
  const z = 3.2 * Math.sin(t * 5.2);
  const top = y + 13, bottom = y + 30 + z;
  const n = 9;
  for (let i = 0; i < n; i++) {
    const y0 = top + (bottom - top) * i / n, y1 = top + (bottom - top) * (i + 1) / n;
    P.line(x + (i % 2 ? 25 : 19), y0, x + (i % 2 ? 19 : 25), y1, C.steelX);
  }
  const col = o.mass ? o.mass() : C.brass;
  P.rect(x + 17, bottom, 10, 7, C.out); P.rect(x + 18, bottom + 1, 8, 5, col); P.hl(x + 18, bottom + 1, 8, mix(col, '#FFFFFF', 0.45));
} };

A.airtrack = { w: 4, h: 1, sprite: () => make(64, 26, (P) => {
  P.rect(2, 12, 60, 3, C.steelL); P.hl(2, 12, 60, '#FFFFFF'); P.rect(2, 15, 60, 3, C.steel); P.hl(2, 17, 60, C.steelD);
  for (let i = 6; i < 60; i += 4) P.px(i, 13, C.steelD);
  P.rect(6, 18, 3, 8, C.steelX); P.rect(55, 18, 3, 8, C.steelX); P.hl(3, 25, 9, C.steelX); P.hl(52, 25, 9, C.steelX);
  P.rect(0, 9, 3, 8, C.rose); P.rect(61, 9, 3, 8, C.rose);
  // blower and hose
  P.rect(0, 19, 8, 7, C.navy); P.hl(0, 19, 8, C.blue); P.line(4, 19, 8, 16, C.ink);
}), anim(P, x, y, t, o) {
  // two gliders: an elastic bounce, over and over
  const T = 4, u = (t % T) / T;
  const xa = u < 0.5 ? 6 + u * 2 * 22 : 28 - (u - 0.5) * 2 * 2, xb = u < 0.5 ? 40 : 40 + (u - 0.5) * 2 * 14;
  const ca = o.glider ? o.glider(0) : C.gold, cb = o.glider ? o.glider(1) : C.teal;
  for (const [gx, c] of [[xa, ca], [xb, cb]]) {
    P.rect(x + gx, y + 7, 12, 6, C.out); P.rect(x + gx + 1, y + 8, 10, 4, c); P.hl(x + gx + 1, y + 8, 10, mix(c, '#FFFFFF', 0.5));
    P.rect(x + gx + 5, y + 4, 2, 3, C.out);
  }
} };

A.optics = { w: 4, h: 1, sprite: () => make(64, 28, (P) => {
  P.block(0, 12, 64, 6, 4, { top: C.snow, front: C.steelL, shade: C.steel });
  P.rect(1, 22, 3, 6, C.steelX); P.rect(60, 22, 3, 6, C.steelX);
  P.rect(2, 14, 60, 2, C.steelD);
  P.rect(2, 2, 10, 12, C.navy); P.hl(2, 2, 10, C.blue); P.rect(11, 5, 2, 6, C.yellow);
  P.rect(30, 10, 3, 5, C.steelX);
  P.rect(54, 0, 7, 15, C.snow); P.vl(60, 0, 15, C.steelL); P.rect(56, 13, 3, 2, C.steelX);
}), anim(P, x, y, t, o) {
  P.g.fillStyle = 'rgba(255, 224, 122, 0.35)';
  for (let i = 13; i < 55; i++) {
    const half = i < 31 ? 3 + (i - 13) * 0.12 : Math.abs(5.2 * (1 - (i - 31) / 23));
    P.g.fillRect(x + i + P.ox, Math.round(y + 8 - half) + P.oy, 1, Math.max(1, Math.round(2 * half)));
  }
  const lens = o.lens ? o.lens() : C.ice;
  P.oval(x + 29, y + 1, 5, 11, C.out); P.oval(x + 30, y + 2, 3, 9, lens); P.px(x + 30, y + 4, '#FFFFFF');
  // a small inverted arrow on the screen
  P.vl(x + 57, y + 4, 6, C.red); P.px(x + 56, y + 8, C.red); P.px(x + 58, y + 8, C.red);
} };

A.strings = { w: 4, h: 1, sprite: () => make(64, 30, (P) => {
  P.block(0, 14, 60, 6, 4, { top: C.woodL, front: C.wood, edge: '#F6CF9C', shade: C.woodD });
  P.rect(2, 24, 3, 6, C.woodD); P.rect(55, 24, 3, 6, C.woodD);
  P.rect(1, 4, 9, 12, C.orange); P.hl(1, 4, 9, C.yellow); P.rect(3, 7, 5, 3, C.orangeD); P.px(4, 12, C.cyan);
  P.rect(56, 6, 3, 9, C.steelD); P.disc(59, 7, 2, C.steelX);
}), anim(P, x, y, t, o) {
  const n = 3, A = 3 * Math.sin(t * 9);
  for (let i = 0; i <= 48; i++) {
    const s = Math.sin(n * Math.PI * i / 48);
    P.px(x + 10 + i, y + 7 + Math.round(A * s), C.rose);
    if (Math.abs(s) > 0.2) { P.g.fillStyle = 'rgba(224, 69, 123, 0.18)'; P.g.fillRect(x + 10 + i + P.ox, Math.round(y + 7 - 3 * Math.abs(s)) + P.oy, 1, Math.round(6 * Math.abs(s)) + 1); }
  }
  P.vl(x + 61, y + 8, 7, C.out);
  const col = o.mass ? o.mass() : C.brass;
  P.rect(x + 59, y + 15, 5, 7, C.out); P.rect(x + 60, y + 16, 3, 5, col);
} };

A.fieldtable = { w: 2, h: 2, sprite: () => make(32, 34, (P) => {
  P.rect(0, 6, 32, 20, C.steelD); P.rect(1, 7, 30, 18, '#CDEFFC'); P.hl(1, 7, 30, '#FFFFFF');
  P.rect(0, 26, 32, 3, C.steelX);
  P.rect(2, 29, 3, 5, C.steelX); P.rect(27, 29, 3, 5, C.steelX);
}), anim(P, x, y, t) {
  const glow = 0.45 + 0.25 * Math.sin(t * 3);
  P.g.fillStyle = `rgba(107, 91, 230, ${glow})`;
  for (let k = -2; k <= 2; k++) {
    for (let i = 0; i <= 14; i++) {
      const u = i / 14, xx = 9 + u * 14, yy = 16 - k * 3.2 * Math.sin(Math.PI * u);
      P.g.fillRect(Math.round(x + xx) + P.ox, Math.round(y + yy) + P.oy, 1, 1);
    }
  }
  P.disc(x + 9, y + 16, 3, C.out); P.disc(x + 9, y + 16, 2, C.red); P.px(x + 9, y + 16, '#FFFFFF');
  P.disc(x + 23, y + 16, 3, C.out); P.disc(x + 23, y + 16, 2, C.blue); P.px(x + 23, y + 16, '#FFFFFF');
} };

A.launcher = { w: 2, h: 2, sprite: () => make(32, 32, (P) => {
  // a sturdy base, a protractor bracket and a spring tube tilted up
  P.block(2, 22, 28, 4, 6, { top: C.blue, front: C.navy, shade: C.ink });
  P.rect(8, 8, 12, 15, C.steelL); P.vl(19, 8, 15, C.steelD);
  for (let a = 0; a <= 9; a++) { const r = 9, an = a / 9 * Math.PI / 2; P.px(9 + Math.round(r * Math.cos(an)), 21 - Math.round(r * Math.sin(an)), C.steelX); }
  for (let i = 0; i < 20; i++) {
    const xx = 9 + i, yy = 19 - i * 0.58;
    P.rect(xx, yy - 3, 1, 7, i < 4 ? C.navy : i > 17 ? C.ink : C.teal);
    P.px(xx, yy - 3, i < 4 ? C.blue : C.ice);
  }
  P.disc(10, 18, 2, C.steelX); P.rect(22, 7, 3, 7, C.gold);
}), anim(P, x, y, t, o) {
  const col = o.ball ? o.ball() : C.yellow;
  const u = (t % 3) / 3;
  if (u < 0.75) { P.disc(x + 30, y + 6, 2, C.out); P.disc(x + 30, y + 6, 1, col); }
} };

A.basket = { w: 2, h: 2, sprite: () => make(32, 40, (P) => {
  P.rect(22, 8, 3, 32, C.steelD); P.vl(22, 8, 32, C.steelL); P.rect(17, 37, 13, 3, C.steelX);
  P.rect(14, 0, 18, 16, C.snow);
  for (let r = 7; r >= 1; r -= 2) P.disc(23, 8, r, r % 4 === 3 ? C.rose : C.snow);
  P.disc(23, 8, 1, C.red);
  P.rect(4, 15, 14, 2, C.orange); P.hl(4, 15, 14, C.yellow);
  for (let i = 5; i < 17; i += 2) P.line(i, 17, i + 1, 24, C.snow);
  P.hl(6, 24, 10, C.steelL);
}) };

A.lectern = { w: 1, h: 1, sprite: () => make(16, 22, (P) => {
  P.rect(1, 0, 14, 6, C.woodL); P.hl(1, 0, 14, '#F6CF9C'); P.rect(3, 1, 10, 3, C.snow); P.vl(8, 1, 3, C.steelL);
  P.rect(3, 6, 10, 14, C.wood); P.vl(12, 6, 14, C.woodD); P.rect(1, 19, 14, 3, C.woodD);
}) };

// ---------------------------------------------------------------- 2F apparatus
A.pipetower = { w: 2, h: 2, sprite: (o) => make(32, 70, (P) => {
  P.block(0, 60, 32, 4, 6, { top: C.steelL, front: C.steel, shade: C.steelD });
  P.rect(2, 0, 3, 61, C.violet); P.vl(4, 0, 61, C.plum); P.rect(27, 0, 3, 61, C.violet); P.vl(29, 0, 61, C.plum);
  for (const yy of [6, 30, 52]) { P.hl(5, yy, 22, C.plum); }
  // catch box
  P.rect(9, 52, 14, 9, C.yellow); P.hl(9, 52, 14, '#FFF0B8'); P.rect(10, 54, 12, 2, C.gold);
}), anim(P, x, y, t, o) {
  const [m, s, h] = o.pipe ? o.pipe() : [C.copper, C.copperD, C.copperL];
  P.rect(x + 13, y + 3, 7, 48, C.out); P.rect(x + 14, y + 3, 5, 48, m); P.vl(x + 14, y + 3, 48, h); P.vl(x + 18, y + 3, 48, s);
  P.rect(x + 12, y + 2, 9, 2, C.steelX); P.rect(x + 12, y + 50, 9, 2, C.steelX);
  // a slot window shows the magnet sliding down slowly
  P.rect(x + 15, y + 8, 3, 38, C.night);
  const u = (t % 6) / 6, my = y + 8 + Math.round(u * 34);
  P.rect(x + 15, my, 3, 4, C.red); P.hl(x + 15, my + 2, 3, C.blue);
} };

A.slinkytower = { w: 3, h: 2, sprite: () => make(48, 64, (P) => {
  P.block(0, 56, 48, 4, 4, { top: C.sunny || '#FFE9A8', front: C.gold, shade: C.brassD });
  // ladder at the left and a top beam
  P.rect(2, 2, 3, 55, C.woodL); P.rect(10, 2, 3, 55, C.woodL); P.vl(4, 2, 55, C.wood); P.vl(12, 2, 55, C.wood);
  for (let yy = 8; yy < 56; yy += 7) P.hl(5, yy, 5, C.wood);
  P.rect(2, 0, 44, 4, C.woodL); P.hl(2, 3, 44, C.wood); P.rect(42, 0, 3, 57, C.woodL); P.vl(44, 0, 57, C.wood);
  P.rect(24, 4, 4, 3, C.steelX);
}), anim(P, x, y, t, o) {
  const col = o.slinky ? o.slinky() : [C.steelL, C.steel];
  // hangs, then drops and collapses, then resets
  const T = 5, u = (t % T) / T;
  let top = 7, bot = 46;
  if (u > 0.55 && u < 0.8) { const s = (u - 0.55) / 0.25; top = 7 + s * s * 39; if (top > bot - 4) top = bot - 4; }
  if (u >= 0.8) { top = 42; bot = 46; }
  const n = 14;
  for (let i = 0; i < n; i++) {
    const yy = top + (bot - top) * Math.pow(i / (n - 1), 1.6);
    P.hl(x + 20, y + yy, 12, C.out); P.hl(x + 21, y + yy, 10, i % 2 ? col[0] : col[1]);
  }
} };

A.darkroom = { w: 5, h: 3, sprite: () => make(80, 62, (P) => {
  // walls of a booth seen from the front, a dark curtain door and a laser sign
  P.rect(0, 0, 80, 8, C.plum); P.hl(0, 0, 80, C.violet); P.hl(0, 7, 80, '#33286A');
  P.rect(0, 8, 80, 54, C.ink); P.rect(2, 8, 76, 52, '#2A3A6E');
  for (let i = 4; i < 76; i += 6) P.vl(i, 10, 50, '#33467F');
  // curtain door
  P.rect(30, 22, 20, 40, C.night);
  for (let i = 30; i < 50; i += 3) P.vl(i, 22, 40, '#1A2C55');
  P.rect(29, 20, 22, 3, C.steelD);
  // laser warning light and sign
  P.rect(33, 11, 14, 7, C.night); tinyText(P, 'LASER', 30 + 3, 12, C.red);
  P.rect(56, 14, 18, 30, '#0F1C38'); P.rect(57, 15, 16, 28, C.night);
}), anim(P, x, y, t) {
  // fringes glowing on the little window
  for (let i = 0; i < 16; i++) {
    const a = Math.pow(Math.cos((i - 7.5) * 0.8), 2) * Math.exp(-((i - 7.5) ** 2) / 40);
    P.g.fillStyle = `rgba(255, 70, 90, ${0.15 + 0.8 * a})`;
    P.g.fillRect(x + 58 + i + P.ox, y + 18 + P.oy, 1, 22);
  }
  const on = Math.floor(t * 2) % 2;
  P.disc(x + 40, y + 4, 2, on ? C.red : C.redD);
} };

A.coupled = { w: 3, h: 2, sprite: () => make(48, 46, (P) => {
  P.block(0, 38, 48, 4, 4, { top: C.woodL, front: C.wood, shade: C.woodD });
  P.rect(2, 2, 3, 37, C.steelL); P.vl(4, 2, 37, C.steelD); P.rect(43, 2, 3, 37, C.steelL); P.vl(45, 2, 37, C.steelD);
  P.rect(1, 0, 46, 4, C.steel); P.hl(1, 0, 46, C.steelL); P.hl(1, 3, 46, C.steelD);
}), anim(P, x, y, t) {
  const w = 3.0, eps = 0.25;
  const a1 = 0.32 * Math.cos(eps * t) * Math.sin(w * t), a2 = 0.32 * Math.sin(eps * t) * Math.sin(w * t + 0.3);
  const L = 26, p1 = [x + 16, y + 4], p2 = [x + 32, y + 4];
  const b1 = [p1[0] + L * Math.sin(a1), p1[1] + L * Math.cos(a1)], b2 = [p2[0] + L * Math.sin(a2), p2[1] + L * Math.cos(a2)];
  P.line(p1[0], p1[1], b1[0], b1[1], C.out); P.line(p2[0], p2[1], b2[0], b2[1], C.out);
  // spring between the strings
  const s1 = [p1[0] + 16 * Math.sin(a1), p1[1] + 16 * Math.cos(a1)], s2 = [p2[0] + 16 * Math.sin(a2), p2[1] + 16 * Math.cos(a2)];
  for (let i = 0; i < 6; i++) {
    const u0 = i / 6, u1 = (i + 1) / 6;
    P.line(s1[0] + (s2[0] - s1[0]) * u0, s1[1] + (i % 2 ? 2 : -2), s1[0] + (s2[0] - s1[0]) * u1, s1[1] + (i % 2 ? -2 : 2), C.green);
  }
  P.disc(b1[0], b1[1], 3, C.out); P.disc(b1[0], b1[1], 2, C.red);
  P.disc(b2[0], b2[1], 3, C.out); P.disc(b2[0], b2[1], 2, C.blue);
} };

A.gyro = { w: 2, h: 2, sprite: () => make(32, 34, (P) => {
  P.block(0, 16, 32, 8, 4, { top: C.lilac, front: C.lav, shade: C.violet });
  P.rect(2, 28, 3, 6, C.violet); P.rect(27, 28, 3, 6, C.violet);
  P.rect(14, 4, 4, 16, C.steelX); P.vl(14, 4, 16, C.steelD); P.oval(11, 18, 10, 4, C.steelX);
  P.disc(16, 4, 2, C.steelD);
}), anim(P, x, y, t) {
  const ph = t * 1.4, ax = Math.cos(ph), az = Math.sin(ph);
  const ex = x + 16 + 12 * ax, ey = y + 4 + 3 * az, bx = x + 16 - 7 * ax, by = y + 4 - 2 * az;
  P.line(bx, by, ex, ey, C.steelX);
  P.disc(bx, by, 2, C.out); P.disc(bx, by, 1, C.steelD);
  // the spinning wheel: an ellipse whose width follows the precession angle
  const spin = Math.floor(t * 12) % 2, rx = Math.max(2, Math.round(6 * Math.abs(az) + 2));
  P.oval(ex - rx - 1, ey - 7, 2 * rx + 3, 14, C.out); P.oval(ex - rx, ey - 6, 2 * rx + 1, 12, spin ? C.gold : C.brass);
  P.vl(ex, ey - 5, 10, spin ? C.brassD : C.yellow);
} };

A.chladni = { w: 2, h: 2, sprite: () => make(32, 36, (P) => {
  P.rect(13, 14, 6, 14, C.navy); P.oval(8, 24, 16, 8, C.ink); P.oval(10, 25, 12, 5, C.navy);
  P.rect(5, 30, 22, 4, C.ink);
  P.rect(0, 2, 32, 14, C.brassD); P.rect(1, 3, 30, 12, C.brass); P.hl(1, 3, 30, C.yellow);
}), anim(P, x, y, t, o) {
  // sand gathers on the nodal lines of the plate
  const n = 2 + (Math.floor(t / 3) % 3), m = 1 + (Math.floor(t / 3) % 2);
  for (let j = 0; j < 12; j++) for (let i = 0; i < 30; i++) {
    const u = i / 29 - 0.5, v = j / 11 - 0.5;
    const z = Math.cos(n * Math.PI * u) * Math.cos(m * Math.PI * v) - Math.cos(m * Math.PI * u) * Math.cos(n * Math.PI * v);
    if (Math.abs(z) < 0.18) P.px(x + 1 + i, y + 3 + j, C.cream);
  }
} };

// ---------------------------------------------------------------- 3F apparatus
A.magnet = { w: 3, h: 2, sprite: () => make(48, 44, (P) => {
  P.block(0, 34, 48, 4, 6, { top: C.steelL, front: C.steel, shade: C.steelD });
  // yoke
  P.rect(4, 4, 40, 6, C.steelX); P.hl(4, 4, 40, C.steelD);
  P.rect(4, 4, 6, 32, C.steelX); P.rect(38, 4, 6, 32, C.steelX);
  // coils and pole pieces
  for (const cx of [10, 28]) {
    P.rect(cx, 12, 10, 20, C.copper); P.hl(cx, 12, 10, C.copperL);
    for (let j = 14; j < 32; j += 3) P.hl(cx, j, 10, C.copperD);
  }
  P.rect(20, 18, 3, 8, C.steelD); P.rect(25, 18, 3, 8, C.steelD);
  // the sample holder in the gap
  P.rect(23, 6, 2, 22, C.gold);
}), anim(P, x, y, t) {
  const g = 0.5 + 0.5 * Math.sin(t * 2.4);
  P.g.fillStyle = `rgba(0, 212, 255, ${0.25 + 0.35 * g})`;
  P.g.fillRect(x + 22 + P.ox, y + 17 + P.oy, 4, 10);
} };

A.rack = { w: 1, h: 2, sprite: () => make(16, 44, (P) => {
  P.rect(0, 0, 16, 44, C.ink); P.hl(0, 0, 16, C.navy); P.vl(15, 0, 44, C.out);
  P.rect(1, 3, 14, 12, C.snow); P.rect(2, 4, 9, 8, C.night);
  P.rect(1, 17, 14, 8, C.cream); P.rect(2, 18, 7, 5, C.night); P.px(12, 20, C.red); P.px(13, 20, C.green);
  P.rect(1, 27, 14, 7, C.steelL); P.rect(2, 28, 6, 4, C.night); P.px(11, 30, C.cyan);
  P.rect(1, 36, 14, 6, C.navy); P.px(4, 38, C.yellow);
}), anim(P, x, y, t) {
  for (let i = 0; i < 8; i++) {
    const u = i / 7 - 0.5 - 0.1 * Math.sin(t);
    P.px(x + 2 + i, y + 9 - Math.round(4 * Math.exp(-u * u * 30)), C.yellow);
  }
  P.hl(x + 3, y + 20, 5, (Math.floor(t * 4) % 2) ? C.green : C.mint);
} };

A.optable = { w: 4, h: 2, sprite: () => make(64, 40, (P) => {
  P.block(0, 6, 64, 22, 6, { top: C.ink, front: C.night, edge: C.navy, shade: C.out });
  for (let j = 8; j < 27; j += 3) for (let i = 2; i < 63; i += 3) P.px(i, j, '#2E4A7D');
  P.rect(2, 34, 4, 6, C.steelX); P.rect(58, 34, 4, 6, C.steelX); P.rect(30, 34, 4, 6, C.steelX);
  // laser, mirrors, interferometer box and the microscope
  P.rect(3, 9, 16, 6, C.snow); P.hl(3, 9, 16, '#FFFFFF'); P.rect(15, 10, 3, 4, C.green); tinyText(P, '532', 4, 10, C.ink);
  P.rect(44, 2, 16, 10, C.navy); P.hl(44, 2, 16, C.blue); P.rect(46, 4, 12, 6, C.night);
  P.rect(30, 16, 4, 4, C.steelL); P.rect(46, 18, 4, 4, C.steelL);
  P.rect(22, 0, 6, 14, C.steelD); P.rect(23, 14, 4, 4, C.steelX);
}), anim(P, x, y, t) {
  const f = 0.75 + 0.25 * Math.sin(t * 7);
  P.g.fillStyle = `rgba(76, 255, 120, ${f})`;
  P.g.fillRect(x + 18 + P.ox, y + 11 + P.oy, 14, 1);
  P.g.fillRect(x + 31 + P.ox, y + 11 + P.oy, 1, 8);
  P.g.fillRect(x + 32 + P.ox, y + 18 + P.oy, 16, 1);
  P.g.fillRect(x + 47 + P.ox, y + 10 + P.oy, 1, 8);
  for (let i = 0; i < 10; i++) {
    const v = Math.exp(-(((i - 4.5) / 1.4) ** 2)) * (0.6 + 0.4 * Math.sin(t * 3 + i));
    P.g.fillStyle = `rgba(0, 212, 255, ${0.2 + 0.8 * v})`;
    P.g.fillRect(x + 47 + i + P.ox, Math.round(y + 9 - 4 * v) + P.oy, 1, Math.max(1, Math.round(4 * v)));
  }
} };

A.simdesk = { w: 3, h: 1, sprite: () => make(48, 28, (P) => {
  P.rect(0, 12, 48, 7, C.snow); P.hl(0, 12, 48, '#FFFFFF'); P.rect(0, 19, 48, 3, C.steelL); P.hl(0, 21, 48, C.steel);
  P.rect(2, 22, 2, 6, C.steelD); P.rect(44, 22, 2, 6, C.steelD);
  for (const sx of [2, 17, 32]) { P.rect(sx, 0, 14, 11, C.steelX); P.rect(sx + 1, 1, 12, 9, C.night); P.rect(sx + 6, 11, 2, 2, C.steelX); }
  P.rect(16, 14, 16, 3, C.steelD); P.rect(36, 14, 4, 3, C.steelL);
}), anim(P, x, y, t) {
  for (const [k, sx] of [[0, 3], [1, 18], [2, 33]]) {
    for (let j = 0; j < 9; j++) for (let i = 0; i < 12; i++) {
      const a = Math.atan2(j - 4, i - 6) + t * (k === 1 ? 1.2 : 0.6) + k;
      const hue = ((a / (2 * Math.PI)) % 1 + 1) % 1;
      const pal = [C.red, C.violet, C.cyan, C.green];
      if (k === 2) P.px(x + sx + i, y + 1 + j, (i + Math.floor(t * 6)) % 6 < 3 ? C.blue : C.ice);
      else P.px(x + sx + i, y + 1 + j, pal[Math.floor(hue * 4) % 4]);
    }
  }
} };

A.gpurack = { w: 1, h: 2, sprite: () => D.server.sprite({}), anim: D.server.anim };

A.fridge = { w: 2, h: 2, sprite: () => make(32, 70, (P) => {
  P.block(0, 62, 32, 4, 4, { top: C.steelL, front: C.steel, shade: C.steelD });
  P.rect(1, 0, 3, 63, C.steelD); P.rect(28, 0, 3, 63, C.steelD); P.rect(0, 0, 32, 5, C.steelX); P.hl(0, 0, 32, C.steelD);
  // gold plates, getting smaller and colder towards the bottom
  const plates = [[8, 4, 16], [20, 6, 14], [31, 7, 12], [41, 8, 10], [50, 9, 8]];
  for (const [yy, x0, w] of plates) {
    P.rect(16 - w, yy, 2 * w, 3, C.gold); P.hl(16 - w, yy, 2 * w, C.yellow); P.hl(16 - w, yy + 2, 2 * w, C.brassD);
  }
  for (const xx of [9, 15, 22]) P.vl(xx, 5, 50, C.brass);
  P.rect(13, 53, 6, 6, C.copper); P.hl(13, 53, 6, C.copperL);
}), anim(P, x, y, t) {
  const g = 0.3 + 0.2 * Math.sin(t * 1.6);
  P.g.fillStyle = `rgba(0, 212, 255, ${g})`;
  P.g.fillRect(x + 12 + P.ox, y + 59 + P.oy, 8, 2);
} };

// ---------------------------------------------------------------- 3F: the spin gallery and the project room
const lab = { top: C.snow, front: C.steelL, edge: '#FFFFFF', shade: C.steel };

// a spin in a glass dome, turning round its field
A.spintop = { w: 3, h: 2, sprite: () => make(48, 48, (P) => {
  P.block(6, 34, 36, 5, 9, { top: C.blue, front: C.navy, edge: C.sky, shade: C.ink });
  P.rect(8, 47, 4, 1, C.ink); P.rect(36, 47, 4, 1, C.ink);
  tinyText(P, 'SPIN', 16, 40, C.ice);
  // the dome
  P.oval(8, 2, 32, 36, C.steelD); P.oval(9, 3, 30, 34, '#DDF6FF');
  P.oval(11, 5, 26, 30, '#EAF9FF');
  P.line(14, 10, 17, 6, '#FFFFFF'); P.line(13, 13, 14, 11, '#FFFFFF');
  // the drive coil round its foot
  P.oval(7, 29, 34, 9, C.copperD); P.oval(8, 30, 32, 7, C.copper); P.oval(12, 31, 24, 4, C.copperL); P.oval(13, 32, 22, 2, C.copperD);
  // the axis
  for (let y = 6; y < 30; y += 3) P.vl(24, y, 2, C.steel);
}), anim(P, x, y, t) {
  const th = 0.55 + 0.18 * Math.sin(t * 0.45), ph = t * 2.2;
  const bx = x + 24, by = y + 28;
  // the cone it sweeps, faintly
  for (let k = 0; k < 24; k++) { const a = k / 24 * 2 * Math.PI; P.px(bx + 13 * Math.sin(th) * Math.cos(a), by - 18 * Math.cos(th) + 4 * Math.sin(th) * Math.sin(a), C.pink); }
  const tx = bx + 13 * Math.sin(th) * Math.cos(ph), ty = by - 18 * Math.cos(th) + 4 * Math.sin(th) * Math.sin(ph);
  P.line(bx, by, tx, ty, C.redD); P.line(bx + 1, by, tx + 1, ty, C.red);
  P.disc(tx, ty, 2, C.red); P.px(tx, ty - 1, C.pink);
  P.disc(bx, by, 2, C.out); P.px(bx, by, C.steelL);
} };

// a chain of little spins on a bench: flick one end and a wave runs along
A.wavechain = { w: 6, h: 2, sprite: () => make(96, 40, (P) => {
  P.block(0, 24, 96, 5, 10, lab);
  P.rect(3, 39, 3, 1, C.steelD); P.rect(90, 39, 3, 1, C.steelD);
  // the antenna at one end, a soft absorber at the other
  P.rect(1, 12, 8, 13, C.copperD); P.rect(2, 13, 6, 11, C.copper); for (let j = 14; j < 24; j += 2) P.hl(2, j, 6, C.copperL);
  P.rect(88, 12, 7, 13, C.ink); P.dither(89, 13, 5, 11, C.navy, 0);
  for (let i = 0; i < 16; i++) { const px = 12 + i * 5; P.rect(px - 1, 19, 3, 6, C.steelX); P.px(px, 19, C.steelD); }
  P.hl(10, 25, 78, C.cyan);
}), anim(P, x, y, t) {
  for (let i = 0; i < 16; i++) {
    const px = x + 12 + i * 5, a = 0.75 * Math.sin(i * 0.62 - t * 3.2) * Math.min(1, 0.4 + 0.6 * Math.abs(Math.sin(t * 0.4)));
    const ex = px + Math.round(7 * Math.sin(a)), ey = y + 18 - Math.round(12 * Math.cos(a) * 0.9);
    P.line(px, y + 18, ex, ey, C.steelX);
    P.px(ex, ey, C.red); P.px(ex, ey - 1, C.red); P.px(ex + (a > 0 ? 1 : -1), ey, C.pink);
  }
  // microwaves leaving the antenna
  const k = Math.floor(t * 6) % 3;
  P.px(x + 9 + k, y + 14, C.cyan); P.px(x + 9 + k, y + 18, C.cyan); P.px(x + 9 + k, y + 22, C.cyan);
} };

// the Kerr microscope: polarised light shows the magnetic domains on a screen
A.kerr = { w: 3, h: 2, sprite: () => make(48, 46, (P) => {
  P.block(0, 28, 48, 5, 10, lab);
  P.rect(2, 43, 3, 3, C.steelD); P.rect(43, 43, 3, 3, C.steelD);
  // the microscope
  P.rect(3, 24, 20, 4, C.ink); P.hl(3, 24, 20, C.navy);
  P.rect(8, 4, 5, 20, C.steelX); P.vl(8, 4, 20, C.steelD);
  P.rect(8, 4, 13, 5, C.steelX); P.hl(8, 4, 13, C.steelD);
  P.rect(17, 9, 4, 9, C.steelD); P.rect(17, 17, 4, 2, C.gold);
  P.rect(14, 21, 10, 3, C.lilac);           // the sample under it
  P.rect(1, 9, 7, 5, C.navy); P.px(6, 11, C.green);   // laser
  P.rect(21, 1, 4, 4, C.violet);            // analyser
  // the screen
  P.rect(25, 2, 22, 18, C.out); P.rect(26, 3, 20, 16, C.night);
  P.rect(33, 20, 6, 8, C.steelX); P.rect(29, 26, 14, 2, C.steelD);
}), anim(P, x, y, t) {
  // domains: a slowly drifting maze of light and dark
  for (let j = 0; j < 16; j++) for (let i = 0; i < 20; i++) {
    const v = Math.sin(i * 0.62 + 1.8 * Math.sin(j * 0.45 + t * 0.35) + t * 0.25) + 0.35 * Math.sin(j * 0.9 - t * 0.2);
    P.px(x + 26 + i, y + 3 + j, v > 0 ? '#DDF6FF' : '#2E4A7D');
  }
  P.px(x + 6, y + 11, (Math.floor(t * 3) % 2) ? C.green : C.mint);
} };

// a copper cavity between the poles of a magnet, with a little garnet sphere inside
A.cavity = { w: 3, h: 2, sprite: () => make(48, 46, (P) => {
  P.block(0, 36, 48, 4, 6, { top: C.steelL, front: C.steel, shade: C.steelD });
  P.rect(3, 12, 42, 5, C.steelX); P.hl(3, 12, 42, C.steelD);
  P.rect(3, 12, 6, 26, C.steelX); P.rect(39, 12, 6, 26, C.steelX);
  for (const cx of [9, 31]) { P.rect(cx, 19, 8, 17, C.copper); P.hl(cx, 19, 8, C.copperL); for (let j = 21; j < 36; j += 3) P.hl(cx, j, 8, C.copperD); }
  // the cavity: a shiny copper box with a window
  P.rect(18, 22, 12, 12, C.copperD); P.rect(19, 23, 10, 10, C.copperL); P.rect(21, 25, 6, 6, C.out);
  // cables up to the little analyser screen on top
  P.vl(22, 6, 16, C.steelD); P.vl(26, 6, 16, C.steelD);
  P.rect(10, 0, 28, 10, C.out); P.rect(11, 1, 26, 8, C.night);
}), anim(P, x, y, t) {
  // two peaks that meet and refuse to cross: the avoided crossing
  const d = 7 * Math.sin(t * 0.5), g = 3, s = Math.sqrt(d * d + g * g);
  for (let i = 0; i < 24; i++) {
    const u = i - 12, h1 = 5 / (1 + ((u + s) / 1.6) ** 2), h2 = 5 / (1 + ((u - s) / 1.6) ** 2);
    P.px(x + 12 + i, y + 7 - Math.round(h1 + h2), C.cyan);
  }
  const k = 0.5 + 0.5 * Math.sin(t * 3);
  P.disc(x + 24, y + 28, 2, k > 0.5 ? C.red : C.redD);
} };

// a spin-wave logic chip: two inputs meet in a Y and decide whether the output lights up
A.logicbench = { w: 4, h: 2, sprite: () => make(64, 42, (P) => {
  P.block(0, 26, 64, 5, 9, lab);
  P.rect(3, 40, 3, 2, C.steelD); P.rect(58, 40, 3, 2, C.steelD);
  P.rect(2, 2, 60, 23, C.out); P.rect(3, 3, 58, 21, C.plum);
  for (let i = 4; i < 60; i += 4) P.vl(i, 4, 19, '#55459A');
  // the waveguide: two arms that join and run on to the output
  P.line(8, 7, 32, 13, C.lav); P.line(8, 8, 32, 14, C.lav); P.line(8, 20, 32, 14, C.lav); P.line(8, 19, 32, 13, C.lav);
  P.rect(32, 12, 22, 3, C.lav);
  P.rect(5, 5, 3, 5, C.gold); P.rect(5, 17, 3, 5, C.gold);
  P.disc(56, 13, 4, C.out);
}), anim(P, x, y, t) {
  const cyc = Math.floor(t / 2.5) % 4, a = cyc & 1, b = (cyc >> 1) & 1;
  const on = a === b;                       // same phase: the waves add up
  for (let k = 0; k < 4; k++) {
    const u = ((t * 0.8 + k / 4) % 1);
    P.px(x + 8 + 24 * u, y + 7 + 6 * u, a ? C.yellow : C.cyan);
    P.px(x + 8 + 24 * u, y + 20 - 6 * u, b ? C.yellow : C.cyan);
    if (on) P.px(x + 33 + 20 * u, y + 13, C.yellow);
  }
  P.disc(x + 56, y + 13, 3, on ? C.yellow : C.ink);
  tinyText(P, String(a), x + 10, y + 3, C.ice); tinyText(P, String(b), x + 10, y + 19, C.ice);
} };

// a crystal of steel balls, a microwave horn and a detector on a swinging arm
A.braggtable = { w: 4, h: 2, sprite: () => make(64, 44, (P) => {
  P.block(0, 12, 64, 22, 6, { top: C.ink, front: C.night, edge: C.navy, shade: C.out });
  for (let j = 14; j < 33; j += 3) for (let i = 2; i < 63; i += 3) P.px(i, j, '#2E4A7D');
  P.rect(2, 40, 4, 4, C.steelX); P.rect(58, 40, 4, 4, C.steelX);
  // the crystal: layers of 3D-printed plates holding steel balls
  P.rect(24, 22, 16, 4, C.mint); P.hl(24, 22, 16, '#C9F3DD');
  for (let l = 0; l < 3; l++) for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
    const bx = 25 + i * 4 + (l % 2) * 2, by = 20 - l * 5 - j * 1;
    P.disc(bx, by, 1, C.steelD); P.px(bx, by - 1, '#FFFFFF');
  }
  // the source horn on the left and a little network analyser
  P.rect(4, 18, 6, 6, C.brassD); P.rect(10, 16, 4, 10, C.brass); P.hl(10, 16, 4, C.yellow);
  P.rect(3, 26, 10, 6, C.steelL); P.rect(4, 27, 6, 3, C.night); P.px(11, 28, C.green);
}), anim(P, x, y, t) {
  // microwaves on their way in
  for (let k = 0; k < 3; k++) { const u = ((t * 1.2 + k / 3) % 1); const px = x + 15 + 9 * u; P.vl(px, y + 16 + 2 * u, 6 - 4 * u, C.cyan); }
  // the detector arm swings slowly; at the right angle the reflection lights it up
  const a = 0.35 + 0.3 * Math.sin(t * 0.6), cx = x + 32, cy = y + 24;
  const ex = cx + 22 * Math.cos(a), ey = cy - 12 * Math.sin(a);
  P.line(cx, cy, ex, ey, C.steelD);
  const hit = Math.abs(a - 0.45) < 0.06;
  P.rect(ex - 2, ey - 3, 6, 6, hit ? C.yellow : C.brass); P.px(ex + 3, ey, C.out);
  if (hit) { P.px(ex + 5, ey - 4, '#FFFFFF'); P.px(ex + 6, ey - 5, '#FFFFFF'); }
} };

// a steel rod on V-blocks, a hammer and a compass at its end
A.rodstand = { w: 3, h: 1, sprite: () => make(48, 28, (P) => {
  P.block(0, 12, 48, 5, 9, { top: C.woodL, front: C.wood, edge: '#F6CF9C', shade: C.woodD });
  P.rect(2, 26, 3, 2, C.woodD); P.rect(43, 26, 3, 2, C.woodD);
  P.rect(8, 9, 5, 5, C.steelX); P.rect(28, 9, 5, 5, C.steelX);
  P.rect(3, 6, 34, 4, C.steelL); P.hl(3, 6, 34, '#FFFFFF'); P.hl(3, 9, 34, C.steel);
  P.px(3, 7, C.red); P.px(3, 8, C.red);
  // the compass
  P.disc(42, 8, 5, C.out); P.disc(42, 8, 4, C.snow);
  // the hammer
  P.line(14, 4, 22, -2 + 6, C.woodD); P.rect(12, 1, 5, 4, C.steelX);
}), anim(P, x, y, t) {
  const a = -0.25 + 0.15 * Math.sin(t * 1.3) + (Math.floor(t * 0.5) % 4 === 0 ? 0.25 * Math.sin(t * 12) : 0);
  const dx = Math.round(3 * Math.sin(a)), dy = Math.round(3 * Math.cos(a));
  P.px(x + 42 + dx, y + 8 - dy, C.red); P.px(x + 42 + Math.round(dx / 2), y + 8 - Math.round(dy / 2), C.red);
  P.px(x + 42 - dx, y + 8 + dy, C.blue); P.px(x + 42, y + 8, C.out);
} };

// a low table of little compasses, all turning to follow a toy magnet
A.compasses = { w: 4, h: 2, sprite: () => make(64, 34, (P) => {
  P.block(0, 6, 64, 18, 6, { top: '#DDF6FF', front: C.steelL, edge: '#FFFFFF', shade: C.steel });
  P.rect(3, 30, 3, 4, C.steelD); P.rect(58, 30, 3, 4, C.steelD);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 7; i++) { P.disc(6 + i * 9, 10 + j * 6, 2, C.steelL); }
}), anim(P, x, y, t) {
  const mx = x + 32 + 24 * Math.cos(t * 0.5), my = y + 16 + 7 * Math.sin(t * 0.5), ang = t * 0.5 + Math.PI / 2;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 7; i++) {
    const cx = x + 6 + i * 9, cy = y + 10 + j * 6;
    // the field of a small bar magnet (a dipole) pointing along its path
    const rx = cx - mx, ry = (cy - my) * 2, r2 = rx * rx + ry * ry + 4, r = Math.sqrt(r2);
    const mxd = Math.cos(ang), myd = Math.sin(ang), dot = (mxd * rx + myd * ry) / r;
    const bx = 3 * dot * rx / r - mxd, by = 3 * dot * ry / r - myd, b = Math.hypot(bx, by) || 1;
    const ux = Math.round(2 * bx / b), uy = Math.round(1.4 * by / b);
    P.px(cx + ux, cy + uy, C.red); P.px(cx - ux, cy - uy, C.blue); P.px(cx, cy, C.out);
  }
  P.rect(mx - 3, my - 1, 3, 3, C.red); P.rect(mx, my - 1, 3, 3, C.blue);
} };

// the Earth as a magnet
A.globe = { w: 2, h: 2, sprite: () => make(32, 42, (P) => {
  P.rect(13, 30, 6, 8, C.woodD); P.rect(8, 37, 16, 4, C.wood); P.hl(8, 37, 16, C.woodL);
  P.ring(16, 16, 15, C.brassD); P.disc(16, 16, 13, C.blue);
  // the continents, roughly
  P.rect(8, 8, 6, 4, C.green); P.rect(10, 12, 3, 5, C.green); P.rect(18, 9, 7, 4, C.green); P.rect(20, 13, 4, 6, C.green); P.rect(13, 22, 5, 3, C.green);
  P.rect(12, 3, 8, 2, '#FFFFFF'); P.rect(12, 28, 8, 2, '#FFFFFF');
}), anim(P, x, y, t) {
  // field lines leave the south and come back in at the north, round the outside
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const u = ((t * 0.25 + k / 3) % 1), a = Math.PI * u;
    P.px(x + 16 + s * (14 + 4 * Math.sin(a)), y + 16 + 15 * Math.cos(a), C.cyan);
  }
} };

// a bench to sit on in the gallery
A.bench = { w: 3, h: 1, sprite: (o) => make(48, 18, (P) => {
  const [m, s, h] = TONES[o.tone || 'navy'];
  P.rect(0, 2, 48, 6, m); P.hl(0, 2, 48, h); P.hl(0, 7, 48, s);
  P.rect(2, 8, 44, 3, s);
  P.rect(3, 11, 3, 7, C.steelX); P.rect(42, 11, 3, 7, C.steelX); P.rect(22, 11, 4, 7, C.steelX);
}) };

// ---------------------------------------------------------------- wall pictures: our papers and the students' projects
const FRAME_ART = {
  // a magnonic waveguide, and sharp new peaks in its spectrum
  nc2024(P) { P.rect(3, 13, 26, 3, C.lav); for (let i = 3; i < 29; i++) P.px(i, 10 + Math.round(2 * Math.sin(i * 1.1)), C.violet); P.vl(10, 3, 6, C.red); P.vl(18, 4, 5, C.red); P.vl(14, 2, 7, C.red); P.hl(3, 9, 26, C.steelD); },
  // a disk shaking with sound, its spins answering
  pra2023(P) { P.oval(7, 6, 18, 10, C.steelL); P.oval(9, 8, 14, 6, C.ice); for (let k = 0; k < 3; k++) P.ring(16, 11, 2 + k * 2, k % 2 ? C.teal : C.blue); P.line(16, 11, 19, 4, C.red); },
  // two magnets far apart, bright and dark
  prx2022(P) { P.rect(3, 6, 5, 8, C.red); P.rect(24, 6, 5, 8, C.blue); for (let i = 8; i < 24; i++) P.px(i, 10 + Math.round(2 * Math.sin(i * 0.8)), C.teal); P.disc(10, 4, 2, C.yellow); P.disc(22, 4, 2, C.navy); },
  // a spin carried from one magnet to the other by a sound wave
  prb2020(P) { P.rect(3, 7, 5, 6, C.red); P.rect(24, 7, 5, 6, C.red); for (let i = 8; i < 24; i++) P.px(i, 10 + Math.round(2 * Math.sin(i * 0.9)), C.teal); P.ring(16, 4, 2, C.violet); P.px(18, 2, C.violet); },
  // two magnetic layers, and a faster wave through them
  pra2019(P) { P.rect(3, 8, 26, 3, C.orange); P.rect(3, 11, 26, 3, C.lav); for (let i = 3; i < 29; i++) P.px(i, 5 + Math.round(2 * Math.sin(i * 0.5)), C.blue); P.line(22, 3, 27, 3, C.red); P.px(26, 2, C.red); P.px(26, 4, C.red); },
  // a laser heats a magnet: spins and lattice end up at different temperatures
  prl2016(P) { P.line(4, 1, 14, 9, C.green); P.line(5, 1, 15, 9, C.green); P.rect(4, 10, 24, 5, C.steelL); P.rect(22, 2, 2, 7, C.red); P.rect(26, 4, 2, 5, C.blue); P.disc(23, 9, 1, C.red); P.disc(27, 9, 1, C.blue); },
};
D.frame = { w: 2, h: 2, wall: true, sprite: (o) => {
  const P = new Pix(32, 30);
  P.rect(0, 0, 32, 22, C.woodD); P.rect(1, 1, 30, 20, C.gold); P.rect(3, 3, 26, 16, C.snow);
  P.at(0, 3); (FRAME_ART[o.kind] || FRAME_ART.nc2024)(P); P.at(0, 0);
  P.rect(9, 24, 14, 6, C.brassD); P.rect(10, 25, 12, 4, C.brass);
  tinyText(P, String(o.year || ''), 10 + Math.max(0, (12 - (String(o.year || '').length * 4 - 1)) / 2), 25, C.out);
  return P.c;
} };
const PHOTO_ART = {
  poster(P) { P.rect(0, 0, 26, 16, '#3D6FB6'); P.rect(9, 2, 14, 11, C.snow); for (let j = 4; j < 12; j += 2) P.hl(11, j, 10, C.steel); P.rect(3, 5, 4, 4, C.skin); P.rect(2, 9, 6, 7, C.teal); P.disc(18, 13, 2, C.steelL); },
  setup(P) { P.rect(0, 0, 26, 16, C.night); P.rect(0, 11, 26, 5, C.ink); P.rect(2, 7, 4, 4, C.brass); P.rect(20, 5, 4, 4, C.brass); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) P.px(11 + i * 2, 6 + j * 2, C.steelL); P.rect(10, 11, 7, 2, C.mint); },
  team(P) { P.rect(0, 0, 26, 16, C.sky); P.rect(0, 0, 26, 4, C.blue); tinyText(P, 'KPS', 8, 0, C.snow); for (let i = 0; i < 6; i++) { P.rect(2 + i * 4, 7, 3, 3, C.skin); P.rect(2 + i * 4, 10, 3, 6, [C.teal, C.red, C.navy, C.green, C.violet, C.orange][i]); } },
};
D.photo = { w: 2, h: 2, wall: true, sprite: (o) => {
  const P = new Pix(32, 26);
  P.rect(0, 0, 32, 22, C.out); P.rect(1, 1, 30, 20, C.snow); P.rect(2, 2, 28, 18, C.steelL);
  P.at(3, 3); (PHOTO_ART[o.kind] || PHOTO_ART.poster)(P); P.at(0, 0);
  P.rect(14, 22, 4, 2, C.steelD);
  return P.c;
} };


// ---------------------------------------------------------------- Korean touches
// Hangul is drawn with the Galmuri pixel fonts (see pix.js hangul()).

// a signpost with the room's Korean name over its English one
D.ksign = { w: 1, h: 1, sprite: (o) => {
  const ko = o.ko || '', en = o.en || '', kw = ko ? hangulWidth(ko, 8) : 0, ew = en ? tinyWidth(en) : 0;
  const w = Math.max(kw, ew) + 8, bh = (ko ? 11 : 0) + (en ? 7 : 0) + 3;
  return make(w, bh + 10, (P) => {
    const [m, s, h] = TONES[o.tone || 'teal'];
    P.rect(0, 0, w, bh, s); P.rect(1, 1, w - 2, bh - 2, m); P.hl(1, 1, w - 2, h);
    if (ko) hangul(P, ko, Math.round((w - kw) / 2), 2, C.out, { size: 8 });
    if (en) tinyText(P, en, Math.round((w - ew) / 2), ko ? 13 : 3, mix(C.out, m, 0.3));
    P.vl(Math.floor(w / 2) - 1, bh, 9, C.woodD); P.vl(Math.floor(w / 2), bh, 9, C.wood);
    P.rect(Math.floor(w / 2) - 3, bh + 8, 6, 2, C.woodD);
  });
} };

// a folding screen with the sun, the moon and five peaks (일월오봉도), the old royal painting
D.screen = { w: 3, h: 1, sprite: () => make(48, 30, (P) => {
  const frame = '#7A2E22', frameL = '#A8483A';
  P.rect(0, 0, 48, 27, frame); P.hl(0, 0, 48, frameL);
  P.rect(2, 2, 44, 22, '#2E4A7D');                     // the night-blue sky
  P.disc(9, 7, 3, C.red); P.px(8, 6, '#FF9F94');         // the sun
  P.disc(39, 7, 3, C.snow); P.px(38, 6, '#FFFFFF');      // the moon
  // five peaks, the middle one tallest
  const peak = (cx, top, half, c, cL) => { for (let y = top; y < 21; y++) { const k = Math.round((y - top) * half / (21 - top)); P.hl(cx - k, y, 2 * k + 1, c); P.px(cx - k, y, cL); } };
  peak(24, 6, 9, '#2F7D5B', '#4CB782'); peak(13, 10, 7, '#3A9A55', '#62C46E'); peak(35, 10, 7, '#3A9A55', '#62C46E');
  peak(5, 13, 5, '#2F7D5B', '#4CB782'); peak(43, 13, 5, '#2F7D5B', '#4CB782');
  // pines on both sides
  for (const x of [3, 44]) { P.vl(x, 14, 8, C.copperD); P.oval(x - 2, 12, 5, 3, '#1E6B45'); P.oval(x - 3, 15, 7, 3, '#1E6B45'); }
  // waves along the bottom
  P.rect(2, 20, 44, 4, '#3D6FB6');
  for (let x = 3; x < 46; x += 4) { P.px(x, 20, C.snow); P.px(x + 1, 21, C.snow); P.px(x - 1, 21, C.ice); }
  // the folds: every panel edge catches the light a little differently
  for (let x = 2; x < 46; x += 8) { P.vl(x, 2, 22, 'rgba(255,255,255,0.10)'); P.vl(x + 7, 2, 22, 'rgba(19,36,71,0.25)'); }
  P.rect(1, 27, 3, 3, frame); P.rect(44, 27, 3, 3, frame); P.rect(22, 27, 3, 3, frame);
}) };

// a blue-and-red silk lantern (청사초롱) on a post
D.chorong = { w: 1, h: 1, sprite: () => make(12, 32, (P) => {
  P.vl(5, 0, 32, C.woodD); P.vl(6, 0, 32, C.wood); P.rect(2, 30, 8, 2, C.woodD);
  P.hl(3, 2, 6, C.woodD);                                 // the arm it hangs from
  P.rect(2, 4, 8, 2, C.gold); P.hl(2, 4, 8, C.yellow);    // top cap
  P.rect(1, 6, 10, 6, '#2E6BC2'); P.rect(3, 7, 6, 4, '#6FA8F0');   // blue silk
  P.rect(1, 12, 10, 6, C.red); P.rect(3, 13, 6, 4, '#FF9F94');     // red silk
  P.vl(1, 6, 12, C.redD); P.vl(10, 6, 12, C.redD);
  P.rect(2, 18, 8, 2, C.gold);                            // bottom cap
  P.vl(5, 20, 4, C.red); P.vl(6, 20, 3, C.redD);          // tassel
}) };

// a celadon vase (청자 매병) with white cranes and clouds inlaid, on a little stand
D.vase = { w: 1, h: 1, sprite: () => make(14, 26, (P) => {
  const c = '#8CC7A8', cD = '#5FA383', cL = '#BFE8D2';
  P.rect(5, 0, 4, 2, c); P.hl(5, 0, 4, cL);               // mouth
  P.rect(3, 2, 8, 2, c); P.oval(1, 3, 12, 8, c); P.rect(2, 8, 10, 6, c); P.rect(3, 14, 8, 3, c); P.rect(4, 17, 6, 2, c);
  P.vl(11, 5, 10, cD); P.vl(10, 14, 4, cD); P.vl(2, 5, 3, cL); P.vl(3, 8, 4, cL);
  // a crane and a cloud
  P.px(5, 7, C.snow); P.px(6, 6, C.snow); P.px(7, 7, C.snow); P.px(6, 8, C.out); P.px(8, 11, C.snow); P.px(9, 11, C.snow); P.px(9, 10, C.snow);
  P.rect(2, 19, 10, 3, C.bark); P.hl(2, 19, 10, C.woodD); P.rect(2, 22, 2, 4, C.bark); P.rect(10, 22, 2, 4, C.bark);
}) };

// a pine bonsai in a shallow pot
D.bonsai = { w: 1, h: 1, sprite: () => make(16, 22, (P) => {
  P.line(8, 17, 6, 12, C.bark); P.line(7, 17, 5, 12, C.bark); P.line(6, 12, 9, 7, C.bark); P.line(9, 8, 12, 6, C.bark); P.line(6, 12, 3, 9, C.bark);
  P.oval(1, 6, 7, 4, '#2F7D5B'); P.oval(7, 3, 8, 4, '#3A9A55'); P.oval(4, 0, 7, 4, '#2F7D5B');
  P.hl(2, 6, 4, '#62C46E'); P.hl(9, 3, 4, '#62C46E'); P.hl(6, 0, 3, '#62C46E');
  P.rect(1, 17, 14, 4, '#3D6FB6'); P.hl(1, 17, 14, '#6FB7F0'); P.hl(1, 20, 14, C.navy); P.rect(2, 21, 2, 1, C.navy); P.rect(12, 21, 2, 1, C.navy);
  P.hl(3, 16, 10, C.bark);
}) };

// a hanging scroll in brush lettering: 격물치지, "study things to their roots to know"
D.scroll = { w: 2, h: 2, wall: true, sprite: (o) => {
  const P = new Pix(28, 32);
  P.rect(1, 0, 26, 2, C.bark); P.px(0, 0, C.woodD); P.px(27, 0, C.woodD);
  P.rect(2, 2, 24, 26, '#C9DCEE'); P.rect(4, 4, 20, 22, '#FFF8E8');
  const t = o.text || '격물치지';
  // two lines of two, read left to right as modern Korean is
  [t.slice(0, 2), t.slice(2, 4)].forEach((line, j) => { const w = hangulWidth(line, 8); hangul(P, line, Math.round((28 - w) / 2), 5 + j * 9, C.out, { size: 8 }); });
  P.rect(6, 22, 3, 3, C.red); P.px(7, 23, '#FF9F94');     // the red seal
  P.rect(1, 28, 26, 2, C.bark); P.rect(0, 28, 2, 3, C.woodD); P.rect(26, 28, 2, 3, C.woodD);
  return P.c;
} };

// 화이팅! — a cheering poster
D.cheer = { w: 2, h: 2, wall: true, sprite: () => {
  const P = new Pix(32, 26);
  P.rect(0, 0, 32, 23, C.out); P.rect(1, 1, 30, 21, C.yellow); P.dither(1, 1, 30, 21, '#FFE9A0', 0);
  const w = hangulWidth('화이팅!', 8);
  hangul(P, '화이팅!', Math.round((32 - w) / 2), 3, C.redD, { size: 8 });
  // a little fist and stars
  P.rect(13, 13, 6, 5, C.skin); P.hl(13, 13, 6, '#FFE7D4'); P.px(14, 15, C.skinD); P.px(16, 15, C.skinD); P.rect(14, 18, 4, 3, C.red);
  for (const [x, y] of [[5, 15], [26, 14], [8, 19], [23, 19]]) { P.px(x, y, C.orange); P.px(x - 1, y, C.orange); P.px(x + 1, y, C.orange); P.px(x, y - 1, C.orange); P.px(x, y + 1, C.orange); }
  return P.c;
} };

// 편의점: a little convenience-store fridge with banana milk and cup ramyeon
D.cstore = { w: 2, h: 1, sprite: () => make(32, 40, (P) => {
  P.rect(0, 0, 32, 9, '#00A9D6'); P.hl(0, 0, 32, '#7FE4FF'); P.hl(0, 8, 32, C.deep);
  const w = hangulWidth('편의점', 8); hangul(P, '편의점', Math.round((32 - w) / 2), 0, C.snow, { size: 8 });
  P.rect(0, 9, 32, 31, C.steelL); P.vl(31, 9, 31, C.steel); P.rect(2, 11, 28, 25, C.glass);
  // banana milk: the famous round jug, two shelves of it
  for (const y of [13, 20]) {
    for (let i = 0; i < 6; i++) { const x = 3 + i * 4; P.rect(x, y + 1, 3, 4, C.yellow); P.hl(x, y + 1, 3, '#FFF1B0'); P.px(x + 1, y, C.snow); P.px(x + 2, y + 3, C.orange); }
    P.hl(2, y + 5, 28, C.steel);
  }
  // cup ramyeon at the bottom
  for (let i = 0; i < 5; i++) { const x = 3 + i * 5; P.rect(x, 28, 4, 5, C.red); P.hl(x, 28, 4, C.snow); P.px(x + 1, 30, C.yellow); }
  P.vl(16, 11, 25, C.steel); P.rect(14, 22, 1, 4, C.steelX); P.rect(17, 22, 1, 4, C.steelX);
  P.rect(0, 36, 32, 4, C.steelD);
}) };

// 노래방: a karaoke booth with a neon sign
D.noraebang = { w: 3, h: 2, sprite: () => make(48, 46, (P) => {
  P.rect(0, 10, 48, 36, '#4A3A8C'); P.hl(0, 10, 48, '#6B5BE6'); P.vl(47, 10, 36, C.out);
  P.rect(2, 0, 44, 11, C.night); P.rect(3, 1, 42, 9, '#1B2440');
  const w = hangulWidth('노래방', 8); hangul(P, '노래방', Math.round((48 - w) / 2), 1, C.pink, { size: 8 });
  // the window: a screen with notes, and a microphone
  P.rect(5, 15, 24, 16, C.night); P.rect(6, 16, 22, 11, '#1A3566');
  P.hl(8, 24, 18, C.lav); P.hl(8, 26, 12, C.ice);
  P.rect(33, 16, 11, 30, '#2A1F5C'); P.rect(34, 17, 9, 28, '#3A2E78'); P.px(41, 31, C.gold);   // the door
  P.vl(16, 32, 10, C.steelD); P.disc(16, 31, 1, C.steelL); P.rect(13, 42, 7, 2, C.steelD);
}), anim(P, x, y, t) {
  // the neon breathes, the notes drift across the screen
  const on = 0.5 + 0.5 * Math.sin(t * 3);
  if (on > 0.3) { P.hl(x + 4, y + 2, 2, C.cyan); P.hl(x + 42, y + 8, 2, C.cyan); }
  for (let k = 0; k < 3; k++) {
    const nx = x + 8 + ((t * 6 + k * 7) % 18), ny = y + 18 + ((k * 2 + Math.floor(t * 2)) % 3);
    P.px(nx, ny + 2, C.yellow); P.px(nx + 1, ny + 2, C.yellow); P.vl(nx + 1, ny, 2, C.yellow);
  }
} };

// 인형뽑기: a claw machine full of plush versions of the people in the building
D.claw = { w: 2, h: 1, sprite: () => make(32, 46, (P) => {
  P.rect(0, 0, 32, 46, C.pink); P.hl(0, 0, 32, C.blush); P.vl(31, 0, 46, C.rose);
  P.rect(2, 1, 28, 8, C.rose); const w = hangulWidth('뽑기', 8); hangul(P, '뽑기', Math.round((32 - w) / 2), 1, C.snow, { size: 8 });
  P.rect(2, 10, 28, 22, C.glass); P.hl(3, 11, 26, '#FFFFFF');
  // plush toys in a heap: owl, penguin, fox, robot, cat, robot
  const toys = [[5, 26, C.wood], [10, 27, C.ink], [15, 26, C.orange], [20, 27, C.snow], [25, 26, C.sand], [8, 22, C.snow], [17, 22, C.wood], [22, 22, C.ink]];
  for (const [x, y, c] of toys) { P.disc(x, y, 2, c); P.px(x - 1, y - 1, C.out); P.px(x + 1, y - 1, C.out); P.px(x - 2, y + 1, C.blush); }
  P.rect(2, 32, 28, 14, C.rose); P.hl(2, 32, 28, C.pink);
  P.rect(6, 35, 6, 4, C.night); P.vl(9, 33, 3, C.steelD); P.disc(9, 33, 1, C.red);   // the joystick
  P.disc(22, 37, 2, C.yellow); P.px(21, 36, '#FFFFFF');                               // the button
  P.rect(13, 41, 6, 3, C.out);
}), anim(P, x, y, t) {
  // the claw swings a little on its cable
  const cx = x + 16 + Math.round(5 * Math.sin(t * 0.9)), cy = y + 11;
  P.vl(cx, cy, 4 + Math.round(1 + Math.sin(t * 1.7)), C.steelD);
  const by = cy + 5 + Math.round(1 + Math.sin(t * 1.7));
  P.hl(cx - 2, by, 5, C.steelX); P.px(cx - 2, by + 1, C.steelX); P.px(cx + 2, by + 1, C.steelX); P.px(cx - 3, by + 2, C.steelX); P.px(cx + 3, by + 2, C.steelX);
} };

// a low table (소반) with tea, and rice cakes dusted in soybean powder
D.lowtable = { w: 2, h: 1, sprite: () => make(32, 16, (P) => {
  P.rect(0, 4, 32, 6, '#7A2E22'); P.hl(0, 4, 32, '#A8483A'); P.hl(0, 9, 32, '#5C2018');
  P.rect(2, 10, 3, 5, '#5C2018'); P.rect(27, 10, 3, 5, '#5C2018'); P.hl(1, 14, 5, '#5C2018'); P.hl(26, 14, 5, '#5C2018');
  // a celadon teapot and two cups
  P.oval(5, 0, 8, 6, '#8CC7A8'); P.hl(6, 0, 6, '#BFE8D2'); P.px(13, 2, '#8CC7A8'); P.px(14, 1, '#8CC7A8'); P.px(4, 3, '#5FA383');
  P.rect(16, 3, 3, 2, '#BFE8D2'); P.rect(21, 3, 3, 2, '#BFE8D2');
  // injeolmi on a plate
  P.oval(24, 2, 7, 3, C.snow); P.rect(25, 2, 2, 2, C.sand); P.rect(28, 2, 2, 2, C.tan);
}) };

// a floor cushion (방석) in silk with rainbow edges
D.cushion = { w: 1, h: 1, floor: true, sprite: (o) => {
  const P = new Pix(16, 16), [m, s, h] = TONES[o.tone || 'rose'];
  P.rect(2, 3, 12, 11, s); P.rect(3, 4, 10, 9, m); P.rect(5, 6, 6, 5, h);
  P.hl(3, 4, 10, '#FFFFFF33'); P.px(8, 8, s);
  const sd = [C.red, C.yellow, C.green, C.blue, C.pink];
  for (let i = 0; i < 12; i++) P.px(2 + i, 14, sd[i % 5]);
  return P.c;
} };

// 직지: a page of the oldest surviving book printed with movable metal type (Cheongju, 1377)
D.jikji = { w: 2, h: 2, wall: true, sprite: () => {
  const P = new Pix(32, 30);
  P.rect(0, 0, 32, 24, C.woodD); P.rect(1, 1, 30, 22, '#E8D3A2'); P.dither(1, 1, 30, 22, '#DCC18A', 1);
  P.rect(3, 3, 26, 18, '#F2E2BC');
  for (let c = 0; c < 6; c++) for (let j = 0; j < 15; j += 2) if ((c * 7 + j) % 5) P.px(26 - c * 4, 4 + j, '#5C3A2A');
  const w = hangulWidth('직지', 8); P.rect(4, 4, w + 2, 10, '#F2E2BC'); hangul(P, '직지', 5, 4, C.redD, { size: 8 });
  P.rect(5, 16, 3, 3, C.red);
  P.rect(8, 25, 16, 5, C.brassD); P.rect(9, 26, 14, 3, C.brass); tinyText(P, '1377', 9, 26, C.out);
  return P.c;
} };

// the counter, with a Korean welcome on its front
D.kcounter = { w: 3, h: 1, sprite: () => make(48, 22, (P) => {
  P.rect(0, 0, 48, 8, C.snow); P.hl(0, 0, 48, '#FFFFFF'); P.hl(0, 7, 48, C.steelL);
  P.rect(0, 8, 48, 14, C.navy); P.hl(0, 8, 48, C.blue); P.hl(0, 21, 48, C.ink);
  P.rect(0, 10, 48, 1, C.cyan);
  const w = hangulWidth('어서오세요', 8); hangul(P, '어서오세요', Math.round((48 - w) / 2), 12, C.ice, { size: 8 });
  P.rect(5, 3, 5, 2, C.gold); P.px(7, 2, C.gold);
  P.rect(36, 1, 8, 5, C.steelD); P.rect(37, 2, 6, 3, C.night); P.hl(38, 3, 3, C.cyan);
}) };

// ---------------------------------------------------------------- the puzzle of the day, and the seasons
// an A-frame chalkboard: 오늘의 문제, "today's puzzle"
D.daily = { w: 1, h: 1, sprite: () => make(20, 30, (P) => {
  P.line(2, 29, 5, 2, C.woodD); P.line(17, 29, 14, 2, C.woodD); P.line(3, 29, 6, 2, C.wood); P.line(16, 29, 13, 2, C.wood);
  P.rect(1, 3, 18, 20, C.woodD); P.rect(2, 4, 16, 18, '#2B6E54'); P.dither(2, 4, 16, 18, '#2F7559', 0);
  const a = hangulWidth('오늘의', 8), b = hangulWidth('문제', 8);
  hangul(P, '오늘의', Math.round((20 - a) / 2), 4, C.snow, { size: 8 }); hangul(P, '문제', Math.round((20 - b) / 2), 13, C.yellow, { size: 8 });
  P.hl(4, 22, 12, C.woodD);
}), anim(P, x, y, t) { if ((t * 2 % 2) < 1.4) { P.px(x + 17, y + 2, C.yellow); P.px(x + 18, y + 1, C.yellow); } } };

// a standing banner on two poles, for greetings
D.banner = { w: 4, h: 1, sprite: (o) => make(64, 34, (P) => {
  const [bg, ink, edge] = o.tone === 'red' ? [C.red, C.snow, C.redD] : o.tone === 'green' ? ['#2F7D5B', C.snow, '#1E5A40'] : o.tone === 'navy' ? [C.navy, C.yellow, C.ink] : [C.orange, C.out, C.orangeD];
  P.vl(2, 0, 34, C.woodD); P.vl(61, 0, 34, C.woodD); P.rect(0, 32, 5, 2, C.woodD); P.rect(59, 32, 5, 2, C.woodD);
  P.rect(3, 2, 58, 22, edge); P.rect(4, 3, 56, 20, bg);
  const lines = o.lines || [];
  lines.forEach((t, i) => { const w = hangulWidth(t, 8); hangul(P, t, Math.round((64 - w) / 2), 4 + i * 9, ink, { size: 8 }); });
  if (o.en) tinyText(P, o.en, Math.round((64 - tinyWidth(o.en)) / 2), lines.length > 1 ? 24 : 14, edge);
  for (let i = 5; i < 60; i += 6) P.px(i, 23, ink);
}) };

// a jack-o'-lantern, glowing
D.pumpkin = { w: 1, h: 1, sprite: (o) => make(16, 14, (P) => {
  P.oval(1, 3, 14, 11, C.orange); P.vl(5, 4, 9, C.orangeD); P.vl(10, 4, 9, C.orangeD); P.hl(3, 4, 10, '#FFC98F');
  P.rect(7, 0, 2, 4, C.greenD); P.px(9, 1, C.leaf);
  if (!o.plain) { P.px(5, 7, C.yellow); P.px(10, 7, C.yellow); P.px(4, 7, C.yellow); P.px(11, 7, C.yellow); P.hl(5, 10, 6, C.yellow); P.px(6, 11, C.yellow); P.px(9, 11, C.yellow); }
}) };

// a little Christmas tree
D.xtree = { w: 1, h: 1, sprite: () => make(16, 30, (P) => {
  for (let j = 0; j < 4; j++) { const y = 4 + j * 5, w = 6 + j * 3; P.rect(8 - w / 2, y, w, 6, j % 2 ? '#2F7D5B' : '#3A9A55'); }
  P.rect(6, 24, 4, 3, C.bark); P.rect(4, 27, 8, 3, C.red);
  P.px(8, 2, C.yellow); P.px(7, 3, C.yellow); P.px(9, 3, C.yellow); P.px(8, 1, C.yellow);
  for (const [x, y, c] of [[6, 8, C.red], [10, 12, C.cyan], [5, 16, C.yellow], [11, 18, C.pink], [7, 21, C.cyan], [9, 9, C.yellow]]) P.px(x, y, c);
}) };

export const PROPS = { ...D, ...A };

// ---------------------------------------------------------------- caching
const spriteCache = new Map();
export function propSprite(p) {
  const def = PROPS[p.type];
  if (!def) throw new Error('unknown prop ' + p.type);
  const key = p.type + ':' + JSON.stringify(p.opt || {});
  if (!spriteCache.has(key)) spriteCache.set(key, def.sprite(p.opt || {}));
  return spriteCache.get(key);
}
