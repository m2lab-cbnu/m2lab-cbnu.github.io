// M² Lab virtual building: a three-floor lab you walk around as a little pixel scientist.
// 1F has the textbook experiments, 2F the playful ones, 3F our magnonics instruments.

import { Game } from './rpg/game.js';
import { buildWorld, STAIRS, START } from './rpg/world.js';
import { Dialog } from './rpg/dialog.js';
import { state, rig } from './rpg/state.js';
import { ITEMS, itemIcon } from './rpg/items.js';
import { makeTalk, npcMark, STAMPS, stampIcon } from './rpg/quests.js';
import { playerSprites, STYLES } from './rpg/sprites.js';
import { Panel } from './ui/panel.js';
import { el } from './ui/widgets.js';
import { EXPERIMENTS, loadExperiment } from './bench/index.js';
import { rigStrip } from './bench/common.js';
import { lab } from './state.js';
import { material, addSecretFilm, filmAccess } from './physics/materials.js';
import { refreshFilmMenus } from './ui/sample.js';

const main = document.getElementById('vlab');
const canvas = document.getElementById('rpg-canvas');
const isTouch = matchMedia('(pointer: coarse)').matches;
const FLOOR_NAMES = { 1: 'Classics Hall', 2: 'Physics Playground', 3: 'Magnonics Lab' };
const floorBadge = document.querySelector('.rpg-floor');

// labels on the canvas use the pixel font, so give it a moment to arrive
await Promise.race([document.fonts ? document.fonts.load('600 16px Pixelify').catch(() => {}) : null, new Promise((r) => setTimeout(r, 1500))]);
document.querySelector('.vl-loading') && document.querySelector('.vl-loading').remove();

// the mystery film on 3F and the films you may choose
addSecretFilm(rig.secret('film'));
filmAccess.allow = (key) => {
  const id = 'film-' + key;
  return !ITEMS[id] ? key !== 'x' : (ITEMS[id].where === 'free' || rig.has(id));
};

// ---------------------------------------------------------------- the game
const S = state.get();
const world = buildWorld();
let game;
const live = el('p', { class: 'vh', 'aria-live': 'polite' });
main.append(live);

const panel = new Panel(main, {
  onClose: () => {
    game.freeze(false); document.body.classList.remove('panel-open'); game.setInset({ right: 0 }); game.hiddenView = false;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    canvas.focus({ preventScroll: true });
  },
  onTab: (st, tab) => { try { history.replaceState(null, '', `#${st.id}/${tab}`); } catch (_) {} },
});
panel.backLabel = 'Back to the building';

const dialog = new Dialog(main, {
  onOpen: () => { document.body.classList.add('dialog-open'); if (game) game.freeze(true); },
  onClose: () => { document.body.classList.remove('dialog-open'); if (game) { game.freeze(false); canvas.focus({ preventScroll: true }); } },
  styleOf: () => state.get().style || 'teal',
});

game = new Game(canvas, world, {
  onUse: use,
  onTrigger: trigger,
  onFloor: (f) => { setFloorBadge(f); if (f === 2) rig.flag('been2', true); if (f === 3) rig.flag('been3', true); },
  onStep: (f, x, y, dir) => state.where(f, x, y, dir),
  onFocus: (t) => { live.textContent = t ? `In front of you: ${labelFor(t)}. Press Space to use it.` : ''; },
  npcMark,
  labelFor: (t) => labelFor(t) + (isTouch ? '' : '  ·  Space'),
});
game.setStyle(S.style || 'teal');
game.teleport(S.floor || START.floor, Number.isFinite(S.x) ? S.x : START.x, Number.isFinite(S.y) ? S.y : START.y, S.dir || START.dir);
// a saved spot that is no longer free (the furniture moved) sends you back to the front door
if (game.blocked(game.p.x, game.p.y, game.p) || 'UZD'.includes(game.tileAt(game.p.x, game.p.y))) game.teleport(START.floor, START.x, START.y, START.dir);
// Mochi naps on the lobby rug until someone wakes her
const mochi = game.npc('mochi'); if (mochi && !rig.flag('mochiAwake')) mochi.sleeping = true;

