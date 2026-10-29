// Characters: the player (a student in a lab coat in four colour styles, or in a hanbok) and the
// cast of the building, all fictional: Baro the reception robot, Prof. Bueong the owl, Kongi the
// penguin, Injeolmi the cat, Dr. Yeo the fox and Nuri the gallery robot (ids keep their old
// names: bolt, hoo, pip, mochi, fennec, nova). Drawn from text rows, then outlined automatically.

import { PAL, fromRows, outline, recolor, flipX } from './pix.js';

const C = PAL;

// ---------------------------------------------------------------- the player
// 16 x 22 inside an 18 x 24 frame (the outline pass needs the margin): big head, shiny eyes
const P_DOWN = [
    '.....hhhhhh.....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhkkhh..',
    '.hhhhhhhhhhhkkh.',
    '.hGGggGGGGggGGh.',
    'hhhhhhhhhhhhhhhh',
    'hhhhsshhhhsshhhh',
    'hhsssssssssssshh',
    'hssssssssssssssh',
    'hsswesssssswessh',
    'hsseesssssseessh',
    'hssEEssssssEEssh',
    '.srrsssmmsssrrs.',
    '..SssssssssssS..',
    '....ccttttcc....',
    '...ccccttcccc...',
    '..CccccccccccC..',
    '.sCccccccccccCs.',
    '...CccccccccC...',
    '....pppppppp....',
    '....pp....pp....',
    '....bb....bb....',
  ];
const P_UP = [
    '.....hhhhhh.....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhh..',
    '.hhhhhhhhhhhhhh.',
    '.hGGGGGGGGGGGGh.',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hHhhhhhhhhhhhhHh',
    'hHHhhhhhhhhhhHHh',
    '.HHHhhhhhhhhHHH.',
    '..HHHHssssHHHH..',
    '....cccccccc....',
    '...cccccccccc...',
    '..CccccccccccC..',
    '.sCccccccccccCs.',
    '...CccccccccC...',
    '....pppppppp....',
    '....pp....pp....',
    '....bb....bb....',
  ];
const P_SIDE = [
    '....hhhhhhh.....',
    '..hhhhhhhhhhh...',
    '.hhhhhhhhhkkhh..',
    '.hhhhhhhhhhhkkh.',
    '.gGGhhhhhhhhhhh.',
    'hhhhhhhhhhhhhhhh',
    'hhsshhhhhhhhhhhh',
    'hssssshhhhhhhhhh',
    'sssssssShhhhhhhh',
    'swessssShhhhhhhh',
    'seessssShhhhhhhh',
    'sEEsssSShhhhhhhh',
    '.rrsssShhhhhhhH.',
    '..SsssShhhhhHH..',
    '....ccttccc.....',
    '....cccccccc....',
    '....cCcccccC....',
    '....sCcccccC....',
    '....CccccccC....',
    '.....pppppp.....',
    '.....pp.pp......',
    '.....bb.bb......',
  ];
// the hanbok: a yellow jeogori with rainbow saekdong sleeves, a red goreum and a long chima
const HB_DOWN = [
    '.....hhhhhh.....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhRR.',
    '.hhhhhhhhhkkhRD.',
    '.hhhhhhhhhhhkkh.',
    'hhhhhhhhhhhhhhhh',
    'hhhhhshhhhshhhhh',
    'hhsssssssssssshh',
    'hssssssssssssssh',
    'hsswesssssswessh',
    'hsseesssssseessh',
    'hssEEssssssEEssh',
    '.srrsssmmsssrrs.',
    '..SssssssssssS..',
    '....jjWjjWjj....',
    '...jjjjWWjjjj...',
    '..1jjjjRRjjjj1..',
    '..2qqqqqRqqqqq2.',
    '.s3qqqqqRqqqqq3s',
    '..qqqqqqDqqqqqq.',
    '.qqqqqqqqqqqqqq.',
    '.QqqqqqqqqqqqqQ.',
    '..QQbb....bbQQ..',
  ];
