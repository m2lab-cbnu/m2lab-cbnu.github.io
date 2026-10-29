// Reasons to come back: a puzzle of the day with a streak, and the seasons (Halloween,
// Christmas, Seollal and Chuseok) dressing up the building.

import { state, rig } from './state.js';

// ---------------------------------------------------------------- puzzle of the day
// [question, choices, index of the right one, why]
export const PUZZLES = [
  ['A pendulum’s swing takes 2 s. Make its string four times longer. Each swing now takes…', ['2 s', '4 s', '8 s'], 1, 'The period grows with the square root of the length: √4 = 2, so 2 s becomes 4 s.'],
  ['With no air at all, you drop a heavy ball and a light ball of the same size together. Which lands first?', ['the heavy one', 'the light one', 'they land together'], 2, 'Gravity gives every object the same acceleration. Only air makes the light one lag.'],
  ['One ball rolls off a table sideways while another is dropped from the same height at the same moment. Which reaches the floor first?', ['the one rolling off', 'the dropped one', 'both at once'], 2, 'Sideways speed does not change how fast you fall: both fall the same height in the same time.'],
  ['On the Moon, where gravity is six times weaker, a 1 m pendulum swings…', ['more slowly', 'faster', 'just the same'], 0, 'T = 2π√(L/g): six times weaker gravity makes each swing about 2.4 times longer.'],
  ['Two gliders collide and stick together. What is kept exactly?', ['their kinetic energy', 'their total momentum', 'both'], 1, 'Momentum is always kept. Some kinetic energy turns into heat and sound when they stick.'],
  ['A mass on a spring bobs once a second. Double the mass and each bob takes…', ['under a second', 'about 1.4 s', 'exactly 2 s'], 1, 'The period grows with the square root of the mass: √2 ≈ 1.4.'],
  ['Push a swing in time with its own rhythm, a little each time. The swing…', ['barely moves', 'grows bigger and bigger', 'slowly stops'], 1, 'That is resonance: small pushes at the natural frequency add up.'],
  ['A magnifying glass makes a sharp picture of a bright window on the wall. The picture is…', ['upright', 'upside down', 'blurry, always'], 1, 'A lens forms a real image like this one upside down. Your eye’s lens does the same; your brain turns it round.'],
  ['Tighten a guitar string. Its note goes…', ['up', 'down', 'nowhere'], 0, 'Waves run faster along a tighter string, so it vibrates faster: a higher note.'],
  ['A string vibrates in its second harmonic. How many still points are there between the two ends?', ['none', 'one', 'two'], 1, 'Two loops meet at one node in the middle.'],
  ['A strong magnet falls very slowly through a copper pipe because…', ['copper is magnetic', 'currents in the copper push back on it', 'air is trapped below it'], 1, 'The moving magnet drives eddy currents in the copper, and their field brakes the fall.'],
  ['Let go of a slinky hanging from your hand. While the top falls, the bottom…', ['falls even faster', 'hangs still for a moment', 'jumps upwards'], 1, 'The bottom only learns it has been let go when the collapse reaches it.'],
  ['Light through two narrow slits makes stripes. Move the slits closer together and the stripes…', ['get closer', 'spread further apart', 'disappear'], 1, 'Fringe spacing is λL/d: a smaller slit gap d spreads the fringes out.'],
  ['Two pendulums joined by a soft spring. Start only one swinging. A while later…', ['the other swings and the first stands still', 'both swing the same forever', 'the other never moves'], 0, 'The energy slowly moves across and back: the pendulums beat, like two close notes.'],
  ['A spinning top-like gyroscope rests on one end of its axle. It…', ['falls over at once', 'turns slowly round the stand', 'floats up'], 1, 'Gravity’s twist makes the spinning wheel turn sideways: it precesses instead of falling.'],
  ['On a vibrating Chladni plate, the sand collects where the plate…', ['moves the most', 'does not move at all', 'is hottest'], 1, 'Sand bounces off the moving parts and settles on the nodal lines, which stay still.'],
  ['Put a compass next to a wire and switch on a current. The needle…', ['turns', 'stays put', 'heats up'], 0, 'A current makes a magnetic field around the wire. Ørsted found this in 1820.'],
  ['A spin in a magnetic field is nudged a little off line. It…', ['flips straight away', 'circles round the field', 'stops spinning'], 1, 'It precesses about the field, like a tilted spinning top.'],
  ['Make the magnetic field twice as strong. A spin precesses…', ['twice as fast', 'half as fast', 'just as fast'], 0, 'The precession frequency is f = γB: proportional to the field.'],
  ['A spin wave is…', ['electrons flowing along a wire', 'a ripple in the direction the spins point', 'a sound wave inside a magnet'], 1, 'Neighboring spins precess slightly out of step, and the pattern travels: a spin wave. Its quanta are magnons.'],
  ['Magnons carry information without moving any…', ['electric charge', 'energy', 'thing at all'], 0, 'No charge flows, so no current heats the wire. That is why magnonics is interesting for computing.'],
  ['Heat a magnet above its Curie temperature. It…', ['gets stronger', 'stops being a magnet', 'becomes a superconductor'], 1, 'The heat jiggles the spins out of line, and the magnetization disappears.'],
  ['On a hard disk, one bit is stored as…', ['a tiny hole', 'a tiny region magnetized one way or the other', 'a speck of charge'], 1, 'Bits are tiny magnetic domains; the read head senses which way they point.'],
  ['Waves reflected from two neighboring planes of a crystal add up when their paths differ by…', ['half a wavelength', 'a whole number of wavelengths', 'exactly nothing'], 1, 'That is Bragg’s law: 2d sinθ = nλ.'],
  ['Hammer a steel rod while it points along Earth’s field. It becomes a weak magnet because…', ['the hammer is magnetic', 'the shaking frees its domains to follow the field', 'friction charges it'], 1, 'Each blow unpins the domain walls for an instant, and they settle along the field.'],
  ['Which is faster in air, light or sound?', ['sound', 'light, by far', 'they are equal'], 1, 'Light: 300,000 km per second. Sound: about 0.34 km per second. That is why you see lightning first.'],
  ['A magnon and a microwave are tuned to the same frequency in a box. Their two peaks…', ['cross as if nothing happened', 'push apart and leave a gap', 'cancel each other'], 1, 'Coupled waves mix and repel: an avoided crossing, the sign of strong coupling.'],
  ['Earth’s magnetic field here in Korea points north and…', ['up into the sky', 'down into the ground', 'nowhere: it is flat'], 1, 'It dips about 53° into the ground. Only at the equator is it close to flat.'],
  ['Polarized light meets a second polarizer turned by 90°. How much gets through?', ['all of it', 'half', 'none'], 2, 'Crossed polarizers block it all (Malus’s law: cos²90° = 0).'],
  ['Your weight on the Moon, compared with on Earth, is…', ['the same', 'about one sixth', 'six times more'], 1, 'Your mass is the same, but the Moon pulls about six times more weakly.'],
];