const talk = makeTalk({ dialog, toast, openGuide: () => openGuide(), game });

function labelFor(t) {
  if (!t) return '';
  if (t.kind === 'npc') return t.npc.name;
  if (t.kind === 'elevator') return 'Elevator';
  if (t.kind === 'window') return 'Window';
  if (t.prop) return t.prop.name || (t.prop.use && t.prop.use.read ? 'Look' : '') || t.prop.type;
  return '';
}

// ---------------------------------------------------------------- using things
async function use(t) {
  if (t.kind === 'npc') {
    const n = t.npc;
    // turn to face you
    const p = game.p;
    n.dir = p.x < n.x ? 'left' : p.x > n.x ? 'right' : p.y < n.y ? 'up' : 'down';
    n.talking = true;
    if (n.id === 'mochi' && n.sleeping) rig.flag('mochiAwake', true);
    await talk(n.id);
    n.talking = false;
    return;
  }
  if (t.kind === 'elevator') return elevator();
  if (t.kind === 'window') {
    const views = ['The city hums below. Somewhere out there, a magnet is being measured.', 'Clouds drift past. A drone delivers a box labelled “liquid nitrogen”.', 'From up here the river looks like a long, slow wave.'];
    await dialog.say(null, [views[Math.floor(Math.random() * views.length)]]);
    return;
  }
  const q = t.prop, u = q && q.use;
  if (!u) {
    if (q && q.name) await dialog.say(null, [q.name + '.']);
    return;
  }
  if (u.read) return dialog.say(null, u.read);
  if (u.bench || u.station) return openExperiment(u.bench || u.station);
  if (u.cabinet) return openCabinet(u.cabinet, q.name);
  if (u.guide) return openGuide();
  if (u.go) {
    const c = await dialog.ask(null, 'Step into the **holo room**? It is our real lab, rebuilt in 3D. It needs a computer with decent graphics.', ['Step in', 'Stay here']);
    dialog.close();
    if (c === 0) { rig.flag('visitedHolo', true); location.href = u.go; }
    return;
  }
  if (u.beanbag) {
    if (u.beanbag === 2 && !rig.has('magnet-tiny') && ITEMS['magnet-tiny']) {
      rig.give('magnet-tiny', true);
      await dialog.say(null, ['You lift the beanbag... a **tiny magnet**! Mochi must have hidden it here.']);
      toast('You got: ' + ITEMS['magnet-tiny'].name, 'magnet-tiny');
    } else await dialog.say(null, ['Squishy. Nothing under this one.']);
  }
}

async function elevator() {
  const here = game.p.floor;
  const floors = [3, 2, 1].filter((f) => f !== here);
  const c = await dialog.ask(null, `Elevator. You are on **${here}F**. Where to?`, [...floors.map((f) => `${f}F · ${FLOOR_NAMES[f]}`), 'Stay here']);
  dialog.close();
  if (c < 0 || c >= floors.length) return;
  goFloor(floors[c], 2 + (game.p.x >= 3 ? 1 : 0), 3, 'down');
}

function goFloor(f, x, y, dir) {
  game.transition(() => { game.teleport(f, x, y, dir); state.where(f, x, y, dir); });
}

async function trigger(c, x, y) {
  const f = game.p.floor;
  if (c === 'U' || c === 'Z') {
    const dest = STAIRS[f] && STAIRS[f][c];
    if (!dest) return;
    goFloor(dest[0], x, dest[2], 'down');
    return;
  }
  if (c === 'D') {
    const k = await dialog.ask(null, 'Leave the building and go back to the M² Lab homepage?', ['Leave', 'Stay a bit longer']);
    dialog.close();
    if (k === 0) { location.href = 'index.html'; return; }
    game.teleport(f, x, y - 1, 'up');
  }
}

