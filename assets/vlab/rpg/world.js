// What stands where in the building, who works on which floor, and what happens when you use it.
//   use.bench    opens an experiment (assets/vlab/bench)
//   use.station  opens one of the magnonics instruments (assets/vlab/stations)
//   use.cabinet  opens a cabinet of samples and equipment
//   use.read     a few lines of text
//   use.guide    the building directory      use.go  a link (the holo room)

import { FLOORS } from './maps.js';
import { season } from './daily.js';

const P = (type, x, y, extra = {}) => ({ type, x, y, ...extra });

const read = (name, ...lines) => ({ name, use: { read: lines } });

const floor1 = {
  props: [
    // lobby
    P('rug', 1, 5, { opt: { w: 4, h: 4, tone: 'teal' } }),
    P('doormat', 6, 20),
    P('directory', 5, 3, { dx: -8, name: 'Building directory', use: { guide: true } }),
    P('daily', 8, 6, { name: 'Puzzle of the day (오늘의 문제)', use: { daily: true } }),
    P('plant', 1, 3, read('Monstera', 'A happy monstera. Somebody waters it every Monday.')),
    P('plant', 8, 3, { opt: { kind: 'tall', pot: 'teal' }, ...read('Snake plant', 'It survives anything, even a cryostat warming up.') }),
    P('sofa', 1, 6, { opt: { tone: 'teal' }, ...read('Sofa', 'Soft. Injeolmi the cat thinks it belongs to her.') }),
    P('table', 1, 8, read('Coffee table', 'Three mugs. One says “I ♥ magnons”.')),
    P('armchair', 4, 6, { opt: { tone: 'gold' }, ...read('Armchair', 'The comfiest seat in the lobby.') }),
    P('vending', 1, 11, { opt: { tone: 'rose' }, ...read('Drinks machine', 'Fizzy water, iced tea, and something called “Spin Wave Soda”.') }),
    P('coffee', 1, 12, read('Coffee machine', 'It hums in B-flat. Nobody knows why.')),
    P('cooler', 1, 13, read('Water cooler', 'Stay hydrated, scientist.')),
    P('kcounter', 5, 14, { counter: true, name: 'Front desk', ...read('Front desk', 'The front desk. 어서오세요 means “please come in”. Baro keeps it very tidy.') }),
    P('screen', 5, 12, read('Folding screen', 'A folding screen painted with the sun, the moon and five peaks (일월오봉도). Joseon kings sat in front of one. Baro thinks it suits him.')),
    P('chorong', 5, 20, read('Lantern', 'A cheongsachorong (청사초롱): blue silk above, red below. Lanterns like this once lit the way to weddings.')),
    P('chorong', 8, 20, read('Lantern', 'Its twin stands on the other side of the door, so every visitor walks in between two lights.')),
    P('vase', 10, 6, read('Celadon vase', 'Goryeo celadon (청자): a jade-green glaze with white cranes inlaid into the clay. The real ones are about 800 years old. This one came from the museum shop.')),
    P('bonsai', 10, 10, read('Pine bonsai', 'A little pine (소나무). Pines stay green all winter, so in Korea they stand for keeping faith.')),
    P('plant', 1, 19, { opt: { pot: 'gold' }, ...read('Plant', 'A rubber plant, leaning toward the windows.') }),
    P('plant', 10, 19, { opt: { kind: 'tall', pot: 'rose' }, ...read('Plant', 'This one is plastic. Do not tell the others.') }),
    P('boxes', 10, 15, read('Boxes', 'Deliveries for the 3rd floor: “FRAGILE: liquid helium inside, sort of”.')),
    // hall
    P('ksign', 12, 3, { opt: { ko: '고전 물리관', en: 'CLASSICS', tone: 'gold' }, ...read('Classics Hall', 'The textbook experiments, done properly. Change the sample, swap the equipment, measure again.') }),
    P('blackboard', 27, 1, { name: 'Blackboard', ...read('Blackboard', 'Prof. Bueong’s blackboard: T = 2π√(L/g), and a resonance curve drawn with great care.') }),
    P('poster', 16, 1, { opt: { kind: 'fma' }, ...read('Poster', 'F = ma. The most famous three letters in physics.') }),
    P('poster', 20, 1, { opt: { kind: 'wave' }, ...read('Poster', 'Waves: the same mathematics for strings, sound, light and spins.') }),
    P('poster', 25, 1, { opt: { kind: 'lens' }, ...read('Poster', 'Rays through a lens: one through the center, one parallel, one through the focus.') }),
    P('clock', 11, 1, { dy: 6, ...read('Clock', 'It is always time for one more measurement.') }),
    P('scroll', 23, 1, read('Calligraphy', '격물치지 (gyeongmul chiji): study things down to their roots, and you will understand them. Prof. Bueong calls it the oldest job description for a physicist.')),
    P('lectern', 29, 4, read('Lectern', 'Prof. Bueong’s notes. The handwriting is very small and very neat.')),
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
    { id: 'bolt', name: 'Baro', x: 6, y: 13, dir: 'down', tall: 16 },
    { id: 'hoo', name: 'Prof. Bueong', x: 28, y: 4, dir: 'down', tall: 12 },
    { id: 'mochi', name: 'Injeolmi', x: 4, y: 9, dir: 'down', wander: [1, 4, 10, 18], speed: 2.4, tall: 6 },
  ],
};

