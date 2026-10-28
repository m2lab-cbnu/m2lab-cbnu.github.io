// Material presets for the virtual lab (SI units).
//   Ms     saturation magnetization (A/m)
//   A      exchange stiffness (J/m)
//   gamma  gyromagnetic ratio / 2π (Hz/T)
//   alpha  Gilbert damping
//   dB0    inhomogeneous FMR linewidth, half width (T)
//   Kp     perpendicular uniaxial anisotropy (J/m^3, > 0 favours the film normal)
//   Ku     in-plane uniaxial anisotropy (J/m^3) along the in-plane angle phiU (deg)
//   d      a typical film thickness (m)

export const MU0 = 4e-7 * Math.PI;

export const MATERIALS = {
  yig:   { key: 'yig',   name: 'YIG (yttrium iron garnet)', Ms: 140e3, A: 3.7e-12, gamma: 28.0e9, alpha: 2e-4,  dB0: 0.05e-3, Kp: 0, Ku: 0, phiU: 0, d: 100e-9 },
  py:    { key: 'py',    name: 'Permalloy (Ni80Fe20)',      Ms: 800e3, A: 13e-12,  gamma: 29.5e9, alpha: 0.008, dB0: 0.3e-3,  Kp: 0, Ku: 0, phiU: 0, d: 20e-9 },
  cofeb: { key: 'cofeb', name: 'CoFeB',                     Ms: 1.2e6, A: 15e-12,  gamma: 29.0e9, alpha: 0.004, dB0: 0.5e-3,  Kp: 0, Ku: 0, phiU: 0, d: 10e-9 },
  copt:  { key: 'copt',  name: 'Co/Pt (perpendicular)',     Ms: 1.1e6, A: 15e-12,  gamma: 29.0e9, alpha: 0.02,  dB0: 2e-3,    Kp: 1.1e6, Ku: 0, phiU: 0, d: 1e-9 },
};

export function material(key) {
  return { ...(MATERIALS[key] || MATERIALS.py) };
}

// Exchange length sqrt(2A / (mu0 Ms^2)) in metres
export function exchangeLength(m) {
  return Math.sqrt(2 * m.A / (MU0 * m.Ms * m.Ms));
}
