// M² Lab virtual lab: boots the 3D room, the stations and their panels.

import * as THREE from './vendor/three.js';
import { buildRoom, Batcher, makeKit, screenMaterial, faceMaterial, W, D } from './world/room.js';
import * as T from './world/textures.js';
import { Controls } from './world/controls.js';
import { Labels } from './world/labels.js';
import { Panel } from './ui/panel.js';
import { el } from './ui/widgets.js';
import { STATIONS } from './stations/index.js';

const main = document.getElementById('vlab');
const canvas = document.getElementById('vl-canvas');
const loading = document.querySelector('.vl-loading');
const isTouch = matchMedia('(pointer: coarse)').matches;

const panel = new Panel(main, {
  onClose: () => { app && app.onPanel(false); },
  onTab: (st, tab) => { try { history.replaceState(null, '', `#${st.id}/${tab}`); } catch (_) {} },
});

const flat = new URLSearchParams(location.search).has('flat');
window.__vlabStations = STATIONS;
let app = null;
setupMenu();
setupIntro();
// canvas textures (instrument panels, the blackboard) need the web font, so wait for it briefly
const fontReady = document.fonts && document.fonts.load
  ? Promise.race([document.fonts.load('600 16px Plex').catch(() => {}), new Promise((r) => setTimeout(r, 1500))])
  : Promise.resolve();
fontReady.then(() => {
  if (flat) fallback(null);
  else {
    try { app = boot(); }
    catch (err) { console.error(err); fallback(err); }
  }
  if (loading) loading.remove();
  openFromHash();
});

function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.3 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  let needsRender = true, shadowsDirty = true;
  const invalidate = () => { needsRender = true; };
  const room = buildRoom(renderer, { invalidate });
  if (isTouch) room.sun.shadow.mapSize.set(1024, 1024);   // lighter on phones and tablets
  const { scene } = room;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(isTouch ? 70 : 62, 1, 0.05, 60);
  const tickers = [];

  // stations build their apparatus into one more batch
  const SB = new Batcher(), SK = makeKit(SB);
  const proxies = [], pickables = [];
  const world = {
    THREE, scene, M: room.M, K: SK, spots: room.spots, T, renderer, camera,
    invalidate, screenMaterial, faceMaterial,
    shadowsChanged: () => { shadowsDirty = true; needsRender = true; },
    addCollider: (x0, z0, x1, z1) => room.colliders.push({ x0, z0, x1, z1 }),
    onTick: (fn) => tickers.push(fn),
    proxy(station, x0, y0, z0, x1, y1, z1) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.MeshBasicMaterial({ visible: false }));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.userData.station = station;
      scene.add(m); proxies.push(m); return m;
    },
    pickable(obj, station) { obj.userData.station = station; pickables.push(obj); },
  };
  const placed = [];
  for (const st of STATIONS) {
    const info = st.build3D ? st.build3D(world) : null;
    if (info) placed.push({ st, ...info });
  }
  const stationStatics = SB.build(scene);
  const occluders = [...room.statics, ...stationStatics];

  // controls and labels
  const controls = new Controls(camera, canvas, {
    colliders: room.colliders, bounds: { x0: 0, z0: 0, x1: W, z1: D },
    onTap: (p) => pick(p, true),
    onHover: (p) => hover(p),
  });
  const labels = new Labels(document.querySelector('.vl-labels'), camera, { occluders, onClick: (st) => openStation(st) });
  for (const p of placed) if (p.anchor) labels.add(p.st, p.anchor);

  const ray = new THREE.Raycaster();
  const stationOf = (obj) => { for (let o = obj; o; o = o.parent) if (o.userData && o.userData.station) return o.userData.station; return null; };
  let hovered = null, hoverT = 0;
  function hover(p) {
    const now = performance.now(); if (now - hoverT < 40) return; hoverT = now;
    let st = null;
    if (p) {
      ray.setFromCamera(p, camera);
      const hit = ray.intersectObjects([...proxies, ...pickables], true)[0];
      if (hit && hit.distance < 9) st = stationOf(hit.object);
    }
    if (st !== hovered) { hovered = st; labels.hot(st); canvas.classList.toggle('is-pointing', !!st); }
  }
  function pick(p) {
    ray.setFromCamera(p, camera);
    const hits = ray.intersectObjects([...proxies, ...pickables, room.floor, ...occluders], true);
    const near = hits[0];
    if (!near) return;
    const st = stationOf(near.object);
    if (st && near.distance < 9) { openStation(st); return; }
    const floorHit = hits.find((h) => h.object === room.floor);
    if (floorHit && (near.object === room.floor || floorHit.distance - near.distance < 0.05)) {
      controls.walkTo(floorHit.point.x, floorHit.point.z); fadeHint();
    }
  }

  function openStation(st, tab) {
    if (st.action) { st.action(); return; }
    const pl = placed.find((p) => p.st === st);
    panel.open(st, tab);
    onPanel(true);
    if (pl && pl.view) controls.flyTo(pl.view, 1.1);
    fadeHint();
  }

  // camera shift so the station stays visible beside the panel
  let offX = 0, offTarget = 0;
  function onPanel(open) {
    controls.keysEnabled = !open;
    updateOffsetTarget(); needsRender = true;
    document.body.classList.toggle('panel-open', open);
    if (!open) { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {} canvas.focus({ preventScroll: true }); }
  }
  function updateOffsetTarget() {
    const w = main.clientWidth, pw = panel.isOpen ? panel.root.offsetWidth : 0;
    offTarget = panel.isOpen && pw < w - 120 ? pw / 2 : 0;
  }

  function resize() {
    const w = main.clientWidth, h = main.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    updateOffsetTarget();
    applyOffset();
    needsRender = true;
  }
  function applyOffset() {
    const w = main.clientWidth, h = main.clientHeight;
    if (Math.abs(offX) < 0.5) camera.clearViewOffset();
    else camera.setViewOffset(w, h, offX, 0, w, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(main);
  resize();

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let dirty = controls.update(dt) || needsRender;
    if (Math.abs(offX - offTarget) > 0.5) { offX += (offTarget - offX) * Math.min(1, dt * 10); applyOffset(); dirty = true; }
    else if (offX !== offTarget) { offX = offTarget; applyOffset(); dirty = true; }
    for (const fn of tickers) if (fn(dt, now / 1000)) dirty = true;
    if (dirty) {
      if (shadowsDirty) { renderer.shadowMap.needsUpdate = true; shadowsDirty = false; }
      renderer.render(scene, camera);
      labels.update();
      needsRender = false;
    }
  }
  requestAnimationFrame(frame);
  canvas.addEventListener('pointerdown', fadeHint, { once: true });
  window.addEventListener('keydown', (e) => { if (/^[wasd]$|^arrow/i.test(e.key)) fadeHint(); }, { once: false });

  const api = { openStation, onPanel, invalidate, controls, camera, scene, renderer };
  window.__vlab = api;   // for debugging in the console
  return api;
}

