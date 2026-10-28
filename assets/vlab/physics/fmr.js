// Ferromagnetic resonance of a thin film (macrospin), Smit–Beljers in matrix form.
//
// Free energy density  F(m) = m·K·m − Ms B·m   (J/m^3), B = mu0 H in tesla, |m| = 1,
// with K = (mu0 Ms^2 / 2) zz  (film shape, normal along z)  − Kp zz  − Ku uu.
// Effective field B_eff = −(1/Ms) dF/dm = B − (2/Ms) K m.
// Linearising Landau–Lifshitz around the equilibrium m0 in a right-handed basis (e1, e2, m0)
// gives the stiffness matrix S_ij = B0 δ_ij + (2/Ms) e_i·K·e_j with B0 = B_eff(m0)·m0, and
//   ω = γ sqrt(det S),   Gilbert decay rate Γ = α γ (S11 + S22)/2.
// For an in-plane field this reduces to Kittel, ω = γ sqrt(B (B + mu0 Ms)).

import { MU0 } from './materials.js';

const TWO_PI = 2 * Math.PI;

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }
function matVec(K, v) { return [K[0] * v[0] + K[1] * v[1] + K[2] * v[2], K[3] * v[0] + K[4] * v[1] + K[5] * v[2], K[6] * v[0] + K[7] * v[1] + K[8] * v[2]]; }

// Unit vector from polar angle theta (from the film normal z) and azimuth phi (deg)
export function dirFromAngles(thetaDeg, phiDeg) {
  const t = thetaDeg * Math.PI / 180, p = phiDeg * Math.PI / 180;
  return [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
}

export function anisotropyMatrix(mat) {
  const K = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  K[8] += 0.5 * MU0 * mat.Ms * mat.Ms - (mat.Kp || 0);
  if (mat.Ku) {
    const p = (mat.phiU || 0) * Math.PI / 180, u = [Math.cos(p), Math.sin(p), 0];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) K[3 * i + j] -= mat.Ku * u[i] * u[j];
  }
  return K;
}

function energy(mat, K, B, m) { return dot(m, matVec(K, m)) - mat.Ms * dot(B, m); }

function beff(mat, K, B, m) {
  const Km = matVec(K, m), s = 2 / mat.Ms;
  return [B[0] - s * Km[0], B[1] - s * Km[1], B[2] - s * Km[2]];
}

// Relax m to a local energy minimum (projected gradient flow on the unit sphere)
function relax(mat, K, B, m0) {
  let m = norm(m0);
  const scale = Math.hypot(B[0], B[1], B[2]) + 2 * (Math.abs(K[0]) + Math.abs(K[4]) + Math.abs(K[8])) / mat.Ms + 1e-6;
  const eta = 0.6 / scale;
  for (let it = 0; it < 4000; it++) {
    const b = beff(mat, K, B, m), bm = dot(b, m);
    const t = [b[0] - bm * m[0], b[1] - bm * m[1], b[2] - bm * m[2]];
    const tn = Math.hypot(t[0], t[1], t[2]);
    m = norm([m[0] + eta * t[0], m[1] + eta * t[1], m[2] + eta * t[2]]);
    if (tn < 1e-9 * scale) break;
  }
  return m;
}

