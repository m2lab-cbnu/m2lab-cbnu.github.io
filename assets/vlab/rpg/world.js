// What stands where in the building, who works on which floor, and what happens when you use it.
//   use.bench    opens an experiment (assets/vlab/bench)
//   use.station  opens one of the magnonics instruments (assets/vlab/stations)
//   use.cabinet  opens a cabinet of samples and equipment
//   use.read     a few lines of text
//   use.guide    the building directory      use.go  a link (the holo room)

import { FLOORS } from './maps.js';

const P = (type, x, y, extra = {}) => ({ type, x, y, ...extra });

const read = (name, ...lines) => ({ name, use: { read: lines } });

const floor1 = {
  props: [
    // lobby
    P('rug', 1, 5, { opt: { w: 4, h: 4, tone: 'teal' } }),
    P('doormat', 6, 20),
    P('directory', 5, 3, { name: 'Building directory', use: { guide: true } }),
    P('plant', 1, 3, read('Monstera', 'A happy monstera. Somebody waters it every Monday.')),
    P('plant', 8, 3, { opt: { kind: 'tall', pot: 'teal' }, ...read('Snake plant', 'It survives anything, even a cryostat warming up.') }),
    P('sofa', 1, 6, { opt: { tone: 'teal' }, ...read('Sofa', 'Soft. Mochi the cat thinks it belongs to her.') }),
    P('table', 1, 8, read('Coffee table', 'Three mugs. One says “I ♥ magnons”.')),
    P('armchair', 4, 6, { opt: { tone: 'gold' }, ...read('Armchair', 'The comfiest seat in the lobby.') }),
    P('vending', 1, 11, { opt: { tone: 'rose' }, ...read('Drinks machine', 'Fizzy water, iced tea, and something called “Spin Wave Soda”.') }),
    P('coffee', 1, 12, read('Coffee machine', 'It hums in B-flat. Nobody knows why.')),
    P('cooler', 1, 13, read('Water cooler', 'Stay hydrated, scientist.')),
    P('counter', 5, 14, { counter: true, name: 'Front desk', ...read('Front desk', 'The front desk. Bolt keeps it very tidy.') }),
    P('plant', 1, 19, { opt: { pot: 'gold' }, ...read('Plant', 'A rubber plant, leaning towards the windows.') }),
    P('plant', 10, 19, { opt: { kind: 'tall', pot: 'rose' }, ...read('Plant', 'This one is plastic. Do not tell the others.') }),
    P('boxes', 10, 15, read('Boxes', 'Deliveries for the 3rd floor: “FRAGILE: liquid helium inside, sort of”.')),
    // hall
    P('sign', 12, 3, { opt: { text: 'CLASSICS', tone: 'gold' }, ...read('Classics Hall', 'The textbook experiments, done properly. Change the sample, swap the equipment, measure again.') }),
    P('blackboard', 27, 1, { name: 'Blackboard', ...read('Blackboard', 'Prof. Hoo’s blackboard: T = 2π√(L/g), and a resonance curve drawn with great care.') }),
    P('poster', 16, 1, { opt: { kind: 'fma' }, ...read('Poster', 'F = ma. The most famous three letters in physics.') }),
    P('poster', 20, 1, { opt: { kind: 'wave' }, ...read('Poster', 'Waves: the same mathematics for strings, sound, light and spins.') }),
    P('poster', 25, 1, { opt: { kind: 'lens' }, ...read('Poster', 'Rays through a lens: one through the centre, one parallel, one through the focus.') }),
    P('clock', 11, 1, { dy: 6, ...read('Clock', 'It is always time for one more measurement.') }),
    P('lectern', 29, 4, read('Lectern', 'Prof. Hoo’s notes. The handwriting is very small and very neat.')),
    P('cabinet', 31, 3, { name: 'Classics cabinet', opt: { tone: 'gold', label: 'KIT', sparkle: true }, use: { cabinet: 'cab1' } }),
    P('pendulum', 13, 6, { name: 'Pendulum', use: { bench: 'pendulum' } }),
    P('spring', 17, 6, { name: 'Spring and motor', use: { bench: 'spring' }, phase: 0.4 }),
    P('airtrack', 21, 7, { name: 'Air track', use: { bench: 'airtrack' } }),
    P('optics', 13, 11, { name: 'Lens bench', use: { bench: 'optics' } }),
    P('strings', 19, 11, { name: 'Vibrating string', use: { bench: 'strings' } }),
    P('fieldtable', 25, 10, { name: 'Field table', use: { bench: 'field' } }),
    P('launcher', 12, 16, { name: 'Launcher', use: { bench: 'launcher' } }),
    P('basket', 31, 16, { name: 'Target', use: { bench: 'launcher' } }),
    P('plant', 32, 9, read('Fern', 'A fern. It has seen many pendulums come and go.')),
    P('plant', 32, 19, { opt: { pot: 'teal' }, ...read('Plant', 'Leaves turned to the light, like little compass needles.') }),
    P('chair', 30, 12, { opt: { tone: 'gold' } }),
    P('desk', 29, 13, read('Desk', 'A laptop running a spreadsheet of pendulum periods.')),
  ],
  npcs: [
    { id: 'bolt', name: 'Bolt', x: 6, y: 13, dir: 'down', tall: 12 },
    { id: 'hoo', name: 'Prof. Hoo', x: 28, y: 4, dir: 'down', tall: 12 },
    { id: 'mochi', name: 'Mochi', x: 4, y: 9, dir: 'down', wander: [1, 4, 10, 18], speed: 2.4, tall: 6 },
  ],
};

