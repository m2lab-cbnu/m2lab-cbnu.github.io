// Floors, walls, windows, the elevator and the stairs, drawn into one static layer per floor.
// Tiles are 16 x 16. A map is a list of text rows; each floor has its own colours.

import { PAL, Pix, canvas, mix, tinyText } from './pix.js';

export const TILE = 16;

// what each map character means
//   #  wall top           W / w  wall face (upper / lower half)     O / o  window (upper / lower)
//   E / e elevator doors   U  stairs up      Z  stairs down          D  front door (exit)
//   .  main floor          ,  second floor type   :  third floor type  ~  dark floor   =  lane
//   (space) outside the building
export const WALLS = new Set(['#', 'W', 'w', 'O', 'o', 'E', 'e']);
export const FACES = new Set(['W', 'w', 'O', 'o', 'E', 'e']);

export const STYLES = {
  1: {
    name: 'Classics', main: 'wood', alt: 'checker', third: 'rug',
    face: '#FFF4DE', faceS: '#F2DDB8', panel: '#D9A066', panelS: '#B97A40', panelH: '#E9B77E', base: PAL.bark,
    cap: PAL.navy, capH: PAL.blue, capS: PAL.ink,
  },
  2: {
    name: 'Playground', main: 'mint', alt: 'carpet', third: 'sunny',
    face: '#F1ECFF', faceS: '#DCD2FF', panel: '#9BE3C1', panelS: '#62C49A', panelH: '#C9F3DD', base: PAL.plum,
    cap: PAL.plum, capH: PAL.violet, capS: '#33286A',
  },
  3: {
    name: 'Magnonics', main: 'lab', alt: 'walk', third: 'grate',
    face: '#EEF8FD', faceS: '#D6ECF7', panel: '#CFE7F5', panelS: '#A8D3EA', panelH: PAL.cyan, base: PAL.ink,
    cap: PAL.ink, capH: PAL.navy, capS: PAL.out,
  },
};

// deterministic hash for tile-level variation
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// ---------------------------------------------------------------- floor tiles
const FLOORS = {
  wood(P, x, y, tx, ty) {
    const base = ['#EDBF89', '#E8B880', '#F1C793'];
    for (let r = 0; r < 4; r++) {
      const row = ty * 4 + r, off = (row * 19) % 48;
      for (let i = 0; i < 16; i++) {
        const gx = tx * 16 + i, plank = Math.floor((gx + off) / 48);
        P.rect(x + i, y + r * 4, 1, 4, base[Math.floor(hash(plank, row, 3) * 3)]);
        if ((gx + off) % 48 === 0) P.rect(x + i, y + r * 4, 1, 3, '#D29A5E');
      }
      P.hl(x, y + r * 4 + 3, 16, '#DEA86C');
      if (hash(tx, row, 9) > 0.9) { const k = Math.floor(hash(tx, row, 4) * 12) + 2; P.hl(x + k, y + r * 4 + 1, 3, '#E2AD72'); }
    }
  },
  checker(P, x, y, tx, ty) {
    const a = (tx + ty) & 1;
    P.rect(x, y, 16, 16, a ? '#FFF4DC' : '#F8E4BC');
    P.hl(x, y, 16, a ? '#FFFBEE' : '#FCEDCF');
    P.vl(x, y, 16, a ? '#FFFBEE' : '#FCEDCF');
    P.hl(x, y + 15, 16, '#E9CF9E'); P.vl(x + 15, y, 16, '#E9CF9E');
    if (a && hash(tx, ty, 1) > 0.6) { P.px(x + 4, y + 4, '#FFFFFF'); P.px(x + 5, y + 3, '#FFFFFF'); }
  },
  rug(P, x, y, tx, ty) {
    P.rect(x, y, 16, 16, '#2E4A7D');
    P.dither(x, y, 16, 16, '#35548A', (tx + ty) & 1);
  },
  mint(P, x, y, tx, ty) {
    P.rect(x, y, 16, 16, '#D3F4E3');
    for (let k = 0; k < 6; k++) {
      const sx = Math.floor(hash(tx, ty, k) * 16), sy = Math.floor(hash(ty, tx, k + 7) * 16);
      P.px(x + sx, y + sy, k % 3 === 0 ? '#FFFFFF' : '#A7E6C6');
    }
    if (tx % 2 === 0) P.vl(x, y, 16, '#BDEBD3');
    if (ty % 2 === 0) P.hl(x, y, 16, '#BDEBD3');
  },
  carpet(P, x, y, tx, ty) {
    P.rect(x, y, 16, 16, '#E7DFFF');
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
      const u = (i + 8) % 16, v = (j + 8) % 16;
      if (Math.abs(u - 8) + Math.abs(v - 8) === 6) P.px(x + i, y + j, '#D2C4FF');
    }
    P.px(x + 8, y + 8, '#C2B0FF');
  },
  sunny(P, x, y, tx, ty) {   // yellow play mat
    P.rect(x, y, 16, 16, (tx + ty) & 1 ? '#FFE9A8' : '#FFDF8A');
    P.hl(x, y + 15, 16, '#F2CC6B'); P.vl(x + 15, y, 16, '#F2CC6B');
  },
  lab(P, x, y, tx, ty) {
    P.rect(x, y, 16, 16, '#E8F6FC');
    P.hl(x, y, 16, '#D3ECF7'); P.vl(x, y, 16, '#D3ECF7');
    P.px(x, y, '#A8D8EE'); P.px(x + 1, y, '#BFE3F3'); P.px(x, y + 1, '#BFE3F3');
    if (hash(tx, ty, 2) > 0.8) P.hl(x + 5, y + 9, 4, '#F4FBFE');
  },
  walk(P, x, y, tx, ty) {
    P.rect(x, y, 16, 16, '#D8EEF8');
    P.hl(x, y, 16, '#C5E4F3');
    P.rect(x + 6, y + 7, 4, 2, (tx + ty) % 2 ? '#7FE4FF' : '#BDEFFF');
  },
  grate(P, x, y, tx, ty) {
    P.rect(x, y, 16, 16, '#B9D3E6');
    for (let j = 1; j < 16; j += 3) P.hl(x + 1, y + j, 14, '#9DBAD3');
    P.hl(x, y, 16, '#CFE0F0'); P.vl(x, y, 16, '#CFE0F0');
  },
  dark(P, x, y, tx, ty) {
    P.rect(x, y, 16, 16, '#22325C');
    if ((tx + ty) & 1) P.px(x + 7, y + 7, '#2E4A7D');
  },
  lane(P, x, y, tx, ty) {
    FLOORS.wood(P, x, y, tx, ty);
    if (tx % 2 === 0) P.rect(x, y, 1, 16, '#FFFDF6');
  },
};