function openStation(st, tab) {
  if (app) app.openStation(st, tab);
  else { if (st.action) { st.action(); return; } panel.open(st, tab); panel.setWide(true); }
}
window.__vlabOpen = openStation;

function openFromHash() {
  const m = location.hash.match(/^#([\w-]+)(?:\/([\w-]+))?/);
  if (!m) return;
  const st = STATIONS.find((s) => s.id === m[1]);
  if (st) { hideIntro(); setTimeout(() => openStation(st, m[2]), 300); }
}

function fallback(err) {
  const box = document.querySelector('.vl-fallback');
  box.hidden = false;
  canvas.hidden = true;
  document.querySelector('.vl-hint').hidden = true;
  panel.flat = true;
  if (!err) {
    box.querySelector('h2').textContent = 'The instruments, without the 3D room';
    box.querySelector('p').innerHTML = 'Pick an instrument below, or <a href="lab.html">walk around the 3D room</a> instead.';
    document.getElementById('vl-intro').hidden = true;
  }
  const list = el('div', { class: 'vp-row', style: { justifyContent: 'center', marginTop: '16px' } },
    STATIONS.filter((s) => !s.action).map((s) => el('button', { type: 'button', class: 'vbtn vbtn-go', text: s.title, onclick: () => openStation(s) })));
  box.querySelector('div').append(list);
  if (err) console.warn('3D view unavailable:', err.message);
}

// ---------------------------------------------------------------- instrument menu
function setupMenu() {
  const btn = document.getElementById('vl-menu-btn'), menu = document.getElementById('vl-menu');
  const ul = menu.querySelector('ul');
  for (const st of STATIONS) {
    if (st.separator) ul.append(el('li', { class: 'sep', role: 'separator' }));
    ul.append(el('li', {}, el('button', { type: 'button', onclick: () => { close(); openStation(st); } },
      el('span', { class: 'ic', 'aria-hidden': 'true', text: st.icon || st.title[0] }),
      el('span', { class: 'nm', text: st.title }), el('span', { class: 'ds', text: st.blurb || '' }))));
  }
  function open() { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); const f = menu.querySelector('button'); f && f.focus(); }
  function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); btn.focus(); }
    const items = [...menu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
}

// ---------------------------------------------------------------- intro and hints
function setupIntro() {
  const intro = document.getElementById('vl-intro');
  const hint = document.querySelector('.vl-hint');
  hint.innerHTML = isTouch
    ? '<b>Drag</b> to look around · <b>tap the floor</b> to walk · <b>tap an instrument</b> to use it'
    : '<b>Drag</b> to look around · <b>W A S D</b> or <b>arrow keys</b> to walk · <b>click an instrument</b> to use it';
  let seen = false;
  try { seen = localStorage.getItem('m2lab-vlab-intro') === '1'; } catch (_) {}
  if (seen && !location.hash) intro.hidden = true;
  document.getElementById('vl-enter').addEventListener('click', () => { hideIntro(); canvas.focus({ preventScroll: true }); });
  document.getElementById('vl-tour').addEventListener('click', () => { hideIntro(); document.getElementById('vl-menu-btn').click(); });
  document.getElementById('vl-help').addEventListener('click', () => { intro.hidden = false; document.getElementById('vl-enter').focus(); });
  intro.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideIntro(); });
  if (!intro.hidden) setTimeout(() => document.getElementById('vl-enter').focus({ preventScroll: true }), 50);
}
function hideIntro() {
  const intro = document.getElementById('vl-intro');
  intro.hidden = true;
  try { localStorage.setItem('m2lab-vlab-intro', '1'); } catch (_) {}
}
let hintFaded = false;
function fadeHint() {
  if (hintFaded) return; hintFaded = true;
  setTimeout(() => document.querySelector('.vl-hint').classList.add('is-faded'), 6000);
}
