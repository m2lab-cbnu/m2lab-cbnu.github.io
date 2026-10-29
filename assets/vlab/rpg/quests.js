// What the people in the building say, the little jobs they give you, and the stamps you earn.
// Answers are checked against the same physics the experiments run, or against the hidden
// values of the mystery samples (kept in your browser, different for every visitor).

import { rig, state } from './state.js';
import { ITEMS } from './items.js';
import { PAL, Pix, outline, tinyText } from './pix.js';
import { itemIcon } from './items.js';
import { tr, trf } from '../i18n.js';

const C = PAL;
const WHO = {
  bolt: { id: 'bolt', name: 'Baro' },
  hoo: { id: 'hoo', name: 'Prof. Bueong' },
  pip: { id: 'pip', name: 'Kongi' },
  mochi: { id: 'mochi', name: 'Injeolmi' },
  fennec: { id: 'fennec', name: 'Dr. Yeo' },
  nova: { id: 'nova', name: 'Nuri' },
};

export const STAMPS = [
  { id: 'hello', floor: 1, name: 'Welcome', how: 'Say hello to Baro at the front desk.', item: 'passport', color: C.cyan },
  { id: 'swing', floor: 1, name: 'Ten swings', how: 'Time a 1 m pendulum for Prof. Bueong.', item: 'stopwatch', color: C.gold },
  { id: 'planetx', floor: 1, name: 'Planet X', how: 'Measure g on Planet X.', item: 'g-x', color: C.violet },
  { id: 'bullseye', floor: 1, name: 'Bullseye', how: 'Hit the target with the launcher.', item: 'ball-tennis', color: C.red },
  { id: 'feather', floor: 1, name: 'Featherweight', how: 'Hit the target with the ping-pong ball or the shuttlecock.', item: 'shuttle', color: C.pink },
  { id: 'block', floor: 1, name: 'No scales', how: 'Find the mass of the mystery block with a spring.', item: 'm-mystery', color: C.brass },
  { id: 'halfke', floor: 1, name: 'Half lost', how: 'Make a collision lose half of its kinetic energy.', item: 'bump-velcro', color: C.orange },
  { id: 'lens', floor: 1, name: 'Sharp eyes', how: 'Find the focal length of the mystery lens.', item: 'lens-x', color: C.sky },
  { id: 'string', floor: 1, name: 'Heavy string', how: 'Find the mass per metre of the mystery string.', item: 'str-x', color: C.lav },
  { id: 'null', floor: 1, name: 'Nowhere to go', how: 'Find the point where the electric field vanishes.', item: 'probe', color: C.green },
  { id: 'slowfall', floor: 2, name: 'Slow fall', how: 'Make a magnet take over a minute to fall through the 1 m pipe.', item: 'magnet-n42', color: C.copper },
  { id: 'hover', floor: 2, name: 'Floating slinky', how: 'Tell Kongi how long the bottom of the slinky hovers.', item: 'slinky-metal', color: C.steel },
  { id: 'eraser', floor: 2, name: 'Eraser', how: 'Hide the fringes with polarisers, then bring them back.', item: 'polarizers', color: C.red },
  { id: 'beats', floor: 2, name: 'Swap time', how: 'Find how long the energy takes to move to the other pendulum.', item: 'spring-soft', color: C.green },
  { id: 'precess', floor: 2, name: 'Wobble', how: 'Time the precession of the gyroscope.', item: 'gyrowheel', color: C.gold },
  { id: 'chladni', floor: 2, name: 'Sand artist', how: 'Draw a Chladni pattern with at least six nodal lines.', item: 'plate-square', color: C.brass },
  { id: 'daily1', floor: 1, name: 'Puzzler', how: 'Answer the puzzle of the day on the board in the lobby.', item: null, color: C.green },
  { id: 'streak3', floor: 1, name: 'Three days running', how: 'Answer the puzzle of the day three days in a row.', item: null, color: C.gold },
  { id: 'streak7', floor: 1, name: 'A whole week', how: 'Answer the puzzle of the day seven days in a row.', item: null, color: C.violet },
  { id: 'karaoke', floor: 2, name: 'Noraebang star', how: 'Sing a song in the karaoke room on 2F.', item: null, color: C.pink },
  { id: 'plush', floor: 2, name: 'Plush collector', how: 'Win all six plush toys from the claw machine on 2F.', item: 'plush-pip', color: C.rose },
  { id: 'film', floor: 3, name: 'Film #7', how: 'Measure the mystery film for Dr. Yeo.', item: 'film-x', color: C.orange },
  { id: 'holo', floor: 3, name: 'Holo room', how: 'Visit our real lab in the holo room.', item: null, color: C.cyan },
  { id: 'flip', floor: 3, name: 'Spin flip', how: 'Flip a spin upside down with microwaves.', item: 'sph-yig', color: C.red },
  { id: 'wave', floor: 3, name: 'Spin wave', how: 'Send a spin wave all the way along the spin-wave machine.', item: null, color: C.violet },
  { id: 'loop', floor: 3, name: 'Full loop', how: 'Draw a whole hysteresis loop under the Kerr microscope.', item: 'dom-garnet', color: C.orange },
  { id: 'logic', floor: 3, name: 'Truth table', how: 'Fill in a whole truth table at the spin-wave logic bench.', item: null, color: C.gold },
  { id: 'meet', floor: 3, name: 'In tune', how: 'Tell Nuri the field where the magnons meet the microwaves.', item: 'cav-copper', color: C.copper },
  { id: 'crystal', floor: 3, name: 'Crystal #9', how: 'Measure the spacing of Crystal #9 for Nuri.', item: 'lat-x', color: C.sky },
  { id: 'rod', floor: 3, name: 'Magnet maker', how: 'Hammer a steel rod until its end reads over 100 µT.', item: 'rod-steel', color: C.steel },
];

