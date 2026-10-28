// FMR setup: the electromagnet on the optical table, the vector network analyser, signal generator,
// lock-in and magnet supply in the rack. Tools: field-swept line, f–H map with linewidth analysis,
// angle dependence, and a view of the precession.

import * as THREE from '../vendor/three.js';
import { el, slider, segmented, button, group, readout, canvasBox, note, fmtNum, checkbox } from '../ui/widgets.js';
import { Plot, screenPlot, COLORS } from '../ui/plot.js';
import { sampleEditor } from '../ui/sample.js';
import * as fmr from '../physics/fmr.js';
import { MU0 } from '../physics/materials.js';
import { lab } from '../state.js';
import * as T from '../world/textures.js';

const S = { thetaH: 90, phiH: 0, f: 10e9, signal: 'abs', zoom: 'res' };
const subs = new Set();
const changed = () => { for (const fn of subs) fn(); };
lab.onSample(() => changed());
let hw = null;

const dirH = () => fmr.dirFromAngles(S.thetaH, S.phiH);
const mu0Meff = (m) => MU0 * m.Ms - 2 * (m.Kp || 0) / m.Ms;
function bmaxFor(m, f) { return Math.max(0.3, f / m.gamma + Math.max(0, mu0Meff(m)) + 0.3); }
const mT = (B) => B * 1e3;

// Field-swept absorption at frequency f along dir
function fieldLine(m, dir, f, zoom) {
  const Bres = fmr.resonanceField(m, dir, f, bmaxFor(m, f), 300);
  if (!Number.isFinite(Bres)) return null;
  const B = dir.map((c) => c * Bres);
  const r = fmr.resonance(m, B, dir);
  const dB = Math.max(1e-7, Bres * 2e-5);
  const r2 = fmr.resonance(m, dir.map((c) => c * (Bres + dB)), r.m), r1 = fmr.resonance(m, dir.map((c) => c * Math.max(0, Bres - dB)), r.m);
  const slope = Math.abs((r2.f - r1.f) / (2 * dB)) || 1;
  const hwB = r.hwhm / slope + (m.dB0 || 0);
  let Bs;
  if (zoom === 'res') {
    const n = 500; Bs = new Float64Array(n);
    for (let i = 0; i < n; i++) Bs[i] = Math.max(0, Bres - 12 * hwB + 24 * hwB * i / (n - 1));
  } else {
    const top = Math.max(1.4 * Bres, 0.05), a = [];
    for (let i = 0; i <= 500; i++) a.push(top * i / 500);
    for (let i = 0; i <= 300; i++) a.push(Bres - 15 * hwB + 30 * hwB * i / 300);
    Bs = Float64Array.from(a.filter((b) => b >= 0 && b <= top).sort((x, y) => x - y));
  }
  const res = fmr.sweep(m, dir, Bs);
  const A = new Float64Array(Bs.length), dA = new Float64Array(Bs.length);
  for (let i = 0; i < Bs.length; i++) { const q = res[i]; A[i] = q.f > 0 ? fmr.lorentz(f, q.f, Math.max(q.hwhmTotal, 1)) : 0; }
  for (let i = 0; i < Bs.length; i++) {
    const a = Math.max(0, i - 1), b = Math.min(Bs.length - 1, i + 1);
    dA[i] = Bs[b] > Bs[a] ? (A[b] - A[a]) / (Bs[b] - Bs[a]) : 0;
  }
  // FWHM from the computed curve
  let ip = 0; for (let i = 1; i < A.length; i++) if (A[i] > A[ip]) ip = i;
  const half = A[ip] / 2; let lo = NaN, hi = NaN;
  for (let i = ip; i > 0; i--) if (A[i - 1] < half) { lo = Bs[i - 1] + (half - A[i - 1]) / (A[i] - A[i - 1]) * (Bs[i] - Bs[i - 1]); break; }
  for (let i = ip; i < A.length - 1; i++) if (A[i + 1] < half) { hi = Bs[i] + (A[i] - half) / (A[i] - A[i + 1]) * (Bs[i + 1] - Bs[i]); break; }
  return { Bres, r, slope, hwB, Bs, A, dA, fwhm: hi - lo };
}

function angleBetween(a, b) { return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI; }