const HB_UP = [
    '.....hhhhhh.....',
    '...hhhhhhhhhh...',
    '..hhhhhhhhhhhRR.',
    '.hhhhhhhhhhhhRD.',
    '.hhhhhhhhhhhhhh.',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hhhhhhhhhhhhhhhh',
    'hHhhhhhhhhhhhhHh',
    'hHHhhhhhhhhhhHHh',
    '.HHHhhhhhhhhHHH.',
    '..HHHHhhhhHHHH..',
    '....jjjhhjjj....',
    '...jjjjhhjjjj...',
    '..1jjjjhhjjjj1..',
    '..2qqqqRRqqqqq2.',
    '.s3qqqqDDqqqqq3s',
    '..qqqqqqqqqqqqq.',
    '.qqqqqqqqqqqqqq.',
    '.QqqqqqqqqqqqqQ.',
    '..QQbb....bbQQ..',
  ];
const HB_SIDE = [
    '....hhhhhhh.....',
    '..hhhhhhhhhhh...',
    '.hhhhhhhhhkkhh..',
    '.hhhhhhhhhhhkkh.',
    '.hhhhhhhhhhhhhh.',
    'hhhhhhhhhhhhhhhh',
    'hhsshhhhhhhhhhhh',
    'hssssshhhhhhhhhh',
    'sssssssShhhhhRRh',
    'swessssShhhhhRDh',
    'seessssShhhhhhhh',
    'sEEsssSShhhhhhhh',
    '.rrsssShhhhhhhH.',
    '..SsssShhhhhHH..',
    '....jWjjjjj.....',
    '....RRjjjjjj....',
    '....R1jjjjjj....',
    '....D2qqqqqq....',
    '....s3qqqqqqq...',
    '....qqqqqqqqq...',
    '...qqqqqqqqqqq..',
    '...QqqqqqqqqqQ..',
    '....bb.QQQQ.....',
  ];

// walking: the feet step (lab coat) or the hem sways (hanbok)
function legs(rows, f, side) {
  const r = rows.slice(), n = r.length;
  if (side) {
    if (f === 1) { r[n - 2] = '.....pp...pp....'; r[n - 1] = '....bb.....bb...'; }
    if (f === 2) { r[n - 2] = '......ppp.......'; r[n - 1] = '......bbb.......'; }
  } else {
    if (f === 1) { r[n - 2] = '....pp....bb....'; r[n - 1] = '....bb..........'; }
    if (f === 2) { r[n - 2] = '....bb....pp....'; r[n - 1] = '..........bb....'; }
  }
  return r;
}
function hem(rows, f, side) {
  const r = rows.slice(), n = r.length;
  if (side) {
    if (f === 1) r[n - 1] = '...bb..QQQQ.....';
    if (f === 2) r[n - 1] = '.....bbQQQQ.....';
  } else {
    if (f === 1) r[n - 1] = '..QQbb....QQQ...';
    if (f === 2) r[n - 1] = '...QQQ....bbQQ..';
  }
  return r;
}

export const STYLES = [
  { id: 'teal', name: 'Teal goggles', hair: '#3B2A57', hairS: '#2A1D40', hairK: '#6A55A0', eye: '#3D6FB6', shirt: C.cyan, pants: C.navy, goggle: C.teal },
  { id: 'rose', name: 'Rose bob', hair: '#8E3B2A', hairS: '#6A2A1E', hairK: '#C2654A', eye: '#B3305E', shirt: C.pink, pants: C.plum, goggle: C.rose },
  { id: 'sun', name: 'Sunny', hair: '#E3A93B', hairS: '#B9822A', hairK: '#FFD77A', eye: '#2F7D5B', shirt: C.green, pants: C.ink, goggle: C.orange },
  { id: 'night', name: 'Night owl', hair: '#1F2F5A', hairS: '#14203F', hairK: '#3F5A9A', eye: '#6B5BE6', shirt: C.violet, pants: C.steelX, goggle: C.violet },
  { id: 'hanbok', name: 'Hanbok', hanbok: true, hair: '#4A2E22', hairS: '#33201A', hairK: '#7A5040', eye: '#7A5040', jeogori: '#FFF2B0', chima: '#E0457B', chimaD: '#B3305E', shoes: C.pink },
];

