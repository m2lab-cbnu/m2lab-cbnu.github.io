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
import { sound } from './rpg/sound.js';
import { CARDS } from './rpg/cards.js';
import { isKo, loadLang, install as installLang, setLang, tr, trf, trc } from './i18n.js';
import { PUZZLES, puzzleOfDay, streak, todayAnswer, recordAnswer, season, SEASON_HELLO } from './rpg/daily.js';

// Korean or English: the dictionary arrives before anything is drawn
await loadLang();
installLang();

const main = document.getElementById('vlab');
const canvas = document.getElementById('rpg-canvas');
const isTouch = matchMedia('(pointer: coarse)').matches;
const FLOOR_NAMES = { 1: 'Classics Hall', 2: 'Physics Playground', 3: 'Magnonics Lab' };
const floorBadge = document.querySelector('.rpg-floor');

// labels on the canvas use the pixel font, so give it a moment to arrive
// (and the Korean pixel fonts for the Hangul signs painted into the rooms)
await Promise.race([document.fonts ? Promise.all([
  document.fonts.load('600 16px Pixelify'), document.fonts.load('8px Galmuri7', '한'), document.fonts.load('12px Galmuri', '한'),
]).catch(() => {}) : null, new Promise((r) => setTimeout(r, 2000))]);
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
  onFloor: (f) => { setFloorBadge(f); if (f === 2) rig.flag('been2', true); if (f === 3) rig.flag('been3', true); if (sound.music) sound.startMusic(f); },
  onStep: (f, x, y, dir) => state.where(f, x, y, dir),
  onFocus: (t) => { live.textContent = t ? trf('In front of you: {0}. Press Space to use it.', tr(labelFor(t))) : ''; },
  npcMark,
  labelFor: (t) => tr(labelFor(t)) + (isTouch ? '' : '  ·  ' + tr('Space')),
});
game.setStyle(S.style || 'teal');
game.teleport(S.floor || START.floor, Number.isFinite(S.x) ? S.x : START.x, Number.isFinite(S.y) ? S.y : START.y, S.dir || START.dir);
// a saved spot that is no longer free (the furniture moved) sends you back to the front door
if (game.blocked(game.p.x, game.p.y, game.p) || 'UZD'.includes(game.tileAt(game.p.x, game.p.y))) game.teleport(START.floor, START.x, START.y, START.dir);
// Injeolmi (the cat) naps on the lobby rug until someone wakes her
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
    const views = ['The city hums below. Somewhere out there, a magnet is being measured.', 'Clouds drift past. A drone delivers a box labeled “liquid nitrogen”.', 'From up here the river looks like a long, slow wave.'];
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
  if (u.paper) return openPaper(u.paper);
  if (u.photo) return openPhoto(u.photo);
  if (u.go) {
    const c = await dialog.ask(null, 'Step into the **holo room**? It is our real lab, rebuilt in 3D. It needs a computer with decent graphics.', ['Step in', 'Stay here']);
    dialog.close();
    if (c === 0) { rig.flag('visitedHolo', true); location.href = u.go; }
    return;
  }
  if (u.daily) return dailyPuzzle();
  if (u.karaoke) return karaoke();
  if (u.claw) return clawMachine();
  if (u.beanbag) {
    if (u.beanbag === 2 && !rig.has('magnet-tiny') && ITEMS['magnet-tiny']) {
      rig.give('magnet-tiny', true);
      await dialog.say(null, ['You lift the beanbag... a **tiny magnet**! Injeolmi must have hidden it here.']);
      toast(trf('You got: {0}', tr(ITEMS['magnet-tiny'].name)), 'magnet-tiny');
    } else await dialog.say(null, ['Squishy. Nothing under this one.']);
  }
}

