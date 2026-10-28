// Characters: the player (a student in a lab coat, four colour styles) and the cast of the
// building, all fictional: Bolt the reception robot, Prof. Hoo the owl, Pip the penguin,
// Mochi the cat and Dr. Fennec the fox. Drawn from text rows, then outlined automatically.

import { PAL, fromRows, outline, recolor, flipX } from './pix.js';

const C = PAL;

// ---------------------------------------------------------------- the player
// 14 x 18 inside a 16 x 20 frame (the outline pass needs the margin)
const P_DOWN = [
  '....hhhhhh....',
  '..hhhhhhhhhh..',
  '.hhkkhhhhhhhh.',
  '.hGggGhhGggGh.',
  'hhhhhhhhhhhhhh',
  'hhhsssssssshhh',
  'hsssssssssssSh',
  'hsswesssswesSh',
  'hsseesssseesSh',
  'hsrrssoossrrSh',
  '..SssssssssS..',
  '...ccttttcc...',
  '..ccccttcccc..',
  '..CcccccccCC..',
  '..sCcccccCCs..',
  '...CccccccC...',
  '....pp..pp....',
  '....bb..bb....',
];
const P_UP = [
  '....hhhhhh....',
  '..hhhhhhhhhh..',
  '.hhhhhhhhhkhh.',
  '.hGGGGGGGGGGh.',
  'hhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhh',
  'hhhhhhhhhhhhhh',
  'hHhhhhhhhhhhHh',
  'hHHhhhhhhhhHHh',
  '..HHhhhhhhHH..',
  '...cccccccc...',
  '..cccccccccc..',
  '..CccccccccC..',
  '..sCccccccCs..',
  '...CccccccC...',
  '....pp..pp....',
  '....bb..bb....',
];
const P_SIDE = [   // facing left
  '....hhhhhhh...',
  '..hhhhhhhhhhh.',
  '.hhhhhhhhkkhhh',
  '.gGhhhhhhhhhhh',
  'hhhhhhhhhhhhhh',
  'hhhssssshhhhhh',
  'hsssssssShhhhh',
  'sswesssSShhhhh',
  'sseessssShhhhh',
  'ssrssssShhhhhh',
  '.SsssssShhhhH.',
  '...cttcccc....',
  '...ccccccccc..',
  '...cCcccccCc..',
  '...sCccccCc...',
  '...CccccccC...',
  '.....pp.pp....',
  '.....bb.bb....',
];

function legs(rows, f, side) {
  const r = rows.slice();
  if (side) {
    if (f === 1) { r[16] = '....pp...pp...'; r[17] = '...bb.....bb..'; }
    if (f === 2) { r[16] = '......ppp.....'; r[17] = '......bbb.....'; }
  } else {
    if (f === 1) { r[16] = '....pp..bb....'; r[17] = '....bb........'; }
    if (f === 2) { r[16] = '....bb..pp....'; r[17] = '........bb....'; }
  }
  return r;
}

export const STYLES = [
  { id: 'teal', name: 'Teal goggles', hair: '#3B2A57', hairS: '#2A1D40', hairK: '#6A55A0', shirt: C.cyan, pants: C.navy, goggle: C.teal },
  { id: 'rose', name: 'Rose bob', hair: '#8E3B2A', hairS: '#6A2A1E', hairK: '#C2654A', shirt: C.pink, pants: C.plum, goggle: C.rose },
  { id: 'sun', name: 'Sunny', hair: '#E3A93B', hairS: '#B9822A', hairK: '#FFD77A', shirt: C.green, pants: C.ink, goggle: C.orange },
  { id: 'night', name: 'Night owl', hair: '#1F2F5A', hairS: '#14203F', hairK: '#3F5A9A', shirt: C.violet, pants: C.steelX, goggle: C.violet },
];

function playerKey(st) {
  return {
    h: st.hair, H: st.hairS, k: st.hairK, s: C.skin, S: C.skinD, e: C.out, w: '#FFFFFF', r: C.blush, o: C.out,
    c: C.snow, C: C.steelL, t: st.shirt, p: st.pants, b: C.bark, G: st.goggle, g: C.ice,
  };
}

const cache = new Map();
// returns { down:[3], up:[3], left:[3], right:[3] } of 16x20 canvases
export function playerSprites(styleId = 'teal') {
  if (cache.has('p' + styleId)) return cache.get('p' + styleId);
  const st = STYLES.find((s) => s.id === styleId) || STYLES[0], key = playerKey(st);
  const mk = (rows) => outline(fromRows(rows, key, 1));
  const set = { down: [], up: [], left: [], right: [] };
  for (let f = 0; f < 3; f++) {
    set.down.push(mk(legs(P_DOWN, f)));
    set.up.push(mk(legs(P_UP, f)));
    const l = mk(legs(P_SIDE, f, true));
    set.left.push(l); set.right.push(flipX(l));
  }
  cache.set('p' + styleId, set);
  return set;
}