// ------------------------------------------------------------------------------------- 3D
function build3D(w) {
  const { scene, M, K, spots } = w;
  const r = spots.rack, x0 = r.x - 0.3, x1 = r.x + 0.3, z0 = r.z - 0.3, z1 = r.z + 0.3;
  // rack frame
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) K.boxB(M.black, x - 0.02, 0, z - 0.02, x + 0.02, 2.0, z + 0.02);
  K.boxB(M.black, x0 - 0.02, 1.96, z0 - 0.02, x1 + 0.02, 2.02, z1 + 0.02);
  K.boxB(M.black, x0 - 0.02, 0.0, z0 - 0.02, x1 + 0.02, 0.06, z1 + 0.02);
  for (const y of [0.18, 0.5, 0.78, 1.04, 1.38, 1.64]) K.boxB(M.blackMatte, x0, y - 0.015, z0, x1, y, z1);
  w.addCollider(x0 - 0.03, z0 - 0.03, x1 + 0.03, z1 + 0.03);

  const fw = 0.46;  // front panel width (along z)
  const faces = [];
  const inst = (y0, h, depth, bodyMat, spec) => {
    K.boxB(bodyMat, x0 + 0.02, y0, r.z - fw / 2, x0 + 0.02 + depth, y0 + h, r.z + fw / 2);
    const cw = 1024, ch = Math.round(cw * h / fw);
    const c = T.panelCanvas({ w: cw, h: ch, ...spec(cw, ch) });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, h), w.faceMaterial(c));
    face.rotation.y = -Math.PI / 2; face.position.set(x0 + 0.015, y0 + h / 2, r.z); face.receiveShadow = true;
    scene.add(face); faces.push(face);
    return { y0, h, cw, ch };
  };
  // screen plane on an instrument face; rect in canvas pixels
  const screen = (info, rect, pw, ph) => {
    const c = T.canvas(pw, ph);
    const mat = w.screenMaterial(c);
    const wz = rect.w / info.cw * fw, hy = rect.h / info.ch * info.h;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wz, hy), mat);
    m.rotation.y = -Math.PI / 2;
    m.position.set(x0 + 0.012, info.y0 + info.h - (rect.y + rect.h / 2) / info.ch * info.h, r.z - fw / 2 + (rect.x + rect.w / 2) / info.cw * fw);
    scene.add(m);
    return { c, g: c.getContext('2d'), tex: mat.map, w: pw, h: ph };
  };
  const ivory = '#E6E3D8', beige = '#E5D7B5';
  const lockin = inst(1.645, 0.15, 0.45, M.beige, (cw, ch) => ({ base: beige, label: { x: 30, y: 14, text: 'LOCK-IN AMPLIFIER', size: 22 },
    knobs: [[880, ch / 2 + 20, 34], [960, ch / 2 + 20, 24]], buttons: [{ x: 640, y: 70, cols: 5, rows: 3, bw: 38, bh: 26, gap: 12, color: '#D3C7A6' }], ports: [[60, ch - 70, 26], [140, ch - 70, 26]] }));
  const sa = inst(1.385, 0.24, 0.5, M.instWhite, (cw, ch) => ({ base: ivory, label: { x: 40, y: 18, text: 'SPECTRUM ANALYSER', size: 22 },
    screen: { x: 40, y: 60, w: 420, h: 300 }, knobs: [[800, 150, 48]], buttons: [{ x: 520, y: 70, cols: 4, rows: 6, bw: 40, bh: 30, gap: 12, colors: ['#D5D6CF', '#D5D6CF', '#B9D3E6'] }], ports: [[900, ch - 80, 30]] }));
  const vna = inst(1.045, 0.32, 0.55, M.instWhite, (cw, ch) => ({ base: ivory, label: { x: 40, y: 18, text: 'NETWORK ANALYSER', size: 22 },
    screen: { x: 40, y: 60, w: 520, h: 380 }, knobs: [[870, 170, 50]], buttons: [{ x: 610, y: 70, cols: 4, rows: 7, bw: 38, bh: 30, gap: 11, colors: ['#D5D6CF', '#D5D6CF', '#D5D6CF', '#E6B54E'] }], ports: [[140, ch - 70, 34], [330, ch - 70, 34], [520, ch - 70, 34], [710, ch - 70, 34]] }));
  const sg = inst(0.785, 0.2, 0.45, M.aluminium, (cw, ch) => ({ base: '#D6DCE2', label: { x: 40, y: 16, text: 'SIGNAL GENERATOR', size: 22 },
    screen: { x: 40, y: 60, w: 470, h: 200 }, knobs: [[700, 210, 46]], buttons: [{ x: 790, y: 60, cols: 4, rows: 5, bw: 36, bh: 30, gap: 10, color: '#C5CDD5' }], ports: [[960, ch - 90, 32]] }));
  const psu = inst(0.505, 0.16, 0.45, M.blackMatte, (cw, ch) => ({ base: '#2B3036', frame: 'rgba(255,255,255,0.12)', label: { x: 40, y: 14, text: 'MAGNET SUPPLY', size: 22, color: 'rgba(230,240,250,0.8)' },
    screen: { x: 40, y: 60, w: 420, h: 120 }, knobs: [[620, ch / 2 + 15, 40], [740, ch / 2 + 15, 40]], ports: [[880, ch / 2 + 15, 26], [960, ch / 2 + 15, 26]] }));
  inst(0.2, 0.26, 0.45, M.blackMatte, (cw, ch) => ({ base: '#30353b', frame: 'rgba(255,255,255,0.12)', label: { x: 40, y: 16, text: 'DC SUPPLY', size: 22, color: 'rgba(230,240,250,0.8)' },
    leds: [{ x: 60, y: 80, w: 260, h: 70, text: '12.00', color: '#3CFF9A', bg: '#0A1F14' }, { x: 360, y: 80, w: 260, h: 70, text: '0.42', color: '#FF3B2F' }], knobs: [[760, ch / 2 + 10, 44], [900, ch / 2 + 10, 44]] }));
  const sVNA = screen(vna, { x: 40, y: 60, w: 520, h: 380 }, 520, 380);
  const sSA = screen(sa, { x: 40, y: 60, w: 420, h: 300 }, 420, 300);
  const sSG = screen(sg, { x: 40, y: 60, w: 470, h: 200 }, 470, 200);
  const sPSU = screen(psu, { x: 40, y: 60, w: 420, h: 120 }, 420, 120);
  const sLI = screen(lockin, { x: 30, y: 60, w: 560, h: 110 }, 560, 110);

  // electromagnet on table A, axis along z
  const tA = spots.tableA, mx = tA.cx - 0.1, mz = tA.cz - 0.65, top = tA.top, ay = top + 0.17;
  K.boxB(M.aluminium, mx - 0.16, top, mz - 0.36, mx + 0.16, top + 0.02, mz + 0.36);
  for (const s of [-1, 1]) {
    K.boxB(M.aluminium, mx - 0.07, top + 0.02, mz + s * 0.2 - 0.05, mx + 0.07, ay - 0.1, mz + s * 0.2 + 0.05);
    const zc = mz + s * 0.115;
    K.cylP(M.steel, [mx, ay, zc - 0.062], [mx, ay, zc - 0.05], 0.13);              // flanges either side of the coil
    K.cylP(M.steel, [mx, ay, zc + 0.05], [mx, ay, zc + 0.062], 0.13);
  }
  const coilTex = T.canvas(32, 256), cg = coilTex.getContext('2d');
  for (let i = 0; i < 256; i += 4) { cg.fillStyle = i % 8 ? '#C77B45' : '#A85F31'; cg.fillRect(0, i, 32, 4); }
  const coilMat = new THREE.MeshStandardMaterial({ map: T.tex(coilTex), color: 0xffffff, roughness: 0.32, metalness: 0.85 });
  for (const s of [-1, 1]) {
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 40, 1, false), coilMat);
    coil.rotation.x = Math.PI / 2; coil.position.set(mx, ay, mz + s * 0.115); coil.castShadow = true; scene.add(coil);
    K.cylP(M.steel, [mx, ay, mz + s * 0.06], [mx, ay, mz + s * 0.36], 0.05);          // core
    K.cylP(M.steel, [mx, ay, mz + s * 0.36], [mx, ay, mz + s * 0.38], 0.09);          // end cap
    const pole = new THREE.CylinderGeometry(0.028, 0.05, 0.035, 32);
    K.geom(pole, M.steel, new THREE.Matrix4().compose(new THREE.Vector3(mx, ay, mz + s * 0.045), new THREE.Quaternion().setFromEuler(new THREE.Euler(s > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)));
  }
  // sample stage between the poles (rotates with the field angle)
  K.cylY(M.blackMatte, mx + 0.16, mz, 0.012, top, ay + 0.02, 'cyl8');
  K.boxB(M.blackMatte, mx + 0.1, ay - 0.08, mz - 0.02, mx + 0.17, ay - 0.05, mz + 0.02);
  const stage = new THREE.Group(); stage.position.set(mx, ay, mz); scene.add(stage);
  const holder = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.022), M.blackMatte); stage.add(holder);
  const pcbC = T.canvas(64, 64), pg = pcbC.getContext('2d');
  pg.fillStyle = '#1F5E3B'; pg.fillRect(0, 0, 64, 64); pg.fillStyle = '#E3BD5B'; pg.fillRect(29, 0, 6, 64); pg.fillRect(0, 0, 64, 6); pg.fillRect(0, 58, 64, 6);
  pg.fillStyle = '#1A1A2A'; pg.fillRect(22, 24, 20, 16);
  const pcb = new THREE.Mesh(new THREE.PlaneGeometry(0.024, 0.024), new THREE.MeshStandardMaterial({ map: T.tex(pcbC), roughness: 0.5 }));
  pcb.rotation.y = -Math.PI / 2; pcb.position.x = -0.0025; stage.add(pcb);
  const pcb2 = pcb.clone(); pcb2.rotation.y = Math.PI / 2; pcb2.position.x = 0.0025; stage.add(pcb2);
  // the home-made rotation controller (red box) and coax cables to the rack
  K.boxB(M.red, mx + 0.25, top, mz + 0.25, mx + 0.37, top + 0.035, mz + 0.33);
  const cable = (pts, r = 0.0045) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    K.geom(new THREE.TubeGeometry(curve, 60, r, 6, false), M.blueCable, new THREE.Matrix4());
  };
  cable([[mx + 0.01, ay + 0.015, mz], [mx + 0.05, ay + 0.06, mz - 0.02], [mx + 0.3, top + 0.03, mz - 0.3], [x1 + 0.4, top + 0.02, r.z + 0.25], [x0 - 0.02, 1.07, r.z - fw / 2 + 140 / 1024 * fw]]);
  cable([[mx + 0.01, ay - 0.015, mz], [mx + 0.08, ay - 0.05, mz + 0.03], [mx + 0.35, top + 0.025, mz - 0.2], [x1 + 0.45, top + 0.02, r.z + 0.15], [x0 - 0.02, 1.07, r.z - fw / 2 + 330 / 1024 * fw]]);
  // power leads from the supply to the coils (red/black)
  K.geom(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[mx - 0.1, ay - 0.05, mz - 0.17], [mx - 0.4, top + 0.02, mz - 0.4], [x1 + 0.3, 0.6, r.z], [x0 - 0.02, 0.58, r.z + 0.2]].map((p) => new THREE.Vector3(...p))), 40, 0.005, 6), M.red, new THREE.Matrix4());

  // everyday clutter on the table: a supply, a small scope, an Arduino, posts and boxes
  const tx = tA.cx, tz = tA.cz;
  K.boxB(M.blackMatte, tx + 0.35, top, tz + 0.45, tx + 0.62, top + 0.13, tz + 0.75);
  K.boxB(M.instWhite, tx + 0.32, top, tz + 0.95, tx + 0.62, top + 0.16, tz + 1.08);
  const scope = T.canvas(256, 128), sc = scope.getContext('2d');
  sc.fillStyle = '#04121F'; sc.fillRect(0, 0, 256, 128); sc.strokeStyle = '#FFD84A'; sc.lineWidth = 3; sc.beginPath();
  for (let i = 0; i <= 256; i += 4) { const y = 64 + 38 * Math.sin(i / 256 * Math.PI * 6); i ? sc.lineTo(i, y) : sc.moveTo(i, y); } sc.stroke();
  sc.strokeStyle = '#7CFFB2'; sc.beginPath(); for (let i = 0; i <= 256; i += 4) { const y = 64 + 20 * Math.sin(i / 256 * Math.PI * 6 + 1.2); i ? sc.lineTo(i, y) : sc.moveTo(i, y); } sc.stroke();
  const scopeM = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.09), w.screenMaterial(scope)); scopeM.rotation.y = -Math.PI / 2; scopeM.position.set(tx + 0.318, top + 0.08, tz + 1.0); scene.add(scopeM);
  const ard = T.canvas(64, 48), ag = ard.getContext('2d'); ag.fillStyle = '#1F6E8C'; ag.fillRect(0, 0, 64, 48); ag.fillStyle = '#E3BD5B'; for (let i = 0; i < 14; i++) ag.fillRect(4 + i * 4, 2, 2, 4); ag.fillStyle = '#111'; ag.fillRect(24, 20, 18, 12);
  const ardM = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.053), new THREE.MeshStandardMaterial({ map: T.tex(ard), roughness: 0.5 })); ardM.rotation.x = -Math.PI / 2; ardM.position.set(tx + 0.12, top + 0.012, tz + 0.55); scene.add(ardM);
  K.boxB(M.whitePlastic, tx - 0.55, top, tz + 0.5, tx - 0.25, top + 0.12, tz + 0.72);
  K.boxB(M.whitePlastic, tx - 0.55, top, tz + 0.82, tx - 0.4, top + 0.06, tz + 1.0);
  for (const [px, pz] of [[tx - 0.15, tz + 1.1], [tx - 0.05, tz + 1.25], [tx + 0.08, tz + 1.12]]) { K.cylY(M.steel, px, pz, 0.006, top, top + 0.18, 'cyl8'); K.cylY(M.black, px, pz, 0.02, top, top + 0.012, 'cyl8'); K.cylP(M.black, [px, top + 0.18, pz - 0.02], [px, top + 0.18, pz + 0.02], 0.02); }
  K.boxB(M.yellow, tx - 0.35, top, tz + 1.3, tx - 0.15, top + 0.03, tz + 1.36);
  K.boxB(M.red, tx + 0.15, top, tz + 0.82, tx + 0.24, top + 0.04, tz + 0.88);
  w.proxy(api, mx - 0.25, top, mz - 0.45, mx + 0.45, top + 0.45, mz + 0.45);
  w.proxy(api, x0 - 0.05, 0, z0 - 0.05, x1 + 0.05, 2.02, z1 + 0.05);
  hw = { sVNA, sSA, sSG, sPSU, sLI, stage, coilMat, invalidate: w.invalidate };
  subs.add(drawHardware);
  drawHardware();
  return {
    anchor: [mx + 0.05, top + 0.62, mz],
    view: { pos: [2.6, 1.7, 6.3], target: [5.4, 1.02, 4.6] },
  };
}

