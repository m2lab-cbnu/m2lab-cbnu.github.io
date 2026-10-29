// Ready-made simulations for the Simulation PC. Each returns a configuration for engine.load().

import { MU0 } from '../physics/materials.js';
import * as disp from '../physics/dispersion.js';
import * as fmr from '../physics/fmr.js';
import { lab } from '../state.js';

// ---------------------------------------------------------------- helpers
export function blank(Nx, Ny) { return new Float32Array(Nx * Ny * 4); }
export function fillMask(m, Nx, Ny, dx, dy, inside) {
  for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) {
    const x = (i + 0.5 - Nx / 2) * dx, y = (j + 0.5 - Ny / 2) * dy;
    m[4 * (j * Nx + i) + 3] = inside(x, y, i, j) ? 1 : 0;
  }
  return m;
}
export function setUniform(m, dir) {
  const n = Math.hypot(...dir) || 1;
  for (let k = 0; k < m.length; k += 4) { m[k] = dir[0] / n; m[k + 1] = dir[1] / n; m[k + 2] = dir[2] / n; }
  return m;
}
export function setVortex(m, Nx, Ny, dx, dy, c = 1, p = 1, core = 10e-9) {
  for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) {
    const x = (i + 0.5 - Nx / 2) * dx, y = (j + 0.5 - Ny / 2) * dy, r = Math.hypot(x, y), k = 4 * (j * Nx + i);
    const mz = p * Math.exp(-(r * r) / (core * core));
    const s = Math.sqrt(Math.max(0, 1 - mz * mz));
    m[k] = r > 0 ? -c * y / r * s : 0; m[k + 1] = r > 0 ? c * x / r * s : 0; m[k + 2] = r > 0 ? mz : p;
  }
  return m;
}
export function setRandom(m, seed = 1) {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let k = 0; k < m.length; k += 4) { const v = [rnd(), rnd(), rnd()], n = Math.hypot(...v) || 1; m[k] = v[0] / n; m[k + 1] = v[1] / n; m[k + 2] = v[2] / n; }
  return m;
}
export function matFromLab(over = {}) {
  const s = lab.sample;
  return { Ms: s.Ms, A: s.A, alpha: s.alpha, gamma: s.gamma, Ku: s.Ku || 0, phiU: s.phiU || 0, Kp: s.Kp || 0, ...over };
}
const exLen = (m) => Math.sqrt(2 * m.A / (MU0 * m.Ms * m.Ms));

// Field of a strip line (width w, centre x0, height s above the film) per unit peak field,
// or a coplanar waveguide (signal w, gaps g, grounds wg). Returns Float32Array RGBA (bx, 0, bz).
export function antennaProfile(Nx, Ny, dx, dy, { x0, w, s, type = 'strip', g = 0, wg = 0, rot = false }) {
  const out = new Float32Array(Nx * Ny * 4);
  const strip = (x, xc, ww, I) => {
    const a = xc - ww / 2, b = xc + ww / 2;
    const bx = -I / ww * (Math.atan((x - a) / s) - Math.atan((x - b) / s));
    const bz = I / (2 * ww) * Math.log(((x - b) ** 2 + s * s) / ((x - a) ** 2 + s * s));
    return [bx, bz];
  };
  let peak = 0;
  const vals = [];
  const N = rot ? Ny : Nx, d = rot ? dy : dx;
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5 - N / 2) * d;
    let [bx, bz] = strip(x, x0, w, 1);
    if (type === 'cpw') {
      const xg = w / 2 + g + wg / 2;
      for (const sg of [-1, 1]) { const [gx, gz] = strip(x, x0 + sg * xg, wg, -0.5); bx += gx; bz += gz; }
    }
    vals.push([bx, bz]); peak = Math.max(peak, Math.abs(bx), Math.abs(bz));
  }
  for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) {
    const v = vals[rot ? j : i], k = 4 * (j * Nx + i);
    if (rot) { out[k + 1] = v[0] / peak; out[k + 2] = v[1] / peak; } else { out[k] = v[0] / peak; out[k + 2] = v[1] / peak; }
  }
  return out;
}

