// The room, modelled on photos of the M² Lab (Natural Science Building, Chungbuk National University):
// terrazzo floor, cream walls, exposed pipes and fume arms, LED panels, an air-conditioner cassette,
// a green blackboard, a double door, windows with exhaust fans, wooden bookshelves, the yellow
// flammables cabinet, a vacuum system, two optical tables (one with an overhead frame) and furniture.
//
// Coordinates in metres: x from the blackboard wall (west, x = 0) to the east wall (x = W),
// z from the window wall (north, z = 0) to the door wall (south, z = D), y up.
// Static parts are merged per material to keep draw calls low.

import * as THREE from '../vendor/three.js';
import * as T from './textures.js';

export const W = 10, D = 12, H = 3.0;

// ---------------------------------------------------------------- batching
export class Batcher {
  constructor() { this.groups = new Map(); }
  add(geom, mat, matrix) {
    let g = geom.index ? geom.toNonIndexed() : geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    let list = this.groups.get(mat);
    if (!list) { list = []; this.groups.set(mat, list); }
    list.push(g);
  }
  build(parent, { shadows = true } = {}) {
    const meshes = [];
    for (const [mat, list] of this.groups) {
      const merged = THREE.mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = shadows && !mat.userData.noShadow; m.receiveShadow = true;
      m.matrixAutoUpdate = false; m.updateMatrix();
      m.userData.static = true;
      parent.add(m); meshes.push(m);
    }
    this.groups.clear();
    return meshes;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function mat4(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  return _m.clone().compose(_p, _q, _s);
}

// geometry cache
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 10),
  sph: new THREE.SphereGeometry(1, 20, 14),
  plane: new THREE.PlaneGeometry(1, 1),
};
export { GEO };

// helpers that add to a batcher
export function makeKit(B) {
  const kit = {
    // axis-aligned box by bounds, optional rotation about y around its centre
    boxB(mat, x0, y0, z0, x1, y1, z1, ry = 0) {
      B.add(GEO.box, mat, mat4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, ry, 0, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)));
    },
    box(mat, cx, cy, cz, w, h, d, ry = 0, rx = 0, rz = 0) { B.add(GEO.box, mat, mat4(cx, cy, cz, rx, ry, rz, w, h, d)); },
    // vertical cylinder from y0 to y1
    cylY(mat, x, z, r, y0, y1, seg = 'cyl') { B.add(GEO[seg], mat, mat4(x, (y0 + y1) / 2, z, 0, 0, 0, r, y1 - y0, r)); },
    // cylinder between two points
    cylP(mat, a, b, r, seg = 'cyl') {
      const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      const m = new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(r, L, r));
      B.add(GEO[seg], mat, m);
    },
    sphere(mat, x, y, z, r) { B.add(GEO.sph, mat, mat4(x, y, z, 0, 0, 0, r, r, r)); },
    geom(g, mat, matrix) { B.add(g, mat, matrix); },
  };
  return kit;
}