function playerKey(st) {
  return {
    h: st.hair, H: st.hairS, k: st.hairK, s: C.skin, S: C.skinD, e: C.out, w: '#FFFFFF', E: st.eye, r: C.blush, m: '#C2654A',
    c: C.snow, C: C.steelL, t: st.shirt, p: st.pants, b: st.shoes || C.bark, G: st.goggle, g: C.ice,
    j: st.jeogori, W: C.snow, q: st.chima, Q: st.chimaD, R: C.red, D: C.redD, 1: C.red, 2: C.yellow, 3: C.green, 4: C.blue, 5: C.pink,
  };
}

const cache = new Map();
// returns { down:[3], up:[3], left:[3], right:[3] } of 18 x 24 canvases
export function playerSprites(styleId = 'teal') {
  if (cache.has('p' + styleId)) return cache.get('p' + styleId);
  const st = STYLES.find((s) => s.id === styleId) || STYLES[0], key = playerKey(st);
  const mk = (rows) => outline(fromRows(rows, key, 1));
  const [D, U, L, step] = st.hanbok ? [HB_DOWN, HB_UP, HB_SIDE, hem] : [P_DOWN, P_UP, P_SIDE, legs];
  const set = { down: [], up: [], left: [], right: [] };
  for (let f = 0; f < 3; f++) {
    set.down.push(mk(step(D, f)));
    set.up.push(mk(step(U, f)));
    const l = mk(step(L, f, true));
    set.left.push(l); set.right.push(flipX(l));
  }
  cache.set('p' + styleId, set);
  return set;
}

// ---------------------------------------------------------------- the cast
// Each NPC has down / up / left / right frames, two frames each (idle animation). Chibi
// proportions, with a little Korean touch each: a gat, a saekdong scarf, a norigae.

const BOLT = {   // Baro (바로), the front-desk robot: a screen face that smiles
  key: { r: C.red, R: C.pink, a: C.steelD, l: C.snow, L: C.steelL, d: C.night, c: C.cyan, p: C.pink, m: C.cyan, b: C.steelD, w: C.steelL, W: C.steel, k: C.gold, t: C.teal, g: C.yellow },
  down: [
    '.......rr.......',
    '.......aa.......',
    '...llllllllll...',
    '..llllllllllll..',
    '.lLddddddddddLl.',
    '.lddddddddddddl.',
    '.lddcddddddcddl.',
    '.ldcdcddddcdcdl.',
    '.lddddddddddddl.',
    '.ldpddddddddpdl.',
    '.lddddmddmddddl.',
    '.lLddddmmddddLl.',
    '..llllllllllll..',
    '.....bbbbbb.....',
    '...wwwwwwwwww...',
    '..WwwwwkkwwwwW..',
    '.WWwwwwkkwwwwWW.',
    '.W..wwwwwwww..W.',
    '....WWWWWWWW....',
    '.....tttttt.....',
    '......gggg......',
  ],
  up: [
    '.......rr.......',
    '.......aa.......',
    '...llllllllll...',
    '..llllllllllll..',
    '.lLllllllllllLl.',
    '.llllllllllllll.',
    '.llllllllllllll.',
    '.llllllbbllllll.',
    '.llllllllllllll.',
    '.llllllllllllll.',
    '.llllllllllllll.',
    '.lLllllllllllLl.',
    '..llllllllllll..',
    '.....bbbbbb.....',
    '...wwwwwwwwww...',
    '..WwwwwwwwwwwW..',
    '.WWwwwwwwwwwwWW.',
    '.W..wwwwwwww..W.',
    '....WWWWWWWW....',
    '.....tttttt.....',
    '......gggg......',
  ],
  left: [
    '......rr........',
    '......aa........',
    '...llllllllll...',
    '..llllllllllll..',
    '.dddddddlllllLl.',
    '.ddddddddllllll.',
    '.ddcdddddllllll.',
    '.dcdcddddllllll.',
    '.ddddddddllllll.',
    '.dpdddddllllllL.',
    '.ddddmmdllllllL.',
    '.Ldddddllllllll.',
    '..llllllllllll..',
    '......bbbbbb....',
    '....wwwwwwwww...',
    '....wwwwwwwwW...',
    '...Wwwwwwwwww...',
    '....wwwwwwwW....',
    '....WWWWWWWW....',
    '.....tttttt.....',
    '......gggg......',
  ],
};

