// The simulation engine shared by the Simulation PC and the BLS station: one GPU solver, a run loop
// that adapts the number of steps per frame, relaxation, and a cache of demagnetizing kernels.

import { LLGSim } from './llg-gl.js';
import { demagKernelFFT } from '../physics/demag.js';

const kernels = new Map();
let worker = null, wid = 0;
const pending = new Map();
function remember(key, K) {   // keep the six most recent kernels
  kernels.delete(key); kernels.set(key, K);
  while (kernels.size > 6) kernels.delete(kernels.keys().next().value);
}
function kernelAsync(g) {
  const key = [g.Nx, g.Ny, g.dx, g.dy, g.dz, (g.pbc || [0, 0]).join('/')].join(',');
  if (kernels.has(key)) { const K = kernels.get(key); remember(key, K); return Promise.resolve(K); }
  const small = g.Nx * g.Ny <= 64 * 64 && !(g.pbc && (g.pbc[0] || g.pbc[1]));
  if (small || typeof Worker === 'undefined') {
    const K = demagKernelFFT(g.Nx, g.Ny, g.dx, g.dy, g.dz, 48, g.pbc || [0, 0]); remember(key, K); return Promise.resolve(K);
  }
  if (!worker) {
    try {
      worker = new Worker(new URL('./kernel-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data.K); };
      worker.onerror = () => { worker = null; };
    } catch (_) { worker = null; }
  }
  if (!worker) { const K = demagKernelFFT(g.Nx, g.Ny, g.dx, g.dy, g.dz, 48, g.pbc || [0, 0]); remember(key, K); return Promise.resolve(K); }
  const id = ++wid;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (K) => { remember(key, K); resolve(K); }, reject });
    worker.postMessage({ id, g });
  });
}