// 오늘의 문제: one puzzle a day, the same for everyone; answering on days in a row builds a streak
async function dailyPuzzle() {
  const [q, choices, right, why] = PUZZLES[puzzleOfDay()];
  const done = todayAnswer(), n = streak();
  const head = n > 1 ? `Puzzle of the day (오늘의 문제). You are on a streak of ${n} days!` : 'Puzzle of the day (오늘의 문제). A new one appears every morning.';
  const ans = `**${trc('quiz', choices[right])}**`;   // short answers can need a different word here
  if (done) {
    await dialog.say(null, [head, trf('Today’s puzzle: {0}', tr(q)), trf(done.ok ? 'You got it right: {0}.' : 'The answer: {0}.', ans) + ' ' + tr(why), 'Come back tomorrow for a new one.']);
    return;
  }
  await dialog.say(null, [head], { keepOpen: true });
  const c = await dialog.ask(null, q, choices.map((x) => trc('quiz', x)));
  if (c < 0) { dialog.close(); return; }
  const ok = c === right;
  recordAnswer(c, ok);
  sound.play(ok ? 'right' : 'wrong');
  await dialog.say(null, [ok ? 'Right!' : trf('Not quite: it is {0}.', ans), why]);
  const s = streak();
  for (const [id, need] of [['daily1', 1], ['streak3', 3], ['streak7', 7]]) if (s >= need && rig.stamp(id)) toast(trf('New stamp: {0}', tr(STAMPS.find((x) => x.id === id).name)), null, id);
  await dialog.say(null, [s > 1 ? `That makes ${s} days in a row. See you tomorrow!` : 'Come back tomorrow for a new one: answer on days in a row to build a streak.']);
}

// 노래방: Kongi's song, five notes of a pentatonic scale, plucked like a gayageum
const SONG = [[392, 1], [440, 0.5], [493.88, 0.5], [587.33, 1.5], [493.88, 0.5], [440, 1], [392, 0.5], [329.63, 0.5], [392, 2],
  [493.88, 1], [587.33, 0.5], [659.26, 0.5], [783.99, 1.5], [659.26, 0.5], [587.33, 1], [493.88, 0.5], [440, 0.5], [392, 2]];
async function karaoke() {
  for (;;) {
    const len = sound.melody(SONG, 150);
    await dialog.say(null, [len ? 'The screen lights up: 노래방 (noraebang), Korean karaoke. Tonight’s song is “Five Notes”, by Kongi. ♪'
      : 'The screen lights up: 노래방 (noraebang), Korean karaoke. Turn the sound on (top right) to hear Kongi’s song.',
    'It uses only five notes: G, A, B, D and E. Many Korean folk songs are built on five-note scales like this one.',
    'Every note is a frequency. This G is 392 Hz; the G an octave higher is 784 Hz, exactly twice as fast.']);
    if (rig.stamp('karaoke')) toast(trf('New stamp: {0}', tr(STAMPS.find((x) => x.id === 'karaoke').name)), null, 'karaoke');
    const c = await dialog.ask(null, 'One more time?', ['Sing it again', 'Enough singing']);
    if (c !== 0) { dialog.close(); return; }
  }
}

