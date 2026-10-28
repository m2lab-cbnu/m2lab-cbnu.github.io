// The little top-down engine: floors, walking on a tile grid, people, things to use, a camera
// that keeps pixels crisp, keyboard / touch / click-to-walk, and labels for whatever you face.

import { TILE, renderFloor, windowRects, WALLS, FACES } from './tiles.js';
import { PROPS, propSprite } from './props.js';
import { playerSprites, npcSprites, dropShadow } from './sprites.js';
import { Pix, PAL } from './pix.js';

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};
const ACTION_KEYS = new Set([' ', 'Enter', 'e', 'E', 'z', 'Z']);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Game {
  constructor(canvas, world, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.opts = opts;
    this.buf = new Pix(8, 8);
    this.floors = {};
    for (const [k, f] of Object.entries(world.floors)) this.floors[k] = this._prepare(f);
    this.p = { floor: 1, x: 6, y: 19, dir: 'up', fx: 6, fy: 19, moving: false, t: 0, from: [6, 19], step: 0, style: 'teal', run: false };
    this.held = [];
    this.path = null; this.pathGoal = null;
    this.frozen = 0;
    this.fade = 0; this.fadeDir = 0; this.fadeCb = null;
    this.time = 0;
    this.inset = { left: 0, right: 0, bottom: 0 };
    this.hover = null; this.focusTarget = null;
    this.scale = 3;
    this.labels = [];
    this._bind();
    this._resize();
    if ('ResizeObserver' in window) new ResizeObserver(() => this._resize()).observe(canvas);
    window.addEventListener('resize', () => this._resize());
    this._last = performance.now();
    this.running = true;
    this.hiddenView = false;
    const loop = (now) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      if (document.hidden || this.hiddenView) { this._last = now; return; }
      // while a panel or a menu is open the building only idles, so draw it less often
      if (this.frozen && now - this._last < 66) return;
      const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
      this.update(dt);
      this.render();
    };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ setup
  _prepare(f) {
    const W = f.rows[0].length, H = f.rows.length;
    const layer = renderFloor(f);
    const P = new Pix(layer.width, layer.height, layer.getContext('2d'));
    const solid = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = f.rows[y][x];
      solid[y * W + x] = (WALLS.has(c) || c === ' ' || (c === '#')) ? 1 : 0;
    }
    const props = [], wallProps = [], floorProps = [];
    for (const p of f.props || []) {
      const def = PROPS[p.type];
      if (!def) { console.warn('no prop', p.type); continue; }
      const q = Object.assign({ w: (p.opt && p.opt.w) || def.w, h: (p.opt && p.opt.h) || def.h }, p);
      q.def = def; q.img = propSprite(q);
      if (def.floor) {
        P.draw(q.img, q.x * TILE, q.y * TILE);
        floorProps.push(q);
        continue;
      }
      if (def.wall) {
        // wall pieces sit on the wall face; x, y is the top-left face tile
        q.px = q.x * TILE + Math.round((q.w * TILE - q.img.width) / 2);
        q.py = q.y * TILE + (q.dy || 0) + Math.round((q.h * TILE - q.img.height) / 2);
        P.draw(q.img, q.px, q.py);
        wallProps.push(q);
        continue;
      }
      q.px = q.x * TILE + Math.round((q.w * TILE - q.img.width) / 2) + (q.dx || 0);
      q.py = (q.y + q.h) * TILE - q.img.height + 1 + (q.dy || 0);
      q.sortY = (q.y + q.h) * TILE - 1 + (q.sort || 0);
      if (!q.walkable) for (let j = 0; j < q.h; j++) for (let i = 0; i < q.w; i++) solid[(q.y + j) * W + q.x + i] = 1;
      props.push(q);
    }
    const npcs = (f.npcs || []).map((n) => Object.assign({ fx: n.x, fy: n.y, moving: false, t: 0, from: [n.x, n.y], frame: 0, wait: 1 + Math.random() * 3, floor: f.floor }, n));
    return { ...f, W, H, layer, solid, props, wallProps, floorProps, npcs, windows: windowRects(f) };
  }

  get floor() { return this.floors[this.p.floor]; }

  setStyle(style) { this.p.style = style; }
  teleport(floor, x, y, dir) {
    this.p.floor = floor; this.p.x = this.p.fx = x; this.p.y = this.p.fy = y; this.p.dir = dir || this.p.dir;
    this.p.moving = false; this.path = null; this.p.from = [x, y];
    if (this.opts.onFloor) this.opts.onFloor(floor);
    this._announce();
  }
  freeze(on) { this.frozen = Math.max(0, this.frozen + (on ? 1 : -1)); if (on) { this.held = []; this.path = null; } }
  setInset(inset) { Object.assign(this.inset, inset); }

  npc(id) {
    for (const f of Object.values(this.floors)) { const n = f.npcs.find((m) => m.id === id); if (n) return n; }
    return null;
  }
  moveNpc(id, floor, x, y, dir) {
    const n = this.npc(id); if (!n) return;
    const from = this.floors[n.floor]; from.npcs.splice(from.npcs.indexOf(n), 1);
    n.floor = floor; n.x = n.fx = x; n.y = n.fy = y; n.from = [x, y]; n.moving = false; if (dir) n.dir = dir;
    this.floors[floor].npcs.push(n);
  }

  // ------------------------------------------------------------ input
  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || this._typing(e)) return;
      if (this.frozen) return;
      const d = KEYMAP[e.key];
      if (d) {
        e.preventDefault();
        if (!this.held.includes(d)) this.held.push(d);
        this.path = null;
        if (this.opts.onActivity) this.opts.onActivity();
        return;
      }
      if (e.key === 'Shift') this.p.run = true;
      if (ACTION_KEYS.has(e.key) && !e.repeat) {
        if (document.activeElement && document.activeElement !== document.body && document.activeElement !== this.canvas) return;
        e.preventDefault(); this.act();
      }
    });
    window.addEventListener('keyup', (e) => {
      const d = KEYMAP[e.key];
      if (d) this.held = this.held.filter((h) => h !== d);
      if (e.key === 'Shift') this.p.run = false;
    });
    window.addEventListener('blur', () => { this.held = []; this.p.run = false; });
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.frozen) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      c.focus({ preventScroll: true });
      const w = this._toWorld(e);
      const target = this._targetAtPixel(w.x, w.y);
      if (this.opts.onActivity) this.opts.onActivity();
      if (target) this.goUse(target);
      else this.goTo(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const w = this._toWorld(e);
      const t = this._targetAtPixel(w.x, w.y);
      this.hover = t;
      c.style.cursor = t ? 'pointer' : '';
    });
    c.addEventListener('pointerleave', () => { this.hover = null; });
  }
  _typing(e) {
    const a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
  }
  // virtual pad
  press(dir, on) {
    if (this.frozen) return;
    if (on) { if (!this.held.includes(dir)) this.held.push(dir); this.path = null; }
    else this.held = this.held.filter((h) => h !== dir);
  }

  _toWorld(e) {
    const r = this.canvas.getBoundingClientRect(), dpr = this._dpr;
    return { x: (e.clientX - r.left) * dpr / this.scale + this.cam.x, y: (e.clientY - r.top) * dpr / this.scale + this.cam.y };
  }

  // ------------------------------------------------------------ world queries
  blocked(x, y, who) {
    const f = this.floor;
    if (x < 0 || y < 0 || x >= f.W || y >= f.H) return true;
    if (f.solid[y * f.W + x]) return true;
    for (const n of f.npcs) {
      if (n === who || n.hidden) continue;
      if ((n.x === x && n.y === y) || (n.moving && n.from[0] === x && n.from[1] === y)) return true;
    }
    if (who && who !== this.p) {
      const p = this.p;
      if ((p.x === x && p.y === y) || (p.moving && p.from[0] === x && p.from[1] === y)) return true;
    }
    return false;
  }
  tileAt(x, y) { const f = this.floor; return (y >= 0 && y < f.H && x >= 0 && x < f.W) ? f.rows[y][x] : '#'; }
  propAt(x, y) {
    return this.floor.props.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) || null;
  }
  wallPropAt(x, y) {
    return this.floor.wallProps.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) || null;
  }
  npcAt(x, y) { return this.floor.npcs.find((n) => !n.hidden && n.x === x && n.y === y) || null; }

  // what is in front of the player
  facing() {
    const [dx, dy] = DIRS[this.p.dir];
    return this.targetAtTile(this.p.x + dx, this.p.y + dy, dx, dy);
  }
  targetAtTile(x, y, dx = 0, dy = 0) {
    const n = this.npcAt(x, y);
    if (n) return { kind: 'npc', npc: n, x, y };
    const q = this.propAt(x, y);
    if (q) {
      if (q.counter) { const m = this.npcAt(x + dx, y + dy) || this.npcAt(x + dx * 2, y + dy * 2); if (m) return { kind: 'npc', npc: m, x, y }; }
      if (q.use) return { kind: 'prop', prop: q, x, y };
      return { kind: 'thing', prop: q, x, y };
    }
    const w = this.wallPropAt(x, y);
    if (w && w.use) return { kind: 'prop', prop: w, x, y };
    const c = this.tileAt(x, y);
    if (c === 'E' || c === 'e') return { kind: 'elevator', x, y };
    if (c === 'O' || c === 'o') return { kind: 'window', x, y };
    if (w) return { kind: 'thing', prop: w, x, y };
    return null;
  }
  // pixel hit test for clicks: people first, then tall sprites, then tiles
  _targetAtPixel(wx, wy) {
    const f = this.floor;
    for (const n of f.npcs) {
      if (n.hidden) continue;
      const nx = n.fx * TILE, ny = n.fy * TILE;
      if (wx >= nx && wx < nx + TILE && wy >= ny - 8 && wy < ny + TILE) return { kind: 'npc', npc: n, x: n.x, y: n.y };
    }
    const order = f.props.slice().sort((a, b) => b.sortY - a.sortY);
    for (const q of order) {
      if (!q.use) continue;
      if (wx >= q.px && wx < q.px + q.img.width && wy >= q.py && wy < q.py + q.img.height) {
        // ignore clear pixels so you can click past an open frame
        const ix = Math.floor(wx - q.px), iy = Math.floor(wy - q.py);
        try { if (q.img.getContext('2d').getImageData(ix, iy, 1, 1).data[3] < 30 && !(wx >= q.x * TILE && wx < (q.x + q.w) * TILE && wy >= q.y * TILE && wy < (q.y + q.h) * TILE)) continue; } catch (_) {}
        return { kind: 'prop', prop: q, x: q.x, y: q.y };
      }
    }
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    const w = this.wallPropAt(tx, ty);
    if (w && w.use) return { kind: 'prop', prop: w, x: tx, y: ty };
    const c = this.tileAt(tx, ty);
    if (c === 'E' || c === 'e') return { kind: 'elevator', x: tx, y: ty };
    return null;
  }

  // ------------------------------------------------------------ moving
  goTo(tx, ty, then) {
    const f = this.floor;
    if (tx < 0 || ty < 0 || tx >= f.W || ty >= f.H) return;
    let goals = [[tx, ty]];
    if (this.blocked(tx, ty, this.p)) {
      // stairs and doors are fine; otherwise walk next to it
      const c = this.tileAt(tx, ty);
      if (!'UZD'.includes(c)) goals = [[tx, ty + 1], [tx, ty - 1], [tx - 1, ty], [tx + 1, ty]].filter(([x, y]) => !this.blocked(x, y, this.p));
    }
    const path = this._bfs(goals);
    if (path) { this.path = path; this.pathThen = then || null; this.held = []; }
  }
  goUse(target) {
    // stand on a free tile next to the thing, face it, use it
    let cells;
    if (target.kind === 'npc') cells = [[target.npc.x, target.npc.y, 1, 1]];
    else if (target.kind === 'prop') { const q = target.prop; cells = [[q.x, q.y, q.w, q.h]]; }
    else cells = [[target.x, target.y, 1, 1]];
    const goals = [];
    for (const [x0, y0, w, h] of cells) {
      for (let i = 0; i < w; i++) { goals.push([x0 + i, y0 + h, 'up'], [x0 + i, y0 - 1, 'down']); }
      for (let j = 0; j < h; j++) { goals.push([x0 - 1, y0 + j, 'right'], [x0 + w, y0 + j, 'left']); }
    }
    // counters: talk across
    if (target.kind === 'npc') {
      for (const [dx, dy, d] of [[0, 2, 'up'], [0, -2, 'down'], [2, 0, 'left'], [-2, 0, 'right']]) {
        const mid = this.propAt(target.npc.x + dx / 2, target.npc.y + dy / 2);
        if (mid && mid.counter) goals.push([target.npc.x + dx, target.npc.y + dy, d]);
      }
    }
    const ok = goals.filter(([x, y]) => (x === this.p.x && y === this.p.y) || !this.blocked(x, y, this.p));
    if (!ok.length) return;
    const here = ok.find(([x, y]) => x === this.p.x && y === this.p.y);
    if (here && !this.p.moving) { this.p.dir = here[2]; this.act(); return; }
    const path = this._bfs(ok.map(([x, y]) => [x, y]));
    if (!path) return;
    const end = path.length ? path[path.length - 1] : [this.p.x, this.p.y];
    const g = ok.find(([x, y]) => x === end[0] && y === end[1]);
    this.path = path; this.held = [];
    this.pathThen = () => { if (g) this.p.dir = g[2]; this.act(); };
  }
  _bfs(goals) {
    const f = this.floor, W = f.W, H = f.H;
    const start = this.p.moving ? [this.p.x, this.p.y] : [this.p.x, this.p.y];
    const key = (x, y) => y * W + x;
    const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
    if (goalSet.has(key(start[0], start[1]))) return [];
    const prev = new Int32Array(W * H).fill(-1), seen = new Uint8Array(W * H);
    const q = [key(start[0], start[1])]; seen[q[0]] = 1;
    let found = -1;
    for (let h = 0; h < q.length && h < 4000; h++) {
      const k = q[h], x = k % W, y = (k / W) | 0;
      if (goalSet.has(k)) { found = k; break; }
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = key(nx, ny);
        if (seen[nk]) continue;
        const c = f.rows[ny][nx];
        const isGoal = goalSet.has(nk);
        if (this.blocked(nx, ny, this.p) && !(isGoal && 'UZD'.includes(c))) continue;
        // never route through stairs or doors unless that is where you are going
        if ('UZD'.includes(c) && !isGoal) continue;
        seen[nk] = 1; prev[nk] = k; q.push(nk);
      }
    }
    if (found < 0) return null;
    const path = [];
    for (let k = found; k !== key(start[0], start[1]); k = prev[k]) path.push([k % W, (k / W) | 0]);
    return path.reverse();
  }

  act() {
    if (this.frozen || this.p.moving) return;
    const t = this.facing();
    if (t && this.opts.onUse) this.opts.onUse(t);
  }

  _startStep(who, dir) {
    who.dir = dir;
    const [dx, dy] = DIRS[dir];
    const nx = who.x + dx, ny = who.y + dy;
    if (this.blocked(nx, ny, who)) return false;
    if (who !== this.p && 'UZD'.includes(this.tileAt(nx, ny))) return false;
    who.from = [who.x, who.y]; who.x = nx; who.y = ny; who.moving = true; who.t = 0;
    return true;
  }

  update(dt) {
    this.time += dt;
    if (this.fadeDir) {
      this.fade += this.fadeDir * dt / (reduceMotion ? 0.05 : 0.22);
      if (this.fade >= 1 && this.fadeDir > 0) { this.fade = 1; const cb = this.fadeCb; this.fadeCb = null; this.fadeDir = -1; if (cb) cb(); }
      if (this.fade <= 0 && this.fadeDir < 0) { this.fade = 0; this.fadeDir = 0; }
    }
    const p = this.p;
    const speed = this.path ? 6.5 : (p.run ? 8 : 4.6);
    if (p.moving) {
      p.t += dt * speed;
      p.step += dt * speed;
      if (p.t >= 1) {
        p.moving = false; p.t = 0; p.fx = p.x; p.fy = p.y;
        this._arrived();
      } else { p.fx = p.from[0] + (p.x - p.from[0]) * p.t; p.fy = p.from[1] + (p.y - p.from[1]) * p.t; }
    }
    if (!p.moving && !this.frozen && !this.fadeDir) {
      let dir = this.held.length ? this.held[this.held.length - 1] : null;
      if (!dir && this.path && this.path.length) {
        const [nx, ny] = this.path[0];
        dir = nx > p.x ? 'right' : nx < p.x ? 'left' : ny > p.y ? 'down' : 'up';
        if (this.blocked(nx, ny, p) && !'UZD'.includes(this.tileAt(nx, ny))) { this.path = null; dir = null; }
        else this.path.shift();
      }
      if (dir) {
        if (!this._startStep(p, dir)) { p.step = 0; }
      } else if (this.path && !this.path.length) {
        this.path = null;
        const cb = this.pathThen; this.pathThen = null;
        if (cb) cb();
      }
    }
    // people wander
    for (const n of this.floor.npcs) this._npcUpdate(n, dt);
    // what is in front of you, for the label and for screen readers
    const ft = (!p.moving && !this.frozen) ? this.facing() : null;
    const key = ft ? (ft.npc ? 'n:' + ft.npc.id : ft.prop ? 'p:' + (ft.prop.id || ft.prop.type) + ft.prop.x : ft.kind) : null;
    if (key !== this._focusKey) { this._focusKey = key; this.focusTarget = ft; if (this.opts.onFocus) this.opts.onFocus(ft); }
  }

  _arrived() {
    const p = this.p, c = this.tileAt(p.x, p.y);
    if (this.opts.onStep) this.opts.onStep(p.floor, p.x, p.y, p.dir);
    if (c === 'U' || c === 'Z' || c === 'D') {
      this.path = null; this.held = [];
      if (this.opts.onTrigger) this.opts.onTrigger(c, p.x, p.y);
    }
  }

  _npcUpdate(n, dt) {
    if (n.moving) {
      n.t += dt * (n.speed || 3);
      if (n.t >= 1) { n.moving = false; n.t = 0; n.fx = n.x; n.fy = n.y; }
      else { n.fx = n.from[0] + (n.x - n.from[0]) * n.t; n.fy = n.from[1] + (n.y - n.from[1]) * n.t; }
      return;
    }
    if (!n.wander || n.talking || n.sleeping) return;
    n.wait -= dt;
    if (n.wait > 0) return;
    n.wait = 1.2 + Math.random() * 3.5;
    const dirs = ['up', 'down', 'left', 'right'];
    const d = dirs[Math.floor(Math.random() * 4)];
    const [dx, dy] = DIRS[d];
    const nx = n.x + dx, ny = n.y + dy, b = n.wander;
    n.dir = d;
    if (nx < b[0] || ny < b[1] || nx > b[2] || ny > b[3]) return;
    this._startStep(n, d);
  }

  // fade out, run cb (change floor), fade back in
  transition(cb) {
    if (this.fadeDir) return;
    this.fadeDir = 1; this.fade = 0; this.fadeCb = cb;
  }

  // ------------------------------------------------------------ drawing
  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this._dpr = dpr;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    const W = Math.round(cw * dpr), H = Math.round(ch * dpr);
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
    const narrow = cw < 640;
    const across = narrow ? 11.5 : 24, down = narrow ? 15 : 14;
    const tileCss = Math.min(cw / across, ch / down);
    this.scale = Math.max(2, Math.round(tileCss * dpr / TILE));
    const vw = Math.ceil(W / this.scale), vh = Math.ceil(H / this.scale);
    if (this.buf.c.width !== vw || this.buf.c.height !== vh) {
      this.buf.c.width = vw; this.buf.c.height = vh; this.buf.w = vw; this.buf.h = vh;
      this.buf.g.imageSmoothingEnabled = false;
    }
    this.ctx.imageSmoothingEnabled = false;
  }

  _camera() {
    const f = this.floor, s = this.scale, dpr = this._dpr;
    const vw = this.buf.c.width, vh = this.buf.c.height;
    const left = this.inset.left * dpr / s, right = this.inset.right * dpr / s, bottom = this.inset.bottom * dpr / s;
    const visW = vw - left - right, visH = vh - bottom;
    const px = Math.round(this.p.fx * TILE) + 8, py = Math.round(this.p.fy * TILE) + 4;
    const mapW = f.W * TILE, mapH = f.H * TILE;
    let x, y;
    if (mapW <= visW) x = -left - (visW - mapW) / 2; else x = Math.min(Math.max(px - left - visW / 2, -left), mapW - visW - left);
    if (mapH <= visH) y = -(visH - mapH) / 2; else y = Math.min(Math.max(py - visH / 2, 0), mapH - visH);
    // ease the camera a little, then snap to whole pixels
    if (!this.cam || this._camFloor !== this.p.floor) this.cam = { x, y, sx: x, sy: y };
    const k = reduceMotion ? 1 : 0.25;
    this.cam.sx += (x - this.cam.sx) * k; this.cam.sy += (y - this.cam.sy) * k;
    if (Math.abs(this.cam.sx - x) < 0.3) this.cam.sx = x;
    if (Math.abs(this.cam.sy - y) < 0.3) this.cam.sy = y;
    this.cam.x = Math.round(this.cam.sx); this.cam.y = Math.round(this.cam.sy);
    this._camFloor = this.p.floor;
  }

  render() {
    if (!this._dpr) return;
    this._camera();
    const B = this.buf, g = B.g, f = this.floor, t = this.time, cx = this.cam.x, cy = this.cam.y;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = PAL.night; g.fillRect(0, 0, B.c.width, B.c.height);
    g.drawImage(f.layer, -cx, -cy);
    B.at(-cx, -cy);
    // clouds drifting past the windows
    for (const w of f.windows) {
      g.save(); g.beginPath(); g.rect(w.x - cx, w.y - cy, w.w, w.h); g.clip();
      for (let k = 0; k < 3; k++) {
        const span = w.w + 24, xx = w.x - 12 + ((t * (3 + k) + k * 37 + w.x) % span);
        const yy = w.y + 2 + ((k * 5 + w.x / 16) % 6);
        B.rect(xx, yy, 8, 2, '#FFFFFF'); B.rect(xx + 2, yy - 1, 4, 1, '#FFFFFF'); B.hl(xx, yy + 2, 8, '#E3F6FF');
      }
      g.restore();
    }
    // wall pieces that move
    for (const q of f.wallProps) if (q.def.anim) q.def.anim(B, q.px, q.py, t, q.opt || {});
    // things on the floor, people and you, sorted by how far down the screen they stand
    const items = [];
    for (const q of f.props) items.push({ y: q.sortY, q });
    for (const n of f.npcs) if (!n.hidden) items.push({ y: Math.round(n.fy * TILE) + 15, n });
    items.push({ y: Math.round(this.p.fy * TILE) + 15.5, me: true });
    items.sort((a, b) => a.y - b.y);
    const vx0 = cx - 64, vx1 = cx + B.c.width + 64, vy0 = cy - 96, vy1 = cy + B.c.height + 96;
    for (const it of items) {
      if (it.q) {
        const q = it.q;
        if (q.px > vx1 || q.px + q.img.width < vx0 || q.py > vy1 || q.py + q.img.height < vy0) continue;
        B.draw(q.img, q.px, q.py);
        if (q.def.anim) q.def.anim(B, q.px + 1, q.py + 1, t + (q.phase || 0), q.opt || {});
      } else if (it.n) this._drawNpc(B, it.n, t);
      else this._drawPlayer(B);
    }
    // marks over people with something to say
    for (const n of f.npcs) {
      if (n.hidden || !this.opts.npcMark) continue;
      const m = this.opts.npcMark(n.id);
      if (m) this._drawMark(B, Math.round(n.fx * TILE) + 8, Math.round(n.fy * TILE) - (n.tall || 10) - 6 + Math.round(Math.sin(t * 4) * 1.5), m);
    }
    // a little arrow over whatever you are facing
    const ft = this.focusTarget || this.hover;
    if (ft && !this.frozen) {
      const a = this._anchor(ft);
      if (a) this._drawPointer(B, a.x, a.y - 3 + Math.round(Math.sin(t * 6)));
    }
    B.at(0, 0);
    // blit, crisp
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(B.c, 0, 0, B.c.width * this.scale, B.c.height * this.scale);
    // name label for the hovered or faced thing, at full resolution
    if (ft && !this.frozen && this.opts.labelFor) {
      const a = this._anchor(ft), text = this.opts.labelFor(ft);
      if (a && text) this._label(text, (a.x - cx) * this.scale, (a.y - cy - 8) * this.scale);
    }
    if (this.fade > 0) { ctx.fillStyle = `rgba(19, 36, 71, ${Math.min(1, this.fade)})`; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }

  _anchor(t) {
    if (t.kind === 'npc') return { x: Math.round(t.npc.fx * TILE) + 8, y: Math.round(t.npc.fy * TILE) - (t.npc.tall || 10) - 2 };
    if (t.prop) { const q = t.prop; return { x: q.px + Math.round(q.img.width / 2), y: q.py - 1 }; }
    if (t.kind === 'elevator') { return { x: t.x * TILE + (this.tileAt(t.x - 1, t.y) === 'E' || this.tileAt(t.x - 1, t.y) === 'e' ? 0 : 16), y: TILE - 2 }; }
    if (t.kind === 'window') return { x: t.x * TILE + 8, y: TILE };
    return null;
  }

  _drawPlayer(B) {
    const p = this.p, set = playerSprites(p.style);
    const frames = set[p.dir];
    const f = p.moving ? (Math.floor(p.step * 2) % 2 ? 1 : 2) : 0;
    const x = Math.round(p.fx * TILE), y = Math.round(p.fy * TILE);
    dropShadow(B, x + 8, y + 15, 12);
    B.draw(frames[f], x, y - 5 - (p.moving && f ? 0 : 0));
  }

  _drawNpc(B, n, t) {
    const set = npcSprites(n.id);
    if (!set) return;
    const x = Math.round(n.fx * TILE), y = Math.round(n.fy * TILE);
    let img;
    if (n.sleeping && set.sleep) img = set.sleep[0];
    else {
      const fr = set[n.dir] || set.down;
      const blink = (Math.floor(t * 1.3 + (n.x * 7 % 5)) % 6) === 0;
      img = n.moving ? fr[Math.floor(n.t * 2) % 2] : fr[blink ? 1 : 0];
    }
    const hover = n.id === 'bolt' ? Math.round(Math.sin(t * 2.5) * 1.5) - 6 : 0;
    dropShadow(B, x + 8, y + 15, n.id === 'mochi' ? 12 : 13);
    const h = img.height;
    B.draw(img, x + Math.round((16 - img.width) / 2), y + 16 - h + 1 + hover);
    if (n.sleeping) {
      const k = Math.floor(t * 1.5) % 3;
      B.px(x + 13 + k, y + 1 - k * 2, PAL.sky); B.px(x + 14 + k, y - k * 2, PAL.sky);
    }
  }

  _drawMark(B, x, y, m) {
    const col = m === '!' ? PAL.gold : m === '?' ? PAL.cyan : m === '★' ? PAL.pink : PAL.mint;
    B.rect(x - 4, y - 5, 9, 9, PAL.out); B.rect(x - 3, y - 4, 7, 7, col); B.px(x, y + 4, PAL.out);
    B.g.fillStyle = PAL.out;
    if (m === '!') { B.vl(x, y - 3, 3, PAL.out); B.px(x, y + 1, PAL.out); }
    else if (m === '?') { B.hl(x - 1, y - 3, 3, PAL.out); B.px(x + 1, y - 2, PAL.out); B.px(x, y - 1, PAL.out); B.px(x, y + 1, PAL.out); }
    else if (m === '★') { B.px(x, y - 3, PAL.out); B.hl(x - 2, y - 1, 5, PAL.out); B.px(x - 1, y, PAL.out); B.px(x + 1, y, PAL.out); B.px(x - 2, y + 1, PAL.out); B.px(x + 2, y + 1, PAL.out); }
    else { B.px(x - 2, y, PAL.out); B.px(x, y, PAL.out); B.px(x + 2, y, PAL.out); }
  }

  _drawPointer(B, x, y) {
    B.hl(x - 3, y - 3, 7, PAL.out); B.hl(x - 2, y - 2, 5, PAL.out); B.hl(x - 1, y - 1, 3, PAL.out); B.px(x, y, PAL.out);
    B.hl(x - 2, y - 3, 5, PAL.yellow); B.hl(x - 1, y - 2, 3, PAL.yellow); B.px(x, y - 1, PAL.yellow);
  }

  _label(text, x, y) {
    const ctx = this.ctx, dpr = this._dpr;
    const size = Math.round(13 * dpr);
    ctx.font = `600 ${size}px Pixelify, "Pixelify Sans", system-ui, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + Math.round(16 * dpr), h = Math.round(24 * dpr);
    let lx = Math.round(x - w / 2), ly = Math.round(y - h);
    lx = Math.max(4 * dpr, Math.min(this.canvas.width - w - 4 * dpr - this.inset.right * dpr, lx));
    ly = Math.max(4 * dpr, ly);
    const u = Math.max(1, Math.round(dpr * 2));
    ctx.fillStyle = PAL.out; ctx.fillRect(lx - u, ly, w + 2 * u, h); ctx.fillRect(lx, ly - u, w, h + 2 * u);
    ctx.fillStyle = '#FFFDF6'; ctx.fillRect(lx, ly, w, h);
    ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, lx + w / 2, ly + h / 2 + dpr);
  }

  _announce() { if (this.opts.onFocus) this.opts.onFocus(null); }
}

export { DIRS };