let hwPending = false;
function drawHardware() {
  if (!hw || hwPending) return; hwPending = true;
  requestAnimationFrame(() => { hwPending = false; paintHardware(); });
}
function paintHardware() {
  const m = lab.sample, dir = dirH(), L = fieldLine(m, dir, S.f, 'res');
  // VNA: |S21| in dB during a field sweep at fixed frequency
  const { sVNA, sSA, sSG, sPSU, sLI } = hw;
  if (L) {
    const x = Array.from(L.Bs, mT), y = Array.from(L.A, (a, i) => -2.1 - 9 * a + 0.05 * Math.sin(i * 0.9));
    screenPlot(sVNA.g, sVNA.w, sVNA.h, { series: [{ x, y, color: '#FFD84A', width: 2.5 }], xlabel: 'Field (mT)', ylabel: '|S21| (dB)', pad: { l: 64, r: 14, t: 34, b: 46 } });
    sVNA.g.fillStyle = '#9FE6FF'; sVNA.g.font = '600 18px "Plex", sans-serif'; sVNA.g.textAlign = 'left'; sVNA.g.fillText(`S21  CW ${fmtNum(S.f / 1e9, 5)} GHz`, 12, 22);
  } else {
    sVNA.g.fillStyle = '#04121F'; sVNA.g.fillRect(0, 0, sVNA.w, sVNA.h); sVNA.g.fillStyle = '#9FE6FF'; sVNA.g.font = '600 20px "Plex", sans-serif'; sVNA.g.fillText('No resonance in range', 20, 40);
  }
  // spectrum analyser: the source tone
  const fx = [], fy = []; for (let i = 0; i <= 200; i++) { const f = S.f / 1e9 - 0.5 + i / 200; fx.push(f); fy.push(-78 + 4 * Math.sin(i * 1.7) * Math.sin(i * 0.31) + 70 / (1 + ((f - S.f / 1e9) / 0.004) ** 2)); }
  screenPlot(sSA.g, sSA.w, sSA.h, { series: [{ x: fx, y: fy, color: '#7CFFB2', width: 2 }], xlabel: 'GHz', ylabel: 'dBm', pad: { l: 56, r: 10, t: 12, b: 40 } });
  // signal generator display
  const g = sSG.g; g.fillStyle = '#E8D34A'; g.fillRect(0, 0, sSG.w, sSG.h);
  g.fillStyle = '#2A2410'; g.font = '700 54px "Plex", monospace'; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillText((S.f / 1e9).toFixed(6) + ' GHz', sSG.w - 20, 80);
  g.font = '600 30px "Plex", sans-serif'; g.fillText('+10.00 dBm   RF ON', sSG.w - 20, 155);
  // magnet supply (assume 50 mT per ampere)
  const p = sPSU.g; p.fillStyle = '#071A12'; p.fillRect(0, 0, sPSU.w, sPSU.h);
  p.fillStyle = '#3CFF9A'; p.shadowColor = '#3CFF9A'; p.shadowBlur = 10; p.font = '700 64px "Plex", monospace'; p.textAlign = 'right'; p.textBaseline = 'middle';
  p.fillText(L ? (L.Bres / 0.05).toFixed(3) + ' A' : '0.000 A', sPSU.w - 16, sPSU.h / 2 + 2); p.shadowBlur = 0;
  // lock-in: three red displays
  const l = sLI.g; l.fillStyle = '#E5D7B5'; l.fillRect(0, 0, sLI.w, sLI.h);
  const vals = L ? [(1e3 * L.dA[Math.floor(L.dA.length * 0.42)] / (Math.max(...L.dA) || 1) * 0.001).toFixed(3), '0.500', (S.thetaH).toFixed(1)] : ['0.000', '0.500', '0.0'];
  vals.forEach((v, i) => {
    const x = 10 + i * 184; l.fillStyle = '#1A0606'; l.fillRect(x, 14, 170, 80);
    l.fillStyle = '#FF3B2F'; l.shadowColor = '#FF3B2F'; l.shadowBlur = 8; l.font = '700 50px "Plex", monospace'; l.textAlign = 'right'; l.textBaseline = 'middle';
    l.fillText(v, x + 162, 56); l.shadowBlur = 0;
  });
  for (const s of [sVNA, sSA, sSG, sPSU, sLI]) s.tex.needsUpdate = true;
  // the sample stage turns with the field direction (field along the magnet axis z)
  hw.stage.rotation.set(0, (90 - S.thetaH) * Math.PI / 180, S.phiH * Math.PI / 180, 'YXZ');
  hw.invalidate();
}