// 인형뽑기: a claw machine with a plush of everyone in the building
const PLUSH = ['hoo', 'pip', 'fennec', 'bolt', 'mochi', 'nova'];
async function clawMachine() {
  const have = PLUSH.filter((k) => rig.has('plush-' + k));
  if (have.length === PLUSH.length) { await dialog.say(null, ['The claw machine is empty. You won every plush in it, and Kongi is very impressed.']); return; }
  const c = await dialog.ask(null, `인형뽑기 (inhyeong ppopgi): a claw machine full of plush toys that look a lot like the people in this building. You have ${have.length} of 6.`, ['Try once', 'Walk away']);
  if (c !== 0) { dialog.close(); return; }
  sound.play('whoosh');
  const tries = (rig.flag('clawTries') || 0) + 1; rig.flag('clawTries', tries);
  if (Math.random() < 0.34 || tries % 4 === 0) {
    const left = PLUSH.filter((k) => !rig.has('plush-' + k)), k = left[Math.floor(Math.random() * left.length)], id = 'plush-' + k;
    rig.give(id, true); rig.flag('clawTries', 0); sound.play('coin');
    await dialog.say(null, ['The claw drops, closes, lifts... and holds on!', trf('You won the **{0}**!', tr(ITEMS[id].name))]);
    toast(trf('You got: {0}', tr(ITEMS[id].name)), id);
    if (PLUSH.every((x) => rig.has('plush-' + x)) && rig.stamp('plush')) toast(trf('New stamp: {0}', tr(STAMPS.find((x) => x.id === 'plush').name)), null, 'plush');
  } else {
    const miss = ['The claw closes on a plush, lifts it... and it slides out. Friction lost to gravity this time.', 'The claw swings, drops, and grabs nothing but air.', 'So close! The plush tumbles back onto the pile.'];
    await dialog.say(null, [miss[Math.floor(Math.random() * miss.length)]]);
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
    await dialog.say(null, [trf('The {0} is still being set up. Try another experiment for now.', tr(meta.title))]);
    return;
  }
  if (meta.station) mod = asStation(mod, meta);
  game.freeze(true);
  // experiments get the whole window: the building waits behind
  panel.setWide(true);
  panel.open(mod, tab);
  sound.play('pop');
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
      const b = el('button', { type: 'button', class: 'rpg-item' + (have ? ' is-locked' : ''), 'aria-label': have ? trf('{0}, already in your bag', tr(it.name)) : trf('Take {0}', tr(it.name)) },
        cv, el('b', { text: it.name }), el('small', { text: have ? 'In your bag' : it.desc }));
      b.addEventListener('click', () => { if (!rig.has(id)) { rig.give(id, true); toast(trf('You took: {0}', tr(it.name)), id); render(); } });
      return b;
    }));
    takeAll.disabled = ids.every((id) => rig.has(id));
  }
  takeAll.addEventListener('click', () => { const got = ids.filter((id) => !rig.has(id)); got.forEach((id) => rig.give(id, true)); if (got.length) toast(`You took ${got.length} things`, got[0]); render(); });
  render();
  sheet(name || 'Cabinet', [el('p', { text: 'Samples and equipment for the experiments on this floor. Take what you like: it goes in your bag, and the experiments will offer it.' }), el('div', { class: 'rpg-help' }, el('div', { class: 'row' }, takeAll)), grid]);
}