// ---------------------------------------------------------------- walls
function drawCap(P, x, y, st, n) {
  P.rect(x, y, 16, 16, st.cap);
  // light edges facing open floor
  if (!n.N) P.hl(x, y, 16, st.capH);
  if (!n.W) P.vl(x, y, 16, st.capH);
  if (!n.E) P.vl(x + 15, y, 16, st.capS);
  if (!n.S) { P.hl(x, y + 15, 16, st.capS); P.hl(x, y + 14, 16, st.capH); }
}

function drawFace(P, x, y, st, upper, fl) {
  P.rect(x, y, 16, 16, st.face);
  if (upper) {
    P.rect(x, y, 16, 2, st.faceS);
    if (fl === 3) P.hl(x, y + 2, 16, '#D6ECF7');
  } else {
    // wainscot or stripe on the lower half, then the skirting board
    if (fl === 1) { P.rect(x, y + 4, 16, 10, st.panel); P.hl(x, y + 4, 16, st.panelH); P.hl(x, y + 5, 16, st.panelS); P.vl(x + 7, y + 6, 8, st.panelS); P.vl(x + 15, y + 6, 8, st.panelS); }
    if (fl === 2) { P.rect(x, y + 6, 16, 3, st.panel); P.hl(x, y + 6, 16, st.panelH); P.hl(x, y + 8, 16, st.panelS); }
    if (fl === 3) { P.rect(x, y + 6, 16, 2, PAL.cyan); P.hl(x, y + 8, 16, '#BDEFFF'); }
    P.rect(x, y + 14, 16, 2, st.base);
  }
}