const pad = (n) => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNo = (s) => Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5);

// the same puzzle for everyone on a given day, cycling through the list in a shuffled order
const ORDER = PUZZLES.map((_, i) => i).sort((a, b) => ((a * 7919) % 31) - ((b * 7919) % 31));
export function puzzleOfDay(d = today()) { return ORDER[((dayNo(d) % ORDER.length) + ORDER.length) % ORDER.length]; }

// days on which the visitor answered, as 'YYYY-MM-DD'
export function answered() { const S = state.get(); return Array.isArray(S.days) ? S.days : (S.days = []); }
export function streak() {
  const days = new Set(answered().map((x) => (typeof x === 'string' ? x : x.d)));
  let n = 0, k = dayNo(today());
  if (!days.has(today())) k -= 1;   // not answered yet today: yesterday's streak still counts
  for (;;) {
    const d = new Date(k * 864e5), s = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    if (!days.has(s)) break;
    n++; k--;
  }
  return n;
}
export function todayAnswer() { return answered().find((x) => x && x.d === today()) || null; }
export function recordAnswer(choice, ok) {
  const list = answered();
  if (!list.find((x) => x && x.d === today())) list.push({ d: today(), q: puzzleOfDay(), c: choice, ok });
  while (list.length > 400) list.shift();
  state.save(true);
}

// ---------------------------------------------------------------- the seasons
// Seollal (Lunar New Year) and Chuseok follow the moon: their days for the next few years
const SEOLLAL = ['2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23'];
const CHUSEOK = ['2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12', '2031-10-01'];
export function season(d = new Date()) {
  const s = today(d), md = s.slice(5), n = dayNo(s);
  const near = (list, before, after) => list.some((x) => n >= dayNo(x) - before && n <= dayNo(x) + after);
  if (near(SEOLLAL, 3, 3)) return 'seollal';
  if (near(CHUSEOK, 3, 3)) return 'chuseok';
  if (md >= '10-24' && md <= '11-01') return 'halloween';
  if (md >= '12-18' && md <= '12-26') return 'xmas';
  return null;
}
export const SEASON_HELLO = {
  halloween: 'Happy Halloween! Somebody left pumpkins all over the building.',
  xmas: 'Merry Christmas! There is a tree in the lobby, and it is magnetic. Probably.',
  seollal: '새해 복 많이 받으세요! Happy Lunar New Year (Seollal)!',
  chuseok: 'Happy Chuseok (추석)! The harvest moon is full tonight.',
};

export { rig };