// Equilibrium magnetization. With `prev` it follows that branch (like a real field sweep);
// otherwise it returns the lowest-energy state among several starting points.
export function equilibrium(mat, B, prev) {
  const K = anisotropyMatrix(mat);
  if (prev) return relax(mat, K, B, prev);
  const starts = [B, [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  if (mat.Ku) { const p = (mat.phiU || 0) * Math.PI / 180; starts.push([Math.cos(p), Math.sin(p), 0], [-Math.cos(p), -Math.sin(p), 0]); }
  let best = null, bestE = Infinity;
  for (const s of starts) {
    if (Math.hypot(s[0], s[1], s[2]) < 1e-12) continue;
    const m = relax(mat, K, B, s), e = energy(mat, K, B, m);
    if (e < bestE - 1e-12) { bestE = e; best = m; }
  }
  return best || [0, 0, 1];
}

// Resonance at field vector B (T). Returns frequency (Hz), half width (Hz), equilibrium m,
// the stiffness matrix and the precession ellipse in the plane perpendicular to m.
export function resonance(mat, B, prev) {
  const K = anisotropyMatrix(mat);
  const m = equilibrium(mat, B, prev);
  let e1 = cross([0, 0, 1], m);
  if (Math.hypot(e1[0], e1[1], e1[2]) < 1e-6) e1 = cross([0, 1, 0], m);
  e1 = norm(e1);
  const e2 = cross(m, e1);
  const b = beff(mat, K, B, m), B0 = dot(b, m), s = 2 / mat.Ms;
  const k11 = s * dot(e1, matVec(K, e1)), k22 = s * dot(e2, matVec(K, e2)), k12 = s * dot(e1, matVec(K, e2));
  const S11 = B0 + k11, S22 = B0 + k22, S12 = k12;
  const det = S11 * S22 - S12 * S12;
  const gam = TWO_PI * mat.gamma;
  const omega = det > 0 ? gam * Math.sqrt(det) : 0;
  const Gamma = mat.alpha * gam * (S11 + S22) / 2;
  // principal axes of S: the precession ellipse has semi-axes ratio sqrt(lambda_small / lambda_large)
  const tr = S11 + S22, dif = Math.sqrt(Math.max(0, (S11 - S22) * (S11 - S22) / 4 + S12 * S12));
  const l1 = tr / 2 + dif, l2 = tr / 2 - dif;
  const ang = 0.5 * Math.atan2(2 * S12, S11 - S22);          // direction of l1 in the (e1, e2) plane
  const ellipse = { axisAngle: ang, ratio: l2 > 0 && l1 > 0 ? Math.sqrt(l2 / l1) : 0 };
  return { f: omega / TWO_PI, hwhm: Gamma / TWO_PI, m, e1, e2, S: [S11, S12, S22], B0, stable: det > 0 && B0 + Math.min(k11, k22) > -1e-9, ellipse };
}

// Field sweep along a fixed direction, from high to low field (a sweep starts saturated).
// Bs must be ascending; the result arrays follow the same order.
export function sweep(mat, dir, Bs) {
  const n = Bs.length, out = new Array(n);
  let prev = null;
  for (let i = n - 1; i >= 0; i--) {
    const B = [dir[0] * Bs[i], dir[1] * Bs[i], dir[2] * Bs[i]];
    const r = resonance(mat, B, prev || (Bs[i] > 0 ? dir : null));
    prev = r.m;
    out[i] = r;
  }
  // inhomogeneous broadening: |df/dB| * dB0
  for (let i = 0; i < n; i++) {
    const a = out[Math.max(0, i - 1)], c = out[Math.min(n - 1, i + 1)];
    const dB = Bs[Math.min(n - 1, i + 1)] - Bs[Math.max(0, i - 1)];
    const slope = dB > 0 ? Math.abs((c.f - a.f) / dB) : 0;
    out[i].hwhmTotal = out[i].hwhm + slope * (mat.dB0 || 0);
  }
  return out;
}

// Normalised absorption (peak 1) of a resonance with centre f0 and half width w at frequency f
export function lorentz(f, f0, w) { const x = (f - f0) / w; return 1 / (1 + x * x); }

// Absorption map A[j][i] for fields Bs[i] and frequencies fs[j]
export function absorptionMap(mat, dir, Bs, fs) {
  const res = sweep(mat, dir, Bs);
  const map = new Float32Array(Bs.length * fs.length);
  for (let i = 0; i < Bs.length; i++) {
    const r = res[i]; if (!(r.f > 0)) continue;
    const w = Math.max(r.hwhmTotal, 1e6);
    for (let j = 0; j < fs.length; j++) map[j * Bs.length + i] = lorentz(fs[j], r.f, w);
  }
  return { map, res };
}

// Resonance field at frequency f (Hz) for a field along dir: sweep down from Bmax and
// bisect the first crossing f_res(B) = f. Returns NaN when there is none.
export function resonanceField(mat, dir, f, Bmax = 3, steps = 240) {
  let prev = dir, Bhi = Bmax, rhi = resonance(mat, [dir[0] * Bhi, dir[1] * Bhi, dir[2] * Bhi], prev);
  prev = rhi.m;
  for (let k = 1; k <= steps; k++) {
    const Blo = Bmax * (1 - k / steps);
    const rlo = resonance(mat, [dir[0] * Blo, dir[1] * Blo, dir[2] * Blo], prev);
    if ((rhi.f - f) * (rlo.f - f) <= 0 && rlo.f > 0) {
      let a = Blo, b = Bhi, ma = rlo.m;
      for (let it = 0; it < 40; it++) {
        const c = (a + b) / 2, rc = resonance(mat, [dir[0] * c, dir[1] * c, dir[2] * c], ma);
        if ((rc.f - f) * (rlo.f - f) <= 0) { b = c; } else { a = c; ma = rc.m; }
      }
      return (a + b) / 2;
    }
    rhi = rlo; Bhi = Blo; prev = rlo.m;
  }
  return NaN;
}

// Kittel formulas, for reference and tests
export function kittelInPlane(mat, B) { return mat.gamma * Math.sqrt(Math.max(0, B * (B + MU0 * mat.Ms - 2 * (mat.Kp || 0) / mat.Ms))); }
export function kittelOutOfPlane(mat, B) { return mat.gamma * Math.max(0, B - MU0 * mat.Ms + 2 * (mat.Kp || 0) / mat.Ms); }