class Engine {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512; this.canvas.height = 256;
    this.sim = null; this.error = null;
    this.running = false; this.cfg = null;
    this.view = { mode: 0, gain: 1 };
    this.spf = 4; this.maxSpf = 400;
    this.fps = 60; this.lastFrame = 0; this.stepRate = 0;
    this.listeners = new Map();
    this.busy = null;      // text while loading or relaxing
    this.gen = 0;          // increases with every load, so stale work can stop
    this.fieldFn = null;   // optional time-dependent uniform field (scripts)
    this.stepHooks = new Set();
    this._loop = this._loop.bind(this);
  }
  on(ev, fn) { if (!this.listeners.has(ev)) this.listeners.set(ev, new Set()); this.listeners.get(ev).add(fn); return () => this.listeners.get(ev).delete(fn); }
  emit(ev, ...a) { const s = this.listeners.get(ev); if (s) for (const fn of s) fn(...a); }
  ensure() {
    if (this.sim) return this.sim;
    if (this.error) throw this.error;
    try { this.sim = new LLGSim(this.canvas); }
    catch (e) { this.error = e; throw e; }
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.running = false; this.cfg = null;
      this.error = new Error('The graphics card reset the simulator. Reload the page to start it again.');
      this.setBusy(this.error.message);
    });
    return this.sim;
  }
  available() { try { this.ensure(); return true; } catch (_) { return false; } }

  // cfg: { grid, mat, m (Float32Array RGBA with mask), B, edges, antenna, rf, demag, view, name }
  async load(cfg) {
    const sim = this.ensure();
    this.pause();
    const gen = ++this.gen;
    this.setBusy('Preparing the magnetostatic kernel…');
    const K = await kernelAsync({ pbc: [0, 0], ...cfg.grid });
    if (gen !== this.gen) return false;      // a newer load started meanwhile
    sim.configure({ pbc: [0, 0], ...cfg.grid }, cfg.mat, K);
    sim.demagOn = cfg.demag !== false;
    sim.setField(cfg.B || [0, 0, 0]);
    sim.setDamping(cfg.edges || {});
    sim.setState(cfg.m);
    if (cfg.antenna) sim.setAntennaProfile(cfg.antenna); else sim.clearAntenna();
    sim.rf = Object.assign({ on: false, kind: 'cw', f: 2e9, amp: 1e-3, t0: 0, fmax: 20e9, width: 50e-12, ramp: 0.5e-9 }, cfg.rf || {});
    sim.t = 0; sim.steps = 0; sim.recording = false; sim.blsOn = false;
    sim.setReference(); sim.blsReset();
    this.fieldFn = cfg.fieldFn || null;
    this.cfg = cfg;
    if (cfg.view) Object.assign(this.view, cfg.view);
    this.spf = 4;
    this.setBusy(null);
    this.resizeCanvas();
    this.render();
    this.emit('load', cfg);
    return true;
  }
  resizeCanvas() {
    if (!this.sim || !this.sim.g) return;
    const { Nx, Ny, dx, dy } = this.sim.g, ar = (Nx * dx) / (Ny * dy);
    const W = Math.round(Math.min(1024, 640 * ar));
    const H = Math.max(24, Math.round(W / ar));
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
  }
  setBusy(text) { this.busy = text; this.emit('status'); }

  play() {
    if (!this.sim || !this.cfg || this.running) return;
    if (this.relaxing) { this.resumeAfter = true; return; }   // start once the relaxation is done
    this.running = true; this.lastFrame = 0; requestAnimationFrame(this._loop); this.emit('status');
  }
  // resolves when no relaxation is in progress
  whenIdle() { return this.relaxing ? new Promise((r) => { const off = this.on('relaxed', () => { off(); r(); }); }) : Promise.resolve(); }
  pause() { if (!this.running) return; this.running = false; this.rateT = 0; this.emit('status'); }
  toggle() { this.running ? this.pause() : this.play(); }

  stepN(n) {
    const sim = this.sim;
    if (this.fieldFn) { for (let i = 0; i < n; i++) { sim.Bext = this.fieldFn(sim.t); sim.step(1); } }
    else sim.step(n);
    for (const h of this.stepHooks) h(n);
  }
  _loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this._loop);
    const gl = this.sim.gl;
    // Pace on the GPU: if the work queued last frame is not finished, queue nothing new this frame.
    if (this.fence) {
      const done = gl.getSyncParameter(this.fence, gl.SYNC_STATUS) === gl.SIGNALED;
      if (!done) { this.waited = (this.waited || 0) + 1; if (this.waited === 2) this.spf = Math.max(1, Math.floor(this.spf * 0.8)); return; }
      gl.deleteSync(this.fence); this.fence = null;
      if (!this.waited) this.spf = Math.min(this.maxSpf, Math.ceil(this.spf * 1.12 + 0.5));
      this.waited = 0;
    }
    const n = this.spf;
    this.stepN(n);
    this.render();
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    // measured speed over the last second or so
    const s = this.sim.steps;
    if (!this.rateT) { this.rateT = now; this.rateS = s; }
    else if (now - this.rateT > 800) { this.stepRate = (s - this.rateS) / ((now - this.rateT) / 1000); this.rateT = now; this.rateS = s; }
    this.emit('frame');
    if (this.cfg && this.cfg.stopAt && this.sim.t >= this.cfg.stopAt) { this.pause(); this.emit('done'); }
  }
  render() { if (this.sim && this.sim.g) this.sim.render(this.view.mode, this.view.gain); }

  // Relax towards equilibrium by steepest descent (no precession, no excitation), a few hundred
  // iterations per frame, until m stops changing.
  relax({ maxIter = 30000, tol = 3e-6, maxMs = 12000 } = {}) {
    const sim = this.sim; if (!sim) return Promise.resolve(0);
    const was = this.running; this.pause();
    const fn = this.fieldFn;
    if (fn) sim.Bext = fn(sim.t);
    let done = 0, chunk = 40;
    const gen = this.gen, tStart = performance.now();
    this.relaxing = true; this.resumeAfter = false;
    this.setBusy('Relaxing…');
    return new Promise((resolve) => {
      const step = () => {
        if (gen !== this.gen) { this.relaxing = false; this.emit('relaxed'); resolve(-1); return; }   // a new simulation was loaded
        const t0 = performance.now();
        sim.snapshot();
        const n = Math.min(chunk, maxIter - done);
        sim.relaxSteps(n); done += n;
        const ch = sim.changeSinceSnapshot() / n;
        const dt = performance.now() - t0;
        chunk = Math.max(5, Math.min(400, Math.round(chunk * (dt < 30 ? 1.3 : 0.8))));
        this.render(); this.emit('frame');
        this.setBusy(`Relaxing… ${done} iterations`);
        if (done < maxIter && ch > tol && performance.now() - tStart < maxMs) requestAnimationFrame(step);
        else {
          sim.setReference();
          this.relaxing = false;
          this.relaxInfo = { done, converged: ch <= tol };
          this.setBusy(null); this.emit('relaxed');
          if (was || this.resumeAfter) this.play();
          resolve(done);
        }
      };
      requestAnimationFrame(step);
    });
  }
}

export const engine = new Engine();
