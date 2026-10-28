// Brillouin light scattering and parametric magnon physics for the BLS station.
//
// Spin-wave modes come from the Kalinikos–Slavin dispersion (dispersion.js). For a mode with
// in-plane and out-of-plane stiffness a1, a2 (rad/s), ω = sqrt(a1 a2):
//   amplitude relaxation  Γ = α (a1 + a2) / 2
//   parallel-pumping coupling  V = γ (a2 − a1) / (4 ω)         (rad/s per tesla of pump field)
//   threshold  b_th = Γ / V
//   vacuum squeezing  r = ¼ ln(a2 / a1)
// The condensation model is a rate-equation picture: magnons injected at f_p/2 relax towards a
// Bose–Einstein distribution at the lattice temperature whose chemical potential follows the
// number of magnons, and decay back to the lattice. It is a teaching model, not a full kinetic theory.

import { MU0 } from './materials.js';
import * as disp from './dispersion.js';

const H = 6.62607015e-34, KB = 1.380649e-23, TWO_PI = 2 * Math.PI;

export function bose(f, T, mu = 0) { const x = H * (f - mu) / (KB * Math.max(T, 1e-6)); return x > 1e-12 ? 1 / Math.expm1(x) : 1e12; }

// stiffnesses of mode n at wavevector k (signed) for angle phi (deg) between k and M
function stiff(p, k, phi, n = 0) {
  const s = disp.setup({ ...p, phi });
  const ka = Math.abs(k), kn2 = ka * ka + (n ? (n * Math.PI / s.d) ** 2 : 0);
  // reuse omegaOf for ω; get a1 from the definition and a2 = ω²/a1
  const w = disp.omegaOf(s, k, n) - s.dmi * k * Math.sin(s.phi);
  const a1 = s.wH + s.wM * s.lam * kn2;
  return { w: w + s.dmi * k * Math.sin(s.phi), w0: w, a1, a2: w * w / a1, s };
}

// ---------------------------------------------------------------- thermal spectra
// opts: { lambda (m), theta (deg, angle of incidence), T, delta (optical penetration depth, m, Infinity
//         for transparent films), res (instrument FWHM, Hz), fmax (Hz), modes (number of thickness modes),
//         micro: bool, NA }
export function thermalSpectrum(p, o) {
  const N = 900, fmax = o.fmax, fs = new Float64Array(N), I = new Float64Array(N);
  for (let i = 0; i < N; i++) fs[i] = -fmax + 2 * fmax * i / (N - 1);
  const lines = [];   // {f, w (Lorentz HWHM), a}
  const surf = (k) => {   // weight of the top surface for DE waves (surface localisation over the optical depth)
    if (!Number.isFinite(o.delta)) return 1;
    const kd = Math.abs(k), a = 2 / o.delta, am = a - kd, ap = a + kd;
    const top = Math.abs(ap * p.d) < 1e-9 ? p.d : (1 - Math.exp(-ap * p.d)) / ap;
    const bot = Math.exp(-kd * p.d) * (Math.abs(am * p.d) < 1e-9 ? p.d : (1 - Math.exp(-am * p.d)) / am);
    return k > 0 ? top / (top + bot) * 2 : bot / (top + bot) * 2;
  };
  const addMode = (k, phi, n, weight) => {
    const st = stiff(p, k, phi, n); if (!(st.w > 0)) return;
    const f = st.w / TWO_PI, G = p.alpha * (st.a1 + st.a2) / 2 / TWO_PI;
    const nb = bose(f, o.T);
    const de = Math.abs(Math.sin(phi * Math.PI / 180)) > 0.5 && p.inPlane;
    const sw = de ? surf(k) : 1;
    // Stokes creates a magnon of wavevector +q at −f(+q); anti-Stokes absorbs −q at +f(−q)
    if (k >= 0) lines.push({ f: -f, w: G, a: weight * (nb + 1) * sw, n });
    else lines.push({ f: f, w: G, a: weight * nb * sw, n });
  };
  if (!o.micro) {
    const q = 4 * Math.PI / o.lambda * Math.sin(o.theta * Math.PI / 180);
    for (let n = 0; n <= (o.modes || 0); n++) { addMode(q, p.phi, n, n ? 0.25 : 1); addMode(-q, p.phi, n, n ? 0.25 : 1); }
  } else {
    const kmax = 4 * Math.PI / o.lambda * (o.NA || 0.75), nk = 60, nphi = 24;
    for (let n = 0; n <= (o.modes || 0); n++) for (let i = 1; i <= nk; i++) {
      const k = kmax * i / nk;
      for (let j = 0; j < nphi; j++) {
        const phi = (j + 0.5) / nphi * 90, wgt = k * (n ? 0.25 : 1) / nk / nphi;
        addMode(k, phi, n, wgt); addMode(-k, phi, n, wgt);
      }
    }
  }
  const sig = (o.res || 0.15e9) / 2.355;
  for (const L of lines) {
    const w = Math.hypot(L.w, sig);    // Lorentzian of the magnon convolved roughly with the instrument
    for (let i = 0; i < N; i++) { const x = (fs[i] - L.f) / w; I[i] += L.a / (1 + x * x); }
  }
  let m = 0; for (const v of I) m = Math.max(m, v);
  for (let i = 0; i < N; i++) I[i] /= m || 1;
  // the strongest Stokes and anti-Stokes lines of mode 0
  const st = lines.filter((l) => l.n === 0 && l.f < 0).sort((a, b) => b.a - a.a)[0];
  const as = lines.filter((l) => l.n === 0 && l.f > 0).sort((a, b) => b.a - a.a)[0];
  return { f: fs, I, stokes: st ? -st.f : NaN, anti: as ? as.f : NaN, ratio: st && as ? st.a / as.a : NaN };
}