const stampCache = new Map();
export function stampIcon(id) {
  if (stampCache.has(id)) return stampCache.get(id);
  const s = STAMPS.find((x) => x.id === id);
  const P = new Pix(34, 34).at(1, 1);
  P.disc(16, 16, 15, s.color); P.ring(16, 16, 13, '#FFFDF6'); P.ring(16, 16, 12, s.color);
  if (s.item) P.draw(itemIcon(s.item), 8, 8);
  else { P.disc(16, 16, 6, '#FFFDF6'); P.disc(16, 16, 3, C.cyan); }
  const c = outline(P.c);
  stampCache.set(id, c);
  return c;
}

// ---------------------------------------------------------------- the jobs
const Q = {
  'hoo-swing': {
    giver: 'hoo', stamp: 'swing', reward: 'photogate', unit: 's',
    offer: ['Here is a classic to warm up. Set the pendulum to **L = 1.00 m**, here on Earth, with a small swing.', 'Time **ten** swings with the stopwatch and tell me the period of one swing.'],
    ask: 'So, what is the period of a 1.00 m pendulum?',
    hint: ['Start the stopwatch as the bob passes the middle, count ten swings there and back, stop on the tenth. Then divide by ten.', 'Ten swings take about twenty seconds, so a small slip of the finger hardly matters.'],
    check: (v) => v > 1.95 && v < 2.08,
    near: (v) => v > 0.9 && v < 1.1 ? ['That looks like half a swing. A period is there **and back**.'] : v > 18 && v < 22 ? ['That looks like the time for all ten swings. Divide by ten!'] : null,
    win: ['Bueong bueong! About two seconds. Your pendulum agrees with Galileo.', 'Here, take my old **photogate**. It times every swing to a ten-thousandth of a second, no reflexes needed.'],
  },
  'hoo-planetx': {
    giver: 'hoo', stamp: 'planetx', give: 'g-x', unit: 'm/s²',
    offer: ['Now something nobody can look up. This card sets the gravity room to **Planet X**.', 'Find its gravitational acceleration g, to within two percent.'],
    ask: 'What is g on Planet X?',
    hint: ['Put the Planet X card in the gravity room slot. Measure the period at a few lengths, keeping the swing small.', 'In the Graphs tab, T² against L is a straight line. Its slope is 4π²/g.'],
    check: (v) => Math.abs(v / rig.secret('planetX') - 1) < 0.02,
    near: (v) => Math.abs(v / rig.secret('planetX') - 1) < 0.08 ? ['Close, but not within two percent. Small swings, several lengths, and the photogate will get you there.'] : null,
    win: ['Correct! You have weighed a planet with a piece of string.'],
  },
  'hoo-block': {
    giver: 'hoo', stamp: 'block', give: 'm-mystery', unit: 'g',
    offer: ['My balance is broken, and I need to know the mass of this **mystery block**.', 'Hang it on a spring and let physics weigh it. Tell me the mass in grams.'],
    ask: 'How heavy is the mystery block?',
    hint: ['Hang the block on a spring whose k you know, find how fast it bobs, and use f = (1/2π)√(k/m).', 'The frequency sweep finds the resonance nicely. And mind the spring’s own mass if you want to be very precise.'],
    check: (v) => Math.abs(v / rig.secret('blockM') - 1) < 0.05,
    near: (v) => Math.abs(v / (rig.secret('blockM') / 1000) - 1) < 0.05 ? ['That is right in kilograms, but I asked for grams.'] : null,
    win: ['Splendid. No scales, just a spring and a clock.'],
  },
  'hoo-lens': {
    giver: 'hoo', stamp: 'lens', give: 'lens-x', unit: 'cm',
    offer: ['This **mystery lens** came without a label. What is its focal length?', 'Within four percent, please, in centimetres.'],
    ask: 'What is the focal length of the mystery lens?',
    hint: ['Make a sharp image on the screen for a few distances, and use 1/f = 1/d_o + 1/d_i.', 'Or use the collimator: light from very far away comes to a focus one focal length behind the lens.'],
    check: (v) => Math.abs(v / rig.secret('lensF') - 1) < 0.04,
    near: (v) => Math.abs(v / (rig.secret('lensF') / 100) - 1) < 0.05 ? ['Right number, wrong unit: I asked in centimetres.'] : null,
    win: ['Exactly. You have a sharp eye, and a sharp image.'],
  },
  'hoo-string': {
    giver: 'hoo', stamp: 'string', give: 'str-x', unit: 'g/m',
    offer: ['Last one from me. This **mystery string**: how many grams does one metre of it weigh?', 'You may not cut it. Use the vibrating string bench.'],
    ask: 'What is its mass per metre?',
    hint: ['Hang a known mass, find the resonances and their frequencies f_n = n v / 2L.', 'The wave speed is v = √(T/μ), with the tension T = Mg from the hanging mass.'],
    check: (v) => Math.abs(v / rig.secret('stringMu') - 1) < 0.06,
    near: (v) => Math.abs(v / (rig.secret('stringMu') / 1000) - 1) < 0.06 ? ['That is in kilograms per metre. I asked for grams per metre.'] : null,
    win: ['Bueong! That is it. You have finished my whole list. 잘했어요 (jal haesseoyo: well done)! I am a very proud owl.'],
  },
  'pip-hover': {
    giver: 'pip', stamp: 'hover', unit: 's',
    offer: ['Hold a slinky up by its top, let go, and the bottom just... **hangs there** for a moment!', 'Use the metal slinky and the high-speed camera. How long does the bottom stay still?'],
    ask: 'How long does the bottom of the metal slinky hover?',
    hint: ['Film it. In the graph, the bottom coil stays flat until the collapse reaches it.', 'Read off the time when the bottom curve starts to drop.'],
    check: (v) => { const t = rig.flag('slinkyHover'); return t ? Math.abs(v / t - 1) < 0.12 : false; },
    near: () => rig.flag('slinkyHover') ? null : ['Drop the metal slinky once with the camera running, then come back to me.'],
    win: ['Yes! The bottom does not know it has been let go until the news arrives. Physics!'],
  },
  'pip-beats': {
    giver: 'pip', stamp: 'beats', unit: 's',
    offer: ['Two pendulums with a spring between them: start one swinging and the energy slowly moves to the other one, and back.', 'With equal pendulums 1.00 m long and the soft spring, how long does it take for **all** the energy to move across?'],
    ask: 'How long until the other pendulum has all the energy?',
    hint: ['Watch the energy graph: count from the start until the first pendulum stands still.', 'That is half of the beat period: t = 1 / (2 × (f₂ − f₁)), with the two mode frequencies in Hz.'],
    check: (v) => { const t = rig.flag('coupledSwap'); return t ? Math.abs(v / t - 1) < 0.08 : false; },
    near: () => rig.flag('coupledSwap') ? null : ['Set it up first: equal 1.00 m pendulums, the soft spring, and start one of them.'],
    win: ['That is right! It is the same physics as a magnon and a photon trading energy upstairs.'],
  },
  'pip-precess': {
    giver: 'pip', stamp: 'precess', unit: 's',
    offer: ['The gyroscope never falls over: it turns around the stand instead. With the brass wheel spinning at **3000 rpm** and no extra weight, how long does one turn around the stand take?'],
    ask: 'How long does one precession turn take?',
    hint: ['Spin the wheel to 3000 rpm, let go, and time one full turn around the stand.', 'Or use Ω = m g r / (I ω), with I = ½ m R² for the wheel: the period is 2π/Ω.'],
    check: (v) => { const t = rig.flag('gyroPeriod'); return t ? Math.abs(v / t - 1) < 0.06 : false; },
    near: () => rig.flag('gyroPeriod') ? null : ['Let the gyroscope go once at 3000 rpm with the brass wheel, then come back.'],
    win: ['Wobble wobble! Exactly. Spin it faster and it turns slower, have you noticed?'],
  },
  'fennec-film': {
    giver: 'fennec', stamp: 'film', give: 'film-x', unit: 'kA/m',
    offer: ['We grew a new film last night, sample **#7**. Nobody has measured it yet.', 'Put it in the FMR magnet and find its saturation magnetisation M_s, within five percent, in kA/m.'],
    ask: 'What is M_s of film #7?',
    hint: ['Choose “Film #7” as the film. In the f–H map, the resonance follows the Kittel formula f = γ√(B(B + μ₀M_s)).', 'Measure the resonance field at two or three frequencies and solve for M_s. The film is thin and has no anisotropy.'],
    check: (v) => Math.abs(v / (rig.secret('film').Ms / 1000) - 1) < 0.05,
    near: (v) => Math.abs(v / (rig.secret('film').Ms) - 1) < 0.05 ? ['Right, but in kA/m please: divide by a thousand.'] : null,
    win: ['Perfect. That goes straight into the lab notebook. Thank you!'],
  },
  'nova-meet': {
    giver: 'nova', stamp: 'meet', unit: 'mT',
    offer: ['Bzzt. In the resonance lab there is a copper box with a garnet sphere inside. The box rings at **9 GHz**; the sphere’s magnons follow the magnet.', 'At what field do the magnons catch up with the box? Tell me in millitesla.'],
    ask: 'At what field do the magnons and the box meet?',
    hint: ['Watch two readouts: the magnons in the sphere and the microwaves in the box. Turn the magnet until they agree.', 'Or work it out: magnons in a sphere go at f = γB, with γ = 28 GHz per tesla.'],
    check: (v) => Math.abs(v - 321.4) < 3,
    near: (v) => Math.abs(v - 0.3214) < 0.004 ? ['That is in tesla. I asked in millitesla.'] : null,
    win: ['Beep beep! 321 mT. There they keep the same pace and trade their energy back and forth.', 'Our lab wants to do that one quantum at a time, with superconducting qubits. You just did the first step.'],
  },
  'nova-bragg': {
    giver: 'nova', stamp: 'crystal', give: 'lat-x', unit: 'cm',
    offer: ['Somebody built this crystal of steel balls and forgot to write down how far apart the balls are. It is **Crystal #9**.', 'Put it on the Bragg table in the paper gallery and find the spacing between neighbouring balls, in centimetres.'],
    ask: 'How far apart are the balls in Crystal #9?',
    hint: ['Choose Crystal #9 and scan. The first peak comes where the extra path 2d sinθ is one wavelength.', 'With the cube face to the beam, d is the spacing itself. The wavelength is shown next to the frequency.'],
    check: (v) => Math.abs(v / rig.secret('latX') - 1) < 0.04,
    near: (v) => {
      const a = rig.secret('latX');
      if (Math.abs(v / (a / 100) - 1) < 0.05) return ['That is in metres. I asked in centimetres.'];
      if (Math.abs(v / (a / Math.SQRT2) - 1) < 0.05) return ['That is the spacing of the diagonal planes. The cube’s side is √2 times bigger.'];
      if (Math.abs(v / (a / 2) - 1) < 0.05) return ['Half of what I expected. Did you take the second peak for the first?'];
      return null;
    },
    win: ['Bzzt! Exactly. That is how crystallographers measure atoms, only with X-rays instead of microwaves.'],
  },
};
export const QUESTS = Q;
const CHAIN = { hoo: ['hoo-swing', 'hoo-planetx', 'hoo-block', 'hoo-lens', 'hoo-string'], pip: ['pip-hover', 'pip-beats', 'pip-precess'], fennec: ['fennec-film'], nova: ['nova-meet', 'nova-bragg'] };