const floor2 = {
  props: [
    P('ksign', 11, 8, { opt: { ko: '물리 놀이터', en: 'PLAYGROUND', tone: 'lav' }, ...read('Physics Playground', 'Experiments that look like magic tricks. They are not.') }),
    P('snackbar', 1, 4, read('Snack bar', 'Fruit, cookies, and a jar labeled “for postdocs only”.')),
    P('cstore', 4, 4, read('Convenience store', '편의점! Banana milk in its famous round jug, and cup ramyeon for late-night measurements.', 'A sign says: “Pour the hot water, wait three minutes. Use the time to time a pendulum.”')),
    P('cheer', 11, 1, read('Poster', '화이팅! (hwaiting): what Koreans shout to cheer each other on. Kongi made it for exam week.')),
    P('noraebang', 12, 16, { name: 'Karaoke room (노래방)', use: { karaoke: true } }),
    P('claw', 17, 17, { name: 'Claw machine (인형뽑기)', use: { claw: true } }),
    P('arcade', 1, 8, read('Arcade', '“MAGNON RUN: high score 99,999, by P. P.”')),
    P('vending', 1, 9, { opt: { tone: 'mint' }, ...read('Drinks machine', 'Out of everything except lemonade.') }),
    P('sofa', 5, 7, { opt: { tone: 'lav' }, ...read('Sofa', 'Squishy. A good place to think about slinkies.') }),
    P('beanbag', 2, 14, { opt: { tone: 'rose' }, name: 'Beanbag', use: { beanbag: 1 } }),
    P('beanbag', 5, 16, { opt: { tone: 'gold' }, name: 'Beanbag', use: { beanbag: 2 } }),
    P('beanbag', 7, 13, { opt: { tone: 'teal' }, name: 'Beanbag', use: { beanbag: 3 } }),
    P('plant', 10, 3, { opt: { pot: 'lav' }, ...read('Plant', 'A cheerful pothos, climbing toward the stairs.') }),
    P('plant', 1, 19, { opt: { kind: 'tall', pot: 'mint' }, ...read('Plant', 'Tall and calm.') }),
    P('poster', 13, 1, { opt: { kind: 'magnet' }, ...read('Poster', 'A magnet and its field lines. Moving magnets push currents around.') }),
    P('poster', 22, 1, { opt: { kind: 'cat' }, ...read('Poster', '“Have you seen this cat?” It is Injeolmi. She is fine.') }),
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
    P('whiteboard', 28, 14, { opt: { text: 'F=-KX' }, ...read('Whiteboard', 'Kongi’s plan: “1. drop magnet 2. be amazed 3. repeat”.') }),
  ],
  npcs: [
    { id: 'pip', name: 'Kongi', x: 9, y: 11, dir: 'down', wander: [8, 10, 11, 12], speed: 2.2, tall: 12 },
  ],
};

