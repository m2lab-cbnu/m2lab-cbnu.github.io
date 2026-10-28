// First-person controls: drag to look, WASD/arrow keys to walk, wheel to step, tap the floor to walk
// there, and smooth camera flights to station viewpoints. Collisions with furniture use 2D boxes.

import * as THREE from '../vendor/three.js';

const EYE = 1.6, RADIUS = 0.28;

export class Controls {
  constructor(camera, dom, { colliders, bounds, onTap, onHover }) {
    this.camera = camera; this.dom = dom;
    this.colliders = colliders; this.bounds = bounds;
    this.onTap = onTap; this.onHover = onHover;
    this.pos = new THREE.Vector3(2.9, EYE, 10.9);
    this.yaw = -0.56; this.pitch = -0.08;
    this.vel = new THREE.Vector3();
    this.keys = new Set();
    this.keysEnabled = true;
    this.anim = null;        // fly-to animation
    this.walkTarget = null;  // tap-to-walk
    this.moved = true;
    camera.rotation.order = 'YXZ';
    this._bind();
    this.apply();
  }

  _bind() {
    const d = this.dom;
    let start = null, dragging = false, last = null, pid = null;
    d.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      start = { x: e.clientX, y: e.clientY, t: performance.now() }; last = { x: e.clientX, y: e.clientY }; dragging = false; pid = e.pointerId;
      try { d.setPointerCapture(e.pointerId); } catch (_) {}
    });
    d.addEventListener('pointermove', (e) => {
      if (start && e.pointerId === pid) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) { dragging = true; d.classList.add('is-dragging'); this.cancelAuto(); }
        if (dragging) {
          const s = (this.camera.fov * Math.PI / 180) / Math.max(200, d.clientHeight) * 1.1;
          this.yaw += dx * s; this.pitch = THREE.MathUtils.clamp(this.pitch + dy * s, -1.3, 1.2);
          this.moved = true;
        }
        last = { x: e.clientX, y: e.clientY };
      } else if (e.pointerType === 'mouse' && this.onHover) this.onHover(this._ndc(e));
    });
    const end = (e) => {
      if (!start || e.pointerId !== pid) return;
      const wasDrag = dragging; start = null; dragging = false; d.classList.remove('is-dragging');
      if (!wasDrag && e.type === 'pointerup' && this.onTap) this.onTap(this._ndc(e));
    };
    d.addEventListener('pointerup', end); d.addEventListener('pointercancel', end);
    d.addEventListener('pointerleave', () => { if (this.onHover) this.onHover(null); });
    d.addEventListener('wheel', (e) => {
      e.preventDefault(); this.cancelAuto();
      const step = Math.max(-1, Math.min(1, -e.deltaY / 100)) * 0.45;
      this._tryMove(this._fwd().multiplyScalar(step)); this.moved = true;
    }, { passive: false });
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    const keyOK = (e) => this.keysEnabled && !e.altKey && !e.ctrlKey && !e.metaKey && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(document.activeElement && document.activeElement.tagName) || document.activeElement === this.dom;
    window.addEventListener('keydown', (e) => {
      if (!keyOK(e)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', 'shift'].includes(k)) {
        if (k.startsWith('arrow')) e.preventDefault();
        this.keys.add(k); this.cancelAuto();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  _ndc(e) {
    const r = this.dom.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1, cx: e.clientX, cy: e.clientY };
  }
  _fwd() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  _right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  cancelAuto() { this.anim = null; this.walkTarget = null; }

  // Resolve a circle against the room bounds and the furniture boxes
  _collide(p) {
    const b = this.bounds;
    p.x = Math.min(b.x1 - RADIUS, Math.max(b.x0 + RADIUS, p.x));
    p.z = Math.min(b.z1 - RADIUS, Math.max(b.z0 + RADIUS, p.z));
    for (let it = 0; it < 2; it++) {
      for (const c of this.colliders) {
        const qx = Math.max(c.x0, Math.min(p.x, c.x1)), qz = Math.max(c.z0, Math.min(p.z, c.z1));
        const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
        if (d2 < RADIUS * RADIUS) {
          if (d2 > 1e-10) { const d = Math.sqrt(d2), f = (RADIUS - d) / d; p.x += dx * f; p.z += dz * f; }
          else { // centre inside the box: push out along the shortest way
            const opts = [[c.x0 - RADIUS - p.x, 0], [c.x1 + RADIUS - p.x, 0], [0, c.z0 - RADIUS - p.z], [0, c.z1 + RADIUS - p.z]];
            opts.sort((a, b2) => Math.abs(a[0] + a[1]) - Math.abs(b2[0] + b2[1]));
            p.x += opts[0][0]; p.z += opts[0][1];
          }
        }
      }
    }
    return p;
  }
  _tryMove(delta) {
    const p = this.pos.clone().add(delta);
    this._collide(p);
    const moved = p.distanceToSquared(this.pos) > 1e-10;
    this.pos.copy(p);
    return moved;
  }

  walkTo(x, z) {
    this.anim = null;
    this.walkTarget = new THREE.Vector3(x, EYE, z);
    this._collide(this.walkTarget);
  }

  // Fly to a viewpoint {pos:[x,y,z], target:[x,y,z]}; resolves when done
  flyTo(view, duration = 1.0) {
    this.walkTarget = null;
    const to = new THREE.Vector3(...view.pos), tgt = new THREE.Vector3(...view.target);
    const dir = tgt.clone().sub(to);
    const yaw = Math.atan2(-dir.x, -dir.z), pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    let dy = yaw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return new Promise((resolve) => {
      this.anim = { from: this.pos.clone(), to, y0: this.yaw, y1: this.yaw + dy, p0: this.pitch, p1: pitch, t: 0, T: reduce ? 0.001 : duration, resolve };
    });
  }

  update(dt) {
    let moved = this.moved; this.moved = false;
    if (this.anim) {
      const a = this.anim; a.t += dt;
      const u = Math.min(1, a.t / a.T), s = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this.pos.lerpVectors(a.from, a.to, s);
      // rise a little mid-flight so the camera clears furniture
      this.pos.y += Math.sin(Math.PI * s) * 0.25 * Math.min(1, a.from.distanceTo(a.to) / 3);
      this.yaw = a.y0 + (a.y1 - a.y0) * s; this.pitch = a.p0 + (a.p1 - a.p0) * s;
      moved = true;
      if (u >= 1) { this.anim = null; a.resolve(); }
    } else {
      const k = this.keys, run = k.has('shift') ? 2 : 1;
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const r = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      const turn = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') || k.has('e') ? 1 : 0);
      if (turn) { this.yaw += turn * dt * 1.6; moved = true; }
      const want = this._fwd().multiplyScalar(f).add(this._right().multiplyScalar(r));
      if (want.lengthSq() > 0) want.normalize().multiplyScalar(2.0 * run);
      if (this.walkTarget) {
        const to = this.walkTarget.clone().sub(this.pos); to.y = 0;
        const dist = to.length();
        if (dist < 0.06) this.walkTarget = null;
        else want.copy(to.normalize().multiplyScalar(Math.min(2.2, dist * 3 + 0.4)));
      }
      this.vel.lerp(want, 1 - Math.exp(-dt * 12));
      if (this.vel.lengthSq() > 1e-6) {
        const before = this.pos.clone();
        this._tryMove(this.vel.clone().multiplyScalar(dt));
        if (this.walkTarget && before.distanceToSquared(this.pos) < 1e-8) this.walkTarget = null;   // blocked
        // ease the eye height back to standing
        this.pos.y += (EYE - this.pos.y) * Math.min(1, dt * 4);
        moved = true;
      } else if (Math.abs(this.pos.y - EYE) > 0.002 && !this.hold) { this.pos.y += (EYE - this.pos.y) * Math.min(1, dt * 4); moved = true; }
    }
    if (moved) this.apply();
    return moved;
  }

  apply() {
    this.camera.position.copy(this.pos);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.updateMatrixWorld();
  }

  get busy() { return !!this.anim || !!this.walkTarget || this.keys.size > 0 || this.vel.lengthSq() > 1e-6; }
}