// ---------------------------------------------------------------- experiments
const wrapped = new Map();
const filmBench = {
  id: 'films',
  slots: [{ id: 'film', label: 'Film', options: ['film-yig', 'film-py', 'film-cofeb', 'film-copt', 'film-ni', 'film-fe', 'film-x'], def: 'film-yig' }],
};
rig.on('mount', (m) => {
  if (m.bench !== 'films') return;
  const key = ITEMS[m.id] && ITEMS[m.id].phys.key;
  if (key && lab.sample.key !== key) lab.setSample({ ...material(key), D: 0, edited: false }, 'strip');
});
lab.onSample((s, src) => { if (src !== 'strip' && ITEMS['film-' + s.key]) rig.mount('films', 'film', 'film-' + s.key, 'editor'); });
rig.on('item', () => refreshFilmMenus());

function asStation(mod, meta) {
  if (wrapped.has(mod)) return wrapped.get(mod);
  const w = Object.assign(Object.create(mod), { kicker: `${meta.floor}F · ${FLOOR_NAMES[meta.floor]}`, header: rigStrip(filmBench) });
  wrapped.set(mod, w);
  return w;
}

async function openExperiment(id, tab) {
  const meta = EXPERIMENTS.find((e) => e.id === id);
  if (!meta) return;
  let mod;
  try { mod = await loadExperiment(id); }
  catch (err) {
    console.error(err);
    await dialog.say(null, [`The ${meta.title.toLowerCase()} is still being set up. Try another experiment for now.`]);
    return;
  }
  if (meta.station) mod = asStation(mod, meta);
  game.freeze(true);
  panel.open(mod, tab);
  document.body.classList.add('panel-open');
  requestAnimationFrame(updateInset);
}
function updateInset() {
  const w = main.clientWidth, pw = panel.isOpen ? panel.root.offsetWidth : 0;
  game.setInset({ right: panel.isOpen && pw < w - 160 ? pw : 0 });
  // nothing of the building shows behind a full-width panel, so stop drawing it
  game.hiddenView = panel.isOpen && pw >= w - 160;
}
new ResizeObserver(updateInset).observe(main);
new ResizeObserver(updateInset).observe(panel.root);

// ---------------------------------------------------------------- cabinets
const CAB_TONE = { cab1: 'gold', cab2: 'lav', cab3: 'teal' };
function cabinetItems(cab) { return Object.keys(ITEMS).filter((id) => ITEMS[id].where === cab); }
for (const f of Object.values(game.floors)) for (const q of f.props) {
  if (q.use && q.use.cabinet) {
    const cab = q.use.cabinet;
    q.opt = Object.assign({}, q.opt, { contents: () => cabinetItems(cab).filter((id) => !rig.has(id)).map((id) => ITEMS[id].icon[1] && ITEMS[id].icon[1].startsWith && ITEMS[id].icon[1].startsWith('#') ? ITEMS[id].icon[1] : '#FFE07A') });
  }
}
function openCabinet(cab, name) {
  const ids = cabinetItems(cab);
  const grid = el('div', { class: 'rpg-grid' });
  const takeAll = el('button', { type: 'button', text: 'Take everything' });
  function render() {
    grid.replaceChildren(...ids.map((id) => {
      const have = rig.has(id), it = ITEMS[id];
      const cv = el('canvas', { width: 16, height: 16, 'aria-hidden': 'true' }); cv.getContext('2d').drawImage(itemIcon(id), 0, 0);
      const b = el('button', { type: 'button', class: 'rpg-item' + (have ? ' is-locked' : ''), 'aria-label': have ? `${it.name}, already in your bag` : `Take ${it.name}` },
        cv, el('b', { text: it.name }), el('small', { text: have ? 'In your bag' : it.desc }));
      b.addEventListener('click', () => { if (!rig.has(id)) { rig.give(id, true); toast(`You took: ${it.name}`, id); render(); } });
      return b;
    }));
    takeAll.disabled = ids.every((id) => rig.has(id));
  }
  takeAll.addEventListener('click', () => { const got = ids.filter((id) => !rig.has(id)); got.forEach((id) => rig.give(id, true)); if (got.length) toast(`You took ${got.length} things`, got[0]); render(); });
  render();
  sheet(name || 'Cabinet', [el('p', { text: 'Samples and equipment for the experiments on this floor. Take what you like: it goes in your bag, and the experiments will offer it.' }), el('div', { class: 'rpg-help' }, el('div', { class: 'row' }, takeAll)), grid]);
}