// ---------------------------------------------------------------- the paper gallery and the project photos
const PAPERS = {
  nc2024: { journal: 'Nature Communications', ref: '15, 7302 (2024)', title: 'Emergent coherent modes in nonlinear magnonic waveguides detected at ultrahigh frequency resolution', doi: 'https://doi.org/10.1038/s41467-024-51483-7',
    fig: 'images/figures/nonlinear-waveguide.webp', alt: 'Schematic of a frequency-offset vector network analyzer measurement on a magnonic waveguide, with transmission spectra near 2.125 GHz',
    plain: ['Push spin waves hard enough down a narrow magnetic strip and they start to interact with each other.', 'New, very sharp modes then appear in the spectrum, packed so close together in frequency that we needed an ultrahigh frequency resolution to tell them apart.'],
    tryIt: ['chain', 'Send spin waves down a chain of spins'] },
  pra2023: { journal: 'Physical Review Applied', ref: '20, 014046 (2023)', title: 'Optimizing the magnon-phonon cooperativity in planar geometries', doi: 'https://doi.org/10.1103/PhysRevApplied.20.014046',
    plain: ['Inside a magnet, spin waves (magnons) and sound waves (phonons) can trade energy back and forth.', 'How well they do it, compared with how fast each of them dies away, is called the cooperativity. We worked out which flat geometries make it as large as possible.'],
    tryIt: ['cavity', 'See two kinds of waves share energy'] },
  prx2022: { journal: 'Physical Review X', ref: '12, 011060 (2022)', title: 'Bright and dark states of two distant macrospins strongly coupled by phonons', doi: 'https://doi.org/10.1103/PhysRevX.12.011060',
    fig: 'images/figures/bright-dark-states.webp', alt: 'Bloch sphere showing the bright state and the dark state of two coupled magnets',
    plain: ['Two small magnets, far apart on the same crystal, can still swing together: sound waves in the crystal carry their motion across.', 'Like the coupled pendulums on 2F, the pair then has two ways to move together. The bright one shows up in our measurement; the dark one hides from it.'],
    tryIt: ['coupled', 'Try the coupled pendulums on 2F'] },
  prb2020: { journal: 'Physical Review B', ref: '101, 060407(R) (2020)', title: 'Coherent long-range transfer of angular momentum between magnon Kittel modes by phonons', doi: 'https://doi.org/10.1103/PhysRevB.101.060407',
    plain: ['Sound waves can carry spin. We showed that phonons in a garnet crystal pass angular momentum from one magnet to another one far away.', 'And they keep in step all the way across: the transfer is coherent, not just a random shove.'],
    tryIt: ['precess', 'Make a single spin precess'] },
  pra2019: { journal: 'Physical Review Applied', ref: '11, 034065 (2019)', title: 'Optimization of spin-wave propagation with enhanced group velocities by exchange-coupled ferrimagnet-ferromagnet bilayers', doi: 'https://doi.org/10.1103/PhysRevApplied.11.034065',
    plain: ['Spin waves are slow travelers. Stacking two different magnetic layers, held together by exchange, made them run much faster.', 'Faster spin waves are good news if you want to send signals with them.'],
    tryIt: ['chain', 'See how fast a spin wave travels'] },
  prl2016: { journal: 'Physical Review Letters', ref: '117, 107202 (2016)', title: 'Magnons and phonons optically driven out of local equilibrium in a magnetic insulator', doi: 'https://doi.org/10.1103/PhysRevLett.117.107202',
    plain: ['Heat a magnet with a laser and the energy goes into both its spins (magnons) and its vibrations (phonons).', 'We found that the two do not keep the same temperature: they fall out of local equilibrium, and we measured by how much.'],
    tryIt: null },
};
const PHOTOS = {
  poster: { src: 'images/thumbs/kps2026-poster.jpg', alt: 'A student presents a poster next to a stacked lattice model at the KPS Fall Meeting', text: 'The microwave diffraction poster in the undergraduate research competition, KPS Fall Meeting 2026, Jeju.', tryIt: ['bragg', 'Try the microwave crystal'] },
  setup: { src: 'images/thumbs/microwave-diffraction-setup-2026.jpg', alt: 'Microwave antennas aimed at a stacked lattice model on an optical table', text: 'The microwave diffraction setup on the optical table, September 2026: steel balls on 3D-printed layers make simple cubic, BCC and FCC crystals.', tryIt: ['bragg', 'Try the microwave crystal'] },
  team: { src: 'images/thumbs/kps2026-team.jpg', alt: 'Kyongmo An with the 2026 summer students in front of the KPS Fall Meeting banner in Jeju', text: 'The 2026 summer team at the KPS Fall Meeting in Jeju. One team hammered steel rods in the Earth’s field, the other built crystals out of steel balls.', tryIt: ['rod', 'Hammer a steel rod'] },
};
function tryButton(t) {
  if (!t) return null;
  return el('div', { class: 'rpg-help' }, el('div', { class: 'row' }, el('button', { type: 'button', text: t[1], onclick: () => { openSheet && openSheet.close(); openExperiment(t[0]); } })));
}
function openPaper(id) {
  const p = PAPERS[id]; if (!p) return;
  rig.flag('paper:' + id, true);
  const kids = [
    el('p', { class: 'rpg-paper-src', text: `${p.journal} ${p.ref}` }),
    el('p', { class: 'rpg-paper-title', text: p.title }),
    p.fig ? el('img', { class: 'rpg-paper-fig', src: p.fig, alt: p.alt, loading: 'lazy' }) : null,
    el('h3', { text: 'In plain words' }), ...p.plain.map((t) => el('p', { text: t })),
    el('p', {}, el('a', { href: p.doi, target: '_blank', rel: 'noopener', text: 'Read the paper' })),
    tryButton(p.tryIt),
  ].filter(Boolean);
  sheet('From our papers', kids);
}
function openPhoto(id) {
  const p = PHOTOS[id]; if (!p) return;
  sheet('Student projects', [el('img', { class: 'rpg-paper-fig', src: p.src, alt: p.alt, loading: 'lazy' }), el('p', { text: p.text }), tryButton(p.tryIt)].filter(Boolean));
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
  const have = rig.cards(), ids = Object.keys(CARDS);
  const cards = el('div', { class: 'rpg-cards' }, ...ids.map((id) => {
    const c = CARDS[id], ok = have.includes(id);
    return el('div', { class: 'rpg-cardi' + (ok ? '' : ' is-empty'), 'data-floor': c.floor },
      el('span', { class: 'fl', text: `${c.floor}F` }), el('b', { text: ok ? c.title : '???' }), el('span', { text: ok ? c.text : 'Solve a challenge to reveal this card.' }));
  }));
  sheet('Lab passport', [
    el('p', { class: 'rpg-rank', text: `${rankOf()} · ${got.length} of ${STAMPS.length} stamps · ${have.length} of ${ids.length} cards` }),
    el('h3', { text: 'Stamps' }), el('p', { text: got.length === STAMPS.length ? 'Every single one. You are an honorary member of M² Lab!' : 'The people in the building stamp your passport when you help them, and some experiments stamp it when you pull off something special.' }), grid,
    el('h3', { text: 'Insight cards' }), el('p', { text: 'Each challenge (guess first, then watch) gives you a card that keeps what you found out.' }), cards,
  ]);
}
function rankOf() {
  const n = rig.stamps().length + rig.cards().length;
  const total = STAMPS.length + Object.keys(CARDS).length;
  if (n >= total) return 'Magnon master';
  return n >= 50 ? 'Senior researcher' : n >= 32 ? 'Researcher' : n >= 18 ? 'Junior researcher' : n >= 8 ? 'Lab intern' : n >= 2 ? 'Lab helper' : 'Visitor';
}