// ---------------------------------------------------------------- materials
export function makeMaterials(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const floorTex = T.terrazzo(); floorTex.anisotropy = aniso; floorTex.repeat.set(W / 0.6, D / 0.6);
  const wallTex = T.plaster(); wallTex.repeat.set(4, 2);
  const bb = T.breadboard(); bb.anisotropy = aniso;
  const peg = T.pegboard();
  const M = {
    floor: std({ map: floorTex, roughness: 0.62, metalness: 0 }),
    wall: std({ color: 0xF3EEE4, map: wallTex, roughness: 0.95 }),
    wallLow: std({ color: 0xE9DFCB, roughness: 0.9 }),
    ceiling: std({ color: 0xF3F0E8, roughness: 0.95 }),
    black: std({ color: 0x15181c, roughness: 0.55, metalness: 0.35 }),
    blackMatte: std({ color: 0x1b1f24, roughness: 0.8, metalness: 0.1 }),
    steel: std({ color: 0xC7CFD6, roughness: 0.32, metalness: 0.88 }),
    breadboard: std({ color: 0xffffff, map: bb, roughness: 0.42, metalness: 0.55 }),
    aluminium: std({ color: 0xD9DEE2, roughness: 0.38, metalness: 0.75 }),
    copper: std({ color: 0xC0733F, roughness: 0.33, metalness: 0.9 }),
    brass: std({ color: 0xC9A65A, roughness: 0.35, metalness: 0.85 }),
    gold: std({ color: 0xE3BD5B, roughness: 0.28, metalness: 0.95 }),
    white: std({ color: 0xF4F2EC, roughness: 0.55 }),
    whitePlastic: std({ color: 0xF7F6F1, roughness: 0.42 }),
    cream: std({ color: 0xEFE6CC, roughness: 0.85 }),
    beige: std({ color: 0xE6DAB9, roughness: 0.6 }),
    instWhite: std({ color: 0xE9E7DF, roughness: 0.5, metalness: 0.1 }),
    woodDark: std({ map: T.wood('#6B4226', '#3E2410'), roughness: 0.6 }),
    woodMid: std({ map: T.wood('#8E5B34', '#5A3418'), roughness: 0.55 }),
    woodLight: std({ map: T.wood('#C99C66', '#9A6E3E'), roughness: 0.5 }),
    deskTop: std({ map: T.wood('#7A4A2C', '#4C2A15'), roughness: 0.45 }),
    yellow: std({ color: 0xF4B400, roughness: 0.45, metalness: 0.15 }),
    teal: std({ color: 0x4E8A90, roughness: 0.55, metalness: 0.2 }),
    tealDark: std({ color: 0x2F6066, roughness: 0.6, metalness: 0.2 }),
    peg: std({ color: 0xffffff, map: peg, roughness: 0.8 }),
    pipeWhite: std({ color: 0xF2F0EA, roughness: 0.5 }),
    pipeBlack: std({ color: 0x23272c, roughness: 0.5, metalness: 0.2 }),
    pipeBlue: std({ color: 0x2F6EC0, roughness: 0.65 }),
    cardboard: std({ color: 0xC9A06A, roughness: 0.9 }),
    red: std({ color: 0xC8312B, roughness: 0.5 }),
    green: std({ color: 0x2C8A4B, roughness: 0.5 }),
    rubber: std({ color: 0x222428, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xDDEFF8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
    led: new THREE.MeshBasicMaterial({ color: 0xFFFFFF }),
    ledWarm: new THREE.MeshBasicMaterial({ color: 0xFFF6E6 }),
    screenOff: std({ color: 0x0b0d10, roughness: 0.15, metalness: 0.3 }),
    paper: std({ color: 0xFBFAF5, roughness: 0.9 }),
    chair: std({ color: 0xF2F2EE, roughness: 0.6 }),
    chairSeat: std({ color: 0x8D9399, roughness: 0.85 }),
    mesh: std({ color: 0xC3CCD6, roughness: 0.9 }),
    blueCable: std({ color: 0x3E8EDB, roughness: 0.5 }),
    tvWhite: std({ color: 0xF6F5F0, roughness: 0.35 }),
    hood: std({ color: 0xF7F6F1, roughness: 0.42, side: THREE.DoubleSide }),
    fixture: std({ color: 0xF4F2EC, roughness: 0.55 }),
    beam: std({ color: 0xF3F0E8, roughness: 0.95 }),
  };
  // the room is lit by many diffuse panels, so things near the ceiling should not throw hard shadows
  for (const k of ['led', 'ledWarm', 'glass', 'pipeWhite', 'pipeBlue', 'pipeBlack', 'hood', 'fixture', 'beam']) M[k].userData.noShadow = true;
  return M;
}

// a material showing a canvas (unlit, for screens and labels)
export function screenMaterial(canvas) {
  const t = T.tex(canvas, { mip: false });
  const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
  m.userData.noShadow = true;
  return m;
}
export function faceMaterial(canvas, opts = {}) {
  const t = T.tex(canvas);
  return new THREE.MeshStandardMaterial(Object.assign({ map: t, roughness: 0.55, metalness: 0.05 }, opts));
}

// ---------------------------------------------------------------- the room
export function buildRoom(renderer, { invalidate = () => {} } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xEEE8DC);
  const M = makeMaterials(renderer);
  const B = new Batcher(), K = makeKit(B);
  const colliders = [];
  const solid = (x0, z0, x1, z1) => colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });

  // ---- shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); floor.receiveShadow = true; floor.name = 'floor';
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.ceiling);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(W / 2, H, D / 2); scene.add(ceil);
  const wallMesh = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.wall); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m; };
  // north wall with a window opening (x 0.6..5.4, y 1.0..2.6)
  const north = new THREE.Group(); scene.add(north);
  K.boxB(M.wall, 0, 0, -0.1, W, 1.0, 0, 0);
  K.boxB(M.wall, 0, 2.6, -0.1, W, H, 0);
  K.boxB(M.wall, 0, 1.0, -0.1, 0.6, 2.6, 0);
  K.boxB(M.wall, 5.4, 1.0, -0.1, W, 2.6, 0);
  wallMesh(D, H, W, H / 2, D / 2, -Math.PI / 2);          // east
  wallMesh(D, H, 0, H / 2, D / 2, Math.PI / 2);           // west
  // south wall with the double door opening (x 2.0..3.6, y 0..2.15)
  K.boxB(M.wall, 0, 0, D, 2.0, H, D + 0.1);
  K.boxB(M.wall, 3.6, 0, D, W, H, D + 0.1);
  K.boxB(M.wall, 2.0, 2.15, D, 3.6, H, D + 0.1);
  // skirting (darker band at the bottom of the walls)
  K.boxB(M.wallLow, 0, 0, 0, W, 0.1, 0.012); K.boxB(M.wallLow, 0, 0, D - 0.012, 2.0, 0.1, D); K.boxB(M.wallLow, 3.6, 0, D - 0.012, W, 0.1, D);
  K.boxB(M.wallLow, 0, 0, 0, 0.012, 0.1, D); K.boxB(M.wallLow, W - 0.012, 0, 0, W, 0.1, D);
  // structural beam across the ceiling
  K.boxB(M.beam, 0, H - 0.32, 5.9, W, H, 6.3);

  // ---- windows with exhaust fans
  const winView = new THREE.MeshBasicMaterial({ map: T.windowView(), toneMapped: false });
  const view = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.6), winView); view.position.set(3.0, 1.8, -0.09); scene.add(view);
  K.boxB(M.white, 0.6, 0.94, -0.12, 5.4, 1.0, 0.08);                    // sill
  for (const x of [0.6, 1.8, 3.0, 4.2, 5.4]) K.boxB(M.white, x - 0.04, 1.0, -0.06, x + 0.04, 2.6, 0.0);
  for (const y of [1.0, 2.15, 2.6]) K.boxB(M.white, 0.6, y - 0.035, -0.06, 5.4, y + 0.035, 0.0);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.6), M.glass); glass.position.set(3.0, 1.8, -0.03); scene.add(glass);
  const fanCanvas = T.canvas(128, 128), fg = fanCanvas.getContext('2d');
  fg.fillStyle = '#EDEDE6'; fg.fillRect(0, 0, 128, 128); fg.strokeStyle = '#9AA0A3'; fg.lineWidth = 2;
  for (let r = 10; r < 60; r += 7) { fg.beginPath(); fg.arc(64, 64, r, 0, Math.PI * 2); fg.stroke(); }
  for (let a = 0; a < 4; a++) { fg.beginPath(); fg.moveTo(64, 64); fg.lineTo(64 + 60 * Math.cos(a * Math.PI / 2), 64 + 60 * Math.sin(a * Math.PI / 2)); fg.stroke(); }
  const fanMat = new THREE.MeshStandardMaterial({ map: T.tex(fanCanvas), roughness: 0.6 });
  for (const x of [1.2, 3.6]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.42), fanMat); f.position.set(x, 2.38, 0.005); scene.add(f); }

  // ---- door (south wall, double, white with narrow glass)
  const doorG = new THREE.Group(); doorG.name = 'door'; scene.add(doorG);
  K.boxB(M.white, 1.92, 0, D - 0.06, 2.0, 2.23, D + 0.02); K.boxB(M.white, 3.6, 0, D - 0.06, 3.68, 2.23, D + 0.02); K.boxB(M.white, 1.92, 2.15, D - 0.06, 3.68, 2.23, D + 0.02);
  const leafMat = M.whitePlastic;
  for (const [x0, x1] of [[2.0, 2.795], [2.805, 3.6]]) {
    const leaf = new THREE.Mesh(GEO.box, leafMat); leaf.scale.set(x1 - x0, 2.13, 0.05); leaf.position.set((x0 + x1) / 2, 1.075, D - 0.03); leaf.castShadow = true; doorG.add(leaf);
    const xm = (x0 + x1) / 2;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.7), M.glass); win.position.set(xm, 1.45, D - 0.058); win.rotation.y = Math.PI; doorG.add(win);
    const handle = new THREE.Mesh(GEO.box, M.steel); handle.scale.set(0.14, 0.025, 0.03); handle.position.set(x0 < 2.5 ? x1 - 0.12 : x0 + 0.12, 1.0, D - 0.075); doorG.add(handle);
  }
  // door closer signs etc.
  K.boxB(M.paper, 2.25, 1.62, D - 0.061, 2.45, 1.82, D - 0.058);

  // ---- blackboard on the west wall (z 4.6..8.6)
  const bbCanvas = T.blackboardCanvas();
  const bbMat = new THREE.MeshStandardMaterial({ map: T.tex(bbCanvas), roughness: 0.85 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.6), bbMat);
  board.rotation.y = Math.PI / 2; board.position.set(0.035, 1.65, 6.6); board.receiveShadow = true; scene.add(board);
  K.boxB(M.woodMid, 0.0, 0.8, 4.5, 0.06, 0.86, 8.7); K.boxB(M.woodMid, 0.0, 2.44, 4.5, 0.06, 2.5, 8.7);
  K.boxB(M.woodMid, 0.0, 0.8, 4.5, 0.06, 2.5, 4.6); K.boxB(M.woodMid, 0.0, 0.8, 8.6, 0.06, 2.5, 8.7);
  K.boxB(M.woodMid, 0.0, 0.8, 4.6, 0.13, 0.84, 8.6);                       // chalk tray
  K.boxB(M.paper, 0.1, 0.84, 7.9, 0.12, 0.855, 7.98); K.boxB(M.paper, 0.09, 0.84, 6.1, 0.115, 0.85, 6.15);
  K.boxB(M.red, 0.09, 0.84, 6.2, 0.11, 0.85, 6.25);
  // a small painting above the board
  const paint = T.canvas(256, 200), pg = paint.getContext('2d');
  const sky = pg.createLinearGradient(0, 0, 0, 200); sky.addColorStop(0, '#9CC9E6'); sky.addColorStop(1, '#E9F3F7'); pg.fillStyle = sky; pg.fillRect(0, 0, 256, 200);
  pg.fillStyle = '#3F8D5A'; pg.beginPath(); pg.moveTo(0, 150); pg.quadraticCurveTo(80, 70, 150, 120); pg.quadraticCurveTo(210, 150, 256, 110); pg.lineTo(256, 200); pg.lineTo(0, 200); pg.fill();
  pg.fillStyle = '#2C78B7'; pg.fillRect(0, 165, 256, 35);
  const pm = new THREE.MeshStandardMaterial({ map: T.tex(paint), roughness: 0.8 });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.48), pm); pic.rotation.y = Math.PI / 2; pic.position.set(0.04, 2.66, 8.15); scene.add(pic);
  K.boxB(M.woodMid, 0.0, 2.4, 7.82, 0.035, 2.92, 8.48);

  // ---- bookshelf (black metal) west of the door, armchair and side shelf east of it
  K.boxB(M.black, 0.25, 0, 11.5, 1.45, 2.0, 11.95);
  for (let i = 0; i < 5; i++) {
    const y = 0.08 + i * 0.4;
    K.boxB(M.blackMatte, 0.28, y, 11.52, 1.42, y + 0.02, 11.93);
  }
  const bookMat = new THREE.MeshStandardMaterial({ map: T.books(30, 5), roughness: 0.8 });
  const bookMat2 = new THREE.MeshStandardMaterial({ map: T.books(30, 9), roughness: 0.8 });
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.3), i % 2 ? bookMat : bookMat2); p.position.set(0.85, 0.25 + i * 0.4, 11.52); p.rotation.y = Math.PI; scene.add(p); }
  solid(0.25, 11.5, 1.45, 11.95);
  // armchair (cream cushions, wooden frame)
  armchair(K, M, 4.45, 11.3, Math.PI);
  solid(4.0, 10.85, 4.9, 11.75);
  K.boxB(M.woodLight, 5.1, 0, 11.55, 5.6, 0.9, 11.95);           // small cabinet
  K.boxB(M.cream, 5.55, 1.2, D - 0.11, 5.95, 1.7, D - 0.01);       // electrical box
  K.boxB(M.paper, 6.05, 1.25, D - 0.012, 6.3, 1.6, D - 0.005);
  solid(5.1, 11.55, 5.6, 11.95);
  // boxes under the blackboard
  K.boxB(M.cardboard, 0.15, 0, 8.95, 0.65, 0.42, 9.6); K.boxB(M.cardboard, 0.2, 0.42, 9.05, 0.6, 0.62, 9.45, 0.1);
  solid(0.1, 8.9, 0.7, 9.65);

  // ---- north side: AC tower, round table, window desk, speaker, flammables cabinet, ladder, bookshelves
  K.boxB(M.white, 0.12, 0, 0.12, 0.62, 1.85, 0.52); K.boxB(M.whitePlastic, 0.14, 1.2, 0.5, 0.6, 1.7, 0.53);
  solid(0.12, 0.12, 0.62, 0.52);
  roundTable(K, M, 2.25, 2.4);
  solid(1.6, 1.75, 2.9, 3.05);
  K.boxB(M.woodLight, 3.25, 0.72, 0.12, 4.75, 0.75, 0.82);                         // window desk
  for (const [x, z] of [[3.3, 0.17], [4.7, 0.17], [3.3, 0.77], [4.7, 0.77]]) K.cylY(M.steel, x, z, 0.02, 0, 0.72, 'cyl8');
  officeChair(K, M, 4.0, 1.2, 0);
  solid(3.25, 0.12, 4.75, 0.82);
  K.boxB(M.woodDark, 4.95, 0, 0.12, 5.35, 0.85, 0.5);                               // speaker
  K.cylP(M.blackMatte, [5.15, 0.6, 0.5], [5.15, 0.6, 0.508], 0.1); K.cylP(M.blackMatte, [5.15, 0.25, 0.5], [5.15, 0.25, 0.508], 0.06);
  solid(4.95, 0.12, 5.35, 0.5);
  // flammables cabinet
  K.boxB(M.yellow, 5.6, 0, 0.1, 6.5, 1.65, 0.68);
  const flam = T.canvas(256, 128), fl = flam.getContext('2d');
  fl.fillStyle = '#F4B400'; fl.fillRect(0, 0, 256, 128); fl.fillStyle = '#C8102E'; fl.font = '700 30px "Plex", sans-serif'; fl.textAlign = 'center';
  fl.fillText('FLAMMABLE', 128, 50); fl.font = '700 20px "Plex", sans-serif'; fl.fillText('KEEP FIRE AWAY', 128, 88);
  const flamMat = new THREE.MeshStandardMaterial({ map: T.tex(flam), roughness: 0.5 });
  const fsign = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), flamMat); fsign.position.set(6.05, 1.35, 0.685); scene.add(fsign);
  K.boxB(M.black, 6.04, 0.3, 0.68, 6.06, 1.1, 0.69);
  solid(5.6, 0.1, 6.5, 0.68);
  K.cylY(M.steel, 6.75, 0.32, 0.11, 0, 1.4); K.cylY(M.steel, 6.75, 0.32, 0.05, 1.4, 1.55); K.sphere(M.steel, 6.75, 1.4, 0.32, 0.105);
  ladder(K, M, 7.05, 0.75);
  solid(6.6, 0.15, 7.4, 1.1);
  // wooden bookshelves along the north wall (x 7.45..9.95)
  K.boxB(M.woodDark, 7.45, 0, 0.05, 9.95, 2.25, 0.5);
  for (let i = 0; i < 6; i++) { const y = 0.05 + i * 0.42; K.boxB(M.woodMid, 7.5, y, 0.07, 9.9, y + 0.025, 0.5); }
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 0.36), i % 2 ? bookMat : bookMat2); p.position.set(8.7, 0.27 + i * 0.42, 0.505); scene.add(p);
  }
  solid(7.45, 0.05, 9.95, 0.5);

  // ---- east side: vacuum system, teal console, pegboard with tool chest
  K.boxB(M.cream, 9.1, 0, 1.6, 9.95, 1.05, 3.2);                                    // cream console
  K.boxB(M.beige, 9.08, 1.05, 1.6, 9.95, 1.09, 3.2);
  K.cylY(M.steel, 9.5, 2.2, 0.3, 1.09, 1.55); K.sphere(M.steel, 9.5, 1.55, 2.2, 0.3);  // chamber
  K.cylY(M.steel, 9.5, 2.2, 0.05, 1.8, 2.25); K.cylY(M.steel, 9.5, 2.75, 0.09, 1.09, 1.35);
  K.cylP(M.steel, [9.2, 1.4, 2.2], [8.98, 1.4, 2.2], 0.07);
  K.boxB(M.cream, 9.35, 0, 3.25, 9.95, 2.0, 3.85);                                  // control rack
  const ctl = T.panelCanvas({ w: 256, h: 512, base: '#E9E2CF', leds: [{ x: 40, y: 40, w: 170, h: 40, text: '2.1E-6', color: '#3CFF9A', bg: '#082014' }, { x: 40, y: 110, w: 170, h: 40, text: '24.8', color: '#FF3B2F' }], knobs: [[70, 220, 22], [180, 220, 22], [70, 300, 16], [180, 300, 16]], buttons: [{ x: 40, y: 360, cols: 4, rows: 3, bw: 34, bh: 22, gap: 9, colors: ['#D9D6CC', '#C8312B', '#2C8A4B'] }] });
  const ctlMat = faceMaterial(ctl);
  const ctlFace = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.1), ctlMat); ctlFace.rotation.y = -Math.PI / 2; ctlFace.position.set(9.345, 1.35, 3.55); scene.add(ctlFace);
  solid(9.05, 1.55, 9.95, 3.9);
  K.boxB(M.teal, 9.25, 0, 4.1, 9.95, 1.3, 5.2); K.boxB(M.tealDark, 9.23, 0.85, 4.15, 9.25, 1.25, 5.15);
  K.boxB(M.tealDark, 9.23, 0.1, 4.15, 9.25, 0.8, 4.62); K.boxB(M.tealDark, 9.23, 0.1, 4.68, 9.25, 0.8, 5.15);
  solid(9.2, 4.05, 9.95, 5.25);
  const pegTex = M.peg.map; pegTex.repeat.set(2.2 / 0.05, 1.1 / 0.05);
  const pb = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), M.peg); pb.rotation.y = -Math.PI / 2; pb.position.set(W - 0.03, 1.55, 7.0); pb.receiveShadow = true; scene.add(pb);
  for (let i = 0; i < 9; i++) {             // tools hanging on the pegboard
    const z = 6.1 + i * 0.22, y = 1.45 + (i % 3) * 0.18;
    K.boxB(i % 3 ? M.red : M.black, W - 0.07, y - 0.12, z - 0.015, W - 0.04, y + 0.08, z + 0.015);
  }
  K.boxB(M.yellow, 9.35, 0, 6.3, 9.95, 0.95, 7.3);                                // tool chest
  for (let i = 0; i < 4; i++) K.boxB(M.black, 9.33, 0.12 + i * 0.2, 6.35, 9.35, 0.14 + i * 0.2, 7.25);
  solid(9.3, 6.25, 9.95, 7.35);

  // ---- optical table A (FMR, with overhead frame) and the PC desk / TV beside it
  const tA = { cx: 6.2, cz: 5.6, w: 1.5, d: 3.0, top: 0.8 };
  opticalTable(K, M, tA);
  overheadFrame(K, M, tA, scene);
  solid(tA.cx - tA.w / 2 - 0.02, tA.cz - tA.d / 2 - 0.02, tA.cx + tA.w / 2 + 0.02, tA.cz + tA.d / 2 + 0.02);
  // PC desk with brown top (FMR computer)
  pcDesk(K, M, 4.95, 6.55);
  solid(4.65, 6.25, 5.25, 6.85);
  officeChair(K, M, 4.3, 6.55, Math.PI / 2);
  // white folding table with tools (north of the rack)
  K.boxB(M.white, 4.15, 0.72, 2.6, 5.35, 0.75, 3.3);
  for (const [x, z] of [[4.2, 2.65], [5.3, 2.65], [4.2, 3.25], [5.3, 3.25]]) K.cylY(M.white, x, z, 0.02, 0.05, 0.72, 'cyl8');
  K.boxB(M.whitePlastic, 4.3, 0.75, 2.75, 4.75, 0.86, 3.05); K.boxB(M.blackMatte, 4.85, 0.75, 2.8, 5.25, 0.77, 3.05);
  solid(4.15, 2.6, 5.35, 3.3);

  // ---- white stand TV beside the PC desk, showing a photo of the team
  const tvx = 4.72, tvz = 8.05;
  K.cylY(M.tvWhite, tvx, tvz, 0.21, 0, 0.035); K.cylY(M.tvWhite, tvx, tvz, 0.022, 0.035, 1.02);
  K.box(M.tvWhite, tvx + 0.03, 1.3, tvz, 0.05, 0.6, 1.02, 0.35);
  const tvC = T.canvas(1024, 576), tg = tvC.getContext('2d');
  tg.fillStyle = '#0E2A4D'; tg.fillRect(0, 0, 1024, 576);
  tg.fillStyle = '#FFFFFF'; tg.font = '600 64px "Plex", sans-serif'; tg.textAlign = 'center'; tg.fillText('M² Lab', 512, 300);
  const tvMat = screenMaterial(tvC);
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.552), tvMat);
  tvScreen.position.set(tvx - Math.cos(0.35) * 0.0, 1.3, tvz); tvScreen.rotation.y = -Math.PI / 2 + 0.35;
  tvScreen.position.x -= 0.0; tvScreen.translateZ(0.001 + 0.0); scene.add(tvScreen);
  tvScreen.position.set(tvx + 0.03 - 0.026 * Math.cos(0.35), 1.3, tvz + 0.026 * Math.sin(0.35));
  const photo = new Image();
  photo.onload = () => {
    const s = Math.max(1024 / photo.width, 576 / photo.height), w = photo.width * s, h = photo.height * s;
    tg.drawImage(photo, (1024 - w) / 2, (576 - h) / 2, w, h);
    tvMat.map.needsUpdate = true; invalidate();
  };
  photo.src = 'images/kps2026-team.jpg';
  solid(tvx - 0.22, tvz - 0.22, tvx + 0.22, tvz + 0.22);

  // ---- optical table B (BLS / Kerr) in the south-east
  const tB = { cx: 8.15, cz: 9.6, w: 1.2, d: 2.4, top: 0.8 };
  opticalTable(K, M, tB);
  solid(tB.cx - tB.w / 2 - 0.02, tB.cz - tB.d / 2 - 0.02, tB.cx + tB.w / 2 + 0.02, tB.cz + tB.d / 2 + 0.02);
  officeChair(K, M, 9.25, 10.3, Math.PI / 2 + 0.3);

  // ---- simulation desk on the west wall, north of the blackboard
  K.boxB(M.deskTop, 0.08, 0.72, 2.95, 0.83, 0.755, 4.45);
  K.boxB(M.black, 0.1, 0, 3.0, 0.8, 0.72, 3.04); K.boxB(M.black, 0.1, 0, 4.36, 0.8, 0.72, 4.4);
  K.boxB(M.blackMatte, 0.15, 0.04, 4.0, 0.62, 0.5, 4.28);                                       // tower PC
  solid(0.08, 2.95, 0.83, 4.45);
  officeChair(K, M, 1.3, 3.7, -Math.PI / 2);

  // ---- ceiling services: LED panels, AC cassette, pipes, cable tray
  const leds = [[2.4, 2.6], [2.4, 8.7], [6.8, 2.6], [6.8, 8.7], [4.6, 4.3], [8.4, 4.6]];
  for (const [x, z] of leds) {
    K.boxB(M.fixture, x - 0.62, H - 0.36, z - 0.11, x + 0.62, H - 0.3, z + 0.11);
    K.boxB(M.led, x - 0.6, H - 0.362, z - 0.09, x + 0.6, H - 0.358, z + 0.09);
    K.cylY(M.steel, x - 0.5, z, 0.004, H - 0.3, H); K.cylY(M.steel, x + 0.5, z, 0.004, H - 0.3, H);
  }
  const acMat = new THREE.MeshStandardMaterial({ map: T.acGrille(), roughness: 0.6 });
  K.boxB(M.fixture, 5.1, H - 0.22, 7.7, 5.95, H, 8.55);
  const ac = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), acMat); ac.rotation.x = Math.PI / 2; ac.position.set(5.525, H - 0.221, 8.125); scene.add(ac);
  // pipes along x near the north wall and across the room
  K.cylP(M.pipeWhite, [0, 2.78, 0.45], [W, 2.78, 0.45], 0.075);
  K.cylP(M.pipeBlue, [0, 2.86, 0.8], [W, 2.86, 0.8], 0.055);
  K.cylP(M.pipeBlack, [0, 2.88, 1.1], [W, 2.88, 1.1], 0.045);
  K.cylP(M.pipeWhite, [0, 2.7, 1.45], [W, 2.7, 1.45], 0.05);
  K.cylP(M.pipeWhite, [5.0, 2.82, 0.45], [5.0, 2.82, D], 0.06);
  K.cylP(M.pipeBlack, [3.2, 2.9, 0.45], [3.2, 2.9, D], 0.035);
  K.cylP(M.pipeWhite, [0, 2.9, 10.6], [W, 2.9, 10.6], 0.04);
  K.boxB(M.pipeBlack, 7.2, 2.84, 0, 7.5, 2.88, D);                                   // cable tray
  K.cylP(M.pipeBlack, [0.08, 2.9, 0.3], [0.08, 2.9, 11.6], 0.03);                     // conduit on the west wall
  // fume extraction arms above table A
  fumeArm(K, M, 5.75, 4.75, 2.05);
  fumeArm(K, M, 6.75, 5.35, 2.1);
  fumeArm(K, M, 7.3, 8.6, 2.15);

  const statics = B.build(scene);

  // ---- lights
  const hemi = new THREE.HemisphereLight(0xFFF9EF, 0xC9BFAE, 0.85); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xFFFBF2, 1.25);
  sun.position.set(3.5, 9, 7.5); sun.target.position.set(5.5, 0, 6.5);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 20 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  for (const [x, z] of [[2.4, 2.6], [6.8, 8.7], [4.6, 4.3]]) {
    const p = new THREE.PointLight(0xFFF4E2, 3.0, 7, 1.6); p.position.set(x, H - 0.45, z); scene.add(p);
  }

  // spots where stations put their apparatus
  const spots = {
    tableA: tA, tableB: tB,
    rack: { x: 4.95, z: 4.35, face: -Math.PI / 2 },
    pcDesk: { x: 4.95, z: 6.55 },
    blackboard: { canvas: bbCanvas, texture: bbMat.map, mesh: board },
    simDesk: { x: 0.45, z: 3.7, top: 0.755 },
    tv: { x: 4.75, z: 8.0 },
    door: { group: doorG, x: 2.8, z: D },
  };
  return { scene, M, K, colliders, statics, floor, spots, sun };
}

