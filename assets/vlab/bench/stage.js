// The hands-on stage every experiment is played on: a big scene you can grab things in, a row of
// switches for what to show (forces, energy, snapshots...), slow motion and pause, and a guide
// card where the floor's resident explains what you see, walks you through why it happens, and
// sets little Predict -> Watch -> Explain challenges that earn insight cards.

import { el } from '../ui/widgets.js';
import { portrait } from '../rpg/sprites.js';
import { rig } from '../rpg/state.js';
import { sound } from '../rpg/sound.js';
import { CARDS } from '../rpg/cards.js';
import { Particles, confetti, pulse, LINE } from './kit.js';
import { tr, trc } from '../i18n.js';

const NAMES = { hoo: 'Prof. Bueong', pip: 'Kongi', fennec: 'Dr. Yeo', bolt: 'Baro', mochi: 'Injeolmi', nova: 'Nuri' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function md(s) {
  const esc = String(tr(String(s))).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_\{(.+?)\}/g, '<sub>$1</sub>').replace(/\^\{(.+?)\}/g, '<sup>$1</sup>').replace(/\n/g, '<br>');
}

const ICON = {
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 6.2A5 5 0 1 1 3 9.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M1.5 2.8v4h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  snail: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12h11.5M5 12a4 4 0 1 1 6.8-2.8M8.6 9.2a1.6 1.6 0 1 0-1.6-1.6M13 12l1.5-4" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
};

export class Stage {
  constructor(pane, opts = {}) {
    this.o = Object.assign({ npc: 'hoo', aspect: 16 / 10, phoneAspect: 0.86, minH: 300, maxH: 700, label: 'Experiment' }, opts);
    this.bench = opts.bench || { id: 'x' };
    this.handles = [];
    this.tools = new Map();
    this.speed = 1; this.paused = false;
    this.t = 0; this.simT = 0;
    this.mode = 'play';
    this.w = 600; this.h = 400; this.dpr = 1;
    this.parts = new Particles(500);
    this.hoverId = null; this.drag = null;
    this.flashes = [];
    this.stepFns = []; this.drawFns = []; this.overFns = [];
    this.locked = false;
    this.readouts = new Map();
    this.challenges = []; this.tourDef = null;

    // ---------- DOM
    this.cv = el('canvas', { class: 'stg-cv', tabindex: '0', role: 'img', 'aria-label': this.o.label });
    this.toolsEl = el('div', { class: 'stg-tools', role: 'group', 'aria-label': 'What to show' });
    this.timeEl = el('div', { class: 'stg-time', role: 'group', 'aria-label': 'Time' });
    this.hintEl = el('p', { class: 'stg-hint', 'aria-hidden': 'true' });
    this.flashEl = el('p', { class: 'stg-flash', role: 'status' });
    this.bar = el('div', { class: 'stg-bar' }, this.toolsEl, this.timeEl);
    this.graphEl = el('div', { class: 'stg-graph', hidden: true });
    this.scene = el('div', { class: 'stg-scene' }, this.cv, this.graphEl, this.hintEl, this.flashEl);
    // guide card
    const face = el('canvas', { class: 'stg-face', width: 16, height: 20, 'aria-hidden': 'true' });
    try { const img = portrait(this.o.npc); face.width = img.width; face.height = img.height; face.getContext('2d').drawImage(img, 0, 0); } catch (_) {}
    this.sayEl = el('div', { class: 'stg-say', 'aria-live': 'polite' });
    this.actsEl = el('div', { class: 'stg-acts' });
    this.roEl = el('dl', { class: 'stg-ro' });
    this.ctlEl = el('div', { class: 'stg-ctl' });
    this.guide = el('aside', { class: 'stg-guide' },
      el('div', { class: 'stg-who' }, face, el('b', { text: NAMES[this.o.npc] || '' })),
      this.sayEl, this.actsEl, this.ctlEl, this.roEl);
    this.root = el('div', { class: 'stg' }, el('div', { class: 'stg-left' }, this.bar, this.scene), this.guide);
    pane.append(this.root);
    this.g = this.cv.getContext('2d');
    (window.__stages = window.__stages || []).push(this);

    this._timeControls();
    this._pointer();
    this._keys();
    this._mainActs();
    this.say(this.o.hello || '');

    this.ctl = {
      show: () => { this._resize(); this.start(); if (this.o.onShow) this.o.onShow(); },
      hide: () => { this.stop(); if (this.o.onHide) this.o.onHide(); },
      resize: () => this._resize(),
    };
    // only a change of width re-lays the scene out (its height is ours to set, and reacting to it
    // could bounce back and forth with the panel's scroll bar)
    this._lastW = 0;
    if ('ResizeObserver' in window) new ResizeObserver((es) => {
      const w = Math.round(es[0].contentRect.width);
      if (Math.abs(w - this._lastW) > 1) { this._lastW = w; this._resize(); }
    }).observe(this.scene);
    window.addEventListener('resize', () => this._resize());
  }