function openHelp() {
  const styles = styleButtons((id) => { S.style = id; state.save(true); game.setStyle(id); });
  const music = el('button', { type: 'button', text: sound.music ? 'Music: on' : 'Music: off', onclick: () => { sound.setMusic(!sound.music); music.textContent = tr(sound.music ? 'Music: on' : 'Music: off'); if (sound.music) sound.startMusic(game.p.floor); else sound.stopMusic(); } });
  const lang = el('button', { type: 'button', 'data-tr': 'no', lang: isKo ? 'en' : 'ko', text: isKo ? 'View in English' : '한국어로 보기', onclick: () => setLang(isKo ? 'en' : 'ko') });
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
      el('h3', { text: 'Sound and language' }),
      el('p', { text: 'Gentle background music, a different tune on every floor. The language button switches every sign, line and experiment between English and Korean.' }),
      el('div', { class: 'row' }, music, lang),
      el('h3', { text: 'Elsewhere' }),
      el('p', { html: 'Our real lab is in the <a href="lab3d.html">holo room (3D)</a>. Or go back to the <a href="index.html">homepage</a>.' })),
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
  canvas.setAttribute('aria-label', trf('The M² Lab building, {0}. Use the arrow keys to walk and Space to use what you face. The Map button lists every experiment.', `${tr(f + 'F')} ${tr(FLOOR_NAMES[f])}`));
}
setFloorBadge(game.p.floor);
for (const [id, fn] of [['rpg-guide', openGuide], ['rpg-bag', openBag], ['rpg-pass', openPassport], ['rpg-help', openHelp]]) {
  document.getElementById(id).addEventListener('click', (e) => { sheetByPointer = e.detail > 0; fn(); });
}
function updateCounts() {
  const n = rig.stamps().length + rig.cards().length;
  const c = document.querySelector('#rpg-pass .count'); if (c) { c.textContent = n; c.hidden = n === 0; }
}
rig.on('stamp', () => { updateCounts(); sound.play('stamp'); }); updateCounts();
rig.on('card', (id) => { updateCounts(); if (CARDS[id]) toast(trf('New card: {0}', tr(CARDS[id].title))); });
rig.on('item', () => sound.play('coin'));