// ---------------------------------------------------------------- sheets
let openSheet = null;
// sheets opened with a mouse or a tap give the keyboard back to the game when they close;
// opened from the keyboard, focus goes back to the button that opened them
let sheetByPointer = false;
function sheet(title, kids, { onClose } = {}) {
  if (openSheet) openSheet.close();
  const opener = sheetByPointer ? canvas : document.activeElement;
  sheetByPointer = false;
  const x = el('button', { type: 'button', class: 'x', 'aria-label': 'Close', text: '×' });
  const card = el('div', { class: 'rpg-card pixbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, x, el('h2', { text: title }), ...kids);
  const wrap = el('div', { class: 'rpg-sheet' }, card);
  main.append(wrap);
  game.freeze(true);
  const onKey = (e) => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); close(); } };
  const close = () => {
    wrap.remove(); openSheet = null; game.freeze(false);
    window.removeEventListener('keydown', onKey, true);
    if (onClose) onClose();
    (opener && opener.isConnected && opener !== document.body ? opener : canvas).focus({ preventScroll: true });
  };
  x.addEventListener('click', close);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
  window.addEventListener('keydown', onKey, true);
  setTimeout(() => (card.querySelector('button:not(.x)') || x).focus({ preventScroll: true }), 30);
  openSheet = { close };
  return openSheet;
}

function openGuide() {
  const floors = [3, 2, 1].map((f) => {
    const exps = EXPERIMENTS.filter((e) => e.floor === f);
    return el('div', { class: 'rpg-floorcard' },
      el('h3', {}, `${f}F · ${FLOOR_NAMES[f]}`, game.p.floor === f ? el('span', { class: 'here', text: '(you are here)' }) : null),
      el('ul', {}, ...exps.map((e) => el('li', {}, el('button', { type: 'button', text: e.title, title: e.blurb, onclick: () => { openSheet && openSheet.close(); openExperiment(e.id); } })))),
      game.p.floor !== f ? el('ul', {}, el('li', {}, el('button', { type: 'button', text: `Take the elevator to ${f}F`, onclick: () => { openSheet && openSheet.close(); goFloor(f, 2, 3, 'down'); } }))) : null);
  });
  sheet('Building directory', [el('p', { text: 'Open any experiment straight away, or ride the elevator and walk there.' }), el('div', { class: 'rpg-floors' }, ...floors)]);
}

function openBag() {
  const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].where !== 'free');
  const have = ids.filter((id) => rig.has(id));
  const grid = el('div', { class: 'rpg-grid' }, ...have.map((id) => {
    const cv = el('canvas', { width: 16, height: 16, 'aria-hidden': 'true' }); cv.getContext('2d').drawImage(itemIcon(id), 0, 0);
    return el('div', { class: 'rpg-item' }, cv, el('b', { text: ITEMS[id].name }), el('small', { text: ITEMS[id].desc }));
  }));
  sheet('Your bag', [el('p', { text: have.length ? `${have.length} of ${ids.length} things found. The experiments offer whatever is in your bag, alongside what is always on the bench.` : 'Empty, for now. The cabinets on each floor have samples and equipment, and the people here hand out a few special things.' }), grid]);
}