const HOO = {   // Prof. Bueong (부엉), an owl scholar in a gat and a white durumagi
  key: { n: '#22325C', N: '#4A5E8C', b: C.wood, B: C.woodD, f: C.cream, w: C.snow, e: C.out, k: '#FFFFFF', o: C.orange, O: C.orangeD, r: C.blush, y: '#F0B85A', c: C.snow, C: C.steelL, v: C.teal, V: C.deep },
  down: [
    '......nnnnnn......',
    '......nNNNNn......',
    '......nNNNNn......',
    '......nnnnnn......',
    '..nnnnnnnnnnnnnn..',
    'nnNNNNNNNNNNNNNNnn',
    '..bbbbbbbbbbbbbb..',
    '.bbbbbbbbbbbbbbbb.',
    '.bffffffbbffffffb.',
    '.fwwwwwwffwwwwwwf.',
    '.fwwkewwffwwkewwf.',
    '.fwweewwffwweewwf.',
    '.bfwwwwfoofwwwwfb.',
    '.bryffffOOffffyrb.',
    '..bBybbbbbbbbyBb..',
    '...ByccccccccyB...',
    '..BBcyccccccycBB..',
    '.BBcccyvvvvycccBB.',
    '.BbccccVVVVccccbB.',
    '...cccccccccccc...',
    '...CccccccccccC...',
    '....CCccccccCC....',
    '.....oo....oo.....',
    '....ooo....ooo....',
  ],
  up: [
    '......nnnnnn......',
    '......nNNNNn......',
    '......nNNNNn......',
    '......nnnnnn......',
    '..nnnnnnnnnnnnnn..',
    'nnNNNNNNNNNNNNNNnn',
    '..bbbbbbbbbbbbbb..',
    '.bbbbbbbbbbbbbbbb.',
    '.bbbbbbbbbbbbbbbb.',
    '.bbbBbbbbbbbbBbbb.',
    '.bbbbbbbbbbbbbbbb.',
    '.bbbbbbbbbbbbbbbb.',
    '.bbbbbbbbbbbbbbbb.',
    '.bBbbbbbbbbbbbbBb.',
    '..bBbbbbbbbbbbBb..',
    '...BccccccccccB...',
    '..BBccccccccccBB..',
    '.BBccccccccccccBB.',
    '.BbcccvvvvvvcccbB.',
    '...cccccccccccc...',
    '...CccccccccccC...',
    '....CCccccccCC....',
    '.....oo....oo.....',
    '....ooo....ooo....',
  ],
  left: [
    '.......nnnnnn.....',
    '.......nNNNNn.....',
    '.......nNNNNn.....',
    '.......nnnnnn.....',
    '...nnnnnnnnnnnnnn.',
    '.nnNNNNNNNNNNNNNnn',
    '...bbbbbbbbbbbbb..',
    '..bbbbbbbbbbbbbbb.',
    '..ffffffbbbbbbbbb.',
    '.fwwwwwfbbbbbbbbb.',
    '.fwkewwfbbbbbbbBb.',
    '.fweewwfbbbbbbbBb.',
    'oofwwwfbbbbbbbbBb.',
    '.OOrfffbbbbbbbbBb.',
    '..ybbbbbbbbbbbBb..',
    '...ycccccccccB....',
    '...cyccccccccBB...',
    '...ccyvvvvvvcBb...',
    '...ccccVVVVccBb...',
    '...ccccccccccc....',
    '...Cccccccccccc...',
    '....CCcccccCC.....',
    '......oo..oo......',
    '.....ooo.ooo......',
  ],
};

