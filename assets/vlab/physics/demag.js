// Demagnetizing tensor for a single layer of rectangular cells (dx × dy × dz), as in mumax3/OOMMF:
// Newell, Williams & Dunlop (1993) for nearby cells, the point-dipole limit further away.
// The kernel is zero-padded to (2Nx × 2Ny) and Fourier transformed so the field
// H = −N * M can be evaluated with FFTs without periodic images.

import { fft2 } from './fft.js';

function asinhSafe(num, den) {   // asinh(num/den) with den ≥ 0, returns 0 when num = 0
  if (num === 0) return 0;
  if (den === 0) return Math.sign(num) * 40;   // only reached when its prefactor is 0
  return Math.asinh(num / den);
}
function atanSafe(num, den) {
  if (num === 0) return 0;
  if (den === 0) return Math.sign(num) * Math.PI / 2;
  return Math.atan(num / den);
}

export function newellF(x, y, z) {
  x = Math.abs(x); y = Math.abs(y); z = Math.abs(z);
  const x2 = x * x, y2 = y * y, z2 = z * z, R = Math.sqrt(x2 + y2 + z2);
  if (R === 0) return 0;
  let f = 0;
  if (y > 0 && (z2 - x2) !== 0) f += (y / 2) * (z2 - x2) * asinhSafe(y, Math.sqrt(x2 + z2));
  if (z > 0 && (y2 - x2) !== 0) f += (z / 2) * (y2 - x2) * asinhSafe(z, Math.sqrt(x2 + y2));
  if (x > 0 && y > 0 && z > 0) f -= x * y * z * atanSafe(y * z, x * R);
  f += (1 / 6) * (2 * x2 - y2 - z2) * R;
  return f;
}

export function newellG(x, y, z) {
  const sgn = Math.sign(x) * Math.sign(y);
  x = Math.abs(x); y = Math.abs(y); z = Math.abs(z);
  if (sgn === 0) return 0;
  const x2 = x * x, y2 = y * y, z2 = z * z, R = Math.sqrt(x2 + y2 + z2);
  let g = 0;
  if (z > 0) g += x * y * z * asinhSafe(z, Math.sqrt(x2 + y2));
  g += (y / 6) * (3 * z2 - y2) * asinhSafe(x, Math.sqrt(y2 + z2));
  g += (x / 6) * (3 * z2 - x2) * asinhSafe(y, Math.sqrt(x2 + z2));
  if (z > 0) g -= (z2 * z / 6) * atanSafe(x * y, z * R);
  if (z > 0 && y > 0) g -= (z * y2 / 2) * atanSafe(x * z, y * R);
  if (z > 0 && x > 0) g -= (z * x2 / 2) * atanSafe(y * z, x * R);
  g -= x * y * R / 3;
  return sgn * g;
}

// −Δx Δy Δz F / (4π dx dy dz), the Newell combination
function newellSum(F, X, Y, Z, dx, dy, dz) {
  const c = [1, -2, 1], o = [-1, 0, 1];
  let s = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++)
    s += c[i] * c[j] * c[k] * F(X + o[i] * dx, Y + o[j] * dy, Z + o[k] * dz);
  return -s / (4 * Math.PI * dx * dy * dz);
}

// Demag tensor between two cells displaced by (X, Y, 0): returns [Nxx, Nyy, Nzz, Nxy]
export function cellTensor(X, Y, dx, dy, dz, near = true) {
  if (near) {
    return [
      newellSum(newellF, X, Y, 0, dx, dy, dz),
      newellSum((a, b, c) => newellF(b, a, c), X, Y, 0, dx, dy, dz),
      newellSum((a, b, c) => newellF(c, b, a), X, Y, 0, dx, dy, dz),
      newellSum(newellG, X, Y, 0, dx, dy, dz),
    ];
  }
  const r2 = X * X + Y * Y, r = Math.sqrt(r2), V = dx * dy * dz;
  const pre = V / (4 * Math.PI * r2 * r);
  return [pre * (1 - 3 * X * X / r2), pre * (1 - 3 * Y * Y / r2), pre, -3 * pre * X * Y / r2];
}