// ---------------------------------------------------------------- the cast
// Each NPC has down / up / left / right frames, two frames each (idle animation).

const BOLT = {
  key: { a: C.steelD, r: C.rose, R: C.pink, l: C.steelL, L: C.steel, d: C.night, c: C.cyan, w: C.snow, W: C.steelL, t: C.teal, g: C.ice, b: C.steelD, k: C.gold },
  down: [
    '......rr......',
    '......aa......',
    '..llllllllll..',
    '.llllllllllll.',
    '.lddddddddddl.',
    '.ldcddddddcdl.',
    '.lcdcddddcdcl.',
    '.lddddddddddl.',
    '.LllllllllllL.',
    '..LLLLLLLLLL..',
    '.....bbbb.....',
    '...wwwwwwww...',
    '.WwwwwkkwwwwW.',
    '.Ww.wwkkwww.W.',
    '.W..WwwwwW..W.',
    '....WWWWWW....',
    '.....tttt.....',
    '......gg......',
  ],
  up: [
    '......rr......',
    '......aa......',
    '..llllllllll..',
    '.llllllllllll.',
    '.llllllllllll.',
    '.llllllllllll.',
    '.lllllbbllllll',
    '.llllllllllll.',
    '.LllllllllllL.',
    '..LLLLLLLLLL..',
    '.....bbbb.....',
    '...wwwwwwww...',
    '.WwwwwwwwwwwW.',
    '.Ww.wwwwwww.W.',
    '.W..WwwwwW..W.',
    '....WWWWWW....',
    '.....tttt.....',
    '......gg......',
  ],
  left: [
    '.....rr.......',
    '.....aa.......',
    '...lllllllll..',
    '..lllllllllll.',
    '..ddddddllllL.',
    '..cdcdddllllL.',
    '..ddddddllllL.',
    '..ddddddllllL.',
    '..LlllllllllL.',
    '...LLLLLLLLL..',
    '......bbbb....',
    '....wwwwwww...',
    '...wwwwwwwW...',
    '...wwwwwwwW...',
    '....WwwwwW....',
    '....WWWWWW....',
    '.....tttt.....',
    '......gg......',
  ],
};

const HOO = {
  key: { t: C.woodD, b: C.wood, B: C.woodD, f: C.cream, F: C.sand, w: C.snow, e: C.out, o: C.orange, O: C.orangeD, r: C.red, R: C.redD, y: C.sand, Y: C.tan, g: C.gold },
  down: [
    '.t..........t.',
    '.tt........tt.',
    '.tbbbbbbbbbbt.',
    'bbbbbbbbbbbbbb',
    'bfffffbbfffffb',
    'bfwwwfffwwwffb',
    'bwwewwffwwewwb',
    'bwweewffweewwb',
    'bfwwwfoofwwwfb',
    'bbffffooffffbb',
    'Bbbbrrbbrrbbbb',
    'BbbbbRRRbbbbbB',
    'BbbyyyyyyyybbB',
    'BbbyYyyyyYybbB',
    'BbbyyyYYyyybbB',
    '.BbbyyyyyybbB.',
    '..BBBBBBBBBB..',
    '....oo..oo....',
  ],
  up: [
    '.t..........t.',
    '.tt........tt.',
    '.tbbbbbbbbbbt.',
    'bbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbb',
    'bbbBbbbbbbBbbb',
    'bbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbb',
    'bbbbbbbbbbbbbb',
    'BbbBbbbbbBbbbB',
    'BbbbbbbbbbbbbB',
    'BbBbbbbbbbbBbB',
    'BbbBbbbbbbBbbB',
    'BbbbBbbbbBbbbB',
    '.BbbbBbbBbbbB.',
    '..BBBBBBBBBB..',
    '....oo..oo....',
  ],
  left: [
    '..t.......t...',
    '..tt.....tt...',
    '..tbbbbbbbt...',
    '.bbbbbbbbbbb..',
    '.ffffbbbbbbbb.',
    'fwwwffbbbbbbb.',
    'wwewfbbbbbbbb.',
    'wweefbbbbbbbB.',
    'fwwwfbbbbbbbB.',
    'ooffbbbbbbbbB.',
    'obrrbbbbbbbbB.',
    '.bRRbbbbbbbbB.',
    '.byyybbbBbbbB.',
    '.byYyybbBbbbB.',
    '.byyyybbBbbbB.',
    '..byyybbbbbB..',
    '...BBBBBBBBB..',
    '.....oo.oo....',
  ],
};