// ---------------------------------------------------------------- furniture
function opticalTable(K, M, t) {
  const x0 = t.cx - t.w / 2, x1 = t.cx + t.w / 2, z0 = t.cz - t.d / 2, z1 = t.cz + t.d / 2;
  K.boxB(M.black, x0, t.top - 0.3, z0, x1, t.top - 0.012, z1);                          // honeycomb body
  // legs (isolators)
  for (const [x, z] of [[x0 + 0.18, z0 + 0.25], [x1 - 0.18, z0 + 0.25], [x0 + 0.18, z1 - 0.25], [x1 - 0.18, z1 - 0.25]]) {
    K.boxB(M.black, x - 0.13, 0, z - 0.13, x + 0.13, t.top - 0.3, z + 0.13);
    K.boxB(M.blackMatte, x - 0.15, 0, z - 0.15, x + 0.15, 0.05, z + 0.15);
  }
  // breadboard top with 25 mm holes
  const g = new THREE.PlaneGeometry(t.w, t.d);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * t.w / 0.025, uv.getY(i) * t.d / 0.025);
  K.geom(g, M.breadboard, mat4(t.cx, t.top, t.cz, -Math.PI / 2, 0, 0));
}

function overheadFrame(K, M, t, scene) {
  const x0 = t.cx - t.w / 2 - 0.05, x1 = t.cx + t.w / 2 + 0.05, z0 = t.cz - t.d / 2 - 0.05, z1 = t.cz + t.d / 2 + 0.05;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) K.boxB(M.black, x - 0.04, 0, z - 0.04, x + 0.04, 1.98, z + 0.04);
  K.boxB(M.black, x0 - 0.04, 1.9, z0 - 0.06, x1 + 0.04, 1.98, z0 + 0.06);
  K.boxB(M.black, x0 - 0.04, 1.9, z1 - 0.06, x1 + 0.04, 1.98, z1 + 0.06);
  K.boxB(M.black, x0 - 0.06, 1.9, z0, x0 + 0.06, 1.98, z1);
  K.boxB(M.black, x1 - 0.06, 1.9, z0, x1 + 0.06, 1.98, z1);
  K.boxB(M.blackMatte, x0, 1.62, z0, x1, 1.645, z1);                                      // shelf
  // outlets along the front beam
  for (let i = 0; i < 6; i++) { const z = z0 + 0.3 + i * 0.5; K.boxB(M.whitePlastic, x0 - 0.065, 1.92, z - 0.05, x0 - 0.055, 1.96, z + 0.05); }
  // instruments on the shelf
  const boxes = [[0.25, 0.14, 0.32, M.instWhite], [0.22, 0.12, 0.3, M.blackMatte], [0.3, 0.16, 0.35, M.instWhite], [0.2, 0.1, 0.28, M.beige], [0.26, 0.13, 0.33, M.blackMatte], [0.22, 0.09, 0.3, M.instWhite]];
  let z = z0 + 0.2;
  for (const [w, h, d, m] of boxes) { K.boxB(m, x0 + 0.08, 1.645, z, x0 + 0.08 + d, 1.645 + h, z + w); z += w + 0.18; }
  K.boxB(M.black, x1 - 0.42, 1.645, t.cz - 0.3, x1 - 0.12, 1.85, t.cz + 0.05);
}

