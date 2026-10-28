// Spin-wave dispersion of a thin film: Kalinikos–Slavin (1986), unpinned surface spins,
// diagonal approximation, plus interfacial DMI, group velocity, lifetime and decay length.
//
//   ω_n² = (ω_H + ω_M λ k_n²) (ω_H + ω_M λ k_n² + ω_M F_nn)
//   F_nn = P_nn + sin²θ [1 − P_nn (1 + cos²φ) + ω_M P_nn (1 − P_nn) sin²φ / (ω_H + ω_M λ k_n²)]
//   P_nn = k²/k_n² − (k⁴/k_n⁴) (2/(kd)) (1 − (−1)^n e^{−kd}) / (1 + δ_0n),   k_n² = k² + (nπ/d)²
//
// θ is the magnetization angle from the film normal (90° = in plane), φ the angle between
// k and the in-plane magnetization, λ = 2A/(μ0 Ms²). Perpendicular anisotropy Kp lowers the
// out-of-plane stiffness by ω_K = γ 2Kp/Ms. Interfacial DMI adds (2γD/Ms) k sinφ.

import { MU0 } from './materials.js';

const TWO_PI = 2 * Math.PI;

// p: { Ms, A, gamma (Hz/T), alpha, d (m), B (T, applied), inPlane (bool), phi (deg), D (J/m^2), Kp, n }
export function setup(p) {
  const gam = TWO_PI * p.gamma;                     // rad/(s T)
  const wM = gam * MU0 * p.Ms;
  const Bint = p.inPlane ? p.B : p.B - MU0 * p.Ms + 2 * (p.Kp || 0) / p.Ms;
  return {
    gam, wM,
    wH: gam * Bint,
    wK: p.inPlane ? gam * 2 * (p.Kp || 0) / p.Ms : 0,
    lam: 2 * p.A / (MU0 * p.Ms * p.Ms),
    d: p.d,
    sinT2: p.inPlane ? 1 : 0,
    phi: (p.phi || 0) * Math.PI / 180,
    dmi: p.inPlane && p.D ? 2 * gam * p.D / p.Ms : 0,   // rad/s per (rad/m)
    alpha: p.alpha,
  };
}

function Pnn(k, n, d) {
  const ka = Math.abs(k);
  if (n === 0) {
    if (ka * d < 1e-6) return ka * d / 2;
    return 1 - (1 - Math.exp(-ka * d)) / (ka * d);
  }
  const kn2 = ka * ka + (n * Math.PI / d) ** 2;
  if (ka < 1e-3) return 0;
  const Fn = (2 / (ka * d)) * (1 - ((n % 2) ? -1 : 1) * Math.exp(-ka * d));
  return (ka * ka) / kn2 - (ka ** 4 / (kn2 * kn2)) * Fn;
}

// Angular frequency (rad/s) of thickness mode n at wavenumber k (rad/m, signed), or NaN if unstable
export function omegaOf(s, k, n = 0, wHoverride) {
  const wH = wHoverride === undefined ? s.wH : wHoverride;
  const ka = Math.abs(k);
  const kn2 = ka * ka + (n ? (n * Math.PI / s.d) ** 2 : 0);
  const P = Pnn(ka, n, s.d);
  const c = Math.cos(s.phi), sn = Math.sin(s.phi);
  const a1 = wH + s.wM * s.lam * kn2;
  const F = P + s.sinT2 * (1 - P * (1 + c * c) + (a1 > 0 ? s.wM * P * (1 - P) * sn * sn / a1 : 0));
  const a2 = a1 + s.wM * F - s.wK;
  const w2 = a1 * a2;
  if (!(w2 > 0)) return NaN;
  return Math.sqrt(w2) + s.dmi * k * sn;
}

// Precession ellipticity |m_out| / |m_in| for mode 0 (≈ sqrt(a1/a2))
export function ellipticity(s, k) {
  const ka = Math.abs(k), P = Pnn(ka, 0, s.d);
  const c = Math.cos(s.phi), sn = Math.sin(s.phi);
  const a1 = s.wH + s.wM * s.lam * ka * ka;
  const F = P + s.sinT2 * (1 - P * (1 + c * c) + (a1 > 0 ? s.wM * P * (1 - P) * sn * sn / a1 : 0));
  const a2 = a1 + s.wM * F - s.wK;
  return a1 > 0 && a2 > 0 ? Math.sqrt(a1 / a2) : NaN;
}

// Curves over a k grid (rad/m). Returns frequency (Hz), group velocity (m/s), lifetime (s)
// and decay length (m) for each k.
export function curves(p, ks, n = 0) {
  const s = setup(p);
  const N = ks.length;
  const f = new Float64Array(N), vg = new Float64Array(N), tau = new Float64Array(N), Ldec = new Float64Array(N);
  const dk = N > 1 ? Math.max(1e2, Math.abs(ks[N - 1] - ks[0]) / (N - 1) * 0.25) : 1e3;
  const dwH = Math.max(1e6, Math.abs(s.wH) * 1e-4);
  for (let i = 0; i < N; i++) {
    const k = ks[i], w = omegaOf(s, k, n);
    f[i] = w / TWO_PI;
    const wp = omegaOf(s, k + dk, n), wm = omegaOf(s, k - dk, n);
    vg[i] = (wp - wm) / (2 * dk);
    // lifetime τ = 1 / (α ω ∂ω/∂ω_H) (Stancil & Prabhakar)
    const dwdH = (omegaOf(s, k, n, s.wH + dwH) - omegaOf(s, k, n, s.wH - dwH)) / (2 * dwH);
    tau[i] = 1 / (p.alpha * w * Math.abs(dwdH));
    Ldec[i] = Math.abs(vg[i]) * tau[i];
  }
  return { f, vg, tau, Ldec };
}

export function linspace(a, b, n) { const out = new Float64Array(n); for (let i = 0; i < n; i++) out[i] = a + (b - a) * i / (n - 1); return out; }

// ---------------------------------------------------------------- antennas
// Fourier transform of the antenna current density (arbitrary units) and the resulting
// in-plane (hx) and out-of-plane (hz) field components at distance s below the antenna:
//   hx(k) = J(k) e^{-|k|s} / 2,   hz(k) = i sgn(k) J(k) e^{-|k|s} / 2
// ant: { type: 'strip' | 'cpw', w (signal width, m), g (gap, m), wg (ground width, m), s (spacing, m) }
function sinc(x) { return Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x; }
export function antennaJ(ant, k) {
  if (ant.type === 'cpw') {
    const xg = ant.w / 2 + ant.g + ant.wg / 2;
    return sinc(k * ant.w / 2) - Math.cos(k * xg) * sinc(k * ant.wg / 2);
  }
  return sinc(k * ant.w / 2);
}

// Excitation efficiency for waves leaving the antenna with wavevector +k and −k, for a mode
// whose precession has ellipticity e = |m_z| / |m_x| (Damon–Eshbach geometry, k ⟂ M).
// The rf field (hx, hz) couples to (m_x, m_z) ∝ (1, ±i e): one direction adds, the other cancels.
export function excitation(ant, k, e) {
  const J = antennaJ(ant, Math.abs(k)) * Math.exp(-Math.abs(k) * (ant.s || 0)) / 2;
  const plus = J * J * (1 + e) * (1 + e), minus = J * J * (1 - e) * (1 - e);
  return { plus, minus, ratio: minus > 0 ? plus / minus : Infinity };
}