// ---------------------------------------------------------------- parallel pumping
// Lowest threshold over all modes with f(k) = fp/2, at field B. Returns {bth (T), k, phi} or null.
export function pumpThreshold(p, fp, B) {
  const target = TWO_PI * fp / 2;
  let best = null;
  for (let j = 0; j <= 30; j++) {
    const phi = 90 * j / 30;
    const pp = { ...p, B, phi };
    // find k where ω = target by scanning and bisection
    let kPrev = 1e3, wPrev = stiff(pp, kPrev, phi).w;
    for (let i = 1; i <= 160; i++) {
      const k = 1e3 * Math.pow(1e5, i / 160), w = stiff(pp, k, phi).w;
      if (Number.isFinite(w) && Number.isFinite(wPrev) && (w - target) * (wPrev - target) <= 0) {
        let a = kPrev, b = k;
        for (let it = 0; it < 40; it++) { const c = Math.sqrt(a * b), wc = stiff(pp, c, phi).w; if ((wc - target) * (wPrev - target) <= 0) b = c; else a = c; }
        const kk = Math.sqrt(a * b), st = stiff(pp, kk, phi);
        const G = p.alpha * (st.a1 + st.a2) / 2, V = TWO_PI * p.gamma * Math.abs(st.a2 - st.a1) / (4 * st.w0);
        const bth = V > 0 ? G / V : Infinity;
        if (!best || bth < best.bth) best = { bth, k: kk, phi };
      }
      kPrev = k; wPrev = w;
    }
    // also the uniform mode limit k -> 0 at this angle
  }
  return best;
}

export function butterfly(p, fp, Bmax, n = 80) {
  const Bs = [], th = [], ks = [];
  for (let i = 1; i <= n; i++) {
    const B = Bmax * i / n, r = pumpThreshold(p, fp, B);
    Bs.push(B); th.push(r ? r.bth : NaN); ks.push(r ? r.k : NaN);
  }
  return { Bs, th, ks };
}