const floor3 = {
  props: [
    // ---------- the lounge, where the stairs and the elevator arrive
    P('ksign', 9, 3, { opt: { ko: '마그논 연구실', en: 'MAGNONICS', tone: 'teal' }, ...read('Magnonics Lab', 'Spin waves, the ripples in a magnet. This is what M² Lab works on. The gallery downstairs from here shows how they work; the rooms around it are where we measure them.') }),
    P('bookshelf', 10, 5, read('Bookshelf', 'Gurevich and Melkov, Stancil and Prabhakar, Kittel, and a well-thumbed copy of Jackson.')),
    P('desk', 1, 5, read('Desk', 'Somebody’s thesis draft. Chapter 3 is called “Why is my linewidth so broad?”')),
    P('chair', 2, 6, { opt: { tone: 'teal' } }),
    P('whiteboard', 4, 5, { opt: { text: 'TO BUY' }, ...read('Whiteboard', 'Shopping list: helium, coffee, more coffee, a 532 nm laser line filter.') }),
    P('coffee', 11, 7, read('Coffee machine', 'The most important instrument on this floor.')),
    P('cooler', 11, 8, read('Water cooler', 'Cold water for warm discussions.')),
    P('rug', 2, 8, { opt: { w: 6, h: 3, tone: 'navy' } }),
    P('sofa', 2, 10, { opt: { tone: 'navy' }, ...read('Sofa', 'Where the BLS spectra get discussed, with snacks.') }),
    P('lowtable', 3, 8, read('Tea table', 'Barley tea in a celadon pot, and a plate of injeolmi: rice cakes rolled in roasted soybean powder. The cat downstairs is named after them.')),
    P('cushion', 2, 8, { opt: { tone: 'rose' } }),
    P('cushion', 5, 8, { opt: { tone: 'gold' } }),
    P('armchair', 7, 9, { opt: { tone: 'teal' }, ...read('Armchair', 'Dr. Yeo’s favorite thinking chair.') }),
    P('lamp', 8, 11),
    P('plant', 1, 3, { opt: { pot: 'teal' }, ...read('Plant', 'Grown under the BLS laser’s spare light. Probably fine.') }),
    P('plant', 1, 12, { opt: { kind: 'tall', pot: 'navy' }, ...read('Plant', 'A snake plant in a cryo-proof pot.') }),
    // ---------- the resonance lab: FMR, BLS and the holo-board
    P('ksign', 13, 3, { opt: { ko: '공명 실험실', en: 'RESONANCE', tone: 'navy' }, ...read('Resonance lab', 'Our two big measurements: microwaves make the spins precess (FMR), and laser light reads the spin waves back out (BLS).') }),
    P('poster', 22, 1, { opt: { kind: 'kittel' }, ...read('Poster', 'The Kittel formula: f = γ√(B(B + μ₀M_eff)) for a film magnetized in its plane.') }),
    P('poster', 23, 1, { opt: { kind: 'm2' }, ...read('Poster', 'M² Lab: microwaves and magnons.') }),
    P('holoboard', 25, 1, { name: 'Holo-board: dispersion', use: { station: 'dispersion' } }),
    P('magnet', 14, 5, { name: 'FMR magnet', use: { station: 'fmr' } }),
    P('rack', 17, 5, { name: 'FMR instruments', use: { station: 'fmr' } }),
    P('optable', 20, 5, { name: 'BLS table', use: { station: 'bls' } }),
    P('desk', 26, 8, read('Desk', 'A notebook full of Kittel fits, and a mug that says “I ♥ magnons”.')),
    P('chair', 27, 9, { opt: { tone: 'teal' } }),
    P('plant', 30, 3, { opt: { pot: 'navy' }, ...read('Plant', 'It grows toward the holo-board.') }),
    P('plant', 13, 12, { opt: { kind: 'tall', pot: 'teal' }, ...read('Plant', 'Tall, calm and slightly magnetic. Probably.') }),
    // ---------- the cold room: the fridge, the samples and the computers
    P('holodoor', 38, 1, { name: 'Holo room: our lab in 3D', use: { go: 'lab3d.html' } }),
    P('cabinet', 32, 3, { name: 'Sample cabinet', opt: { tone: 'teal', label: 'FILMS', sparkle: true }, use: { cabinet: 'cab3' } }),
    P('fridge', 44, 4, read('Dilution refrigerator', 'It cools to ten thousandths of a degree above absolute zero. Magnons and qubits will meet in here.')),
    P('simdesk', 33, 8, { name: 'Simulation desk', use: { station: 'micromag' } }),
    P('gpurack', 37, 7, { name: 'GPU cluster', use: { station: 'micromag' }, opt: { seed: 2 } }),
    P('server', 44, 9, { opt: { seed: 1 }, ...read('Server', 'Archive of every spectrum ever measured on this floor.') }),
    P('server', 45, 9, { opt: { seed: 3 }, ...read('Server', 'It is warm. Injeolmi likes to sleep on it.') }),
    P('server', 46, 9, { opt: { seed: 5 }, ...read('Server', 'A quiet hum and a lot of blinking.') }),
    P('plant', 46, 12, { opt: { pot: 'teal' }, ...read('Plant', 'It likes the cold room. It is the only one.') }),
    // ---------- the spin gallery
    P('ksign', 2, 14, { opt: { ko: '스핀 전시관', en: 'GALLERY', tone: 'teal' }, ...read('Spin gallery', 'Every exhibit here shows one idea behind our research, from a single spin to spin waves doing logic. Have a go at each one!') }),
    P('spintop', 4, 15, { name: 'Spin precession', use: { bench: 'precess' } }),
    P('wavechain', 8, 15, { name: 'Spin-wave machine', use: { bench: 'chain' } }),
    P('kerr', 17, 15, { name: 'Kerr microscope: domains', use: { bench: 'domains' } }),
    P('cavity', 25, 15, { name: 'Magnons meet photons', use: { bench: 'cavity' } }),
    P('logicbench', 30, 15, { name: 'Spin-wave logic', use: { bench: 'logic' } }),
    P('compasses', 36, 15, read('Compass table', 'Every little compass turns to follow the toy magnet. Its field is invisible, but the compasses can see it.')),
    P('globe', 43, 15, read('Globe', 'The Earth is a magnet too. Here in Korea its field points north and dips down into the ground at about 50°. The steel rod in the project room feels it.')),
    P('bench', 5, 21, { opt: { tone: 'teal' }, ...read('Bench', 'A good place to watch the spin top go round.') }),
    P('bench', 19, 21, { opt: { tone: 'navy' }, ...read('Bench', 'Somebody left a note: “Magnons are just very organized wobbles.”') }),
    P('bench', 33, 21, { opt: { tone: 'teal' }, ...read('Bench', 'Comfy enough for a long think about phase.') }),
    P('plant', 12, 20, { opt: { kind: 'tall', pot: 'teal' }, ...read('Plant', 'It leans toward the spin top.') }),
    P('plant', 27, 20, { opt: { pot: 'lav' }, ...read('Plant', 'A happy pothos.') }),
    P('plant', 46, 22, { opt: { pot: 'navy' }, ...read('Plant', 'Planted by the first students in the lab.') }),
    P('plant', 1, 22, { opt: { kind: 'tall', pot: 'teal' }, ...read('Plant', 'Tall and patient.') }),
    // ---------- our papers
    P('frame', 2, 25, { opt: { kind: 'nc2024', year: 2024 }, name: 'Paper: Nature Communications 2024', use: { paper: 'nc2024' } }),
    P('frame', 6, 25, { opt: { kind: 'pra2023', year: 2023 }, name: 'Paper: Physical Review Applied 2023', use: { paper: 'pra2023' } }),
    P('frame', 10, 25, { opt: { kind: 'prx2022', year: 2022 }, name: 'Paper: Physical Review X 2022', use: { paper: 'prx2022' } }),
    P('frame', 18, 25, { opt: { kind: 'prb2020', year: 2020 }, name: 'Paper: Physical Review B 2020', use: { paper: 'prb2020' } }),
    P('frame', 22, 25, { opt: { kind: 'pra2019', year: 2019 }, name: 'Paper: Physical Review Applied 2019', use: { paper: 'pra2019' } }),
    P('frame', 26, 25, { opt: { kind: 'prl2016', year: 2016 }, name: 'Paper: Physical Review Letters 2016', use: { paper: 'prl2016' } }),
    P('jikji', 28, 25, read('Jikji (직지)', 'A page of Jikji, printed in 1377 at Heungdeok temple in Cheongju, the city of our university.', 'It is the oldest surviving book printed with movable metal type. Words, cast in metal, rearranged for every page: a little like our papers.')),
    P('lectern', 16, 28, read('Our papers', 'Six papers from our group, newest on the left. Walk up to a frame to read what we found, in plain words.')),
    P('bench', 4, 30, { opt: { tone: 'gold' }, ...read('Bench', 'For reading papers slowly.') }),
    P('bench', 21, 30, { opt: { tone: 'gold' }, ...read('Bench', 'Somebody has scribbled “read the supplementary!” on the armrest.') }),
    P('plant', 1, 32, { opt: { kind: 'tall', pot: 'gold' }, ...read('Plant', 'It has read every paper here. Twice.') }),
    P('plant', 30, 32, { opt: { pot: 'gold' }, ...read('Plant', 'A fern with opinions about figure captions.') }),
    // ---------- the students' projects
    P('photo', 33, 25, { opt: { kind: 'poster' }, name: 'Photo: the KPS poster', use: { photo: 'poster' } }),
    P('photo', 42, 25, { opt: { kind: 'setup' }, name: 'Photo: the microwave crystal', use: { photo: 'setup' } }),
    P('photo', 44, 25, { opt: { kind: 'team' }, name: 'Photo: the KPS team', use: { photo: 'team' } }),
    P('braggtable', 33, 28, { name: 'Microwave crystal: Bragg diffraction', use: { bench: 'bragg' } }),
    P('rodstand', 41, 28, { name: 'Hammer a steel rod', use: { bench: 'rod' } }),
    P('desk', 43, 31, read('Desk', 'A portable network analyzer, a box of steel balls and a very worn hammer.')),
    P('ksign', 36, 31, { opt: { ko: '학생 프로젝트', en: 'PROJECTS', tone: 'gold' }, ...read('Student projects', 'Two projects by our undergraduates, shown at the Korean Physical Society Fall Meeting in 2026.') }),
    P('plant', 46, 27, { opt: { pot: 'gold' }, ...read('Plant', 'It survived the hammering. Mostly.') }),
  ],
  npcs: [
    { id: 'fennec', name: 'Dr. Yeo', x: 22, y: 9, dir: 'down', wander: [15, 8, 25, 11], speed: 2.0, tall: 14 },
    { id: 'nova', name: 'Nuri', x: 20, y: 18, dir: 'down', wander: [2, 17, 45, 19], speed: 2.4, tall: 14 },
  ],
};

