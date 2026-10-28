// Furniture and apparatus. Each type has a footprint in tiles, a sprite drawn once (and
// outlined), and optionally an animation painted every frame on top of the sprite.
// Sprites stand on the bottom edge of their footprint and are centred on it.

import { PAL, Pix, outline, tinyText, mix } from './pix.js';

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

D.directory = { w: 3, h: 1, sprite: (o) => make(60, 34, (P) => {
  P.rect(27, 22, 6, 12, C.steelD); P.rect(22, 32, 16, 2, C.steelX);
  P.rect(0, 0, 60, 23, C.night); P.rect(1, 1, 58, 21, '#1A3566');
  P.hl(1, 1, 58, C.cyan);
  const lines = o.lines || ['3F MAGNONICS', '2F PLAYGROUND', '1F CLASSICS'];
  lines.forEach((t, i) => { P.rect(3, 4 + i * 6, 3, 4, [C.cyan, C.lav, C.gold][i % 3]); tinyText(P, t, 7, 4 + i * 6, '#DDF6FF'); });
}) };

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
