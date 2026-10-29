// The three floors of the virtual building. Rows are tiles (see tiles.js for the characters);
// things on the floor (furniture, apparatus, people) are listed separately in `props` and `npcs`.

function row(s, n) { return s.repeat(n); }

function floor1() {
  const R = [];
  R.push(row('#', 34));
  R.push('#WEEWWWWWUUWWOOWWOOWWOOWWWWWWWWWW#');
  R.push('#weewwwwwUUwwoowwoowwoowwwwwwwwww#');
  for (let y = 3; y <= 20; y++) {
    let lob = row(',', 10);
    let hall = row('.', 22);
    if (y === 16 || y === 17) hall = '.' + row('=', 21);
    R.push('#' + lob + hall + '#');
  }
  R.push(row('#', 6) + 'DD' + row('#', 26));
  return R;
}

function floor2() {
  const R = [];
  R.push(row('#', 34));
  R.push('#WEEWWUUWZZWWWWOOWWOOWWOOWWWWWWWW#');
  R.push('#weewwUUwZZwwwwoowwoowwoowwwwwwww#');
  for (let y = 3; y <= 20; y++) {
    let lob = row(',', 10);
    if (y >= 13 && y <= 18) lob = ',' + row(':', 7) + ',,';
    R.push('#' + lob + row('.', 22) + '#');
  }
  R.push(row('#', 34));
  return R;
}

// 3F: three rooms upstairs (lounge, resonance lab, cold room), the spin gallery across the middle,
// and two rooms below it: the gallery of our papers and the students' project room
function floor3() {
  const W = 48, H = 34;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const set = (x, y, c) => { g[y][x] = c; };
  const hl = (x0, x1, y, c) => { for (let x = x0; x <= x1; x++) set(x, y, c); };
  const vl = (x, y0, y1, c) => { for (let y = y0; y <= y1; y++) set(x, y, c); };
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) hl(x0, x1, y, c); };
  // outer walls, and the north wall with its windows, the elevator and the stairs
  hl(0, W - 1, 0, '#'); hl(0, W - 1, H - 1, '#'); vl(0, 0, H - 1, '#'); vl(W - 1, 0, H - 1, '#');
  const north = 'WEEWWZZWOOWWWOOOWOOOWWWWWWWWWWWWOOOWWWWWOOOWWWW';
  for (let x = 1; x < W - 1; x++) { const c = north[x - 1]; set(x, 1, c); set(x, 2, c === 'Z' ? 'Z' : c.toLowerCase()); }
  // floors: wood in the lounge and the paper gallery, grating in the cold room
  fill(1, 3, 11, 12, 'a');
  fill(32, 3, 46, 12, ':');
  fill(1, 27, 30, 32, 'a');
  hl(1, 46, 18, ',');                       // the walkway through the gallery
  // walls between the rooms upstairs, with doorways
  vl(12, 3, 12, '#'); vl(31, 3, 12, '#');
  set(12, 9, 'a'); set(12, 10, 'a'); set(31, 9, '.'); set(31, 10, '.');
  hl(1, 46, 13, '#');
  for (const x of [5, 6, 21, 22, 23, 38, 39]) set(x, 13, ',');
  // the south wall of the gallery, with faces for pictures, and the wall between the two rooms below
  hl(1, 46, 24, '#'); hl(1, 46, 25, 'W'); hl(1, 46, 26, 'w');
  vl(31, 24, 32, '#');
  for (const x of [14, 15, 38, 39]) { set(x, 24, ','); set(x, 25, ','); set(x, 26, ','); }
  return g.map((r) => r.join(''));
}

export const FLOORS = {
  1: { floor: 1, name: 'Classics', title: '1F · Classics Hall', rows: floor1() },
  2: { floor: 2, name: 'Playground', title: '2F · Physics Playground', rows: floor2() },
  3: { floor: 3, name: 'Magnonics', title: '3F · Magnonics Lab', rows: floor3(), floorTypes: { a: 'wood' } },
};

for (const f of Object.values(FLOORS)) {
  const w = f.rows[0].length;
  f.rows.forEach((r, i) => { if (r.length !== w) throw new Error(`floor ${f.floor} row ${i} is ${r.length} wide, expected ${w}`); });
  f.W = w; f.H = f.rows.length;
}