const floor2 = {
  props: [
    P('sign', 12, 3, { opt: { text: 'PLAYGROUND', tone: 'lav' }, ...read('Physics Playground', 'Experiments that look like magic tricks. They are not.') }),
    P('snackbar', 1, 4, read('Snack bar', 'Fruit, cookies, and a jar labelled “for postdocs only”.')),
    P('arcade', 1, 8, read('Arcade', '“MAGNON RUN: high score 99,999, by P. P.”')),
    P('vending', 1, 9, { opt: { tone: 'mint' }, ...read('Drinks machine', 'Out of everything except lemonade.') }),
    P('sofa', 5, 7, { opt: { tone: 'lav' }, ...read('Sofa', 'Squishy. A good place to think about slinkies.') }),
    P('beanbag', 2, 14, { opt: { tone: 'rose' }, name: 'Beanbag', use: { beanbag: 1 } }),
    P('beanbag', 5, 16, { opt: { tone: 'gold' }, name: 'Beanbag', use: { beanbag: 2 } }),
    P('beanbag', 7, 13, { opt: { tone: 'teal' }, name: 'Beanbag', use: { beanbag: 3 } }),
    P('plant', 10, 3, { opt: { pot: 'lav' }, ...read('Plant', 'A cheerful pothos, climbing towards the stairs.') }),
    P('plant', 1, 19, { opt: { kind: 'tall', pot: 'mint' }, ...read('Plant', 'Tall and calm.') }),
    P('poster', 13, 1, { opt: { kind: 'magnet' }, ...read('Poster', 'A magnet and its field lines. Moving magnets push currents around.') }),
    P('poster', 22, 1, { opt: { kind: 'cat' }, ...read('Poster', '“Have you seen this cat?” It is Mochi. She is fine.') }),
    P('cabinet', 21, 3, { name: 'Playground cabinet', opt: { tone: 'lav', label: 'TOYS', sparkle: true }, use: { cabinet: 'cab2' } }),
    P('pipetower', 13, 5, { name: 'Magnet and pipes', use: { bench: 'pipe' } }),
    P('slinkytower', 17, 5, { name: 'Slinky drop', use: { bench: 'slinky' } }),
    P('darkroom', 27, 3, { name: 'Dark room: double slit', use: { bench: 'slit' } }),
    P('coupled', 13, 11, { name: 'Coupled pendulums', use: { bench: 'coupled' } }),
    P('gyro', 19, 11, { name: 'Gyroscope', use: { bench: 'gyro' } }),
    P('chladni', 24, 11, { name: 'Chladni plate', use: { bench: 'chladni' } }),
    P('plant', 32, 8, { opt: { pot: 'rose' }, ...read('Plant', 'It vibrates slightly whenever the Chladni plate is on.') }),
    P('arcade', 32, 19, read('Arcade', '“PENDULUM HERO. Insert curiosity to play.”')),
    P('boxes', 32, 14, read('Boxes', 'Spare slinkies. Hundreds of them.')),
    P('sofa', 27, 17, { opt: { tone: 'rose' }, ...read('Sofa', 'The best seat for watching the Chladni plate.') }),
    P('plant', 26, 19, { opt: { kind: 'tall', pot: 'gold' }, ...read('Plant', 'It hums along with the speaker.') }),
    P('whiteboard', 28, 14, { opt: { text: 'F=-KX' }, ...read('Whiteboard', 'Pip’s plan: “1. drop magnet 2. be amazed 3. repeat”.') }),
  ],
  npcs: [
    { id: 'pip', name: 'Pip', x: 9, y: 11, dir: 'down', wander: [8, 10, 11, 12], speed: 2.2, tall: 12 },
  ],
};

