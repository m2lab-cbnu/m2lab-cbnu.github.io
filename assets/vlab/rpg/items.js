// Things you can carry: samples and equipment for the experiments. Each item has a name, a line
// of description, a small pixel icon, where it is found, and the physical numbers the experiments use.
//   where: 'free' (always on the bench), 'cab1' / 'cab2' / 'cab3' (the cabinet on that floor),
//          'quest:<id>' (given by someone in the building), 'hidden' (somewhere on a floor)

import { PAL, Pix, outline, tinyText, mix } from './pix.js';

const C = PAL;

export const ITEMS = {
  // ---------- balls and bobs (pendulum, launcher)
  'ball-steel':   { name: 'Steel ball', desc: '3.0 cm, 110 g. Heavy and small, so air hardly slows it.', icon: ['ball', C.steelL, C.steelD], where: 'free', phys: { d: 0.030, m: 0.110, Cd: 0.47 } },
  'ball-wood':    { name: 'Wooden ball', desc: '5.0 cm, 43 g. Light for its size.', icon: ['ball', C.woodL, C.wood], where: 'free', phys: { d: 0.050, m: 0.0425, Cd: 0.47 } },
  'bob-brass':    { name: 'Brass bob', desc: '4.0 cm, 285 g. The classic heavy pendulum bob.', icon: ['ball', C.yellow, C.brassD], where: 'cab1', phys: { d: 0.040, m: 0.285, Cd: 0.47 } },
  'ball-pingpong':{ name: 'Ping-pong ball', desc: '4.0 cm and only 2.7 g: air matters a lot.', icon: ['ball', C.snow, C.steelL], where: 'cab1', phys: { d: 0.040, m: 0.0027, Cd: 0.50 } },
  'ball-tennis':  { name: 'Tennis ball', desc: '6.7 cm, 58 g, fuzzy.', icon: ['tennis'], where: 'free', phys: { d: 0.067, m: 0.058, Cd: 0.55 } },
  'ball-golf':    { name: 'Golf ball', desc: '4.3 cm, 46 g. Dimples lower the drag; backspin gives lift.', icon: ['golf'], where: 'cab1', phys: { d: 0.0427, m: 0.0459, Cd: 0.25, CL: 0.16 } },
  'shuttle':      { name: 'Shuttlecock', desc: '5 g with a big skirt: it reaches top speed quickly.', icon: ['shuttle'], where: 'cab1', phys: { d: 0.068, m: 0.0050, Cd: 0.60 } },

  // ---------- timing and tracking
  'stopwatch':    { name: 'Stopwatch', desc: 'You press start and stop. Your reaction time comes along for free.', icon: ['stopwatch'], where: 'free' },
  'photogate':    { name: 'Photogate', desc: 'An infrared beam that times every pass to 0.1 ms.', icon: ['gate'], where: 'quest:hoo-swing' },
  'camera':       { name: 'High-speed camera', desc: '1000 frames a second: positions against time, and slow motion.', icon: ['camera'], where: 'cab1' },
  'radar':        { name: 'Radar gun', desc: 'Reads the speed of a moving ball.', icon: ['radar'], where: 'cab1' },
  'tape':         { name: 'Tape measure', desc: 'Where did it land?', icon: ['tape'], where: 'free' },

  // ---------- places and air
  'g-earth':      { name: 'Earth', desc: 'g = 9.81 m/s², the lab as it is.', icon: ['planet', C.blue, C.green], where: 'free', phys: { g: 9.81 } },
  'g-moon':       { name: 'Moon', desc: 'g = 1.62 m/s². The gravity room turns itself down.', icon: ['planet', C.steelL, C.steel], where: 'free', phys: { g: 1.62 } },
  'g-mars':       { name: 'Mars', desc: 'g = 3.71 m/s².', icon: ['planet', C.orange, C.redD], where: 'free', phys: { g: 3.71 } },
  'g-jupiter':    { name: 'Jupiter', desc: 'g = 24.8 m/s² (if you could stand there).', icon: ['planet', C.sand, C.copper], where: 'free', phys: { g: 24.79 } },
  'g-x':          { name: 'Planet X', desc: 'A gravity card from Prof. Hoo. Its g is a secret.', icon: ['planet', C.violet, C.pink], where: 'quest:hoo-planetx', phys: { g: null } },
  'air':          { name: 'Room air', desc: 'Ordinary air: drag, and a little buoyancy.', icon: ['air'], where: 'free' },
  'belljar':      { name: 'Vacuum jar', desc: 'Pumps the air away: no drag at all.', icon: ['jar'], where: 'cab1' },
  'vactube':      { name: 'Vacuum tunnel', desc: 'A long glass tube along the range with the air pumped out.', icon: ['tube'], where: 'cab1' },
  'spin-off':     { name: 'No spin', desc: 'The ball leaves without spinning.', icon: ['spin', 0], where: 'free' },
  'spin-back':    { name: 'Backspin wheel', desc: 'Gives the ball backspin, so the air lifts it (the Magnus effect).', icon: ['spin', 1], where: 'cab1' },

  // ---------- springs and masses (spring bench, string bench)
  'spring-soft':  { name: 'Soft spring', desc: 'k = 8.0 N/m', icon: ['spring', C.green], where: 'free', phys: { k: 8.0, ms: 0.012 } },
  'spring-mid':   { name: 'Medium spring', desc: 'k = 25 N/m', icon: ['spring', C.blue], where: 'free', phys: { k: 25.0, ms: 0.015 } },
  'spring-stiff': { name: 'Stiff spring', desc: 'k = 80 N/m', icon: ['spring', C.red], where: 'cab1', phys: { k: 80.0, ms: 0.020 } },
  'm50':          { name: '50 g mass', desc: 'A slotted brass mass.', icon: ['mass', '50'], where: 'free', phys: { m: 0.050 } },
  'm100':         { name: '100 g mass', desc: 'A slotted brass mass.', icon: ['mass', '100'], where: 'free', phys: { m: 0.100 } },
  'm200':         { name: '200 g mass', desc: 'A slotted brass mass.', icon: ['mass', '200'], where: 'free', phys: { m: 0.200 } },
  'm500':         { name: '500 g mass', desc: 'The heavy one.', icon: ['mass', '500'], where: 'cab1', phys: { m: 0.500 } },
  'm-mystery':    { name: 'Mystery block', desc: 'Prof. Hoo wants to know its mass, without a balance.', icon: ['mass', '?'], where: 'quest:hoo-block', phys: { m: null } },
  'damp-air':     { name: 'Just air', desc: 'Very little damping.', icon: ['air'], where: 'free', phys: { b: 0.012 } },
  'damp-paddle':  { name: 'Paddle in water', desc: 'A vane in a beaker of water: strong damping.', icon: ['paddle'], where: 'cab1', phys: { b: 0.30 } },
  'damp-magnet':  { name: 'Eddy-current damper', desc: 'A copper plate moving past a magnet. You set the gap.', icon: ['eddy'], where: 'cab1', phys: { b: 0.08 } },
  'ruler':        { name: 'Ruler', desc: 'Read the size of the swing by eye, to a millimetre or so.', icon: ['ruler'], where: 'free' },
  'motion':       { name: 'Motion sensor', desc: 'An ultrasonic ranger: position against time.', icon: ['sensor'], where: 'cab1' },

  // ---------- air track
  'bump-spring':  { name: 'Spring bumpers', desc: 'Bouncy: almost no energy lost.', icon: ['bumper', C.steelL], where: 'free', phys: { e: 0.95 } },
  'bump-velcro':  { name: 'Velcro pads', desc: 'The gliders stick together.', icon: ['bumper', C.orange], where: 'free', phys: { e: 0 } },
  'bump-magnet':  { name: 'Magnet bumpers', desc: 'They repel before they touch.', icon: ['bumper', C.red], where: 'cab1', phys: { e: 0.99, magnet: true } },
  'bump-clay':    { name: 'Clay pads', desc: 'A squishy, partly sticky bounce.', icon: ['bumper', C.pink], where: 'cab1', phys: { e: 0.25 } },
  'massbars':     { name: 'Mass bars', desc: 'Clip-on bars to make a glider heavier.', icon: ['bars'], where: 'free' },

  // ---------- optics
  'lens-10':      { name: 'Lens +10 cm', desc: 'A strong converging lens.', icon: ['lens', 'convex', C.ice], where: 'free', phys: { f: 0.10 } },
  'lens-20':      { name: 'Lens +20 cm', desc: 'A weaker converging lens.', icon: ['lens', 'convex', C.glass], where: 'free', phys: { f: 0.20 } },
  'lens-m15':     { name: 'Lens −15 cm', desc: 'A diverging lens: on its own it makes no real image.', icon: ['lens', 'concave', C.lilac], where: 'cab1', phys: { f: -0.15 } },
  'lens-x':       { name: 'Mystery lens', desc: 'Prof. Hoo wants its focal length.', icon: ['lens', 'convex', C.pink], where: 'quest:hoo-lens', phys: { f: null } },
  'src-arrow':    { name: 'Arrow lamp', desc: 'A lit arrow, 3 cm tall: easy to see which way up the image is.', icon: ['arrowlamp'], where: 'free', phys: { h: 0.03 } },
  'src-candle':   { name: 'Candle', desc: 'A flickering flame, 4 cm tall.', icon: ['candle'], where: 'cab1', phys: { h: 0.04 } },
  'src-far':      { name: 'Collimator', desc: 'Light as if from very far away: the image forms at the focal point.', icon: ['collimator'], where: 'cab1', phys: { far: true } },
  'iris':         { name: 'Iris', desc: 'Close it down for a sharper but dimmer image.', icon: ['iris'], where: 'cab1' },
  'no-iris':      { name: 'Open lens', desc: 'Light through the whole lens: bright, but sharp only right at the focus.', icon: ['ring'], where: 'free' },
  'lens-none':    { name: 'No second lens', desc: 'Just one lens on the rail.', icon: ['ring'], where: 'free' },

  // ---------- strings
  'str-thin':     { name: 'Thin nylon', desc: '0.40 g/m fishing line.', icon: ['string', C.ice], where: 'free', phys: { mu: 0.40e-3 } },
  'str-cord':     { name: 'Braided cord', desc: '1.2 g/m.', icon: ['string', C.orange], where: 'free', phys: { mu: 1.2e-3 } },
  'str-steel':    { name: 'Steel wire', desc: '3.9 g/m piano wire.', icon: ['string', C.steel], where: 'cab1', phys: { mu: 3.9e-3 } },
  'str-x':        { name: 'Mystery string', desc: 'What is its mass per metre?', icon: ['string', C.violet], where: 'quest:hoo-string', phys: { mu: null } },
  'strobe':       { name: 'Strobe lamp', desc: 'Flashes to freeze the string, or to show it in slow motion.', icon: ['strobe'], where: 'cab1' },
  'roomlight':    { name: 'Room light', desc: 'The string moves too fast to see: you see a blur.', icon: ['bulb'], where: 'free' },
  'eyes':         { name: 'Your eyes', desc: 'Watch closely. Good for a rough idea.', icon: ['eye'], where: 'free' },
  'mic':          { name: 'Microphone', desc: 'Listens to the string and shows how loud it is.', icon: ['mic'], where: 'free' },

  // ---------- field table
  'charges':      { name: 'Charge pucks', desc: 'Red is positive, blue is negative. Drag them around.', icon: ['charges'], where: 'free' },
  'plates':       { name: 'Capacitor plates', desc: 'Two charged bars: a uniform field between them.', icon: ['plates'], where: 'cab1' },
  'probe':        { name: 'Voltmeter probe', desc: 'Reads the potential and the field where you put it.', icon: ['probe'], where: 'free' },
  'testq':        { name: 'Test charge', desc: 'A tiny charge that moves along the field.', icon: ['testq'], where: 'free' },

  // ---------- 2F: magnets and pipes
  'magnet-n42':   { name: 'Neodymium magnet', desc: '12.7 mm across and 12.7 mm long, grade N42 (1.3 T).', icon: ['magnet', C.red, 1], where: 'free', phys: { R: 6.35e-3, len: 12.7e-3, Br: 1.30, rho: 7500 } },
  'magnet-stack': { name: 'Stack of three', desc: 'Three of the small magnets stuck end to end.', icon: ['magnet', C.red, 3], where: 'cab2', phys: { R: 6.35e-3, len: 38.1e-3, Br: 1.30, rho: 7500 } },
  'magnet-n52':   { name: 'Super magnet', desc: 'Grade N52 (1.45 T), 25 mm long. Handle with care!', icon: ['magnet', C.violet, 2], where: 'quest:pip-trade', phys: { R: 6.35e-3, len: 25.4e-3, Br: 1.45, rho: 7500 } },
  'magnet-tiny':  { name: 'Tiny magnet', desc: 'A 6 mm fridge magnet. Mochi likes to bat it around.', icon: ['magnet', C.pink, 0], where: 'hidden', phys: { R: 3.0e-3, len: 6.0e-3, Br: 1.20, rho: 7500 } },
  'magnet-ferrite': { name: 'Ferrite magnet', desc: 'A dark ceramic magnet, much weaker (0.39 T) and lighter.', icon: ['magnet', C.ink, 1], where: 'cab2', phys: { R: 6.35e-3, len: 12.7e-3, Br: 0.39, rho: 4900 } },
  'slug-steel':   { name: 'Steel slug', desc: 'Same size as the magnet, but not magnetised. The control experiment.', icon: ['magnet', C.steel, 1], where: 'free', phys: { R: 6.35e-3, len: 12.7e-3, Br: 0, rho: 7850 } },
  'pipe-cu':      { name: 'Copper pipe', desc: '1 m long, 14 mm inside, 1 mm wall. Copper conducts superbly.', icon: ['pipe', C.copper, C.copperL], where: 'free', phys: { a: 7.0e-3, w: 1.0e-3, sigma: 5.96e7, cold: 8.0 } },
  'pipe-al':      { name: 'Aluminium pipe', desc: 'Same size, 1.5 mm wall. A good conductor, but not as good as copper.', icon: ['pipe', C.steelL, '#FFFFFF'], where: 'free', phys: { a: 7.0e-3, w: 1.5e-3, sigma: 3.5e7, cold: 6.5 } },
  'pipe-pvc':     { name: 'Plastic pipe', desc: 'PVC: no conduction at all.', icon: ['pipe', C.mist, '#FFFFFF'], where: 'free', phys: { a: 7.0e-3, w: 1.5e-3, sigma: 0, cold: 1 } },
  'pipe-brass':   { name: 'Brass pipe', desc: 'An alloy: it conducts about a quarter as well as copper.', icon: ['pipe', C.brass, C.yellow], where: 'cab2', phys: { a: 7.0e-3, w: 1.0e-3, sigma: 1.5e7, cold: 1.3 } },
  'pipe-steel':   { name: 'Stainless steel pipe', desc: 'Non-magnetic stainless steel. A poor conductor.', icon: ['pipe', C.steel, C.steelL], where: 'cab2', phys: { a: 7.0e-3, w: 1.0e-3, sigma: 1.4e6, cold: 1.1 } },
  'pipe-slot':    { name: 'Slotted copper pipe', desc: 'Copper with a thin cut all along its length.', icon: ['pipe', C.copper, C.copperL, 1], where: 'cab2', phys: { a: 7.0e-3, w: 1.0e-3, sigma: 5.96e7, cold: 8.0, slot: true } },
  'pipe-thick':   { name: 'Thick copper pipe', desc: 'Copper with a 3 mm wall.', icon: ['pipe', C.copperD, C.copper], where: 'cab2', phys: { a: 7.0e-3, w: 3.0e-3, sigma: 5.96e7, cold: 8.0 } },
  'warm':         { name: 'Room temperature', desc: 'The pipe as it is, at about 20 °C.', icon: ['thermo', C.orange], where: 'free' },
  'ln2':          { name: 'Liquid nitrogen', desc: 'Cools the pipe to −196 °C. Cold metals conduct much better.', icon: ['dewar'], where: 'cab2' },

  // ---------- 2F: slinkies
  'slinky-metal': { name: 'Metal slinky', desc: 'The classic: 215 g of steel coil.', icon: ['slinky', C.steelL, C.steel], where: 'free', phys: { M: 0.215, k: 1.6, h0: 0.065 } },
  'slinky-plastic': { name: 'Plastic slinky', desc: 'Light and floppy: 46 g.', icon: ['slinky', C.pink, C.rose], where: 'cab2', phys: { M: 0.046, k: 0.30, h0: 0.11 } },
  'bottom-none':  { name: 'Nothing', desc: 'Just the slinky.', icon: ['ring'], where: 'free', phys: { m: 0 } },

  // ---------- 2F: light
  'laser-red':    { name: 'Red laser', desc: '650 nm.', icon: ['laser', C.red], where: 'free', phys: { lambda: 650e-9 } },
  'laser-green':  { name: 'Green laser', desc: '532 nm.', icon: ['laser', C.green], where: 'cab2', phys: { lambda: 532e-9 } },
  'laser-blue':   { name: 'Blue laser', desc: '450 nm.', icon: ['laser', C.blue], where: 'cab2', phys: { lambda: 450e-9 } },
  'slit-1':       { name: 'Single slit', desc: 'One slit, 0.08 mm wide.', icon: ['slits', 1], where: 'free', phys: { n: 1, a: 80e-6, d: 0 } },
  'slit-2':       { name: 'Double slit', desc: 'Two slits 0.08 mm wide, 0.25 mm apart.', icon: ['slits', 2], where: 'free', phys: { n: 2, a: 80e-6, d: 250e-6 } },
  'slit-2w':      { name: 'Wide double slit', desc: 'Two slits 0.5 mm apart.', icon: ['slits', 2, 1], where: 'cab2', phys: { n: 2, a: 80e-6, d: 500e-6 } },
  'slit-3':       { name: 'Triple slit', desc: 'Three slits, 0.25 mm apart.', icon: ['slits', 3], where: 'cab2', phys: { n: 3, a: 80e-6, d: 250e-6 } },
  'slit-10':      { name: 'Grating', desc: 'Ten slits, 0.25 mm apart.', icon: ['slits', 10], where: 'cab2', phys: { n: 10, a: 60e-6, d: 250e-6 } },
  'diff-none':    { name: 'No diffuser', desc: 'Clean laser light.', icon: ['ring'], where: 'free' },
  'diffuser':     { name: 'Ground-glass diffuser', desc: 'Scrambles the phase of the light. Where you put it matters!', icon: ['diffuser'], where: 'cab2' },
  'pol-none':     { name: 'No polarisers', desc: 'Both slits pass the same light.', icon: ['ring'], where: 'free' },
  'polarizers':   { name: 'Polariser pair', desc: 'One film over each slit, and a third one to put in front of the screen.', icon: ['polarizer'], where: 'cab2' },
  'screen-eye':   { name: 'White screen', desc: 'Look at the pattern.', icon: ['eye'], where: 'free' },
  'photodiode':   { name: 'Photodiode scanner', desc: 'Measures the brightness across the pattern.', icon: ['sensor'], where: 'free' },
  'spad':         { name: 'Single-photon camera', desc: 'Turn the laser right down and catch the light one photon at a time.', icon: ['camera'], where: 'cab2' },

  // ---------- 2F: coupled pendulums, gyroscope, Chladni plate
  'couple-weak':  { name: 'Weak coupling spring', desc: 'k = 0.6 N/m between the strings.', icon: ['spring', C.mint], where: 'free', phys: { kc: 0.6 } },
  'couple-mid':   { name: 'Medium coupling spring', desc: 'k = 1.5 N/m.', icon: ['spring', C.teal], where: 'free', phys: { kc: 1.5 } },
  'couple-strong': { name: 'Strong coupling spring', desc: 'k = 4 N/m.', icon: ['spring', C.violet], where: 'cab2', phys: { kc: 4.0 } },
  'gyrowheel':    { name: 'Brass wheel', desc: '250 g, 4 cm radius, 5 cm from the pivot.', icon: ['wheel', C.brass], where: 'free', phys: { m: 0.25, R: 0.04, d: 0.05 } },
  'gyro-steel':   { name: 'Heavy steel wheel', desc: '500 g, 5 cm radius, 5 cm from the pivot.', icon: ['wheel', C.steel], where: 'cab2', phys: { m: 0.50, R: 0.05, d: 0.05 } },
  'gw-none':      { name: 'No extra weight', desc: 'Just the wheel.', icon: ['ring'], where: 'free', phys: { mw: 0, dw: 0 } },
  'gw-hang':      { name: 'Weight on the end', desc: 'A 50 g weight past the wheel, 12 cm out: more torque.', icon: ['mass', '50'], where: 'free', phys: { mw: 0.05, dw: 0.12 } },
  'gw-counter':   { name: 'Counterweight', desc: 'A 150 g weight 6 cm behind the pivot: less torque.', icon: ['mass', '200'], where: 'cab2', phys: { mw: 0.15, dw: -0.06 } },
  'plate-square': { name: 'Square brass plate', desc: '24 cm square, 1 mm thick, held at its centre.', icon: ['plate', 0], where: 'free', phys: { shape: 'square', c: 1.0 } },
  'plate-round':  { name: 'Round brass plate', desc: '24 cm across.', icon: ['plate', 1], where: 'cab2', phys: { shape: 'circle', c: 1.0 } },
  'plate-alu':    { name: 'Square aluminium plate', desc: 'Lighter and stiffer for its weight: every note goes up.', icon: ['plate', 2], where: 'cab2', phys: { shape: 'square', c: 1.43 } },
  'sand':         { name: 'Sand', desc: 'Fine dry sand.', icon: ['sand', C.sand], where: 'free' },
  'salt':         { name: 'Salt', desc: 'Finer and whiter: it gathers faster.', icon: ['sand', '#FFFFFF'], where: 'cab2' },
  'speaker':      { name: 'Speaker', desc: 'Shakes the plate at its centre.', icon: ['speaker'], where: 'free' },
  'bow':          { name: 'Violin bow', desc: 'Bow the edge, like Chladni did in 1787.', icon: ['bow'], where: 'cab2' },

  // ---------- 3F films (for the FMR magnet, the BLS table and the holo-board)
  'film-yig':     { name: 'YIG film', desc: 'Yttrium iron garnet: the lowest damping of any magnet we know.', icon: ['film', C.gold], where: 'free', phys: { key: 'yig' } },
  'film-py':      { name: 'Permalloy film', desc: 'Ni₈₀Fe₂₀, 20 nm: soft and easy to work with.', icon: ['film', C.steel], where: 'free', phys: { key: 'py' } },
  'film-cofeb':   { name: 'CoFeB film', desc: '10 nm, a large magnetisation and low damping.', icon: ['film', C.lav], where: 'cab3', phys: { key: 'cofeb' } },
  'film-copt':    { name: 'Co/Pt film', desc: 'Its magnetisation prefers to point out of the plane.', icon: ['film', C.pink], where: 'cab3', phys: { key: 'copt' } },
  'film-ni':      { name: 'Nickel film', desc: '30 nm. A smaller magnetisation, a lot more damping.', icon: ['film', C.mint], where: 'cab3', phys: { key: 'ni' } },
  'film-fe':      { name: 'Iron film', desc: '15 nm. The strongest magnetisation of the lot.', icon: ['film', C.copper], where: 'cab3', phys: { key: 'fe' } },
  'film-x':       { name: 'Film #7', desc: 'Grown last night. Nobody has measured it yet.', icon: ['film', C.orange, '?'], where: 'quest:fennec-film', phys: { key: 'x' } },

  // ---------- passes and keepsakes
  'passport':     { name: 'Lab passport', desc: 'Collect a stamp for each experiment you crack.', icon: ['passport'], where: 'quest:bolt-hello' },
};