// sound on and off
const sndBtn = document.getElementById('rpg-sound');
function syncSound() { sndBtn.setAttribute('aria-pressed', sound.on ? 'true' : 'false'); sndBtn.classList.toggle('is-off', !sound.on); sndBtn.setAttribute('aria-label', sound.on ? 'Sound is on' : 'Sound is off'); }
sndBtn.addEventListener('click', () => { sound.set(!sound.on); syncSound(); sound.play('pop'); });
syncSound();

// English / 한국어: each button is written in the language it switches to
const langBtn = document.getElementById('rpg-lang');
if (langBtn) {
  langBtn.querySelector('.lbl').textContent = isKo ? 'English' : '한국어';
  langBtn.setAttribute('lang', isKo ? 'en' : 'ko');
  langBtn.setAttribute('aria-label', isKo ? 'Switch to English' : '한국어로 보기');
  langBtn.addEventListener('click', () => setLang(isKo ? 'en' : 'ko'));
}
const introLang = document.querySelector('.rpg-intro .lang');
if (introLang) {
  introLang.textContent = isKo ? 'View in English' : '한국어로 보기';
  introLang.setAttribute('lang', isKo ? 'en' : 'ko');
  introLang.addEventListener('click', () => setLang(isKo ? 'en' : 'ko'));
}

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

// the season: a greeting once a day while it lasts, never on top of the start screen
const now = season();
function greetSeason(delay) {
  if (!now || rig.flag('seasonHello') === now + new Date().toDateString()) return;
  rig.flag('seasonHello', now + new Date().toDateString());
  setTimeout(() => toast(SEASON_HELLO[now]), delay);
}

// ---------------------------------------------------------------- first visit
function intro() {
  const box = document.getElementById('rpg-intro');
  if (!box) return;
  if (S.style && !location.hash) { box.hidden = true; greetSeason(1800); return; }
  box.hidden = false;
  game.freeze(true);
  const slot = box.querySelector('.rpg-styles-slot');
  slot.replaceChildren(styleButtons((id) => { S.style = id; game.setStyle(id); }));
  const start = box.querySelector('.start');
  const done = () => {
    if (!S.style) S.style = 'teal';
    state.save(true); box.hidden = true; game.freeze(false); canvas.focus({ preventScroll: true });
    if (!rig.stamps().includes('hello')) setTimeout(() => toast('Say hello to Baro at the front desk'), 600);
    greetSeason(rig.stamps().includes('hello') ? 900 : 5200);
  };
  start.addEventListener('click', done, { once: true });
  box.querySelector('.list').addEventListener('click', (e) => { e.preventDefault(); done(); openGuide(); });
  setTimeout(() => start.focus({ preventScroll: true }), 50);
}
intro();

// music, if it is switched on: each floor has its own tune
if (sound.music) sound.startMusic(game.p.floor);

// open an experiment straight from the address, e.g. lab.html#pendulum/graphs
function fromHash() {
  const m = location.hash.match(/^#([\w-]+)(?:\/([\w-]+))?/);
  if (!m) return;
  const e = EXPERIMENTS.find((x) => x.id === m[1]);
  if (e) { const box = document.getElementById('rpg-intro'); if (box && !box.hidden) { box.hidden = true; game.freeze(false); if (!S.style) { S.style = 'teal'; state.save(true); } } openExperiment(e.id, m[2]); }
}
fromHash();

window.__building = { game, rig, state, openExperiment, dialog, panel, talk, use };
canvas.focus({ preventScroll: true });