// decorations for the time of year (see daily.js)
const pumpkin = (x, y) => P('pumpkin', x, y, read('Pumpkin', 'A jack-o’-lantern with a candle inside. Somebody carved a little magnon into the back.'));
const SEASONAL = {
  halloween: {
    1: [P('banner', 1, 16, { opt: { lines: ['해피 핼러윈!'], en: 'HAPPY HALLOWEEN', tone: 'orange' }, ...read('Banner', 'Happy Halloween! The pumpkins appeared overnight. Nobody admits to anything.') }), pumpkin(9, 17), pumpkin(4, 19)],
    2: [pumpkin(16, 19), pumpkin(24, 18)],
    3: [pumpkin(10, 11), pumpkin(13, 19)],
  },
  xmas: {
    1: [P('banner', 1, 16, { opt: { lines: ['메리 크리스마스'], en: 'MERRY CHRISTMAS', tone: 'red' }, ...read('Banner', 'Merry Christmas from everyone at M² Lab!') }), P('xtree', 9, 8, read('Christmas tree', 'Its lights blink in a pattern. Dr. Yeo swears it is a spin wave.'))],
  },
  seollal: {
    1: [P('banner', 1, 16, { opt: { lines: ['새해 복 많이', '받으세요'], tone: 'red' }, ...read('Banner', '새해 복 많이 받으세요: “receive lots of luck in the new year”, the greeting for Seollal, the Lunar New Year.') })],
  },
  chuseok: {
    1: [P('banner', 1, 16, { opt: { lines: ['풍성한 한가위'], en: 'HAPPY CHUSEOK', tone: 'navy' }, ...read('Banner', '풍성한 한가위: “a rich and plentiful Chuseok”, the greeting for the harvest festival under the full moon.') })],
  },
};

export function buildWorld() {
  const floors = {}, now = season();
  for (const [k, def] of Object.entries({ 1: floor1, 2: floor2, 3: floor3 })) {
    const extra = (now && SEASONAL[now] && SEASONAL[now][k]) || [];
    floors[k] = { ...FLOORS[k], ...def, props: [...def.props, ...extra] };
  }
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
