// The player's progress in the building, kept in this browser only: where you are, what is in
// your bag, what is mounted on each experiment, quests, stamps and the hidden values of the
// mystery samples. Experiments talk to it through `rig`.

const KEY = 'm2lab-building-v1';

function rand(a, b, digits = 2) { const v = a + Math.random() * (b - a); const p = 10 ** digits; return Math.round(v * p) / p; }

function newSecrets() {
  // Planet X: a gravity well away from Earth's, the Moon's, Mars' and Jupiter's values
  let g;
  do { g = rand(4.2, 15.6, 2); } while (Math.abs(g - 9.81) < 1.2 || Math.abs(g - 3.71) < 0.6 || Math.abs(g - 1.62) < 0.6);
  return {
    planetX: g,
    lensF: rand(12, 34, 1),            // cm, a converging lens
    blockM: Math.round(rand(140, 420, 0)), // g
    stringMu: rand(0.9, 3.4, 2),        // g/m
    film: { Ms: Math.round(rand(320, 1050, 0)) * 1e3, alpha: rand(0.0025, 0.012, 4), gamma: 28.0e9 + Math.round(rand(0, 1.6, 1) * 1e8) * 10 },
    chargeQ: rand(1.5, 4.5, 1),
    latX: (() => { let a; do { a = rand(3.2, 5.8, 1); } while (Math.abs(a - 4) < 0.3); return a; })(),   // cm, Crystal #9
  };
}

function fresh() {
  return { v: 1, style: null, floor: 1, x: 6, y: 19, dir: 'up', items: [], mounts: {}, quests: {}, stamps: [], flags: {}, secrets: newSecrets(), log: [], cards: [], chal: {}, days: [] };
}

let S = load();
function load() {
  try {
    const t = localStorage.getItem(KEY);
    if (t) { const s = JSON.parse(t); if (s && s.v === 1) { if (!s.secrets) s.secrets = newSecrets(); return Object.assign(fresh(), s); } }
  } catch (_) {}
  return fresh();
}
let saveTimer = 0;
function persist(now) {
  clearTimeout(saveTimer);
  const go = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) {} };
  if (now) go(); else saveTimer = setTimeout(go, 300);
}

const listeners = new Map();
function emit(evt, data) {
  for (const fn of listeners.get(evt) || []) { try { fn(data); } catch (e) { console.error(e); } }
  for (const fn of listeners.get('*') || []) { try { fn(evt, data); } catch (e) { console.error(e); } }
}

export const state = {
  get: () => S,
  save: persist,
  reset() { S = fresh(); persist(true); emit('reset'); },
  where(floor, x, y, dir) { S.floor = floor; S.x = x; S.y = y; S.dir = dir; persist(); },
};

export const rig = {
  has: (id) => S.items.includes(id) || !!(S.flags.allItems),
  owned: () => S.items.slice(),
  give(id, quiet) {
    if (S.items.includes(id)) return false;
    S.items.push(id); persist(); if (!quiet) emit('item', id); return true;
  },
  mounted(bench, slot, fallback) { return (S.mounts[bench] && S.mounts[bench][slot]) || fallback; },
  mount(bench, slot, id, source) {
    S.mounts[bench] = S.mounts[bench] || {};
    if (S.mounts[bench][slot] === id) return;
    S.mounts[bench][slot] = id; persist();
    emit('mount', { bench, slot, id, source });
  },
  quest: (id) => S.quests[id] || null,
  setQuest(id, st) { S.quests[id] = st; persist(); emit('quest', { id, st }); },
  stamp(id) { if (S.stamps.includes(id)) return false; S.stamps.push(id); persist(); emit('stamp', id); return true; },
  stamps: () => S.stamps.slice(),
  // insight cards, earned by finishing a challenge
  card(id) { if (S.cards.includes(id)) return false; S.cards.push(id); persist(); emit('card', id); return true; },
  cards: () => S.cards.slice(),
  // challenge results: { pick, ok, t }
  chal(id, r) { if (r === undefined) return S.chal[id] || null; S.chal[id] = Object.assign({ t: Date.now() }, r); persist(); emit('chal', { id, r }); return r; },
  flag(name, v) { if (v === undefined) return S.flags[name]; S.flags[name] = v; persist(); emit('flag', { name, v }); return v; },
  secret: (name) => {
    // saves from before a secret existed get one the first time it is asked for
    if (S.secrets[name] === undefined) { const n = newSecrets()[name]; if (n !== undefined) { S.secrets[name] = n; persist(); } }
    return S.secrets[name];
  },
  on(evt, fn) { if (!listeners.has(evt)) listeners.set(evt, new Set()); listeners.get(evt).add(fn); return () => listeners.get(evt).delete(fn); },
  emit,
  // a short history of measurements the quests can look at
  note(entry) { S.log.push({ t: Date.now(), ...entry }); if (S.log.length > 60) S.log.shift(); persist(); emit('note', entry); },
};