// ------------------------------------------------------------------------------------- UI
function fieldControls() {
  const th = slider({ label: 'Field angle from the film normal θ_H', unit: '°', min: 0, max: 90, step: 0.5, value: S.thetaH, digits: 3,
    hint: '90° puts the field in the film plane.', onInput: (v) => { S.thetaH = v; changed(); } });
  const ph = slider({ label: 'In-plane field angle φ_H', unit: '°', min: 0, max: 360, step: 1, value: S.phiH, digits: 3, onInput: (v) => { S.phiH = v; changed(); } });
  const fq = slider({ label: 'Microwave frequency', unit: 'GHz', min: 0.5, max: 40, step: 0.01, value: S.f / 1e9, digits: 4, onInput: (v) => { S.f = v * 1e9; changed(); } });
  subs.add(() => { th.set(S.thetaH, false); ph.set(S.phiH, false); fq.set(S.f / 1e9, false); });
  return { th, ph, fq };
}

function tabSweep(pane) {
  const c = fieldControls();
  const sig = segmented({ label: 'Signal', options: [{ value: 'abs', label: 'Absorption' }, { value: 'der', label: 'Lock-in (dP/dB)' }], value: S.signal, onChange: (v) => { S.signal = v; draw(); } });
  const zoom = segmented({ label: 'Field range', options: [{ value: 'res', label: 'Around the line' }, { value: 'full', label: 'Whole sweep' }], value: S.zoom, onChange: (v) => { S.zoom = v; draw(); } });
  const box = canvasBox('', '16 / 10', 'Microwave absorption against applied field');
  const plot = new Plot(box.canvas, { xlabel: 'Applied field (mT)', ylabel: 'Absorption (arb. units)', hover: true });
  const ro = { B: readout('Resonance field'), W: readout('Linewidth (FWHM)'), M: readout('Magnetization angle from normal'), E: readout('Precession ellipticity'), G: readout('Gilbert part of the half width'), I: readout('Inhomogeneous part ΔB₀') };
  const cur = readout('Cursor');
  plot.onCursor((x, y) => { cur.set(`${fmtNum(x, 5)} mT`); });
  pane.append(
    el('p', { class: 'vp-intro', html: 'Set the microwave frequency and sweep the magnet, as in our FMR setup. The line sits where the precession frequency of the film matches the microwaves; its width comes from Gilbert damping plus inhomogeneous broadening.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor(), group('Microwaves and field', c.fq, c.th, c.ph), group('Display', sig, zoom)),
      el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ...Object.values(ro), cur),
        note('The lock-in trace is the field derivative of the absorption, what field modulation gives you in a real measurement. <b>Try</b> tilting the field out of the plane: the line moves to high field and narrows in field units.'))));
  function draw() {
    const m = lab.sample, L = fieldLine(m, dirH(), S.f, S.zoom);
    if (!L) { plot.setSeries([]).setTexts([{ x: 20, y: 30, px: true, text: 'No resonance below ' + fmtNum(bmaxFor(m, S.f) * 1e3, 4) + ' mT at this frequency.' }]).draw(); Object.values(ro).forEach((r) => r.set('–')); return; }
    const x = Array.from(L.Bs, mT), y = S.signal === 'abs' ? Array.from(L.A) : Array.from(L.dA, (v) => v / 1e3);
    plot.o.ylabel = S.signal === 'abs' ? 'Absorption (arb. units)' : 'dP/dB (arb. units per mT)';
    plot.setTexts([]).setSeries([{ x, y, color: COLORS.cyan, width: 2.5 }]).setVLines([{ x: mT(L.Bres), color: COLORS.gold, dash: [5, 4] }]).draw();
    ro.B.set(`${fmtNum(mT(L.Bres), 5)} mT`);
    ro.W.set(`${fmtNum(mT(L.fwhm), 4)} mT`);
    ro.M.set(`${fmtNum(angleBetween(L.r.m, [0, 0, 1]), 4)}°`);
    ro.E.set(fmtNum(L.r.ellipse.ratio, 3));
    ro.G.set(`${fmtNum(mT(L.r.hwhm / L.slope), 4)} mT`);
    ro.I.set(`${fmtNum(mT(m.dB0 || 0), 4)} mT`);
  }
  subs.add(() => { if (!pane.hidden) draw(); });
  return { show: draw, resize: draw };
}