  // ------------------------------------------------------------ cached layers
  // Draws fn into an offscreen canvas the size of the scene and reuses it until `key` changes.
  // Backgrounds go here, so each frame only paints what moves.
  cache(name, key, fn) {
    if (!this._caches) this._caches = new Map();
    const W = Math.round(this.w * this.dpr), H = Math.round(this.h * this.dpr);
    let c = this._caches.get(name);
    if (!c || c.key !== key || c.cv.width !== W || c.cv.height !== H) {
      const cv = c ? c.cv : document.createElement('canvas');
      cv.width = W; cv.height = H;
      const g = cv.getContext('2d');
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, this.w, this.h);
      try { fn(g, this.w, this.h); } catch (e) { console.error(e); }
      c = { key, cv };
      this._caches.set(name, c);
    }
    const g = this.g;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(c.cv, 0, 0); g.restore();
  }

  // ------------------------------------------------------------ hooks
  onStep(fn) { this.stepFns.push(fn); return this; }
  onDraw(fn) { this.drawFns.push(fn); return this; }
  onOver(fn) { this.overFns.push(fn); return this; }     // drawn above everything (tour marks)
  onResize(fn) { this.resizeFn = fn; return this; }

  // ------------------------------------------------------------ loop
  start() {
    if (this.raf) return;
    let last = performance.now();
    const frame = (now) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      this.t += dt;
      const sdt = this.paused ? 0 : dt * this.speed;
      this.simT += sdt;
      for (const f of this.stepFns) { try { f(sdt, dt); } catch (e) { console.error(e); } }
      this.parts.update(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(frame);
  }
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; }
  // run the simulation forward by `sec` seconds of real time, in small steps (tests, skipping)
  advance(sec, h = 1 / 120) {
    for (let k = 0; k < Math.ceil(sec / h); k++) {
      const sdt = this.paused ? 0 : h * this.speed;
      this.t += h; this.simT += sdt;
      for (const f of this.stepFns) { try { f(sdt, h); } catch (e) { console.error(e); break; } }
      this.parts.update(h);
    }
    this.draw();
  }
  get running() { return !!this.raf; }

  draw() {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    for (const f of this.drawFns) { try { f(g, this.w, this.h, this.t); } catch (e) { console.error(e); } }
    this.parts.draw(g);
    if (this.mode === 'tour' && this.tourStep && this.tourStep.mark) {
      const m = this.tourStep.mark(this);
      if (m) pulse(g, m[0], m[1], m[2] || 26, this.t);
    }
    for (const f of this.overFns) { try { f(g, this.w, this.h, this.t); } catch (e) { console.error(e); } }
    if (this.mode === 'tour' && this.tourStep && this.tourStep.draw) { try { this.tourStep.draw(g, this.w, this.h, this.t, this); } catch (e) { console.error(e); } }
  }

  _resize() {
    const r = this.scene.getBoundingClientRect();
    const w = Math.max(240, Math.round(r.width || this.scene.clientWidth || 600));
    const narrow = w < 560;
    const vh = window.innerHeight || 800;
    // fit the scene in what is left of the window below it, when we can tell
    let avail = Math.round(vh * (narrow ? 0.62 : 0.72));
    const body = this.scene.closest('.vpanel-body');
    if (body && body.clientHeight) {
      const top = this.scene.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      avail = Math.max(narrow ? 300 : 340, body.clientHeight - top - 14);
    }
    let h = Math.round(w / (narrow ? this.o.phoneAspect : this.o.aspect));
    h = Math.max(this.o.minH, Math.min(h, this.o.maxH, avail));
    this.scene.style.height = h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.cv.width !== Math.round(w * dpr) || this.cv.height !== Math.round(h * dpr)) { this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); }
    this.w = w; this.h = h; this.dpr = dpr; this.narrow = narrow;
    if (this.resizeFn) this.resizeFn(w, h, narrow);
    if (this.graph) this.graph.resize();
    if (!this.raf) this.draw();
  }

  // ------------------------------------------------------------ tools (what to show)
  tool(id, label, { on = false, icon = null, title = null, onChange = null } = {}) {
    const b = el('button', { type: 'button', class: 'stg-chip', 'aria-pressed': on ? 'true' : 'false', title: title || label });
    if (icon) b.append(el('span', { class: 'ic', 'aria-hidden': 'true', style: { background: icon } }));
    b.append(el('span', { text: label }));
    const t = { id, on, b, onChange };
    b.addEventListener('click', () => { this.setTool(id, !t.on); sound.play('click'); });
    this.tools.set(id, t);
    this.toolsEl.append(b);
    return this;
  }
  on(id) { const t = this.tools.get(id); return !!(t && t.on); }
  setTool(id, v) {
    const t = this.tools.get(id); if (!t) return;
    t.on = !!v; t.b.setAttribute('aria-pressed', t.on ? 'true' : 'false');
    if (t.onChange) t.onChange(t.on);
    if (id === 'graph' && this.graph) { this.graphEl.hidden = !t.on; this.graph.resize(); }
  }

  _timeControls() {
    const pause = el('button', { type: 'button', class: 'stg-chip stg-ico', 'aria-label': 'Pause', html: ICON.pause });
    pause.addEventListener('click', () => this.setPaused(!this.paused));
    this.pauseBtn = pause;
    const speeds = this.o.speeds || [[1, '1×', 'Normal speed'], [0.25, '¼×', 'Slow motion'], [1 / 16, '⅟₁₆×', 'Super slow motion']];
    this.speedBtns = speeds.map(([v, lab, tt]) => {
      const b = el('button', { type: 'button', class: 'stg-chip stg-sp', 'aria-pressed': v === 1 ? 'true' : 'false', title: tt, 'aria-label': tt, text: lab });
      b.addEventListener('click', () => { this.setSpeed(v); sound.play('click'); });
      b.dataset.v = v;
      return b;
    });
    const reset = el('button', { type: 'button', class: 'stg-chip stg-ico', 'aria-label': 'Start again', title: 'Start again', html: ICON.reset });
    reset.addEventListener('click', () => { if (this.o.onReset) this.o.onReset(); sound.play('pop'); });
    this.timeEl.append(pause, ...this.speedBtns, reset);
    if (this.o.time === false) this.timeEl.hidden = true;
  }
  setPaused(p) {
    this.paused = !!p;
    this.pauseBtn.innerHTML = this.paused ? ICON.play : ICON.pause;
    this.pauseBtn.setAttribute('aria-label', this.paused ? 'Play' : 'Pause');
    this.pauseBtn.classList.toggle('is-on', this.paused);
  }
  setSpeed(v) {
    this.speed = v;
    this.speedBtns.forEach((b) => b.setAttribute('aria-pressed', +b.dataset.v === v ? 'true' : 'false'));
    if (this.paused) this.setPaused(false);
  }

  // ------------------------------------------------------------ pointer
  // handle: { id, hit(x, y) -> distance or false, cursor, down(x, y), move(x, y), up(x, y, vx, vy), click(x, y) }
  handle(h) { this.handles.push(h); return this; }
  _pick(x, y) {
    let best = null, bd = Infinity;
    for (const h of this.handles) {
      if (h.enabled && !h.enabled()) continue;
      const d = h.hit(x, y);
      if (d === false || d === null || d === undefined) continue;
      const dd = d === true ? 0 : d;
      if (dd < bd) { bd = dd; best = h; }
    }
    return best;
  }
  _xy(e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  _pointer() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.locked) return;
      const [x, y] = this._xy(e);
      const h = this._pick(x, y);
      if (!h) { if (this.o.onTap) this.o.onTap(x, y); return; }
      e.preventDefault();
      cv.focus({ preventScroll: true });
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      this.drag = { h, id: e.pointerId, x0: x, y0: y, moved: false, samples: [[performance.now(), x, y]] };
      this.hint(null);
      if (h.down) h.down(x, y, e);
      cv.style.cursor = h.cursorDrag || (h.down ? 'grabbing' : 'pointer');
    });
    cv.addEventListener('pointermove', (e) => {
      const [x, y] = this._xy(e);
      if (this.drag && this.drag.id === e.pointerId) {
        const d = this.drag;
        if (Math.hypot(x - d.x0, y - d.y0) > 4) d.moved = true;
        d.samples.push([performance.now(), x, y]);
        if (d.samples.length > 8) d.samples.shift();
        if (d.h.move) d.h.move(x, y, e);
        return;
      }
      if (e.pointerType !== 'mouse') return;
      const h = this.locked ? null : this._pick(x, y);
      this.hoverId = h ? h.id : null;
      cv.style.cursor = h ? (h.cursor || (h.down ? 'grab' : 'pointer')) : '';
    });
    const end = (e, cancel) => {
      const d = this.drag;
      if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      const [x, y] = this._xy(e);
      // velocity from the last few samples (px/s), for flicks
      const s = d.samples, now = performance.now();
      let vx = 0, vy = 0;
      const old = s.find((q) => now - q[0] < 90) || s[s.length - 1];
      if (old && now - old[0] > 4) { vx = (x - old[1]) / ((now - old[0]) / 1000); vy = (y - old[2]) / ((now - old[0]) / 1000); }
      if (cancel) { if (d.h.up) d.h.up(x, y, 0, 0, true); }
      else if (!d.moved && d.h.click) d.h.click(x, y);
      else if (d.h.up) d.h.up(x, y, vx, vy);
      cv.style.cursor = '';
    };
    cv.addEventListener('pointerup', (e) => end(e, false));
    cv.addEventListener('pointercancel', (e) => end(e, true));
    cv.addEventListener('pointerleave', () => { if (!this.drag) this.hoverId = null; });
  }
  isDragging(id) { return !!(this.drag && this.drag.h.id === id); }
  hovering(id) { return this.hoverId === id || this.isDragging(id); }

  _keys() {
    this.cv.addEventListener('keydown', (e) => {
      const k = this.o.keys; if (!k) return;
      const map = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (map[e.key] && k.arrow) { e.preventDefault(); k.arrow(map[e.key][0], map[e.key][1], e.shiftKey); }
      else if ((e.key === ' ' || e.key === 'Enter') && k.action) { e.preventDefault(); k.action(); }
    });
  }

  // ------------------------------------------------------------ messages
  hint(text, { sticky = false } = {}) {
    clearTimeout(this._hintT);
    if (!text) { this.hintEl.classList.remove('is-on'); return; }
    this.hintEl.textContent = text; this.hintEl.classList.add('is-on');
    if (!sticky) this._hintT = setTimeout(() => this.hintEl.classList.remove('is-on'), 6000);
  }
  flash(text, { tone = 'good' } = {}) {
    this.flashEl.textContent = text;
    this.flashEl.dataset.tone = tone;
    this.flashEl.classList.remove('is-on'); void this.flashEl.offsetWidth; this.flashEl.classList.add('is-on');
    clearTimeout(this._flashT); this._flashT = setTimeout(() => this.flashEl.classList.remove('is-on'), 1800);
  }
  confetti(x, y, n) { if (!reduceMotion) confetti(this.parts, x, y, n); }
  say(text, extra = null) {
    this.sayEl.innerHTML = `<span data-tr="no">${md(text)}</span>`;   // translated whole, not word by word
    if (extra) this.sayEl.append(extra);
  }
  describe(text) { this.cv.setAttribute('aria-label', text); }

  // readouts in the guide card
  readout(id, label) {
    const v = el('dd', { text: '–' });
    const row = el('div', {}, el('dt', { text: label }), v);
    this.roEl.append(row);
    this.readouts.set(id, { v, row });
    return this;
  }
  set(id, text) { const r = this.readouts.get(id); if (r && r.v.textContent !== text) r.v.textContent = text; }
  showReadout(id, on) { const r = this.readouts.get(id); if (r) r.row.hidden = !on; }
  controls(...kids) { this.ctlEl.append(...kids); return this; }

  // ------------------------------------------------------------ the guide's buttons
  _mainActs() {
    this.whyBtn = el('button', { type: 'button', class: 'stg-act stg-why', hidden: true });
    this.chBtn = el('button', { type: 'button', class: 'stg-act stg-ch', hidden: true });
    this.whyBtn.addEventListener('click', () => this.startTour());
    this.chBtn.addEventListener('click', () => this.openChallenges());
    this.actsEl.append(this.whyBtn, this.chBtn);
  }
  _home() {
    this.mode = 'play'; this.locked = false; this.ctlEl.hidden = false;
    this.say(this.o.hello || '');
    this.actsEl.replaceChildren(this.whyBtn, this.chBtn);
    this._countChallenges();
    if (this.o.onHome) this.o.onHome();
  }

  // ------------------------------------------------------------ walkthrough
  // tour: { title, steps: [{ say, enter(st), leave(st), draw(g, w, h, t, st), mark(st) -> [x, y, r] }] }
  tour(def) { this.tourDef = def; this.whyBtn.textContent = def.title || 'Why?'; this.whyBtn.hidden = false; return this; }
  startTour() {
    if (!this.tourDef) return;
    this._saved = { tools: [...this.tools.values()].map((t) => [t.id, t.on]), speed: this.speed, paused: this.paused };
    this.mode = 'tour'; this.ctlEl.hidden = true;
    this.tourI = -1;
    this._tourGo(0);
    sound.play('pop');
  }
  _tourGo(i) {
    const steps = this.tourDef.steps;
    if (this.tourStep && this.tourStep.leave) { try { this.tourStep.leave(this); } catch (e) { console.error(e); } }
    if (i >= steps.length || i < 0) { this.endTour(); return; }
    this.tourI = i; this.tourStep = steps[i];
    if (this.tourStep.tools) for (const [k, v] of Object.entries(this.tourStep.tools)) this.setTool(k, v);
    if (this.tourStep.enter) { try { this.tourStep.enter(this); } catch (e) { console.error(e); } }
    const dots = el('div', { class: 'stg-dots', 'aria-hidden': 'true' }, ...steps.map((_, k) => el('i', { class: k === i ? 'on' : k < i ? 'done' : '' })));
    this.say(this.tourStep.say);
    const back = el('button', { type: 'button', class: 'stg-act ghost', text: 'Back', disabled: i === 0 ? true : undefined });
    const next = el('button', { type: 'button', class: 'stg-act', text: i === steps.length - 1 ? 'Got it!' : 'Next' });
    const quit = el('button', { type: 'button', class: 'stg-act ghost', text: trc('tour', 'Stop') });
    back.addEventListener('click', () => { this._tourGo(i - 1); sound.play('click'); });
    next.addEventListener('click', () => { this._tourGo(i + 1); sound.play(i === steps.length - 1 ? 'chime' : 'click'); });
    quit.addEventListener('click', () => this.endTour());
    this.actsEl.replaceChildren(el('div', { class: 'stg-nav' }, back, next, quit), dots);
    setTimeout(() => next.focus({ preventScroll: true }), 30);
  }
  endTour() {
    if (this.tourStep && this.tourStep.leave && this.mode === 'tour') { try { this.tourStep.leave(this); } catch (_) {} }
    this.tourStep = null;
    if (this._saved) { for (const [k, v] of this._saved.tools) this.setTool(k, v); this.setSpeed(this._saved.speed); this.setPaused(this._saved.paused); this._saved = null; }
    if (this.mode === 'tour' && this.tourDef && this.tourDef.done) rig.flag('tour:' + this.bench.id, true);
    if (this.mode === 'tour' && this.tourDef && this.tourDef.onEnd) this.tourDef.onEnd(this);
    this._home();
  }

  // ------------------------------------------------------------ challenges
  // { id, title, q, choices: [...], answer: index, run(st, finish), explain, card }
  setChallenges(list) { this.challenges = list; this._countChallenges(); return this; }
  _key(ch) { return `${this.bench.id}.${ch.id}`; }
  _countChallenges() {
    if (!this.challenges.length) { this.chBtn.hidden = true; return; }
    const done = this.challenges.filter((c) => rig.chal(this._key(c))).length;
    this.chBtn.hidden = false;
    this.chBtn.textContent = `Challenges · ${done}/${this.challenges.length}`;
  }
  openChallenges() {
    sound.play('click');
    this.mode = 'list'; this.ctlEl.hidden = true;
    this.say('Guess first, then watch. Which one?');
    const list = el('div', { class: 'stg-chlist' }, ...this.challenges.map((c) => {
      const r = rig.chal(this._key(c));
      const b = el('button', { type: 'button', class: 'stg-chcard' + (r ? ' is-done' : '') },
        el('b', { text: c.title }), el('span', { text: r ? (r.ok ? 'Solved: you called it' : 'Solved') : 'New' }));
      b.addEventListener('click', () => this.askChallenge(c));
      return b;
    }));
    const back = el('button', { type: 'button', class: 'stg-act ghost', text: 'Back to playing' });
    back.addEventListener('click', () => this._home());
    this.actsEl.replaceChildren(list, back);
    setTimeout(() => (list.querySelector('button') || back).focus({ preventScroll: true }), 30);
  }
  askChallenge(c) {
    this.mode = 'ask';
    if (c.setup) { try { c.setup(this); } catch (e) { console.error(e); } }
    const title = tr(c.title);   // parts translated one by one; a title that is a question keeps its "?"
    this.say(`**${title}${/[.?!…]$/.test(title) ? '' : '.'}** ${tr(c.q)}`);
    const opts = el('div', { class: 'stg-choices', role: 'group', 'aria-label': 'Your prediction' }, ...c.choices.map((t, i) => {
      const b = el('button', { type: 'button', class: 'stg-choice', text: trc('choice', t) });   // short answers can need their own word
      b.addEventListener('click', () => { sound.play('click'); this.watchChallenge(c, i); });
      return b;
    }));
    const back = el('button', { type: 'button', class: 'stg-act ghost', text: 'Back' });
    back.addEventListener('click', () => this.openChallenges());
    this.actsEl.replaceChildren(el('p', { class: 'stg-small', text: 'Your prediction:' }), opts, back);
    setTimeout(() => opts.querySelector('button').focus({ preventScroll: true }), 30);
  }
  watchChallenge(c, pick) {
    this.mode = 'watch';
    this.say(c.watch || 'Let’s see! Watch closely…');
    const skip = el('button', { type: 'button', class: 'stg-act ghost', text: 'Show me the answer' });
    let done = false;
    const finish = (extra) => {
      if (done) return; done = true;
      this.locked = false;
      this.resultChallenge(c, pick, extra);
    };
    skip.addEventListener('click', () => { if (c.skip) c.skip(this); finish(); });
    this.actsEl.replaceChildren(skip);
    this.locked = !!c.lock;
    try { c.run(this, finish); } catch (e) { console.error(e); finish(); }
  }
  resultChallenge(c, pick, extra) {
    this.mode = 'result';
    const ok = pick === c.answer;
    const first = !rig.chal(this._key(c));
    rig.chal(this._key(c), { pick, ok });
    sound.play(ok ? 'right' : 'wrong');
    const verdict = ok ? (c.yes || 'You called it!') : (c.no || 'Not quite, and that is the fun part.');
    this.say(`**${tr(verdict)}** ${extra ? tr(extra) + ' ' : ''}${tr(c.explain)}`);
    if (ok && first) this.confetti(this.w / 2, this.h * 0.35, 36);
    if (c.card && CARDS[c.card] && rig.card(c.card)) {
      // the building shows a toast for new cards; play the sound here
      sound.play('card');
    }
    const again = el('button', { type: 'button', class: 'stg-act ghost', text: 'Try it myself' });
    again.addEventListener('click', () => { if (c.after) c.after(this); this._home(); });
    const nextC = this.challenges[(this.challenges.indexOf(c) + 1) % this.challenges.length];
    const more = el('button', { type: 'button', class: 'stg-act', text: 'More challenges' });
    more.addEventListener('click', () => { if (c.after) c.after(this); this.openChallenges(); });
    this.actsEl.replaceChildren(more, again);
    this._countChallenges();
    setTimeout(() => more.focus({ preventScroll: true }), 30);
    void nextC;
  }

  // ------------------------------------------------------------ live graph under the scene
  // series: [{ id, label, color }]
  liveGraph({ series, window = 8, ylabel = '', yrange = null, sym = false }) {
    this.graph = new LiveGraph(this.graphEl, { series, window, ylabel, yrange, sym });
    return this.graph;
  }
}