const PIP = {   // Kongi (콩이), a penguin in a saekdong scarf
  key: { n: '#22325C', N: C.out, w: C.snow, W: C.mist, e: C.out, k: '#FFFFFF', E: '#3D6FB6', o: C.orange, O: C.orangeD, r: C.blush, '1': C.red, '2': C.yellow, '3': C.green, '4': C.blue, '5': C.pink },
  down: [
    '......nnnn......',
    '....nnnnnnnn....',
    '...nnnnnnnnnn...',
    '..nnnnnnnnnnnn..',
    '.nnnnwwwwwwnnnn.',
    '.nnnwwwwwwwwnnn.',
    'nnnwwkewwkewwnnn',
    'nnnwweewweewwnnn',
    'nnnwwEEwwEEwwnnn',
    'nnnwrwwoowwrwnnn',
    '.nnnwwwOOwwwnnn.',
    '.n12345123451n..',
    'nn15432154321nn.',
    'nnnwwwwwwwwwnnnn',
    'nnnwwwwwwwwwnn.n',
    'n.nwwwwwwwwwn..n',
    '..nwwwwwwwwWn...',
    '..nnwwwwwwWnn...',
    '...nnWWWWWnn....',
    '....nnnnnnn.....',
    '....oo...oo.....',
    '...ooo...ooo....',
  ],
  up: [
    '......nnnn......',
    '....nnnnnnnn....',
    '...nnnnnnnnnn...',
    '..nnnnnnnnnnnn..',
    '.nnnnnnnnnnnnnn.',
    '.nnnnnnnnnnnnnn.',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnnnn',
    '.nnnnnnnnnnnnnn.',
    '.n12345123451n..',
    'nn15432154321nn.',
    'nnnnnnnnnnnnnnnn',
    'nnnnnnnnnnnnnn.n',
    'n.nnnnnnnnnnn..n',
    '..nnnnnnnnnnn...',
    '..nnnnnnnnnnn...',
    '...nnnnnnnnn....',
    '....nnnnnnn.....',
    '....oo...oo.....',
    '...ooo...ooo....',
  ],
  left: [
    '.......nnnn.....',
    '.....nnnnnnnn...',
    '....nnnnnnnnnn..',
    '...nnnnnnnnnnnn.',
    '..wwwwnnnnnnnnn.',
    '.wwwwwwnnnnnnnn.',
    '.kewwwwnnnnnnnn.',
    'oeewwwwnnnnnnnn.',
    'oOEEwwwnnnnnnnn.',
    '.OwrwwnnnnnnnnN.',
    '..wwwwnnnnnnnn..',
    '..1234512345nn..',
    '..5432154321nn..',
    '..wwwwwnnnnnnn..',
    '..wwwwwnnnnnnNn.',
    '..wwwwwnnnnnnNn.',
    '..wwwwWnnnnnnNn.',
    '..wwwWWnnnnnn...',
    '...WWWnnnnnn....',
    '....nnnnnnn.....',
    '....oo..oo......',
    '...ooo.ooo......',
  ],
};

