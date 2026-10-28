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

function floor3() {
  const R = [];
  R.push(row('#', 34));
  R.push('#WEEWWZZWWWWWOOOWOOOWOOOWWWWWWWWW#');
  R.push('#weewwZZwwwwwooowooowooowwwwwwwww#');
  for (let y = 3; y <= 20; y++) {
    let r = row('.', 32).split('');
    if (y === 8 || y === 15) r = r.map(() => ',');
    r[10] = ',';
    if (y >= 11 && y <= 13) for (let x = 27; x <= 30; x++) r[x] = ':';
    R.push('#' + r.join('') + '#');
  }
  R.push(row('#', 34));
  return R;
}

export const FLOORS = {
  1: { floor: 1, name: 'Classics', title: '1F · Classics Hall', rows: floor1() },
  2: { floor: 2, name: 'Playground', title: '2F · Physics Playground', rows: floor2() },
  3: { floor: 3, name: 'Magnonics', title: '3F · Magnonics Lab', rows: floor3() },
};

for (const f of Object.values(FLOORS)) {
  const w = f.rows[0].length;
  f.rows.forEach((r, i) => { if (r.length !== w) throw new Error(`floor ${f.floor} row ${i} is ${r.length} wide, expected ${w}`); });
  f.W = w; f.H = f.rows.length;
}