const floor3 = {
  props: [
    P('sign', 11, 3, { opt: { text: 'MAGNONICS', tone: 'teal' }, ...read('Magnonics Lab', 'Spin waves, the ripples in a magnet. This is what M² Lab works on.') }),
    P('holoboard', 25, 1, { name: 'Holo-board: dispersion', use: { station: 'dispersion' } }),
    P('holodoor', 30, 1, { name: 'Holo room: our lab in 3D', use: { go: 'lab3d.html' } }),
    P('magnet', 13, 5, { name: 'FMR magnet', use: { station: 'fmr' } }),
    P('rack', 16, 5, { name: 'FMR instruments', use: { station: 'fmr' } }),
    P('optable', 19, 5, { name: 'BLS table', use: { station: 'bls' } }),
    P('simdesk', 13, 12, { name: 'Simulation desk', use: { station: 'micromag' } }),
    P('gpurack', 16, 11, { name: 'GPU cluster', use: { station: 'micromag' }, opt: { seed: 2 } }),
    P('fridge', 28, 11, read('Dilution refrigerator', 'It cools to ten thousandths of a degree above absolute zero. Magnons and qubits will meet in here.')),
    P('cabinet', 31, 9, { name: 'Sample cabinet', opt: { tone: 'teal', label: 'FILMS', sparkle: true }, use: { cabinet: 'cab3' } }),
    P('server', 31, 15, { opt: { seed: 1 }, ...read('Server', 'Archive of every spectrum ever measured on this floor.') }),
    P('server', 32, 15, { opt: { seed: 3 }, ...read('Server', 'It is warm. Mochi likes to sleep on it.') }),
    P('desk', 22, 13, read('Desk', 'A notebook full of Kittel fits.')),
    P('chair', 23, 12, { opt: { tone: 'teal' } }),
    P('plant', 1, 3, { opt: { pot: 'teal' }, ...read('Plant', 'Grown under the BLS laser’s spare light. Probably fine.') }),
    P('plant', 12, 19, { opt: { kind: 'tall', pot: 'navy' }, ...read('Plant', 'A snake plant in a cryo-proof pot.') }),
    P('poster', 9, 1, { opt: { kind: 'kittel' }, ...read('Poster', 'The Kittel formula: f = γ√(B(B + μ₀M_eff)) for a film magnetised in its plane.') }),
    P('poster', 11, 1, { opt: { kind: 'm2' }, ...read('Poster', 'M² Lab: microwaves and magnons.') }),
    P('whiteboard', 3, 9, read('Whiteboard', 'Shopping list: helium, coffee, more coffee, a 532 nm laser line filter.')),
    P('desk', 2, 5, read('Desk', 'Somebody’s thesis draft. Chapter 3 is called “Why is my linewidth so broad?”')),
    P('chair', 2, 6, { opt: { tone: 'teal' } }),
    P('desk', 5, 5, read('Desk', 'A cup of cold coffee next to a hot amplifier.')),
    P('chair', 6, 6, { opt: { tone: 'teal' } }),
    P('bookshelf', 1, 12, read('Bookshelf', 'Gurevich and Melkov, Stancil and Prabhakar, Kittel, and a well-thumbed copy of Jackson.')),
    P('sofa', 2, 16, { opt: { tone: 'navy' }, ...read('Sofa', 'Where the BLS spectra get discussed, with snacks.') }),
    P('table', 2, 18, read('Table', 'Snacks for the night shift.')),
    P('coffee', 1, 14, read('Coffee machine', 'The most important instrument on this floor.')),
    P('lamp', 5, 16),
    P('plant', 9, 19, { opt: { pot: 'teal' }, ...read('Plant', 'It grows towards the holo-board.') }),
  ],
  npcs: [
    { id: 'fennec', name: 'Dr. Fennec', x: 20, y: 9, dir: 'down', wander: [18, 9, 23, 10], speed: 2.0, tall: 14 },
  ],
};

export function buildWorld() {
  const floors = {};
  for (const [k, def] of Object.entries({ 1: floor1, 2: floor2, 3: floor3 })) floors[k] = { ...FLOORS[k], ...def };
  return { floors };
}

// where the stairs land you
export const STAIRS = {
  // floor: { U: [toFloor, x, y], Z: [toFloor, x, y] }
  1: { U: [2, 9, 3] },
  2: { Z: [1, 9, 3], U: [3, 6, 3] },
  3: { Z: [2, 6, 3] },
};

export const START = { floor: 1, x: 6, y: 19, dir: 'up' };