const MOCHI = {   // Injeolmi (인절미), a cat the colour of soybean-dusted rice cake: 14 x 12, sits low
  key: { n: C.rose, N: '#4A5E8C', b: C.pink, B: C.woodD, f: C.cream, w: C.sand, e: C.out, k: '#7A5040', o: C.orange, O: C.orangeD, r: C.blush, y: '#F0B85A', c: C.red, C: C.steelL, v: C.teal, V: C.deep, W: C.tan, d: '#C99A5C', p: C.pink, g: C.gold, h: '#4A2E22', H: '#33201A', s: C.skin, S: C.skinD, E: '#7A5040', m: '#C2654A', R: C.red, D: C.redD, j: '#FFF2B0', J: '#E8D27A', q: '#E0457B', Q: '#B3305E', '1': C.red, '2': C.yellow, '3': C.green, '4': C.blue, '5': C.pink },
  down: [
    '..ww......ww..',
    '..wpw....wpw..',
    '..wwwwwwwwww..',
    '.wwddwwwwwwww.',
    '.wffffffffffw.',
    '.wfkefffkeffw.',
    '.wfeeffffeefw.',
    '.wrrfffnfffrrw',
    '..wfffffffffw.',
    '...ccgccccc...',
    '..wwwwwwwwww..',
    '..wwWwwwwWww..',
    '..ww.ww.ww.ww.',
  ],
  up: [
    '..ww......ww..',
    '..www....www..',
    '..wwwwwwwwww..',
    '.wwddwwwwwwww.',
    '.wwddwwwwwwww.',
    '.wwwwwwwwwwww.',
    '.Wwwwwwwwwwww.',
    '..Wwwwwwwwww..',
    '...cccccccc...',
    '..wwwwwwwwwwd.',
    '..wwWwwwwWwwd.',
    '..ww.ww.ww.wd.',
  ],
  left: [
    '..ww..ww......',
    '..wpwwpw......',
    '.wwwwwwww.....',
    '.wfffwddwd....',
    'kefffwwddw....',
    'eefffwwwww....',
    'nrrffwwwwwwwwd',
    '.fffcgwwwwwwwd',
    '...wwwwwwwwwd.',
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
    'wwffeefeewwwww',
    'wrfffffffwwwww',
    'wwwfcgwwwwwwdd',
    '.wWwwwwwwwwwdd',
    '..WWWWWWWWWWd.',
    '..............',
  ],
};

const FENNEC = {   // Dr. Yeo (여 박사), a fox in a lab coat with a norigae at her side
  key: { n: C.out, N: '#4A5E8C', b: C.bark, B: C.woodD, f: C.cream, w: C.snow, e: C.pink, k: '#FFFFFF', o: C.orange, O: C.orangeD, r: C.blush, y: '#F0B85A', c: C.snow, C: C.steelL, v: C.teal, V: C.deep, F: C.sand, x: C.out, E: '#C96F2A', m: C.rose, t: C.violet, p: C.plum, R: C.red, J: '#3FAF7E', P: C.pink },
  down: [
    '.oo..........oo.',
    '.oeo........oeo.',
    '.oeeo......oeeo.',
    '.oeeoooooooooeeo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'offooooooooooffo',
    'fffoooooooooofff',
    'fffkxffffffkxfff',
    'fffxxffffffxxfff',
    'fffEEffffffEEfff',
    '.frrfffnnfffrrf.',
    '..fffffmmfffff..',
    '...FFffffffFF...',
    '....ccttttcc....',
    '...ccccttcccc...',
    '..CccccccccRcC..',
    '.fCcccccccccJCf.',
    '...CcccccccccP..',
    '....pppppppp.P..',
    '....pp....pp....',
    '....bb....bb....',
  ],
  up: [
    '.oo..........oo.',
    '.ooo........ooo.',
    '.oooo......oooo.',
    '.oooooooooooooo.',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oooooooooooooooo',
    'oOoooooooooooOoo',
    '.OOooooooooooOO.',
    '..OOooooooooOO..',
    '...OOOOOOOOOO...',
    '....OOOOOOOO....',
    '....cccccccc....',
    '...cccccccccc...',
    '..CccccccccccC..',
    '.oCccccccccccCo.',
    '...Cccccccccco..',
    '....ppppppppoof.',
    '....pp....pp.ff.',
    '....bb....bb....',
  ],
  left: [
    '....oo....oo....',
    '....oeo..oeo....',
    '....oeeooeeo....',
    '...ooeeooeeoo...',
    '..oooooooooooo..',
    '.ooooooooooooooo',
    'ffffoooooooooooo',
    'fffffooooooooooo',
    'fkxfffooooooooOo',
    'fxxffffoooooooOo',
    'fEEfffooooooooOo',
    'nrrffoooooooooO.',
    '.ffffFooooooOO..',
    '..FFFFooooOO....',
    '.....ccttcc.....',
    '....ccccccccc...',
    '....cCcccccRC...',
    '....fCccccccJ...',
    '....CccccccCP...',
    '.....ppppppp.Pff',
    '.....pp..pp...ff',
    '.....bb..bb.....',
  ],
};