// Fourier-space kernel for an Nx × Ny grid (powers of two).
// Open boundaries: zero padding to 2Nx × 2Ny. Periodic boundaries (pbc = [Rx, Ry], number of
// images on each side, 0 = open): no padding along that axis, and the kernel collects every
// displacement up to Rx·Nx + Nx/2 cells, as mumax3 does with SetPBC.
// Cells closer than max(nearCells·max(dx, dy), 12·dz) use Newell's formulas, the rest the dipole limit.
// Returns Float32Array RGBA texels (Kxx, Kyy, Kzz, Kxy), row-major, real parts only
// (the kernel is even/odd symmetric so its transform is real).
export function demagKernelFFT(Nx, Ny, dx, dy, dz, nearCells = 48, pbc = [0, 0]) {
  const [Rx, Ry] = pbc;
  const px = Rx ? Nx : 2 * Nx, py = Ry ? Ny : 2 * Ny, n = px * py;
  const Lx = Rx ? Rx * Nx + Math.floor(Nx / 2) : Nx - 1;
  const Ly = Ry ? Ry * Ny + Math.floor(Ny / 2) : Ny - 1;
  const rNear = Math.max(nearCells * Math.max(dx, dy), 12 * dz);
  const comps = [0, 1, 2, 3].map(() => ({ re: new Float64Array(n), im: new Float64Array(n) }));
  for (let j = 0; j <= Ly; j++) {
    const Y = j * dy;
    for (let i = 0; i <= Lx; i++) {
      const X = i * dx;
      const near = Math.hypot(X, Y) <= rNear;
      const T = cellTensor(X, Y, dx, dy, dz, near);
      for (const sx of (i === 0 ? [1] : [1, -1])) {
        for (const sy of (j === 0 ? [1] : [1, -1])) {
          const ix = (((sx * i) % px) + px) % px, iy = (((sy * j) % py) + py) % py, idx = iy * px + ix;
          comps[0].re[idx] += T[0];
          comps[1].re[idx] += T[1];
          comps[2].re[idx] += T[2];
          comps[3].re[idx] += T[3] * sx * sy;
        }
      }
    }
  }
  for (const c of comps) fft2(c.re, c.im, px, py, false);
  const out = new Float32Array(n * 4);
  for (let idx = 0; idx < n; idx++) {
    out[4 * idx] = comps[0].re[idx];
    out[4 * idx + 1] = comps[1].re[idx];
    out[4 * idx + 2] = comps[2].re[idx];
    out[4 * idx + 3] = comps[3].re[idx];
  }
  return { px, py, data: out };
}

// Real-space field of a magnetization pattern by direct summation (for tests and small grids):
// m is Float32Array RGBA (mx, my, mz, mask); returns H/Ms as Float64Array (hx, hy, hz) per cell.
export function demagDirect(m, Nx, Ny, dx, dy, dz, pbc = [0, 0], nearCells = 48) {
  const [Rx, Ry] = pbc;
  const Lx = Rx ? Rx * Nx + Math.floor(Nx / 2) : Nx - 1;
  const Ly = Ry ? Ry * Ny + Math.floor(Ny / 2) : Ny - 1;
  const rNear = Math.max(nearCells * Math.max(dx, dy), 12 * dz);
  const out = new Float64Array(Nx * Ny * 3);
  const cache = new Map();
  const T = (i, j) => {
    const key = i * 100003 + j;
    let t = cache.get(key);
    if (!t) { t = cellTensor(i * dx, j * dy, dx, dy, dz, Math.hypot(i * dx, j * dy) <= rNear); cache.set(key, t); }
    return t;
  };
  for (let ty = 0; ty < Ny; ty++) for (let tx = 0; tx < Nx; tx++) {
    let hx = 0, hy = 0, hz = 0;
    for (let sy = 0; sy < Ny; sy++) for (let sx = 0; sx < Nx; sx++) {
      const s = 4 * (sy * Nx + sx); const w = m[s + 3]; if (!w) continue;
      const mx = m[s] * w, my = m[s + 1] * w, mz = m[s + 2] * w;
      const di0 = tx - sx, dj0 = ty - sy;
      const iList = Rx ? [] : [di0], jList = Ry ? [] : [dj0];
      if (Rx) for (let k = -2 * Rx - 2; k <= 2 * Rx + 2; k++) { const d = di0 + k * Nx; if (Math.abs(d) <= Lx) iList.push(d); }
      if (Ry) for (let k = -2 * Ry - 2; k <= 2 * Ry + 2; k++) { const d = dj0 + k * Ny; if (Math.abs(d) <= Ly) jList.push(d); }
      for (const di of iList) for (const dj of jList) {
        const t = T(Math.abs(di), Math.abs(dj)), sxy = Math.sign(di || 1) * Math.sign(dj || 1);
        const nxy = (di === 0 || dj === 0) ? 0 : t[3] * sxy;
        hx -= t[0] * mx + nxy * my; hy -= nxy * mx + t[1] * my; hz -= t[2] * mz;
      }
    }
    const o = 3 * (ty * Nx + tx); out[o] = hx; out[o + 1] = hy; out[o + 2] = hz;
  }
  return out;
}