const PIP = {
  key: { n: C.ink, N: C.out, w: C.snow, W: C.mist, e: C.out, k: '#FFFFFF', o: C.orange, O: C.orangeD, s: C.cyan, S: C.teal, r: C.blush, g: C.ice, G: C.teal },
  down: [
    '..............',
    '....nnnnnn....',
    '...nnnnnnnn...',
    '..nnGggGggGn..',
    '..nnnnnnnnnn..',
    '.nnnwwwwwwnnn.',
    '.nnwwkewkewwnn',
    '.nnwweewweewnn',
    '.nnwrwoowwrwnn',
    '.nnnwwOOwwwnnn',
    '.nsssssssssssn',
    'nnnSSsssSSSnnn',
    'nnnwwwwwwwwnnn',
    'nn.wwwwwwwW.nn',
    'nn.wwwwwwwW.nn',
    '...wwwwwwWW...',
    '...nWWWWWWn...',
    '...oo....oo...',
  ],
  up: [
    '..............',
    '....nnnnnn....',
    '...nnnnnnnn...',
    '..nGGGGGGGGn..',
    '..nnnnnnnnnn..',
    '.nnnnnnnnnnnn.',
    '.nnnnnnnnnnnnn',
    '.nnnnnnnnnnnnn',
    '.nnnnnnnnnnnnn',
    '.nnnnnnnnnnnnn',
    '.nsssssssssssn',
    'nnnSSSSSsssnnn',
    'nnnnnnnnnnnnnn',
    'nn.nnnnnnnnn.n',
    'nn.nnnnnnnnn.n',
    '...nnnnnnnnn..',
    '...nnnnnnnnn..',
    '...oo....oo...',
  ],
  left: [
    '..............',
    '.....nnnnnn...',
    '....nnnnnnnn..',
    '...gGnnnnnnnn.',
    '...nnnnnnnnnn.',
    '..wwwwnnnnnnn.',
    '.okewwwnnnnnn.',
    'ooeewwwnnnnnn.',
    '.OwrwwwnnnnNn.',
    '..wwwwnnnnnnn.',
    '..sssssssssnn.',
    '..sSSssssnnnn.',
    '..wwwwnnnnnNn.',
    '..wwwwnnnnnNn.',
    '..wwwwWnnnnNn.',
    '..wwwWWnnnnn..',
    '...WWWnnnnn...',
    '...oo.oo......',
  ],
};

const MOCHI = {   // the cat: 14 x 12, sits low
  key: { w: C.snow, W: C.steelL, p: C.pink, e: C.out, k: '#FFFFFF', o: C.orange, O: C.orangeD, c: C.cyan, g: C.gold, n: C.rose },
  down: [
    '..ww......ww..',
    '..wpw....wpw..',
    '..wwwwwwwwww..',
    '.wwoowwwwwwww.',
    '.wwoweeweewww.',
    '.wwwwkewkewww.',
    '.Wwwwwwnwwwww.',
    '..Wwwwwwwwww..',
    '...cccgcccc...',
    '..wwwwwwwwww..',
    '..wwWwwwwWww..',
    '..ww.ww.ww.ww.',
  ],
  up: [
    '..ww......ww..',
    '..www....www..',
    '..wwwwwwwwww..',
    '.wwoowwwwwwww.',
    '.wwoowwwwwwww.',
    '.wwwwwwwwwwww.',
    '.Wwwwwwwwwwww.',
    '..Wwwwwwwwww..',
    '...cccccccc...',
    '..wwwwwwwwwwo.',
    '..wwWwwwwWwwo.',
    '..ww.ww.ww.wo.',
  ],
  left: [
    '..ww..ww......',
    '..wpwwpw......',
    '.wwwwwwww.....',
    '.weewwoowo....',
    'nkewwwoowo....',
    '.wwwwwwwww....',
    '..Wwwwwwwwwwwo',
    '...cgcwwwwwwwo',
    '...wwwwwwwwwo.',
    '...wwwwWwwwww.',
    '...ww.ww.ww.w.',
    '...ww.ww.ww...',
  ],
  sleep: [
    '..............',
    '..............',
    '..............',
    '..ww...ww.....',
    '..wpwwwpw.....',
    '.wwwwwwwwwwww.',
    'wwooweewwwwwww',
    'wwoowwwwwwwwww',
    'wwwwwwwwwwwwoo',
    '.wWwwwwwwwwwoo',
    '..WWWWWWWWWWo.',
    '..............',
  ],
};