function pcDesk(K, M, x, z) {
  K.boxB(M.deskTop, x - 0.28, 0.76, z - 0.36, x + 0.28, 0.79, z + 0.36);
  K.boxB(M.black, x - 0.05, 0.02, z - 0.05, x + 0.05, 0.76, z + 0.05);
  K.boxB(M.black, x - 0.28, 0, z - 0.04, x + 0.28, 0.03, z + 0.04);
  K.boxB(M.black, x - 0.04, 0, z - 0.3, x + 0.04, 0.03, z + 0.3);
}

function officeChair(K, M, x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  K.cylY(M.chair, x, z, 0.03, 0.08, 0.45, 'cyl8');
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; K.cylP(M.chair, [x, 0.08, z], [x + 0.28 * Math.cos(a), 0.05, z + 0.28 * Math.sin(a)], 0.018, 'cyl8'); }
  K.box(M.chairSeat, x, 0.47, z, 0.46, 0.06, 0.46, ry);
  const [bx, bz] = P(0, -0.25);
  K.box(M.mesh, bx, 0.8, bz, 0.4, 0.42, 0.015, ry);
  for (const sx of [-0.21, 0.21]) { const [qx, qz] = P(sx, -0.25); K.box(M.chair, qx, 0.74, qz, 0.025, 0.56, 0.03, ry); }
  const [tx, tz] = P(0, -0.25); K.box(M.chair, tx, 1.02, tz, 0.44, 0.03, 0.03, ry);
}

