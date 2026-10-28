// Shared lab state: the sample on the bench is the same for every station, so a change made at
// one instrument shows up at the others.

import { material } from './physics/materials.js';

const listeners = new Set();

export const lab = {
  sample: { ...material('yig') },
  setSample(patch, source) {
    Object.assign(this.sample, patch);
    for (const fn of listeners) fn(this.sample, source);
  },
  onSample(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
