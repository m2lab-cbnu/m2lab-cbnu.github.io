// The sample editor used by every station. Changing it changes the sample for the whole lab.

import { el, slider, select } from './widgets.js';
import { MATERIALS, material } from '../physics/materials.js';
import { lab } from '../state.js';

const FIELDS = {
  d:     { label: 'Thickness', unit: 'nm', min: 1, max: 5000, log: true, get: (s) => s.d * 1e9, set: (v) => ({ d: v * 1e-9 }), digits: 3 },
  Ms:    { label: 'Saturation magnetization Ms', unit: 'kA/m', min: 10, max: 2000, log: true, get: (s) => s.Ms / 1e3, set: (v) => ({ Ms: v * 1e3 }), digits: 4 },
  gamma: { label: 'Gyromagnetic ratio γ/2π', unit: 'GHz/T', min: 20, max: 35, step: 0.01, get: (s) => s.gamma / 1e9, set: (v) => ({ gamma: v * 1e9 }), digits: 4 },
  alpha: { label: 'Gilbert damping α', unit: '', min: 1e-5, max: 0.1, log: true, get: (s) => s.alpha, set: (v) => ({ alpha: v }), digits: 3 },
  dB0:   { label: 'Inhomogeneous linewidth ΔB₀ (half width)', unit: 'mT', min: 0, max: 10, step: 0.005, get: (s) => s.dB0 * 1e3, set: (v) => ({ dB0: v * 1e-3 }), digits: 3 },
  A:     { label: 'Exchange stiffness A', unit: 'pJ/m', min: 0.5, max: 30, step: 0.1, get: (s) => s.A * 1e12, set: (v) => ({ A: v * 1e-12 }), digits: 3 },
  Kp:    { label: 'Perpendicular anisotropy Kp', unit: 'kJ/m³', min: -500, max: 2000, step: 1, get: (s) => (s.Kp || 0) / 1e3, set: (v) => ({ Kp: v * 1e3 }), digits: 4 },
  Ku:    { label: 'In-plane uniaxial anisotropy Ku', unit: 'kJ/m³', min: -50, max: 50, step: 0.1, get: (s) => (s.Ku || 0) / 1e3, set: (v) => ({ Ku: v * 1e3 }), digits: 3 },
  phiU:  { label: 'Easy axis angle (in plane)', unit: '°', min: 0, max: 180, step: 1, get: (s) => s.phiU || 0, set: (v) => ({ phiU: v }), digits: 3 },
  D:     { label: 'Interfacial DMI D', unit: 'mJ/m²', min: -3, max: 3, step: 0.01, get: (s) => (s.D || 0) * 1e3, set: (v) => ({ D: v * 1e-3 }), digits: 3 },
};

export function sampleEditor({ fields = ['d', 'Ms', 'gamma', 'alpha', 'dB0', 'Kp', 'Ku', 'phiU'], title = 'Sample', open = false } = {}) {
  const me = {};
  const opts = Object.values(MATERIALS).map((m) => ({ value: m.key, label: m.name }));
  opts.push({ value: 'custom', label: 'Your own (edited)' });
  const sel = select({
    label: 'Film on the bench', options: opts, value: lab.sample.edited ? 'custom' : lab.sample.key,
    onChange: (v) => { if (v !== 'custom') lab.setSample({ ...material(v), D: 0, edited: false }, me); refresh(); },
  });
  const ctl = {};
  const box = el('div', { class: 'vp-side' });
  for (const k of fields) {
    const f = FIELDS[k];
    ctl[k] = slider({
      label: f.label, unit: f.unit, min: f.min, max: f.max, step: f.step, log: f.log, digits: f.digits, value: f.get(lab.sample),
      onInput: (v) => { lab.setSample({ ...f.set(v), edited: true }, me); sel.set('custom'); },
    });
    box.append(ctl[k]);
  }
  const details = el('details', { class: 'sample-more', open: open || undefined }, el('summary', { text: 'Edit the film’s properties' }), box);
  function refresh() {
    sel.set(lab.sample.edited ? 'custom' : lab.sample.key);
    for (const k of fields) ctl[k].set(FIELDS[k].get(lab.sample), false);
  }
  lab.onSample((s, src) => { if (src !== me) refresh(); });
  const wrap = el('fieldset', { class: 'grp' }, el('legend', { text: title }), sel, details);
  wrap.refresh = refresh;
  return wrap;
}