function tabMap(pane) {
  const c = fieldControls();
  const track = checkbox({ label: 'Show the resonance curve', checked: true, onChange: () => draw() });
  const box = canvasBox('', '16 / 10', 'Absorption map against field and frequency');
  const plot = new Plot(box.canvas, { xlabel: 'Applied field (mT)', ylabel: 'Frequency (GHz)', hover: true, colorbar: { label: 'Absorption' } });
  const box2 = canvasBox('', '16 / 8', 'Linewidth against frequency');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Frequency (GHz)', ylabel: 'Linewidth FWHM (mT)', tightY: false });
  const ro = { cur: readout('Cursor (field, frequency)'), fr: readout('Resonance at cursor field'), a: readout('Damping from the slope'), b: readout('Zero-frequency intercept 2ΔB₀'), meff: readout('Effective magnetization μ₀M_eff') };
  let lastCursor = null;
  plot.onCursor((B, f, pressed) => {
    lastCursor = [B, f];
    const m = lab.sample, dir = dirH(), r = fmr.resonance(m, dir.map((q) => q * B / 1e3), dir);
    ro.cur.set(`${fmtNum(B, 4)} mT, ${fmtNum(f, 4)} GHz`); ro.fr.set(`${fmtNum(r.f / 1e9, 4)} GHz`);
    if (pressed) { S.f = Math.max(0.5, Math.min(40, f)) * 1e9; changed(); }
    drawOverlay();
  });
  pane.append(
    el('p', { class: 'vp-intro', html: 'The full map of absorption against field and frequency. <b>Click the map</b> to set the microwave frequency for the other tabs. Below: the linewidth at each frequency and the straight-line fit we use to get the damping.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor(), group('Field direction', c.th, c.ph), group('Map', c.fq, track)),
      el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ro.cur, ro.fr), box2, el('div', { class: 'ros' }, ro.a, ro.b, ro.meff))));
  let cache = null;
  function compute() {
    const m = lab.sample, dir = dirH();
    const fmax = 40e9, Bt = Math.max(0.1, Math.min(3, bmaxFor(m, fmax * 0.6)));
    const nB = 240, nF = 160, Bs = new Float64Array(nB), fs = new Float64Array(nF);
    for (let i = 0; i < nB; i++) Bs[i] = Bt * i / (nB - 1);
    for (let j = 0; j < nF; j++) fs[j] = fmax * (j + 0.5) / nF;
    const res = fmr.sweep(m, dir, Bs), map = new Float32Array(nB * nF), df = fmax / nF;
    for (let i = 0; i < nB; i++) {
      const r = res[i]; if (!(r.f > 0)) continue;
      const wd = Math.max(r.hwhmTotal, 0.7 * df);
      for (let j = 0; j < nF; j++) map[j * nB + i] = fmr.lorentz(fs[j], r.f, wd) * Math.min(1, r.hwhmTotal / wd * 4 + 0.25);
    }
    // linewidth against frequency
    const lf = [], lw = [];
    for (let f = 2e9; f <= 40e9; f += 2e9) {
      const L = fieldLine(m, dir, f, 'res'); if (!L || !Number.isFinite(L.fwhm)) continue;
      lf.push(f / 1e9); lw.push(mT(L.fwhm));
    }
    let a = NaN, b = NaN;
    if (lf.length > 2) {
      const n = lf.length, sx = lf.reduce((s, v) => s + v, 0), sy = lw.reduce((s, v) => s + v, 0);
      const sxx = lf.reduce((s, v) => s + v * v, 0), sxy = lf.reduce((s, v, i) => s + v * lw[i], 0);
      a = (n * sxy - sx * sy) / (n * sxx - sx * sx); b = (sy - a * sx) / n;
    }
    cache = { Bs, fs, res, map, Bt, fmax, lf, lw, a, b, nB, nF };
  }
  function drawOverlay() {
    if (!cache) return;
    const s = [];
    if (track.get()) s.push({ x: Array.from(cache.Bs, mT), y: cache.res.map((r) => (r.f > 0 ? r.f / 1e9 : NaN)), color: '#FFFFFF', width: 1.5, dash: [6, 5] });
    plot.setSeries(s).setHLines([{ y: S.f / 1e9, color: COLORS.gold, dash: [4, 4], width: 1.5 }]);
    plot.setMarkers(lastCursor ? [{ x: lastCursor[0], y: lastCursor[1], color: COLORS.gold, r: 4 }] : []).draw();
  }
  function draw() {
    compute();
    plot.setHeatmap({ data: cache.map, nx: cache.nB, ny: cache.nF, x0: 0, x1: mT(cache.Bt), y0: 0, y1: cache.fmax / 1e9, colormap: 'lab', vmin: 0, vmax: 1, gamma: 0.6 });
    drawOverlay();
    const xs = [0, 40], fit = Number.isFinite(cache.a) ? [{ x: xs, y: xs.map((x) => cache.b + cache.a * x), color: COLORS.pink, width: 2, dash: [6, 4], label: 'straight-line fit' }] : [];
    plot2.setSeries([{ x: cache.lf, y: cache.lw, points: true, r: 4, color: COLORS.signal, label: 'linewidth from the model' }, ...fit]).draw();
    const m = lab.sample;
    // in plane: FWHM = 2ΔB0 + (2α/γ) f  -> α = slope·γ/2 (slope in mT/GHz -> T/Hz)
    ro.a.set(Number.isFinite(cache.a) ? `α ≈ ${fmtNum(cache.a * 1e-3 / 1e9 * m.gamma / 2, 3)}${m.hidden ? '' : ` (set: ${fmtNum(m.alpha, 3)})`}` : '–');
    ro.b.set(Number.isFinite(cache.b) ? `${fmtNum(cache.b, 3)} mT` : '–');
    ro.meff.set(m.hidden ? 'hidden: measure it!' : `${fmtNum(mu0Meff(m) * 1e3, 4)} mT`);
  }
  let t = 0; subs.add(() => { if (!pane.hidden) { cancelAnimationFrame(t); t = requestAnimationFrame(draw); } });
  return { show: draw, resize: () => { drawOverlay(); plot2.draw(); } };
}