// ---------------------------------------------------------------- condensation (teaching model)
// Returns frames of the magnon distribution g(f) n(f) over time after the pump is switched on.
export function becModel(p, o) {
  const { fp, pump, T = 300, tauTh = 60e-9, tauSL = 300e-9, tmax = 800e-9, nf = 140 } = o;
  // density of states from an in-plane k grid, n = 0 and a few thickness modes
  const kmax = 40e6, nk = 120, nphi = 30, modes = o.modes ?? 3;
  const fl = [];
  for (let n = 0; n <= modes; n++) for (let i = 1; i <= nk; i++) for (let j = 0; j < nphi; j++) {
    const k = kmax * Math.pow(i / nk, 1.6), phi = (j + 0.5) / nphi * 90, st = stiff({ ...p, phi }, k, phi, n);
    if (st.w > 0) fl.push({ f: st.w / TWO_PI, wgt: k * k * 1.6 / i });
  }
  let fmin = Infinity; for (const s of fl) fmin = Math.min(fmin, s.f);
  const fTop = Math.max(fp / 2 * 1.15, fmin * 1.3), df = (fTop - fmin) / nf;
  const fb = new Float64Array(nf), g = new Float64Array(nf);
  for (let i = 0; i < nf; i++) fb[i] = fmin + (i + 0.5) * df;
  for (const s of fl) { const i = Math.floor((s.f - fmin) / df); if (i >= 0 && i < nf) g[i] += s.wgt; }
  // smooth and normalise the DOS
  let gs = 0; for (let i = 0; i < nf; i++) gs += g[i]; for (let i = 0; i < nf; i++) g[i] = Math.max(g[i] / gs * nf, 1e-4);
  const ip = Math.min(nf - 1, Math.max(0, Math.floor((fp / 2 - fmin) / df)));
  const nth = Array.from(fb, (f) => bose(f, T));
  const Nth = nth.reduce((s, v, i) => s + g[i] * v, 0);
  const Nof = (mu) => { let s = 0; for (let i = 0; i < nf; i++) s += g[i] * bose(fb[i], T, mu); return s; };
  const muMax = fmin - df * 0.02, Ncrit = Nof(muMax);
  const solveMu = (N) => { if (N >= Ncrit) return muMax; let a = fmin - 50 * (fTop - fmin) - 1e10, b = muMax; for (let it = 0; it < 60; it++) { const c = (a + b) / 2; if (Nof(c) < N) a = c; else b = c; } return (a + b) / 2; };
  // pump: injection rate above threshold, a fraction of Nth per tauTh, saturating
  const n = nth.slice(); let cond = 0;
  const dt = Math.min(tauTh, tauSL) / 40, steps = Math.ceil(tmax / dt), every = Math.max(1, Math.floor(steps / 160));
  const frames = [], times = [], mus = [], conds = [];
  const inj = pump > 1 ? (pump - 1) * Nth * 2.2 / tauSL : 0;
  for (let s = 0; s <= steps; s++) {
    const t = s * dt;
    let N = cond; for (let i = 0; i < nf; i++) N += g[i] * n[i];
    const mu = solveMu(N - cond);
    // excess above the critical number condenses at the bottom of the band
    const target = Array.from(fb, (f) => bose(f, T, mu));
    let Nt = 0; for (let i = 0; i < nf; i++) Nt += g[i] * target[i];
    const excess = Math.max(0, N - Nt);
    for (let i = 0; i < nf; i++) {
      const src = i === ip ? inj / g[i] : 0;
      n[i] += dt * (src + (target[i] - n[i]) / tauTh - (n[i] - nth[i]) / tauSL);
    }
    cond += dt * ((excess - cond) / tauTh - cond / tauSL);
    if (s % every === 0) {
      frames.push(Array.from(n, (v, i) => g[i] * Math.max(v - nth[i], 0) + (i === 0 ? cond : 0)));
      times.push(t); mus.push(mu); conds.push(cond / Math.max(N - Nth, 1e-30));
    }
  }
  return { fb, frames, times, mus, conds, fmin, fpHalf: fp / 2, Ncrit: Ncrit - Nth, Nth };
}

// ---------------------------------------------------------------- squeezing
export function squeezing(a1, a2, f, T) {
  const r = 0.25 * Math.log(a2 / a1);
  const nth = bose(f, T);
  return { r, dB: 20 * r / Math.LN10, nth, V1: (2 * nth + 1) * Math.exp(2 * r) / 2, V2: (2 * nth + 1) * Math.exp(-2 * r) / 2 };
}
export function modeStiffness(p, k, phi = 90, n = 0) { return stiff(p, k, phi, n); }
export { MU0 };