function armchair(K, M, x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (dx, dz) => [x + dx * c + dz * s, z - dx * s + dz * c];
  for (const sx of [-0.36, 0.36]) {
    for (const sz of [-0.3, 0.3]) { const [px, pz] = P(sx, sz); K.box(M.woodDark, px, 0.3, pz, 0.05, 0.6, 0.05, ry); }
    const [ax, az] = P(sx, 0); K.box(M.woodDark, ax, 0.6, az, 0.07, 0.04, 0.72, ry);
  }
  const [sx2, sz2] = P(0, 0.02); K.box(M.cream, sx2, 0.36, sz2, 0.64, 0.14, 0.6, ry);
  const [bx, bz] = P(0, -0.3); K.box(M.cream, bx, 0.72, bz, 0.62, 0.62, 0.12, ry, -0.12);
}

function roundTable(K, M, x, z) {
  K.cylY(M.woodLight, x, z, 0.62, 0.72, 0.76);
  K.cylY(M.white, x, z, 0.05, 0.05, 0.72);
  K.cylY(M.white, x, z, 0.32, 0.0, 0.05);
  officeChair(K, M, x + 0.85, z + 0.25, Math.PI / 2 + 0.3);
  officeChair(K, M, x - 0.2, z + 0.85, 0.2);
  K.boxB(M.woodMid, x - 0.35, 0.76, z - 0.3, x - 0.05, 0.85, z - 0.05);
}