function tabAngle(pane) {
  const c = fieldControls();
  let mode = 'oop';
  const seg = segmented({ label: 'Rotate the field', options: [{ value: 'oop', label: 'Out of the plane (θ_H)' }, { value: 'ip', label: 'In the plane (φ_H)' }], value: mode, onChange: (v) => { mode = v; draw(); } });
  const box = canvasBox('', '16 / 9', 'Resonance field against field angle');
  const plot = new Plot(box.canvas, { xlabel: 'Field angle θ_H from the normal (°)', ylabel: 'Resonance field (mT)' });
  const box2 = canvasBox('', '16 / 7', 'Magnetization angle against field angle');
  const plot2 = new Plot(box2.canvas, { xlabel: 'Field angle θ_H from the normal (°)', ylabel: 'Magnetization angle θ_M (°)' });
  const ro = { para: readout('Resonance field, field in plane'), perp: readout('Resonance field, field along normal'), meff: readout('μ₀M_eff') };
  pane.append(
    el('p', { class: 'vp-intro', html: 'Turn the sample in the field, as our Arduino rotation stage does. Out of the plane, the film’s shape anisotropy keeps the magnetization near the plane until the field is strong, so the resonance field climbs steeply near the normal. In the plane, an easy axis gives a two-fold pattern.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor({ open: false }), group('Rotation', seg, c.fq), note('Add an in-plane anisotropy Ku under “Edit the film’s properties” to see the in-plane pattern.')),
      el('div', { class: 'vp-main' }, box, box2, el('div', { class: 'ros' }, ...Object.values(ro)))));
  function draw() {
    const m = lab.sample, angs = [], Bres = [], thM = [];
    const N = mode === 'oop' ? 61 : 73;
    for (let i = 0; i < N; i++) {
      const a = mode === 'oop' ? 90 * i / (N - 1) : 360 * i / (N - 1);
      const dir = mode === 'oop' ? fmr.dirFromAngles(a, S.phiH) : fmr.dirFromAngles(90, a);
      const B = fmr.resonanceField(m, dir, S.f, bmaxFor(m, S.f), 200);
      angs.push(a); Bres.push(mT(B));
      if (Number.isFinite(B)) { const r = fmr.resonance(m, dir.map((q) => q * B), dir); thM.push(mode === 'oop' ? angleBetween(r.m, [0, 0, 1]) : (Math.atan2(r.m[1], r.m[0]) * 180 / Math.PI + 360) % 360); }
      else thM.push(NaN);
    }
    plot.o.xlabel = mode === 'oop' ? 'Field angle θ_H from the normal (°)' : 'In-plane field angle φ_H (°)';
    plot2.o.xlabel = plot.o.xlabel;
    plot2.o.ylabel = mode === 'oop' ? 'Magnetization angle θ_M (°)' : 'Magnetization angle φ_M (°)';
    const cur = mode === 'oop' ? S.thetaH : S.phiH;
    plot.setSeries([{ x: angs, y: Bres, color: COLORS.cyan, width: 2.5 }]).setVLines([{ x: cur, color: COLORS.gold, dash: [5, 4] }]).draw();
    plot2.setSeries([{ x: angs, y: thM, color: COLORS.violet, width: 2.5 }, { x: [angs[0], angs[angs.length - 1]], y: [angs[0], angs[angs.length - 1]], color: COLORS.signal, dash: [4, 4], width: 1.2, label: 'θ_M = θ_H' }]).setVLines([{ x: cur, color: COLORS.gold, dash: [5, 4] }]).draw();
    ro.para.set(`${fmtNum(mT(fmr.resonanceField(m, fmr.dirFromAngles(90, S.phiH), S.f, bmaxFor(m, S.f))), 5)} mT`);
    ro.perp.set(`${fmtNum(mT(fmr.resonanceField(m, [0, 0, 1], S.f, bmaxFor(m, S.f))), 5)} mT`);
    ro.meff.set(m.hidden ? 'hidden: measure it!' : `${fmtNum(mu0Meff(m) * 1e3, 4)} mT`);
  }
  let t = 0; subs.add(() => { if (!pane.hidden) { cancelAnimationFrame(t); t = requestAnimationFrame(draw); } });
  return { show: draw, resize: draw };
}

function tabPrecession(pane) {
  const c = fieldControls();
  let Bset = null, playing = true, speed = 0.4, drive = 3;
  const bsl = slider({ label: 'Applied field (0 = stay on resonance)', unit: 'mT', min: 0, max: 2000, step: 0.1, value: 0, digits: 5, onInput: (v) => { Bset = v > 0 ? v / 1e3 : null; recompute(); } });
  const sp = slider({ label: 'Slow motion: turns per second', unit: '', min: 0.05, max: 2, step: 0.01, value: speed, digits: 3, onInput: (v) => { speed = v; } });
  const dv = slider({ label: 'Cone size (drawing only)', unit: '°', min: 1, max: 30, step: 0.5, value: drive * 5, digits: 3, onInput: (v) => { drive = v / 5; } });
  const play = button('Pause', () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; if (playing) loop(); }, 'secondary');
  const box = canvasBox('', '4 / 3', 'Animated precession of the magnetization');
  const ro = { f: readout('Precession frequency'), e: readout('Ellipticity (minor/major axis)'), m: readout('Magnetization direction θ_M, φ_M'), q: readout('Squeezing of the magnon vacuum') };
  pane.append(
    el('p', { class: 'vp-intro', html: 'The magnetization precesses about its equilibrium direction. In a film the cone is flattened into an ellipse because tipping out of the plane costs demagnetizing energy; the more elliptical the orbit, the more the quantum magnon vacuum is squeezed.' }),
    el('div', { class: 'vp-cols' },
      el('div', { class: 'vp-side' }, sampleEditor(), group('Field', c.fq, c.th, c.ph, bsl), group('Animation', sp, dv, el('div', { class: 'vp-row' }, play))),
      el('div', { class: 'vp-main' }, box, el('div', { class: 'ros' }, ...Object.values(ro)))));
  const cv = box.canvas, g = cv.getContext('2d');
  let R = null, phase = 0, raf = 0, lastT = 0;
  function recompute() {
    const m = lab.sample, dir = dirH();
    const B = Bset != null ? Bset : fmr.resonanceField(m, dir, S.f, bmaxFor(m, S.f));
    if (!Number.isFinite(B)) { R = null; return; }
    R = fmr.resonance(m, dir.map((q) => q * B), dir); R.B = B; R.dir = dir;
    ro.f.set(`${fmtNum(R.f / 1e9, 4)} GHz at ${fmtNum(mT(B), 5)} mT`);
    ro.e.set(fmtNum(R.ellipse.ratio, 3));
    ro.m.set(`${fmtNum(angleBetween(R.m, [0, 0, 1]), 4)}°, ${fmtNum((Math.atan2(R.m[1], R.m[0]) * 180 / Math.PI + 360) % 360, 4)}°`);
    const [S11, , S22] = R.S, tr = Math.abs((S22 - S11) / (S22 + S11)), r = 0.5 * Math.atanh(Math.min(0.999999, tr));
    ro.q.set(`r = ${fmtNum(r, 3)} (${fmtNum(-20 * Math.log10(Math.exp(-r)) , 3)} dB)`);
  }
  // oblique projection
  const P = (v, W, H) => { const s = Math.min(W * 0.5, H) * 0.42; return [W * 0.4 + s * (v[0] * 0.94 + v[1] * 0.42), H * 0.62 + s * (v[0] * 0.24 - v[1] * 0.34 - v[2] * 0.95)]; };
  function frame() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
    // film
    const corners = [[-1.2, -1.2, 0], [1.2, -1.2, 0], [1.2, 1.2, 0], [-1.2, 1.2, 0]].map((v) => P(v, W, H));
    g.fillStyle = '#EAF6FC'; g.strokeStyle = '#C6E6F4'; g.lineWidth = 1.5; g.beginPath(); corners.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#00739E'; g.font = '500 13px "Plex", sans-serif'; g.fillText('film plane', corners[0][0] + 10, corners[0][1] + 18);
    // normal of the film
    { const o = P([0, 0, 0], W, H), z = P([0, 0, 1.15], W, H); g.strokeStyle = 'rgba(0,115,158,0.5)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(...o); g.lineTo(...z); g.stroke(); g.setLineDash([]); g.fillText('normal', z[0] + 6, z[1]); }
    if (!R) { g.fillStyle = '#12243A'; g.fillText('No resonance at this frequency in range.', 16, 24); return; }
    const arrow = (v, col, wdt, label) => {
      const o = P([0, 0, 0], W, H), p = P(v, W, H);
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = wdt; g.beginPath(); g.moveTo(...o); g.lineTo(...p); g.stroke();
      const a = Math.atan2(p[1] - o[1], p[0] - o[0]); g.beginPath(); g.moveTo(...p); g.lineTo(p[0] - 12 * Math.cos(a - 0.4), p[1] - 12 * Math.sin(a - 0.4)); g.lineTo(p[0] - 12 * Math.cos(a + 0.4), p[1] - 12 * Math.sin(a + 0.4)); g.fill();
      if (label) { g.font = '600 13px "Plex", sans-serif'; g.fillText(label, p[0] + 8, p[1] - 6); }
    };
    arrow(R.dir.map((q) => q * 1.25), '#C98A12', 2.5, 'field');
    // precession ellipse: semi-axes along the principal axes of S, small along the stiff direction
    const ang = R.ellipse.axisAngle, ratio = R.ellipse.ratio, amp = Math.tan(drive * 5 * Math.PI / 180);
    const u1 = [0, 1, 2].map((i) => Math.cos(ang) * R.e1[i] + Math.sin(ang) * R.e2[i]);
    const u2 = [0, 1, 2].map((i) => -Math.sin(ang) * R.e1[i] + Math.cos(ang) * R.e2[i]);
    const pt = (t) => [0, 1, 2].map((i) => R.m[i] + amp * (ratio * Math.cos(t) * u1[i] + Math.sin(t) * u2[i]));
    g.strokeStyle = 'rgba(0,169,214,0.55)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath();
    for (let k = 0; k <= 64; k++) { const p = P(pt(k / 64 * Math.PI * 2), W, H); k ? g.lineTo(...p) : g.moveTo(...p); }
    g.stroke(); g.setLineDash([]);
    // cone surface: lines from the origin to the orbit
    g.strokeStyle = 'rgba(0,169,214,0.18)'; g.lineWidth = 1;
    for (let k = 0; k < 24; k++) { const o = P([0, 0, 0], W, H), q = P(pt(k / 24 * Math.PI * 2), W, H); g.beginPath(); g.moveTo(...o); g.lineTo(...q); g.stroke(); }
    arrow(R.m, 'rgba(14,42,77,0.35)', 2, '');
    arrow(pt(phase), '#00A9D6', 3.5, 'm(t)');
    g.fillStyle = '#12243A'; g.font = '500 13px "Plex", sans-serif';
    g.fillText(`slowed down ${fmtNum(R.f / speed, 2)} times`, 14, H - 14);
  }
  function loop(t) {
    cancelAnimationFrame(raf);
    if (!playing || pane.hidden) { frame(); return; }
    const now = performance.now(), dt = lastT ? (now - lastT) / 1000 : 0; lastT = now;
    phase -= dt * speed * Math.PI * 2;
    frame();
    raf = requestAnimationFrame(loop);
  }
  subs.add(() => { if (!pane.hidden) { recompute(); frame(); } });
  return { show() { recompute(); lastT = 0; loop(); }, hide() { cancelAnimationFrame(raf); }, resize: frame };
}

const api = {
  id: 'fmr', title: 'FMR setup', kicker: 'Ferromagnetic resonance', icon: 'FMR',
  blurb: 'Field sweeps, f–H maps, linewidth and damping, angle dependence, precession.',
  build3D,
  tabs: [
    { id: 'sweep', label: 'Field sweep', build: tabSweep },
    { id: 'map', label: 'f–H map', build: tabMap },
    { id: 'angle', label: 'Angle', build: tabAngle },
    { id: 'precession', label: 'Precession', build: tabPrecession },
  ],
};
export default api;
