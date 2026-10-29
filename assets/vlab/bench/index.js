// Every experiment in the building, with what the guide needs to list it. The modules load
// when you first open them, so the building itself starts quickly.

export const EXPERIMENTS = [
  // 1F · Classics Hall
  { id: 'pendulum', floor: 1, title: 'Pendulum', blurb: 'Time swings, swap the bob, go to another planet, measure g.', load: () => import('./pendulum.js') },
  { id: 'launcher', floor: 1, title: 'Launcher', blurb: 'Projectiles with real air drag. Hit the target.', load: () => import('./launcher.js') },
  { id: 'spring', floor: 1, title: 'Spring and motor', blurb: 'Driven oscillations and resonance.', load: () => import('./spring.js') },
  { id: 'airtrack', floor: 1, title: 'Air track', blurb: 'Collisions: momentum and energy.', load: () => import('./airtrack.js') },
  { id: 'optics', floor: 1, title: 'Lens bench', blurb: 'Images, focal lengths and the lens equation.', load: () => import('./optics.js') },
  { id: 'strings', floor: 1, title: 'Vibrating string', blurb: 'Standing waves, harmonics and tension.', load: () => import('./strings.js') },
  { id: 'field', floor: 1, title: 'Field table', blurb: 'Charges, field lines and equipotentials.', load: () => import('./field.js') },
  // 2F · Physics Playground
  { id: 'pipe', floor: 2, title: 'Magnet and pipes', blurb: 'A magnet falls through a copper pipe, very slowly.', load: () => import('./pipe.js') },
  { id: 'slinky', floor: 2, title: 'Slinky drop', blurb: 'Let go of the top. The bottom waits.', load: () => import('./slinky.js') },
  { id: 'slit', floor: 2, title: 'Double slit', blurb: 'Fringes, diffusers, polarizers and single photons.', load: () => import('./slit.js') },
  { id: 'coupled', floor: 2, title: 'Coupled pendulums', blurb: 'Energy sloshing between two swings.', load: () => import('./coupled.js') },
  { id: 'gyro', floor: 2, title: 'Gyroscope', blurb: 'Precession and nutation.', load: () => import('./gyro.js') },
  { id: 'chladni', floor: 2, title: 'Chladni plate', blurb: 'Sand draws the shapes of vibration.', load: () => import('./chladni.js') },
  // 3F · Magnonics Lab: the spin gallery and the project room
  { id: 'precess', floor: 3, title: 'Spin precession', blurb: 'A single spin in a field, and microwaves that flip it.', load: () => import('./precess.js') },
  { id: 'chain', floor: 3, title: 'Spin-wave machine', blurb: 'A row of spins: flick one end and a wave runs along.', load: () => import('./chain.js') },
  { id: 'domains', floor: 3, title: 'Kerr microscope: domains', blurb: 'Watch magnetic domains grow, shrink and remember.', load: () => import('./domains.js') },
  { id: 'logic', floor: 3, title: 'Spin-wave logic', blurb: 'Spin waves meet in a Y and compute.', load: () => import('./logic.js') },
  { id: 'bragg', floor: 3, title: 'Microwave Bragg diffraction', blurb: 'Steel-ball crystals and microwaves: the angles where reflections add up.', load: () => import('./bragg.js') },
  { id: 'rod', floor: 3, title: 'Hammer a steel rod', blurb: 'Hit a steel rod and Earth’s field turns it into a magnet.', load: () => import('./rod.js') },
  { id: 'cavity', floor: 3, title: 'Magnons meet photons', blurb: 'Microwaves and magnons trade energy and refuse to cross.', load: () => import('./cavity.js') },
  // 3F · Magnonics Lab (the instruments of the 3D lab)
  { id: 'fmr', floor: 3, station: true, title: 'FMR setup', blurb: 'Ferromagnetic resonance of a thin film.', load: () => import('../stations/fmr.js') },
  { id: 'dispersion', floor: 3, station: true, title: 'Holo-board', blurb: 'Spin-wave dispersion and antennas.', load: () => import('../stations/dispersion.js') },
  { id: 'micromag', floor: 3, station: true, title: 'Simulation desk', blurb: 'A micromagnetic simulator on your graphics card.', load: () => import('../stations/micromag.js') },
  { id: 'bls', floor: 3, station: true, title: 'BLS table', blurb: 'Brillouin light scattering, pumping and condensation.', load: () => import('../stations/bls.js') },
];

const loaded = new Map();
export async function loadExperiment(id) {
  if (loaded.has(id)) return loaded.get(id);
  const e = EXPERIMENTS.find((x) => x.id === id);
  if (!e) throw new Error('No experiment ' + id);
  const p = e.load().then((m) => m.default);
  loaded.set(id, p);
  try { return await p; } catch (err) { loaded.delete(id); throw err; }
}