function ladder(K, M, x, z) {
  for (const dx of [-0.22, 0.22]) {
    K.cylP(M.aluminium, [x + dx, 0, z - 0.35], [x + dx, 1.2, z - 0.05], 0.018, 'cyl8');
    K.cylP(M.aluminium, [x + dx, 0, z + 0.25], [x + dx, 1.2, z - 0.05], 0.018, 'cyl8');
  }
  for (let i = 1; i < 4; i++) { const t = i / 4; K.box(M.black, x, t * 1.2, z - 0.35 + t * 0.3, 0.44, 0.03, 0.1); }
}

function fumeArm(K, M, x, z, yHood) {
  // ceiling mount, two articulated segments, a hood
  K.cylY(M.pipeWhite, x, z - 0.6, 0.075, H - 0.25, H);
  const j1 = [x, H - 0.3, z - 0.6], j2 = [x + 0.15, yHood + 0.45, z - 0.25], j3 = [x, yHood + 0.12, z];
  K.cylP(M.pipeWhite, j1, j2, 0.06); K.cylP(M.pipeWhite, j2, j3, 0.055);
  K.sphere(M.pipeWhite, ...j1, 0.075); K.sphere(M.pipeWhite, ...j2, 0.075);
  const pts = [new THREE.Vector2(0.02, 0.12), new THREE.Vector2(0.06, 0.1), new THREE.Vector2(0.09, 0.04), new THREE.Vector2(0.2, -0.04), new THREE.Vector2(0.24, -0.1)];
  const hood = new THREE.LatheGeometry(pts, 28);
  K.geom(hood, M.hood, mat4(x, yHood, z));
}