function openPassport() {
  const got = rig.stamps();
  const grid = el('div', { class: 'rpg-stamps' }, ...STAMPS.map((s) => {
    const cv = el('canvas', { width: 34, height: 34, 'aria-hidden': 'true' }); cv.getContext('2d').drawImage(stampIcon(s.id), 0, 0);
    const ok = got.includes(s.id);
    return el('div', { class: 'rpg-stamp' + (ok ? '' : ' is-empty') }, cv, el('b', { text: ok ? s.name : '???' }), el('span', { text: `${s.floor}F · ${s.how}` }));
  }));
  sheet('Lab passport', [el('p', { text: `${got.length} of ${STAMPS.length} stamps.` + (got.length === STAMPS.length ? ' Every single one. You are an honorary member of M² Lab!' : '') }), grid]);
}

function openHelp() {
  const styles = styleButtons((id) => { S.style = id; state.save(true); game.setStyle(id); });
  const reset = el('button', { type: 'button', text: 'Start the building afresh', onclick: async () => {
    openSheet && openSheet.close();
    const c = await dialog.ask(null, 'Start again from the front door? Your bag, stamps and mystery samples will be reset.', ['Start afresh', 'Keep my progress']);
    dialog.close();
    if (c === 0) { state.reset(); location.reload(); }
  } });
  const all = el('button', { type: 'button', text: rig.flag('allItems') ? 'Everything is in your bag' : 'Put every item in my bag', onclick: () => { rig.flag('allItems', true); all.textContent = 'Everything is in your bag'; refreshFilmMenus(); toast('Every sample and every piece of equipment is now in your bag'); } });
  sheet('How to play', [
    el('div', { class: 'rpg-help' },
      el('dl', {},
        el('dt', { text: isTouch ? 'Walk' : 'Arrow keys / W A S D' }), el('dd', { text: isTouch ? 'Tap where you want to go, or use the pad.' : 'Walk. Hold Shift to run. You can also click where you want to go.' }),
        el('dt', { text: isTouch ? 'A button' : 'Space / Enter / E' }), el('dd', { text: 'Talk, or use what you are facing. Tapping a thing walks you to it.' }),
        el('dt', { text: 'Esc' }), el('dd', { text: 'Close a panel or a menu.' }),
        el('dt', { text: 'Map' }), el('dd', { text: 'Every experiment in the building, one click away.' })),
      el('h3', { text: 'Your scientist' }), styles,
      el('h3', { text: 'Progress' }),
      el('p', { text: 'Your progress is kept in this browser only. The mystery samples are different for every visitor, so nobody can tell you the answers.' }),
      el('div', { class: 'row' }, all, reset),
      el('h3', { text: 'Elsewhere' }),
      el('p', {}, 'Our real lab is in the ', el('a', { href: 'lab3d.html', text: 'holo room (3D)' }), '. Or go back to the ', el('a', { href: 'index.html', text: 'homepage' }), '.')),
  ]);
}

function styleButtons(onPick) {
  const wrap = el('div', { class: 'rpg-styles', role: 'group', 'aria-label': 'Choose how your scientist looks' });
  for (const st of STYLES) {
    const img = playerSprites(st.id).down[0];
    const cv = el('canvas', { width: img.width, height: img.height, 'aria-hidden': 'true' }); cv.getContext('2d').drawImage(img, 0, 0);
    const b = el('button', { type: 'button', 'aria-pressed': (S.style || 'teal') === st.id ? 'true' : 'false' }, cv, el('span', { text: st.name }));
    b.addEventListener('click', () => { wrap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); onPick(st.id); });
    wrap.append(b);
  }
  return wrap;
}