const FENNEC = {   // 14 x 20: tall ears
  key: { o: C.orange, O: C.orangeD, e: C.pink, E: C.blush, f: C.cream, F: C.sand, k: C.out, w: '#FFFFFF', n: C.out, c: C.snow, C: C.steelL, t: C.violet, T: C.plum, g: C.ice, G: C.deep, b: C.bark },
  down: [
    '.oo........oo.',
    '.oeo......oeo.',
    '.oeeo....oeeo.',
    '.oeeoooooooeo.',
    'ooeooooooooeoo',
    'oooooooooooooo',
    'offooooooooffo',
    'ofGggGooGggGfo',
    'ffGkwGffGkwGff',
    'ffffffffffffff',
    '.fffffnnfffff.',
    '..FffffffffF..',
    '...ccttttcc...',
    '..ccccttcccc..',
    '..CccccccccC..',
    '..fCcccccCCf..',
    '...CccccccC...',
    '...OOOccOOO...',
    '....bb..bb....',
  ],
  up: [
    '.oo........oo.',
    '.ooo......ooo.',
    '.oooo....oooo.',
    '.ooooooooooooo',
    'oooooooooooooo',
    'oooooooooooooo',
    'oooooooooooooo',
    'oGGGGGGGGGGGGo',
    'oooooooooooooo',
    'oOoooooooooOoo',
    '.OOooooooooOO.',
    '..OOooooooOO..',
    '...cccccccc...',
    '..cccccccccc..',
    '..CccccccccC..',
    '..oCcccccCCo..',
    '...CccccccCff.',
    '...OOO..OOOff.',
    '....bb..bb.f..',
  ],
  left: [
    '...oo....oo...',
    '...oeo..oeo...',
    '...oeeooeeo...',
    '...oeeooeeo...',
    '..ooooooooooo.',
    '.ooooooooooooo',
    'fffooooooooooo',
    'GggGooooooooOo',
    'GkwGfoooooooOo',
    'fffffooooooOo.',
    'nfffffoooooO..',
    '.FffffFoooo...',
    '...ttccccc....',
    '...ccccccccc..',
    '...cCcccccCc..',
    '...fCccccCc...',
    '...CccccccCfff',
    '....OOccOO..ff',
    '.....bb.bb....',
  ],
};

function npcSet(def, frames) {
  const mk = (rows) => outline(fromRows(rows, def.key, 1));
  const set = {};
  for (const dir of ['down', 'up', 'left']) {
    const base = mk(def[dir]);
    set[dir] = [base, frames ? mk(frames(def[dir], dir)) : base];
  }
  set.right = set.left.map(flipX);
  if (def.sleep) set.sleep = [mk(def.sleep)];
  return set;
}
const blink = (open, closed) => (rows, dir) => rows.map((r) => r.split('').map((ch) => (open.includes(ch) ? closed : ch)).join(''));

const cast = {};
export function npcSprites(id) {
  if (cast[id]) return cast[id];
  let s;
  if (id === 'bolt') s = npcSet(BOLT, (rows, dir) => rows.map((r, i) => (i === 0 ? r.replace(/r/g, 'R') : r.replace(/c/g, 'd'))));
  else if (id === 'hoo') s = npcSet(HOO, (rows, dir) => rows.map((r, i) => {
    if (dir === 'up' || i < 5 || i > 8) return r;
    let t = r.replace(/[we]/g, 'f');
    if (i === 7) t = dir === 'down' ? 'bfeeeffffeeefb' : t.slice(0, 1) + 'eee' + t.slice(4);
    return t;
  }));
  else if (id === 'pip') s = npcSet(PIP, (rows) => rows.map((r, i) => (i === 13 || i === 14 ? r.replace(/^nn\./, '.nn').replace(/\.nn$/, 'nn.') : r)));
  else if (id === 'mochi') s = npcSet(MOCHI, (rows, dir) => rows.map((r, i) => (i === rows.length - 1 ? r.split('').reverse().join('') : r)));
  else if (id === 'fennec') s = npcSet(FENNEC, blink('kw', 'f'));
  cast[id] = s;
  return s;
}

// A bigger portrait for the dialog box: the front frame, scaled up by the caller.
export function portrait(id, style) {
  if (id === 'player') return playerSprites(style).down[0];
  return npcSprites(id).down[0];
}

export function dropShadow(P, x, y, w) {
  P.g.fillStyle = 'rgba(27, 36, 64, 0.22)';
  for (let j = 0; j < 3; j++) {
    const ww = j === 1 ? w : w - 4;
    P.g.fillRect(Math.round(x - ww / 2) + P.ox, Math.round(y - 1 + j) + P.oy, ww, 1);
  }
}

export { recolor };