const NOVA = {   // Nuri (누리), a little hovering robot with a saekdong ribbon
  key: { n: C.night, N: '#4A5E8C', b: C.pink, B: C.woodD, f: C.cream, w: C.snow, e: C.out, k: '#FFFFFF', o: C.orange, O: C.orangeD, r: C.blush, y: C.yellow, c: C.cyan, C: C.teal, v: C.teal, V: C.deep, W: C.steelL, S: C.steel, p: C.pink, a: C.steelD, Y: C.orange, '1': C.red, '2': C.yellow, '3': C.green, '4': C.blue, '5': C.pink, h: '#4A2E22', H: '#33201A', s: C.skin, E: '#7A5040', m: '#C2654A', R: C.red, D: C.redD, j: '#FFF2B0', J: '#E8D27A', q: '#E0457B', Q: '#B3305E' },
  down: [
    '....1234512.....',
    '.....5432.......',
    '.......aa.......',
    '.....wwwwww.....',
    '...wwwwwwwwww...',
    '..wwnnnnnnnnww..',
    '.wwnnnnnnnnnnww.',
    '.wnnkcnnnnkcnnw.',
    '.wnnccnnnnccnnw.',
    '.wnnccnnnnccnnw.',
    '.wnrnnnCCnnnrnw.',
    '.wwnnnnnnnnnnWw.',
    '..wwwwwwwwwwWW..',
    '...WwwwwwwwWW...',
    '....WWWWWWWW....',
    '.....SSSSSS.....',
    '......yyyy......',
    '.......YY.......',
  ],
  up: [
    '....1234512.....',
    '.....5432.......',
    '.......aa.......',
    '.....wwwwww.....',
    '...wwwwwwwwww...',
    '..wwwwwwwwwwww..',
    '.wwwwwwwwwwwwww.',
    '.wwwwwWWWWwwwww.',
    '.wwwwWSSSSWwwww.',
    '.wwwwWSSSSWwwww.',
    '.wwwwwWWWWwwwww.',
    '.wwwwwwwwwwwwWw.',
    '..wwwwwwwwwwWW..',
    '...WwwwwwwwWW...',
    '....WWWWWWWW....',
    '.....SSSSSS.....',
    '......yyyy......',
    '.......YY.......',
  ],
  left: [
    '...1234512......',
    '....5432........',
    '......aa........',
    '.....wwwwww.....',
    '...wwwwwwwwww...',
    '..nnnnnnnwwwww..',
    '.nnnnnnnnnwwwww.',
    '.nkcnnnnnnwwwww.',
    '.nccnnnnnnwwwww.',
    '.nccnnnnnnwwwww.',
    '.nnnnCCnnrnwwww.',
    '.nnnnnnnnnwwwWw.',
    '..wwwwwwwwwwWW..',
    '...WwwwwwwwWW...',
    '....WWWWWWWW....',
    '.....SSSSSS.....',
    '......yyyy......',
    '.......YY.......',
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
  const eyes = (rowsIdx, from, to) => (rows, dir) => rows.map((r, i) => (dir !== 'up' && rowsIdx.includes(i) ? r.replace(from, to) : r));
  if (id === 'bolt') s = npcSet(BOLT, (rows) => rows.map((r, i) => (i === 0 ? r.replace(/r/g, 'R') : i === 6 || i === 7 ? r.replace(/c/g, 'd') : r)));
  else if (id === 'hoo') s = npcSet(HOO, eyes([10], /[ke]/g, 'w'));
  else if (id === 'pip') s = npcSet(PIP, eyes([6, 8], /[keE]/g, 'w'));
  else if (id === 'mochi') s = npcSet(MOCHI, (rows) => rows.map((r, i) => (i === rows.length - 1 ? r.split('').reverse().join('') : r)));
  else if (id === 'fennec') s = npcSet(FENNEC, eyes([8, 10], /[kxE]/g, 'f'));
  else if (id === 'nova') s = npcSet(NOVA, (rows, dir) => rows.map((r, i) => (dir !== 'up' && (i === 7 || i === 9) ? r.replace(/[ck]/g, 'n') : i === 16 ? r.replace(/y/g, 'Y') : r)));
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