// ---------------------------------------------------------------- HUD, toasts, touch pad
function setFloorBadge(f) {
  floorBadge.dataset.floor = f;
  floorBadge.querySelector('.rpg-floor-n').textContent = f + 'F';
  floorBadge.querySelector('.rpg-floor-t').textContent = FLOOR_NAMES[f];
  canvas.setAttribute('aria-label', `The M² Lab building, ${f}F ${FLOOR_NAMES[f]}. Use the arrow keys to walk and Space to use what you face. The Map button lists every experiment.`);
}
setFloorBadge(game.p.floor);
for (const [id, fn] of [['rpg-guide', openGuide], ['rpg-bag', openBag], ['rpg-pass', openPassport], ['rpg-help', openHelp]]) {
  document.getElementById(id).addEventListener('click', (e) => { sheetByPointer = e.detail > 0; fn(); });
}
function updateCounts() {
  const n = rig.stamps().length;
  const c = document.querySelector('#rpg-pass .count'); if (c) { c.textContent = n; c.hidden = n === 0; }
}
rig.on('stamp', updateCounts); updateCounts();

let toastTimer = 0;
const toastEl = el('div', { class: 'rpg-toast pixbox is-out', role: 'status' });
main.append(toastEl);
function toast(text, itemId, stampId) {
  toastEl.replaceChildren();
  const img = stampId ? stampIcon(stampId) : itemId ? itemIcon(itemId) : null;
  if (img) { const cv = el('canvas', { width: img.width, height: img.height, 'aria-hidden': 'true' }); cv.getContext('2d').drawImage(img, 0, 0); toastEl.append(cv); }
  toastEl.append(el('span', { text }));
  toastEl.classList.remove('is-out');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add('is-out'), 2600);
}

if (isTouch) {
  const pad = el('div', { class: 'rpg-pad', 'aria-hidden': 'true' });
  for (const [d, cls, sym] of [['up', 'u', '▲'], ['left', 'l', '◀'], ['right', 'r', '▶'], ['down', 'd', '▼']]) {
    const b = el('button', { type: 'button', class: cls, tabindex: '-1', text: sym });
    const on = (e) => { e.preventDefault(); b.classList.add('is-down'); game.press(d, true); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
    const off = () => { b.classList.remove('is-down'); game.press(d, false); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    pad.append(b);
  }
  const a = el('button', { type: 'button', class: 'rpg-a', 'aria-label': 'Use', text: 'A' });
  a.addEventListener('pointerdown', (e) => { e.preventDefault(); a.classList.add('is-down'); game.act(); });
  a.addEventListener('pointerup', () => a.classList.remove('is-down'));
  a.addEventListener('pointercancel', () => a.classList.remove('is-down'));
  main.append(pad, a);
}

// ---------------------------------------------------------------- first visit
function intro() {
  const box = document.getElementById('rpg-intro');
  if (!box) return;
  if (S.style && !location.hash) { box.hidden = true; return; }
  box.hidden = false;
  game.freeze(true);
  const slot = box.querySelector('.rpg-styles-slot');
  slot.replaceChildren(styleButtons((id) => { S.style = id; game.setStyle(id); }));
  const start = box.querySelector('.start');
  const done = () => {
    if (!S.style) S.style = 'teal';
    state.save(true); box.hidden = true; game.freeze(false); canvas.focus({ preventScroll: true });
    if (!rig.stamps().includes('hello')) setTimeout(() => toast('Say hello to Bolt at the front desk'), 600);
  };
  start.addEventListener('click', done, { once: true });
  box.querySelector('.list').addEventListener('click', (e) => { e.preventDefault(); done(); openGuide(); });
  setTimeout(() => start.focus({ preventScroll: true }), 50);
}
intro();

// open an experiment straight from the address, e.g. lab.html#pendulum/graphs
function fromHash() {
  const m = location.hash.match(/^#([\w-]+)(?:\/([\w-]+))?/);
  if (!m) return;
  const e = EXPERIMENTS.find((x) => x.id === m[1]);
  if (e) { const box = document.getElementById('rpg-intro'); if (box && !box.hidden) { box.hidden = true; game.freeze(false); if (!S.style) { S.style = 'teal'; state.save(true); } } openExperiment(e.id, m[2]); }
}
fromHash();

window.__building = { game, rig, state, openExperiment, dialog, panel };
canvas.focus({ preventScroll: true });