function drawWindow(P, x, y, upper, left, right, fl) {
  const frame = PAL.steelL, frameD = PAL.steelD;
  // sky gradient through both halves
  for (let j = 0; j < 16; j++) {
    const t = (upper ? j : 16 + j) / 32;
    P.hl(x, y + j, 16, mix('#8FD3FF', '#D9F4FF', t));
  }
  if (!upper) {
    // skyline: rounded future towers
    const h = [9, 13, 7, 11, 14, 8, 12, 10, 6, 12, 9, 13, 8, 11, 7, 10];
    for (let i = 0; i < 16; i++) {
      const gx = x + i, hh = h[(i + Math.floor(x / 16) * 5) % 16];
      P.rect(gx, y + 16 - hh, 1, hh, (Math.floor((x + i) / 4) % 2) ? '#7FA6DA' : '#6C93CC');
      if ((i % 4 === 1) && hh > 8) { P.px(gx, y + 16 - hh + 3, '#FFE07A'); P.px(gx, y + 16 - hh + 6, '#BDEFFF'); }
    }
    if (fl === 3) { P.hl(x, y + 6, 16, 'rgba(0,212,255,0.35)'); }
  } else {
    // a soft cloud now and then
    if ((x / 16) % 3 === 0) { P.rect(x + 3, y + 6, 7, 2, '#FFFFFF'); P.rect(x + 5, y + 5, 4, 1, '#FFFFFF'); P.hl(x + 3, y + 8, 7, '#E3F6FF'); }
  }
  // frame
  if (upper) { P.hl(x, y, 16, frameD); P.hl(x, y + 1, 16, frame); }
  else { P.rect(x, y + 13, 16, 3, frame); P.hl(x, y + 13, 16, '#FFFFFF'); P.hl(x, y + 15, 16, frameD); }
  if (left) { P.vl(x, y, 16, frameD); P.vl(x + 1, y, 16, frame); }
  if (right) { P.vl(x + 15, y, 16, frameD); P.vl(x + 14, y, 16, frame); }
  else P.vl(x + 15, y, 16, frame);   // mullion between panes
}

const RUNNER = { 1: ['#FF8FAB', '#E0457B'], 2: ['#B9A8FF', '#6B5BE6'], 3: ['#7FE4FF', '#00A9D6'] };

// the whole two-by-two elevator, painted at its top-left tile
function drawElevatorUnit(P, x, y, st, fl) {
  drawFace(P, x, y, st, true, fl); drawFace(P, x + 16, y, st, true, fl);
  drawFace(P, x, y + 16, st, false, fl); drawFace(P, x + 16, y + 16, st, false, fl);
  P.rect(x + 2, y + 7, 28, 25, PAL.steelD);
  P.hl(x + 2, y + 7, 28, PAL.steelX);
  P.rect(x + 4, y + 9, 24, 23, PAL.steelL);
  P.vl(x + 15, y + 9, 23, PAL.steelD); P.vl(x + 16, y + 9, 23, PAL.steel);
  P.vl(x + 7, y + 11, 8, '#FFFFFF'); P.vl(x + 19, y + 11, 8, '#FFFFFF');
  P.hl(x + 4, y + 31, 24, PAL.steelX);
  P.rect(x + 11, y, 10, 7, PAL.night);
  tinyText(P, fl + 'F', x + 13, y + 1, PAL.cyan);
  // call button
  P.rect(x + 29, y + 17, 3, 5, PAL.steelX); P.px(x + 30, y + 18, PAL.cyan); P.px(x + 30, y + 20, PAL.yellow);
}

// stairs set into the wall, painted at their top-left tile
function drawStairsUnit(P, x, y, up, st, fl) {
  const [run, runD] = RUNNER[fl] || RUNNER[1];
  P.rect(x, y, 32, 32, st.cap);
  for (let k = 0; k < 8; k++) {
    const y0 = y + 4 * k, t = k / 7;   // 0 = far (top), 1 = near (bottom)
    const tread = up ? mix('#B7CBE3', '#FFFFFF', t) : mix('#22325C', '#C9DBEE', t);
    const riser = up ? mix('#6A86A8', '#9DB8D3', t) : mix('#1B2440', '#7FA0C6', t);
    P.rect(x + 4, y0, 24, 3, tread); P.hl(x + 4, y0 + 3, 24, riser);
    P.rect(x + 12, y0, 8, 3, up ? mix(runD, run, t) : mix('#1B2440', run, t)); P.hl(x + 12, y0 + 3, 8, up ? runD : mix('#1B2440', runD, t));
  }
  // flanking walls and handrails
  P.rect(x, y, 4, 32, st.cap); P.vl(x + 3, y, 32, st.capS);
  P.rect(x + 28, y, 4, 32, st.cap); P.vl(x + 28, y, 32, st.capS);
  P.vl(x + 5, y + 2, 30, PAL.woodD); P.vl(x + 26, y + 2, 30, PAL.woodD);
  for (let j = 4; j < 32; j += 6) { P.px(x + 5, y + j, PAL.woodL); P.px(x + 26, y + j, PAL.woodL); }
  P.rect(x + 4, y, 24, 2, up ? 'rgba(34,50,92,0.55)' : 'rgba(27,36,64,0.85)');
}

function drawDoor(P, x, y, left, st) {
  // front doors in the bottom wall: a threshold and glass panels slid open
  P.rect(x, y, 16, 16, '#CFE0F0');
  for (let j = 2; j < 16; j += 3) P.hl(x, y + j, 16, '#B9D3E6');
  P.rect(left ? x : x + 12, y, 4, 16, PAL.ice);
  P.vl(left ? x + 3 : x + 12, y, 16, PAL.steelD);
  P.hl(x, y, 16, PAL.steelD);
}