// ---------------------------------------------------------------- presets
export const PRESETS = [
  {
    id: 'waveguide', name: 'Spin waves from an antenna',
    blurb: 'A waveguide cut from the film on the bench, driven by a microwave antenna. Watch the waves leave the antenna and fade with damping.',
    options: { geometry: 'DE', f: null, B: 0.02, amp: 0.5e-3, antenna: 'strip' },
    build(o) {
      const mat = matFromLab();
      const yigLike = mat.Ms < 3e5;
      const d = lab.sample.d, dx = yigLike ? 80e-9 : Math.min(20e-9, Math.max(4e-9, 3 * exLen(mat)));
      const Nx = 256, Ny = 32;
      const along = o.geometry === 'DE' ? [0, 1, 0] : [1, 0, 0];
      const B = along.map((v) => v * o.B);
      const m = setUniform(fillMask(blank(Nx, Ny), Nx, Ny, dx, dx, () => true), along);
      const w = 2 * dx, x0 = -Nx * dx * 0.3;
      const ant = antennaProfile(Nx, Ny, dx, dx, { x0, w, s: Math.max(d / 2 + dx / 2, 50e-9), type: 'strip' });
      let f = o.f;
      if (!f) { const p = { ...mat, d, B: o.B, inPlane: true, phi: o.geometry === 'DE' ? 90 : 0 }; f = disp.curves(p, [2 * Math.PI / (Nx * dx / 9)]).f[0]; }
      return {
        name: this.name, grid: { Nx, Ny, dx, dy: dx, dz: d }, mat, m, B, edges: { left: 26, right: 26 }, antenna: ant,
        rf: { on: true, kind: 'cw', f, amp: o.amp, ramp: 1e-9 }, view: { mode: 4, gain: 40 },
        relaxFirst: true, antennaX: x0, antennaW: w, info: { f, geometry: o.geometry },
      };
    },
  },
  {
    id: 'vortex', name: 'Vortex in a disk',
    blurb: 'A permalloy disk 500 nm across relaxes into a vortex. Give it a short field pulse and the core circles at the gyrotropic frequency.',
    options: { diameter: 500e-9, thickness: 30e-9, c: 1, p: 1 },
    build(o) {
      const mat = { Ms: 800e3, A: 13e-12, alpha: 0.01, gamma: 29.5e9, Ku: 0, phiU: 0, Kp: 0 };
      const N = 64, dx = o.diameter / N, R = o.diameter / 2;
      const m = fillMask(blank(N, N), N, N, dx, dx, (x, y) => x * x + y * y <= R * R);
      setVortex(m, N, N, dx, dx, o.c, o.p, 12e-9);
      const ant = new Float32Array(N * N * 4); for (let k = 0; k < ant.length; k += 4) ant[k] = 1;
      return { name: this.name, grid: { Nx: N, Ny: N, dx, dy: dx, dz: o.thickness }, mat, m, B: [0, 0, 0], antenna: ant,
        rf: { on: false, kind: 'pulse', amp: 4e-3, width: 80e-12 }, view: { mode: 0, gain: 1 }, relaxFirst: true };
    },
  },
  {
    id: 'wall', name: 'Domain wall in a strip',
    blurb: 'A head-to-head domain wall in a permalloy strip, 128 nm wide and 5 nm thick. Push it with a field along the strip; above the Walker field it slows down and wobbles.',
    options: { Bx: 0 },
    build(o) {
      const mat = { Ms: 800e3, A: 13e-12, alpha: 0.02, gamma: 29.5e9, Ku: 0, phiU: 0, Kp: 0 };
      const Nx = 256, Ny = 32, dx = 4e-9;
      const m = fillMask(blank(Nx, Ny), Nx, Ny, dx, dx, () => true);
      for (let j = 0; j < Ny; j++) for (let i = 0; i < Nx; i++) {
        const x = (i + 0.5 - Nx * 0.3) * dx, k = 4 * (j * Nx + i), u = x / 30e-9;
        m[k] = -Math.tanh(u); m[k + 1] = 1 / Math.cosh(u); m[k + 2] = 0;
      }
      return { name: this.name, grid: { Nx, Ny, dx, dy: dx, dz: 5e-9 }, mat, m, B: [o.Bx, 0, 0], view: { mode: 0, gain: 1 }, relaxFirst: true, wall: true };
    },
  },
  {
    id: 'filmfmr', name: 'Film FMR',
    blurb: 'An infinite film (periodic boundaries) made of the film on the bench. Tip the magnetization, let it ring, and compare the spectrum with the Kittel formula.',
    options: { B: 0.1, thetaH: 90 },
    build(o) {
      const mat = matFromLab();
      const N = 4, dx = 50e-9, dir = fmr.dirFromAngles(o.thetaH, 0);
      const B = dir.map((v) => v * o.B);
      const eq = fmr.equilibrium({ ...lab.sample }, B);
      const m = fillMask(blank(N, N), N, N, dx, dx, () => true);
      // tip by 2 degrees away from equilibrium
      const t = [eq[1] * 0 - eq[2] * 1, eq[2] * 0 - eq[0] * 0, eq[0] * 1 - eq[1] * 0], tn = Math.hypot(...t) || 1;
      const tip = t.map((v) => v / tn), a = 2 * Math.PI / 180;
      setUniform(m, [eq[0] * Math.cos(a) + tip[0] * Math.sin(a) + (tn < 1e-6 ? Math.sin(a) : 0), eq[1] * Math.cos(a) + tip[1] * Math.sin(a), eq[2] * Math.cos(a) + tip[2] * Math.sin(a)]);
      const r = fmr.resonance({ ...lab.sample }, B, eq);
      return { name: this.name, grid: { Nx: N, Ny: N, dx, dy: dx, dz: lab.sample.d, pbc: [120, 120] }, mat, m, B, view: { mode: 0, gain: 1 }, info: { fTheory: r.f, eq }, spectrum: true };
    },
  },
  {
    id: 'dispersion', name: 'Dispersion from a simulation',
    blurb: 'A line of cells that stands for an infinite film. A short pulse at the center launches waves of every wavelength; a 2D Fourier transform of m_z(x, t) gives the dispersion, next to the Kalinikos–Slavin curve.',
    options: { geometry: 'DE', B: 0.02 },
    build(o) {
      const mat = matFromLab();
      const yigLike = mat.Ms < 3e5, d = lab.sample.d;
      const dx = yigLike ? 20e-9 : Math.min(12e-9, Math.max(3e-9, 2 * exLen(mat)));
      const Nx = 512;
      const along = o.geometry === 'DE' ? [0, 1, 0] : o.geometry === 'BV' ? [1, 0, 0] : [0, 0, 1];
      const B = along.map((v) => v * o.B);
      const m = setUniform(fillMask(blank(Nx, 1), Nx, 1, dx, dx, () => true), along);
      const ant = new Float32Array(Nx * 4);
      for (const i of [Nx / 2 - 1, Nx / 2]) ant[4 * i + (o.geometry === 'FV' ? 0 : 2)] = 1;
      const p = { ...mat, d, B: o.B, inPlane: o.geometry !== 'FV', phi: o.geometry === 'DE' ? 90 : 0 };
      const kTop = 0.75 / dx;     // beyond k·dx ≈ 0.6 the grid itself starts to bend the dispersion
      const fTop = Math.min(80e9, 1.2 * Math.max(...disp.curves(p, [kTop, -kTop]).f.filter(Number.isFinite), 1e9));
      return { name: this.name, grid: { Nx, Ny: 1, dx, dy: dx, dz: d, pbc: [2, 400] }, mat, m, B, antenna: ant,
        rf: { on: true, kind: 'sinc', amp: 1e-3, fmax: fTop, t0: 0 }, view: { mode: 4, gain: 200 }, dispersion: { p, fTop, kShow: 0.6 / dx } };
    },
  },
  {
    id: 'draw', name: 'Draw your own',
    blurb: 'Draw a shape with the mouse or a finger, place an antenna, set a field and run. The film on the bench sets the material.',
    options: {},
    build() {
      const mat = matFromLab();
      const yigLike = mat.Ms < 3e5;
      const Nx = 256, Ny = 128, dx = yigLike ? 40e-9 : Math.min(10e-9, Math.max(3e-9, 2.5 * exLen(mat)));
      const m = setUniform(fillMask(blank(Nx, Ny), Nx, Ny, dx, dx, (x, y) => Math.abs(y) < Ny * dx * 0.18), [1, 0, 0]);
      const ant = antennaProfile(Nx, Ny, dx, dx, { x0: -Nx * dx * 0.3, w: 3 * dx, s: Math.max(lab.sample.d / 2 + dx / 2, 30e-9) });
      return { name: this.name, grid: { Nx, Ny, dx, dy: dx, dz: lab.sample.d }, mat, m, B: [0.05, 0, 0], antenna: ant,
        rf: { on: false, kind: 'cw', f: 5e9, amp: 1e-3, ramp: 0.5e-9 }, view: { mode: 0, gain: 30 }, draw: true, antennaX: -Nx * dx * 0.3 };
    },
  },
];
