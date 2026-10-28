// The stations in the lab. Each module exports { id, title, kicker, icon, blurb, build3D(world), tabs }.
// To add an instrument, write a module like these and list it here.

import fmr from './fmr.js';
import dispersion from './dispersion.js';
import micromag from './micromag.js';
import bls from './bls.js';

const exit = {
  id: 'exit', title: 'Back to the building', icon: '←', blurb: 'Leave the holo room for the virtual building.', separator: true,
  action: () => { location.href = 'lab.html'; },
  build3D(w) {
    const d = w.spots.door;
    w.proxy(exit, d.x - 0.8, 0, d.z - 0.12, d.x + 0.8, 2.15, d.z + 0.02);
    return { anchor: [d.x, 2.35, d.z - 0.1] };
  },
};

export const STATIONS = [fmr, dispersion, micromag, bls, exit];