// ---------------------------------------------------------------- the static layer
// map: { rows, floor } ; returns a canvas of the whole floor
export function renderFloor(map) {
  const rows = map.rows, H = rows.length, W = rows[0].length, st = STYLES[map.floor];
  const P = new Pix(W * TILE, H * TILE);
  const at = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? '#' : rows[y][x];
  const isWall = (c) => WALLS.has(c) || c === ' ';
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const c = rows[ty][tx], x = tx * TILE, y = ty * TILE;
    const fl = map.floorTypes || {};
    if (c === ' ') { P.rect(x, y, 16, 16, PAL.night); continue; }
    if (c === '#') { drawCap(P, x, y, st, { N: isWall(at(tx, ty - 1)), S: isWall(at(tx, ty + 1)), W: isWall(at(tx - 1, ty)), E: isWall(at(tx + 1, ty)) }); continue; }
    if (c === 'W' || c === 'w') { drawFace(P, x, y, st, c === 'W', map.floor); continue; }
    if (c === 'O' || c === 'o') { drawWindow(P, x, y, c === 'O', !'Oo'.includes(at(tx - 1, ty)), !'Oo'.includes(at(tx + 1, ty)), map.floor); continue; }
    if (c === 'E' || c === 'e') { if (c === 'E' && at(tx - 1, ty) !== 'E') drawElevatorUnit(P, x, y, st, map.floor); continue; }
    if (c === 'U' || c === 'Z') { if (at(tx - 1, ty) !== c && at(tx, ty - 1) !== c) drawStairsUnit(P, x, y, c === 'U', st, map.floor); continue; }
    if (c === 'D') { FLOORS[st.alt](P, x, y, tx, ty); drawDoor(P, x, y, at(tx - 1, ty) !== 'D', st); continue; }
    const kind = fl[c] || (c === ',' ? st.alt : c === ':' ? st.third : c === '~' ? 'dark' : c === '=' ? 'lane' : st.main);
    (FLOORS[kind] || FLOORS[st.main])(P, x, y, tx, ty);
  }
  // soft shadow under the top walls and along the left walls
  for (let ty = 1; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const c = rows[ty][tx];
    if (isWall(c) || 'UZD'.includes(c)) continue;
    const x = tx * TILE, y = ty * TILE;
    if (FACES.has(at(tx, ty - 1)) || at(tx, ty - 1) === '#') { P.g.fillStyle = 'rgba(27,36,64,0.16)'; P.g.fillRect(x, y, 16, 3); P.g.fillStyle = 'rgba(27,36,64,0.08)'; P.g.fillRect(x, y + 3, 16, 2); }
    if (at(tx - 1, ty) === '#') { P.g.fillStyle = 'rgba(27,36,64,0.10)'; P.g.fillRect(x, y, 3, 16); }
  }
  // elevator floor display and stair signs
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const c = rows[ty][tx];
    if ((c === 'U' || c === 'Z') && at(tx - 1, ty) !== c && at(tx, ty - 1) !== c) {
      const lbl = (c === 'U' ? map.floor + 1 : map.floor - 1) + 'F';
      const sx = tx * TILE + 10, sy = ty * TILE - 12;
      P.rect(sx - 2, sy - 1, 16, 9, c === 'U' ? PAL.green : PAL.orange);
      P.rect(sx - 1, sy, 14, 7, c === 'U' ? '#5FD39A' : '#FFB46B');
      // arrow
      if (c === 'U') { P.px(sx + 1, sy + 1, PAL.out); P.hl(sx, sy + 2, 3, PAL.out); P.vl(sx + 1, sy + 3, 3, PAL.out); }
      else { P.vl(sx + 1, sy + 1, 3, PAL.out); P.hl(sx, sy + 4, 3, PAL.out); P.px(sx + 1, sy + 5, PAL.out); }
      tinyText(P, lbl, sx + 5, sy + 1, PAL.out);
    }
  }
  return P.c;
}

// windows get a few drifting clouds, drawn every frame on top of the static layer
export function windowRects(map) {
  const out = [], rows = map.rows;
  for (let ty = 0; ty < rows.length; ty++) for (let tx = 0; tx < rows[0].length; tx++) {
    if (rows[ty][tx] === 'O' && (tx === 0 || rows[ty][tx - 1] !== 'O')) {
      let w = 0; while (rows[ty][tx + w] === 'O') w++;
      out.push({ x: tx * TILE + 2, y: ty * TILE + 2, w: w * TILE - 4, h: 9 });
    }
  }
  return out;
}

export { canvas };