// the quest a person is waiting on, or would offer next
function nextQuest(npc) {
  for (const id of CHAIN[npc] || []) if (rig.quest(id) !== 'done') return id;
  return null;
}

// mark over someone's head: ! has a job for you, ? waiting for your answer
export function npcMark(id) {
  if (id === 'bolt') return rig.stamps().includes('hello') ? null : '!';
  if (id === 'mochi') return null;
  const q = nextQuest(id);
  if (!q) return null;
  const st = rig.quest(q);
  if (st === 'active') return '?';
  return '!';
}

// ---------------------------------------------------------------- conversations
export function makeTalk(ctx) {
  const { dialog, toast, openGuide } = ctx;
  const say = (who, lines) => dialog.say(WHO[who], lines, { keepOpen: true });

  async function giveItem(who, id, quiet) {
    if (!id || rig.has(id)) return;
    rig.give(id, true);
    if (!quiet) toast(trf('You got: {0}', tr(ITEMS[id].name)), id);
  }
  function stamp(id) {
    if (rig.stamp(id)) { const s = STAMPS.find((x) => x.id === id); toast(trf('New stamp: {0}', tr(s.name)), null, id); }
  }

  async function runQuest(npc, qid) {
    const q = Q[qid];
    const st = rig.quest(qid);
    if (st !== 'active') {
      await say(npc, q.offer);
      const yes = await dialog.ask(WHO[npc], 'Will you do it?', ['Sure!', 'Maybe later']);
      if (yes !== 0) { await say(npc, ['No hurry. Come back when you feel like it.']); return; }
      rig.setQuest(qid, 'active');
      if (q.give) await giveItem(npc, q.give);
      await say(npc, ['Wonderful. Come and tell me when you have a number.']);
      return;
    }
    const c = await dialog.ask(WHO[npc], q.ask, ['I have an answer', 'A hint, please', 'Not yet']);
    if (c === 1) { await say(npc, q.hint); return; }
    if (c !== 0) { await say(npc, ['Take your time.']); return; }
    const v = await dialog.askNumber(WHO[npc], q.ask, { unit: q.unit });
    if (v === null) { await say(npc, ['Take your time.']); return; }
    if (q.check(v)) {
      rig.setQuest(qid, 'done');
      await say(npc, q.win);
      if (q.reward) await giveItem(npc, q.reward);
      stamp(q.stamp);
      return;
    }
    const near = q.near && q.near(v);
    await say(npc, near || ['Hmm, that does not match what I expected. Have another look?', ...q.hint.slice(0, 1)]);
  }

  const talk = {
    async bolt() {
      if (!rig.stamps().includes('hello')) {
        await say('bolt', ['Beep! 안녕하세요 (annyeonghaseyo: hello)! Welcome to the **M² Lab building**. I am Baro, the front desk robot. Baro means “right away” in Korean, which is how fast I help.',
          'Three floors: **1F** the classic textbook experiments (고전 물리관), **2F** the Physics Playground (물리 놀이터), **3F** our magnonics lab (마그논 연구실), where the real research happens.',
          'Walk up to anything and press **Space** (or tap it) to use it. Every experiment lets you change the sample, swap the equipment and measure in different ways.',
          'Here is your **lab passport**. People in the building will stamp it when you solve their puzzles.']);
        await giveItem('bolt', 'passport');
        stamp('hello');
        await say('bolt', ['Prof. Bueong is in the hall to the right. The cabinets on each floor hold extra samples and equipment: help yourself. Have fun!']);
        return;
      }
      const c = await dialog.ask(WHO.bolt, 'Beep boop. How can I help?', ['Where is everything?', 'A tip, please', 'Bye, Baro']);
      if (c === 0) { dialog.close(); openGuide(); return; }
      if (c === 1) {
        const tips = [
          'The cabinet on each floor has extra samples and equipment. Take what you like; it all goes in your bag.',
          'Hold **Shift** to run. Baro does not run. Baro glides.',
          'The board next to the directory has a new puzzle every day (오늘의 문제). Answer on days in a row and the stamps add up.',
          'On a phone you can tap where you want to go, or use the pad in the corner.',
          'The elevator and the stairs take you between floors. The stairs are better exercise.',
          'Prof. Bueong checks every answer against real physics, so careful measurements pay off.',
          'Injeolmi the cat wanders around. She is named after a rice cake dusted with roasted soybean powder, and she knows where things are hidden.',
          'Your progress stays in this browser. The Help button can start the building afresh.',
        ];
        await say('bolt', [tips[Math.floor(Math.random() * tips.length)]]);
        return;
      }
      await say('bolt', ['Bye! 안녕히 가세요 (annyeonghi gaseyo: go in peace). Mind the pendulums.']);
    },

    async hoo() {
      if (!rig.flag('metHoo')) {
        rig.flag('metHoo', true);
        await say('hoo', ['Bueong bueong! A visitor. I am Professor Bueong (부엉 is what owls say in Korean), and this is the **Classics Hall**: pendulums, springs, lenses, waves and charges.',
          'Every bench here has slots: you can swap the sample, change the equipment, and choose what to measure. The cabinet in the corner has more kit.']);
      }
      const q = nextQuest('hoo');
      if (q) return runQuest('hoo', q);
      const auto = ['bullseye', 'halfke', 'null', 'feather'].filter((s) => !rig.stamps().includes(s));
      if (auto.length) {
        const hints = {
          bullseye: 'Try the launcher at the end of the hall: land a ball in the basket.',
          feather: 'Then land the ping-pong ball or the shuttlecock in the basket. Air makes that much harder!',
          halfke: 'On the air track, can you make a collision lose exactly half of its kinetic energy?',
          null: 'At the field table: between two charges there is a place where the field cancels. Find it with the probe.',
        };
        await say('hoo', ['You have answered all my questions. There are still stamps to earn here, though.', hints[auto[0]]]);
        return;
      }
      await say('hoo', ['Every stamp on this floor! Have you been upstairs? Kongi runs the Playground on 2F, and Dr. Yeo measures real magnets on 3F.']);
    },

    async mochi() {
      const m = ctx.game.npc('mochi');
      if (m && m.sleeping) { m.sleeping = false; await say('mochi', ['*Injeolmi opens one eye.*', 'Mrrrp?']); return; }
      const lines = [['Mrrp.'], ['야옹. (Yaong: that is “meow” in Korean.)'], ['*Injeolmi blinks slowly at you. That means she likes you.*'], ['*purr purr purr*'], ['Yaong! *She looks at the pendulum, then at you, then at the pendulum.*'], ['*Injeolmi rubs against your leg and leaves a few beige hairs on your clothes.*']];
      if (!rig.has('magnet-tiny') && rig.flag('been2')) lines.push(['*Injeolmi glances at the stairs. Upstairs, near the beanbags... something shiny?*']);
      await say('mochi', lines[Math.floor(Math.random() * lines.length)]);
    },

    async pip() {
      if (!rig.flag('metPip')) {
        rig.flag('metPip', true);
        await say('pip', ['Hi hi! I am Kongi (콩이: “little bean”). Welcome to the **Physics Playground**!', 'Everything up here looks like a magic trick. A magnet that falls in slow motion, a slinky that floats, light that interferes with itself...', 'None of it is magic. Want to help me prove it? 화이팅! (hwaiting: let’s go!)']);
      }
      if (rig.has('magnet-tiny') && !rig.has('magnet-n52')) {
        await say('pip', ['Ooh, is that a tiny magnet? Injeolmi keeps hiding those. Swap it for my **super magnet**? It is much stronger.']);
        const c = await dialog.ask(WHO.pip, 'Trade?', ['Deal!', 'I will keep it']);
        if (c === 0) { await giveItem('pip', 'magnet-n52'); await say('pip', ['Drop it through the copper pipe. Then try the cold copper pipe. Then be amazed.']); return; }
      }
      const q = nextQuest('pip');
      if (q) return runQuest('pip', q);
      const auto = ['slowfall', 'eraser', 'chladni'].filter((s) => !rig.stamps().includes(s));
      const hints = {
        slowfall: 'Can you make a magnet take more than a whole minute to fall through the 1 m pipe? A strong magnet, the best conductor, and... cold metal conducts much better.',
        eraser: 'In the dark room: put crossed polarisers on the two slits and the fringes vanish. Then add the eraser and bring them back!',
        chladni: 'At the Chladni plate, find a pattern with six or more nodal lines.',
      };
      if (auto.length) { await say('pip', [hints[auto[0]]]); return; }
      await say('pip', ['You did everything on my list! 대박 (daebak: amazing)! Go see Dr. Yeo upstairs. The real magnets are on 3F.']);
    },

    async fennec() {
      if (!rig.flag('metFennec')) {
        rig.flag('metFennec', true);
        await say('fennec', ['Oh, hello! I am Dr. Yeo, postdoc. Yeo as in 여우, fox. Yes, really. Welcome to the **Magnonics Lab**.',
          'Magnons are the ripples in a magnet’s spins: spin waves. We excite them with microwaves, watch them with laser light, and simulate them on graphics cards.',
          'The FMR magnet, the BLS table, the holo-board and the simulation desk all work. And through that glowing door is the **holo room**: our real lab, in 3D.']);
      }
      if (rig.flag('visitedHolo') && !rig.stamps().includes('holo')) {
        await say('fennec', ['You went into the holo room! That is what our lab really looks like. Here is a stamp for the trip.']);
        stamp('holo');
      }
      const q = nextQuest('fennec');
      if (q) return runQuest('fennec', q);
      await say('fennec', ['Everything measured! If you ever want to do this for real, the lab is in building E1 of Chungbuk National University, in Cheongju.']);
    },

    async nova() {
      if (!rig.flag('metNova')) {
        rig.flag('metNova', true);
        await say('nova', ['Bzzt! 안녕 (annyeong: hi)! I am Nuri, the gallery robot. 누리 means “the world”. I hover, because legs are overrated.',
          'This is the **spin gallery**: a spin that precesses, a row of spins that carries waves, domains under a Kerr microscope, spin-wave logic, and magnons meeting photons.',
          'Down the corridor, the **paper gallery** shows what our lab has published, and two experiments our undergraduates built in 2026.']);
      }
      const q = nextQuest('nova');
      if (q) return runQuest('nova', q);
      const auto = ['flip', 'wave', 'loop', 'logic', 'rod'].filter((s) => !rig.stamps().includes(s));
      const hints = {
        flip: 'At the spin top: drive the spin with microwaves at exactly its own frequency until it turns upside down.',
        wave: 'At the spin-wave machine: flick one end and let a wave run all the way to the other.',
        loop: 'At the Kerr microscope: sweep the field all the way up, down and back up, and draw a whole hysteresis loop.',
        logic: 'At the logic bench: fill in all four rows of a truth table.',
        rod: 'In the paper gallery: hammer the steel rod until the probe reads over 100 µT.',
      };
      if (auto.length) { await say('nova', ['All my questions answered! A few stamps are still hiding on this floor.', hints[auto[0]]]); return; }
      await say('nova', ['Every stamp on 3F! You would make a fine magnonics student. Beep.']);
    },
  };

  // events from the experiments that earn stamps on their own
  rig.on('note', (n) => {
    if (n.bench === 'launcher' && n.hit) {
      stamp('bullseye');
      if (n.ball === 'ball-pingpong' || n.ball === 'shuttle') stamp('feather');
    }
    if (n.bench === 'airtrack' && Number.isFinite(n.keLost) && Math.abs(n.keLost - 0.5) < 0.02) stamp('halfke');
    if (n.bench === 'field' && n.nullFound) stamp('null');
    if (n.bench === 'pipe' && n.time > 60) stamp('slowfall');
    if (n.bench === 'slit' && n.eraser) stamp('eraser');
    if (n.bench === 'chladni' && n.lines >= 6) stamp('chladni');
    if (n.bench === 'precess' && n.flip) stamp('flip');
    if (n.bench === 'chain' && n.travelled) stamp('wave');
    if (n.bench === 'domains' && n.loop) stamp('loop');
    if (n.bench === 'logic' && n.table) stamp('logic');
    if (n.bench === 'rod' && n.magnetised && n.kind === 'steel') stamp('rod');
  });

  return async function (id) {
    const fn = talk[id];
    if (!fn) return;
    try { await fn(); } finally { dialog.close(); }
  };
}

export { WHO };