// icons -----------------------------------------------------------------------------------
const icons = new Map();
export function itemIcon(id) {
  if (icons.has(id)) return icons.get(id);
  const it = ITEMS[id];
  const P = new Pix(16, 16).at(1, 1);
  paint(P, it ? it.icon : ['unknown']);
  const c = outline(P.c);
  icons.set(id, c);
  return c;
}

function paint(P, spec) {
  const [k, a, b] = spec;
  switch (k) {
    case 'ball': P.disc(7, 7, 5, b); P.disc(6, 6, 4, a); P.px(4, 4, '#FFFFFF'); P.px(5, 4, '#FFFFFF'); break;
    case 'tennis': P.disc(7, 7, 5, '#C8E65A'); P.disc(6, 6, 4, '#DDF27A'); P.line(3, 4, 6, 7, '#FFFFFF'); P.line(6, 7, 11, 9, '#FFFFFF'); break;
    case 'golf': P.disc(7, 7, 5, C.steelL); P.disc(6, 6, 4, C.snow); for (const [x, y] of [[5, 6], [8, 5], [7, 8], [9, 8], [5, 9]]) P.px(x, y, C.steelL); break;
    case 'shuttle': P.disc(7, 11, 2, C.snow); for (let i = 0; i < 5; i++) P.line(7, 10, 3 + i * 2, 1, i % 2 ? C.snow : C.mist); P.hl(3, 2, 9, C.steelL); P.hl(6, 10, 3, C.red); break;
    case 'stopwatch': P.disc(7, 8, 5, C.navy); P.disc(7, 8, 4, C.snow); P.rect(6, 0, 3, 2, C.navy); P.line(7, 8, 7, 5, C.red); P.line(7, 8, 9, 9, C.out); break;
    case 'gate': P.rect(1, 2, 3, 11, C.navy); P.rect(10, 2, 3, 11, C.navy); P.rect(1, 11, 12, 3, C.navy); P.hl(4, 6, 6, C.red); P.px(2, 4, C.cyan); break;
    case 'camera': P.rect(0, 4, 10, 8, C.ink); P.hl(0, 4, 10, C.navy); P.rect(10, 6, 4, 4, C.steelD); P.disc(5, 8, 2, C.cyan); P.px(1, 5, C.red); P.rect(2, 2, 4, 2, C.ink); break;
    case 'radar': P.rect(1, 3, 10, 5, C.yellow); P.hl(1, 3, 10, '#FFF0B8'); P.rect(11, 4, 3, 3, C.steelD); P.rect(3, 8, 3, 6, C.ink); P.rect(3, 4, 4, 2, C.night); P.px(4, 5, C.green); break;
    case 'tape': P.disc(6, 7, 5, C.yellow); P.disc(6, 7, 2, C.gold); P.rect(10, 9, 4, 3, C.yellow); P.hl(10, 10, 4, C.out); break;
    case 'planet': P.disc(7, 7, 5, b); P.disc(7, 6, 4, a); P.px(5, 4, mix(a, '#FFFFFF', 0.6)); if (a === C.violet) { P.hl(0, 8, 14, C.pink); P.px(6, 6, '#FFFFFF'); } break;
    case 'air': for (let i = 0; i < 3; i++) { P.line(1, 3 + i * 4, 9, 3 + i * 4, C.sky); P.px(10, 2 + i * 4, C.sky); P.px(11, 3 + i * 4, C.sky); } break;
    case 'jar': P.oval(2, 1, 10, 10, C.glass); P.rect(2, 6, 10, 5, C.glass); P.px(4, 3, '#FFFFFF'); P.rect(0, 11, 14, 3, C.steelD); P.vl(4, 4, 4, '#FFFFFF'); break;
    case 'spring': for (let i = 0; i < 6; i++) P.line(3, 1 + i * 2, 11, 2 + i * 2, i % 2 ? a : mix(a, '#FFFFFF', 0.4)); P.hl(5, 0, 4, C.steelX); P.hl(5, 13, 4, C.steelX); break;
    case 'mass': P.rect(2, 2, 10, 11, C.brass); P.hl(2, 2, 10, C.yellow); P.vl(11, 2, 11, C.brassD); P.rect(6, 0, 2, 2, C.brassD); tinyText(P, a, a.length === 1 ? 6 : a.length === 2 ? 4 : 2, 6, C.out); break;
    case 'paddle': P.rect(2, 5, 10, 9, C.glass); P.rect(2, 8, 10, 6, C.sky); P.vl(7, 0, 9, C.steelX); P.rect(5, 8, 5, 4, C.steelD); break;
    case 'eddy': P.rect(1, 3, 5, 8, C.red); P.rect(8, 3, 5, 8, C.blue); P.rect(5, 1, 4, 12, C.copper); P.vl(6, 1, 12, C.copperL); break;
    case 'ruler': P.rect(0, 5, 14, 5, C.yellow); for (let i = 1; i < 14; i += 2) P.vl(i, 5, i % 4 === 1 ? 3 : 2, C.out); break;
    case 'sensor': P.rect(2, 2, 10, 10, C.ink); P.disc(7, 7, 3, C.steelL); P.disc(7, 7, 1, C.steelX); P.rect(4, 12, 6, 2, C.steelD); break;
    case 'bumper': P.rect(0, 4, 4, 7, C.steelD); P.rect(4, 3, 6, 9, a); P.hl(4, 3, 6, mix(a, '#FFFFFF', 0.5)); if (a === C.steelL) for (let j = 4; j < 12; j += 2) P.hl(10, j, 3, C.steelX); break;
    case 'bars': for (let i = 0; i < 3; i++) { P.rect(1, 2 + i * 4, 12, 3, C.steelD); P.hl(1, 2 + i * 4, 12, C.steelL); } break;
    case 'lens':
      if (a === 'convex') { P.oval(4, 0, 6, 14, b); P.vl(5, 3, 7, '#FFFFFF'); }
      else { P.rect(3, 0, 8, 14, b); P.rect(6, 2, 2, 10, C.mist); P.px(5, 1, b); P.vl(4, 3, 7, '#FFFFFF'); }
      if (b === C.pink) tinyText(P, '?', 6, 5, C.out);
      break;
    case 'arrowlamp': P.rect(0, 3, 9, 9, C.navy); P.vl(4, 4, 7, C.yellow); P.hl(3, 5, 3, C.yellow); P.px(2, 6, C.yellow); P.px(6, 6, C.yellow); P.rect(9, 5, 4, 5, C.yellow); break;
    case 'candle': P.rect(5, 6, 4, 8, C.snow); P.vl(8, 6, 8, C.steelL); P.oval(5, 0, 4, 6, C.orange); P.oval(6, 2, 2, 3, C.yellow); break;
    case 'collimator': P.rect(0, 4, 9, 6, C.steelX); P.hl(0, 4, 9, C.steelD); for (let i = 0; i < 3; i++) P.hl(9, 4 + i * 2, 5, C.yellow); break;
    case 'iris': P.disc(7, 7, 6, C.ink); P.disc(7, 7, 2, C.cyan); for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; P.line(7 + 2 * Math.cos(an), 7 + 2 * Math.sin(an), 7 + 5 * Math.cos(an + 0.7), 7 + 5 * Math.sin(an + 0.7), C.navy); } break;
    case 'string': P.ring(7, 7, 5, a); P.ring(7, 7, 3, a); P.line(11, 9, 14, 13, a); P.disc(7, 7, 1, C.woodD); break;
    case 'strobe': P.rect(1, 4, 9, 7, C.ink); P.rect(10, 3, 3, 9, C.snow); P.px(11, 4, C.yellow); P.px(11, 7, C.yellow); P.px(11, 10, C.yellow); P.rect(4, 11, 3, 3, C.steelD); break;
    case 'charges': P.disc(4, 5, 3, C.red); P.hl(3, 5, 3, '#FFFFFF'); P.vl(4, 4, 3, '#FFFFFF'); P.disc(10, 9, 3, C.blue); P.hl(9, 9, 3, '#FFFFFF'); break;
    case 'charge': P.disc(7, 7, 5, a); tinyText(P, b || '+', 6, 5, '#FFFFFF'); break;
    case 'plates': P.rect(1, 0, 3, 14, C.red); P.rect(10, 0, 3, 14, C.blue); for (let j = 2; j < 13; j += 3) P.hl(4, j, 6, C.lav); break;
    case 'probe': P.line(2, 12, 10, 2, C.red); P.line(3, 12, 11, 2, C.redD); P.rect(9, 0, 4, 4, C.ink); P.px(1, 13, C.steelL); break;
    case 'testq': P.disc(7, 7, 3, C.gold); P.hl(6, 7, 3, C.out); P.vl(7, 6, 3, C.out); for (let i = 0; i < 3; i++) P.px(11 + i, 7, C.gold); break;
    case 'tube': P.rect(0, 4, 14, 7, C.glass); P.hl(0, 5, 14, '#FFFFFF'); P.rect(0, 3, 2, 9, C.steelD); P.rect(12, 3, 2, 9, C.steelD); P.disc(7, 8, 1, C.yellow); break;
    case 'spin': P.ring(7, 7, 5, a ? C.violet : C.steelL); P.disc(7, 7, 3, a ? C.lav : C.mist); if (a) { P.px(2, 4, C.violet); P.px(1, 5, C.violet); P.px(3, 5, C.violet); } break;
    case 'ring': P.ring(7, 7, 5, C.steel); P.ring(7, 7, 4, C.steelL); break;
    case 'bulb': P.disc(7, 5, 4, C.yellow); P.px(5, 3, '#FFFFFF'); P.rect(5, 9, 5, 4, C.steelD); P.hl(5, 10, 5, C.steelL); break;
    case 'eye': P.oval(1, 4, 13, 7, C.snow); P.disc(7, 7, 2, C.blue); P.px(7, 7, C.out); P.px(6, 6, '#FFFFFF'); break;
    case 'mic': P.oval(4, 0, 6, 8, C.steelL); for (let j = 1; j < 7; j += 2) P.hl(5, j, 4, C.steelD); P.vl(7, 8, 4, C.steelX); P.hl(4, 12, 7, C.steelX); P.line(2, 5, 3, 9, C.steelX); P.line(12, 5, 11, 9, C.steelX); break;
    case 'magnet': {
      const n = b || 0, h = n === 0 ? 5 : n === 3 ? 13 : n === 2 ? 10 : 7, y0 = 13 - h;
      P.rect(4, y0, 6, h, a); if (a === C.red || a === C.violet || a === C.pink) { P.rect(4, y0, 6, Math.floor(h / 2), C.blue); }
      P.vl(4, y0, h, mix(a, '#FFFFFF', 0.4)); if (n === 3) { P.hl(4, y0 + 4, 6, C.out); P.hl(4, y0 + 8, 6, C.out); }
      if (a === C.violet) { P.px(11, 2, C.yellow); P.px(12, 3, C.yellow); P.px(2, 4, C.yellow); }
      break;
    }
    case 'pipe': P.rect(3, 0, 8, 14, a); P.vl(4, 0, 14, b); P.vl(10, 0, 14, mix(a, C.out, 0.3)); P.rect(5, 0, 4, 2, C.out); if (spec[3]) P.vl(7, 2, 12, C.out); break;
    case 'thermo': P.rect(6, 0, 3, 10, C.snow); P.rect(7, 4, 1, 6, a); P.disc(7, 11, 2, a); break;
    case 'dewar': P.rect(3, 2, 8, 12, C.steelL); P.hl(3, 2, 8, '#FFFFFF'); P.rect(5, 0, 4, 2, C.steelD); P.rect(4, 5, 6, 6, C.ice); P.px(2, 1, C.ice); P.px(11, 0, C.ice); P.px(12, 2, C.ice); break;
    case 'slinky': for (let i = 0; i < 7; i++) { P.hl(2, 1 + i * 2, 10, i % 2 ? a : b); P.px(1, 1 + i * 2, b); P.px(12, 1 + i * 2, b); } break;
    case 'laser': P.rect(0, 5, 9, 5, C.ink); P.hl(0, 5, 9, C.navy); P.rect(9, 6, 2, 3, C.steelD); P.hl(11, 7, 3, a); P.px(2, 7, a); break;
    case 'slits': { P.rect(1, 0, 12, 14, C.ink); const n = a, gap = n === 10 ? 1 : b ? 4 : 2; const tot = n === 10 ? 10 : n + (n - 1) * (gap - 1); let x = Math.round(7 - tot / 2); for (let i = 0; i < Math.min(n, 10); i++) { P.vl(x, 2, 10, C.ice); x += n === 10 ? 1 : gap; } break; }
    case 'diffuser': P.disc(7, 7, 6, C.steelL); for (let i = 0; i < 18; i++) P.px(2 + (i * 7) % 11, 2 + (i * 5) % 11, '#FFFFFF'); P.ring(7, 7, 6, C.steelD); break;
    case 'polarizer': P.disc(7, 7, 6, C.lilac); for (let i = 2; i < 13; i += 2) P.vl(i, 3, 9, C.violet); P.ring(7, 7, 6, C.plum); break;
    case 'wheel': P.disc(7, 7, 6, a); P.disc(7, 7, 4, mix(a, C.out, 0.25)); P.disc(7, 7, 1, C.steelX); P.line(0, 7, 14, 7, C.steelX); break;
    case 'plate': if (a === 1) P.disc(7, 7, 6, C.brass); else P.rect(1, 1, 12, 12, a === 2 ? C.steelL : C.brass); for (let i = 2; i < 13; i += 3) { P.px(i, i, C.sand); P.px(13 - i, i, C.sand); } break;
    case 'sand': P.oval(2, 4, 10, 10, C.tan); P.rect(5, 2, 4, 3, C.woodD); for (let i = 0; i < 6; i++) P.px(4 + (i * 3) % 7, 7 + (i % 3) * 2, a); break;
    case 'speaker': P.rect(2, 1, 10, 12, C.ink); P.disc(7, 7, 4, C.steelD); P.disc(7, 7, 2, C.steelX); P.px(6, 6, C.steelL); break;
    case 'bow': P.line(0, 13, 13, 0, C.woodD); P.line(1, 13, 13, 1, C.cream); P.rect(0, 11, 3, 3, C.ink); break;
    case 'film': P.rect(1, 3, 12, 9, C.steelL); P.hl(1, 3, 12, '#FFFFFF'); P.rect(3, 5, 8, 5, a); P.hl(3, 5, 8, mix(a, '#FFFFFF', 0.5)); if (b === '?') tinyText(P, '?', 6, 5, C.out); break;
    case 'passport': P.rect(2, 0, 10, 14, C.navy); P.hl(2, 0, 10, C.blue); P.disc(7, 6, 2, C.gold); P.hl(4, 10, 6, C.cyan); break;
    default: P.rect(2, 2, 10, 10, C.lav); tinyText(P, '?', 6, 5, C.out);
  }
}

export function itemName(id) { return (ITEMS[id] && ITEMS[id].name) || id; }

// where to look for an item, in friendly words
export function itemWhere(id) {
  const w = (ITEMS[id] && ITEMS[id].where) || '';
  if (w === 'free') return 'On the bench already.';
  if (w === 'cab1') return 'In the cabinet on 1F.';
  if (w === 'cab2') return 'In the cabinet on 2F.';
  if (w === 'cab3') return 'In the sample cabinet on 3F.';
  if (w.startsWith('quest:hoo')) return 'Prof. Hoo on 1F has this one.';
  if (w.startsWith('quest:pip')) return 'Pip on 2F has this one.';
  if (w.startsWith('quest:fennec')) return 'Dr. Fennec on 3F has this one.';
  if (w.startsWith('quest:bolt')) return 'Bolt at the front desk has this one.';
  if (w === 'hidden') return 'Somebody hid it somewhere in the building.';
  return '';
}