// ---------------------------------------------------------------- a scrolling graph
export class LiveGraph {
  constructor(host, { series, window = 8, ylabel = '', yrange = null, sym = false }) {
    this.host = host; this.series = series; this.window = window; this.ylabel = ylabel; this.yrange = yrange; this.sym = sym;
    this.cv = el('canvas', { role: 'img', 'aria-label': 'Live graph' });
    this.legend = el('div', { class: 'stg-legend' }, ...series.map((s) => el('span', {}, el('i', { style: { background: s.color } }), s.label)));
    host.append(this.legend, this.cv);
    this.data = series.map(() => []);
    this.g = this.cv.getContext('2d');
  }
  clear() { this.data = this.series.map(() => []); }
  push(t, vals) {
    this.series.forEach((s, i) => { const v = vals[s.id]; if (Number.isFinite(v)) this.data[i].push([t, v]); });
    const t0 = t - this.window * 1.2;
    for (const d of this.data) { let k = 0; while (k < d.length && d[k][0] < t0) k++; if (k) d.splice(0, k); }
    this.tNow = t;
  }
  resize() {
    const w = Math.max(200, (this.host.clientWidth || 420) - 20), h = 118, dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.style.height = h + 'px';
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr); this.w = w; this.h = h; this.dpr = dpr;
  }
  draw() {
    if (this.host.hidden || !this.w) return;
    const g = this.g, w = this.w, h = this.h, padL = 44, padR = 10, padT = 8, padB = 22;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const t1 = this.tNow || 0, t0 = t1 - this.window;
    let lo = Infinity, hi = -Infinity;
    for (const d of this.data) for (const [, v] of d) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (this.yrange) [lo, hi] = this.yrange;
    if (!Number.isFinite(lo)) { lo = -1; hi = 1; }
    if (this.sym) { const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-9); lo = -m; hi = m; }
    if (hi - lo < 1e-12) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = (t) => padL + (t - t0) / (t1 - t0) * (w - padL - padR), Y = (v) => padT + (hi - v) / (hi - lo) * (h - padT - padB);
    g.fillStyle = '#FFFDF6'; g.fillRect(padL, padT, w - padL - padR, h - padT - padB);
    g.strokeStyle = '#D6ECF7'; g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) { const y = padT + k * (h - padT - padB) / 4; g.beginPath(); g.moveTo(padL, y); g.lineTo(w - padR, y); g.stroke(); }
    if (lo < 0 && hi > 0) { g.strokeStyle = '#A8D3EA'; g.beginPath(); g.moveTo(padL, Y(0)); g.lineTo(w - padR, Y(0)); g.stroke(); }
    g.strokeStyle = LINE; g.lineWidth = 1.5; g.strokeRect(padL, padT, w - padL - padR, h - padT - padB);
    g.font = '500 10px "Plex", system-ui, sans-serif'; g.fillStyle = '#12243A'; g.textAlign = 'right'; g.textBaseline = 'middle';
    const fmt = (v) => Math.abs(hi - lo) < 0.1 ? v.toFixed(3) : Math.abs(hi - lo) < 10 ? v.toFixed(2) : v.toFixed(0);
    g.fillText(fmt(hi - pad), padL - 4, Y(hi - pad)); g.fillText(fmt(lo + pad), padL - 4, Y(lo + pad));
    g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('time (s) →', (padL + w) / 2, h - padB + 6);
    g.save(); g.beginPath(); g.rect(padL, padT, w - padL - padR, h - padT - padB); g.clip();
    this.series.forEach((s, i) => {
      const d = this.data[i]; if (d.length < 2) return;
      g.beginPath(); let first = true;
      for (const [t, v] of d) { if (t < t0 - 0.1) continue; const x = X(t), y = Y(v); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); }
      g.strokeStyle = s.color; g.lineWidth = 2.2; g.lineJoin = 'round'; g.stroke();
    });
    g.restore();
    if (this.ylabel) { g.save(); g.translate(11, (padT + h - padB) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(this.ylabel, 0, 0); g.restore(); }
  }
}
