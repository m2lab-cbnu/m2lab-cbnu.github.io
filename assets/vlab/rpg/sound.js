// Sounds for the building, all made on the spot with Web Audio (no sound files): clicks and
// ticks, collisions, plucked strings at their real pitch, tones for resonances, little jingles
// for stamps and cards. Nothing plays until the visitor has touched or clicked the page, and
// one switch turns everything off. The setting is kept in this browser.

const KEY = 'm2lab-sound-v1';
let ctx = null, master = null, fx = null, musicBus = null;
let prefs = { on: true, music: false };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) prefs = Object.assign(prefs, s); } catch (_) {}
const listeners = new Set();

function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {} listeners.forEach((f) => { try { f(prefs); } catch (_) {} }); }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch (_) { return null; }
  master = ctx.createGain(); master.gain.value = prefs.on ? 0.9 : 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
  master.connect(comp); comp.connect(ctx.destination);
  fx = ctx.createGain(); fx.gain.value = 0.55; fx.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? 0.32 : 0; musicBus.connect(master);
  return ctx;
}

// browsers only allow audio after a gesture: unlock on the first one
function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}
['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, unlock, { capture: true, passive: true }));

function ready() { return ctx && ctx.state === 'running' && prefs.on; }
const now = () => ctx.currentTime;

function env(gainNode, t0, a, peak, d, sustain = 0) {
  const gn = gainNode.gain;
  gn.cancelScheduledValues(t0);
  gn.setValueAtTime(0.0001, t0);
  gn.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.max(0.001, a));
  gn.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t0 + a + d);
}

function osc(type, f, t0, dur, peak, { a = 0.004, bend = null, dest = fx, detune = 0 } = {}) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
  if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, bend), t0 + dur);
  env(gn, t0, a, peak, dur);
  o.connect(gn); gn.connect(dest);
  o.start(t0); o.stop(t0 + a + dur + 0.05);
  return o;
}

let noiseBuf = null;
function noise(t0, dur, peak, { type = 'bandpass', f = 2000, q = 1, a = 0.002, dest = fx, sweep = null } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t0); flt.Q.value = q;
  if (sweep) flt.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
  const gn = ctx.createGain(); env(gn, t0, a, peak, dur);
  s.connect(flt); flt.connect(gn); gn.connect(dest);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + a + dur + 0.05);
}

// ---------------------------------------------------------------- the sound set
const SFX = {
  tick(o = {}) { const t = now(); osc('sine', 1900 * (o.pitch || 1), t, 0.05, 0.22 * (o.vol ?? 1)); noise(t, 0.03, 0.12 * (o.vol ?? 1), { f: 3500, q: 2 }); },
  beep(o = {}) { const t = now(); osc('square', 2350 * (o.pitch || 1), t, 0.07, 0.06 * (o.vol ?? 1), { a: 0.002 }); },
  click() { const t = now(); osc('triangle', 1250, t, 0.035, 0.12); },
  pop() { const t = now(); osc('sine', 520, t, 0.09, 0.22, { bend: 980 }); },
  clack(o = {}) { const v = Math.min(1, o.vol ?? 1), t = now(); noise(t, 0.06, 0.35 * v, { f: 2600, q: 1.4 }); osc('triangle', 620 * (o.pitch || 1), t, 0.08, 0.2 * v); },
  thud(o = {}) { const v = Math.min(1, o.vol ?? 1), t = now(); osc('sine', 150, t, 0.16, 0.45 * v, { bend: 55 }); noise(t, 0.08, 0.2 * v, { type: 'lowpass', f: 600 }); },
  boing(o = {}) {
    const v = Math.min(1, o.vol ?? 1), t = now();
    const ox = ctx.createOscillator(), gn = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    ox.type = 'sine'; ox.frequency.setValueAtTime(260, t); ox.frequency.exponentialRampToValueAtTime(520, t + 0.08); ox.frequency.exponentialRampToValueAtTime(330, t + 0.35);
    lfo.frequency.value = 22; lg.gain.value = 26; lfo.connect(lg); lg.connect(ox.frequency);
    env(gn, t, 0.005, 0.3 * v, 0.38); ox.connect(gn); gn.connect(fx);
    ox.start(t); lfo.start(t); ox.stop(t + 0.45); lfo.stop(t + 0.45);
  },
  // a struck metal bar: partials of a free bar (1 : 2.76 : 5.40 : 8.93)
  clang(o = {}) { const v = Math.min(1, o.vol ?? 1), f = 520 * (o.pitch || 1), t = now(); [[1, 0.3, 1.4], [2.76, 0.16, 0.9], [5.4, 0.08, 0.5], [8.93, 0.05, 0.3]].forEach(([k, a, d]) => osc('sine', f * k, t, d, a * v)); noise(t, 0.04, 0.25 * v, { f: 4000, q: 0.8 }); },
  clink(o = {}) { const t = now(); [[1, 0.14, 0.35], [2.4, 0.07, 0.2], [4.1, 0.04, 0.12]].forEach(([k, a, d]) => osc('sine', 1500 * k * (o.pitch || 1), t, d, a * (o.vol ?? 1))); },
  whoosh(o = {}) { const t = now(); noise(t, 0.35, 0.18 * (o.vol ?? 1), { f: 400, sweep: 2400, q: 0.8, a: 0.08 }); },
  sand(o = {}) { const t = now(); noise(t, 0.12, 0.08 * (o.vol ?? 1), { type: 'highpass', f: 4500, q: 0.5 }); },
  zap() { const t = now(); osc('sawtooth', 900, t, 0.12, 0.07, { bend: 240 }); noise(t, 0.08, 0.1, { f: 5000, q: 2 }); },
  laser() { const t = now(); osc('square', 1400, t, 0.14, 0.05, { bend: 300 }); },
  photon(o = {}) { const t = now(); osc('sine', 2600 + Math.random() * 400, t, 0.04, 0.05 * (o.vol ?? 1)); },
  chime() { const t = now(); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { osc('triangle', f, t + i * 0.07, 0.35, 0.16); osc('sine', f * 2, t + i * 0.07, 0.25, 0.04); }); },
  coin() { const t = now(); osc('square', 987.77, t, 0.07, 0.07); osc('square', 1318.5, t + 0.07, 0.25, 0.07); },
  card() { const t = now(); [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => osc('triangle', f, t + i * 0.06, 0.3, 0.14)); noise(t, 0.2, 0.05, { f: 6000, q: 0.5 }); },
  stamp() { const t = now(); osc('sine', 180, t, 0.12, 0.4, { bend: 90 }); noise(t, 0.05, 0.2, { type: 'lowpass', f: 900 }); setTimeout(() => ready() && SFX.chime(), 140); },
  wrong() { const t = now(); osc('triangle', 330, t, 0.16, 0.12); osc('triangle', 262, t + 0.15, 0.26, 0.12); },
  right() { const t = now(); osc('triangle', 784, t, 0.12, 0.14); osc('triangle', 1175, t + 0.1, 0.28, 0.14); },
  blip(o = {}) { const t = now(); osc('square', (o.pitch || 1) * 640, t, 0.025, 0.025, { a: 0.001 }); },
  step() { const t = now(); noise(t, 0.04, 0.05, { type: 'lowpass', f: 500 }); },
  door() { const t = now(); osc('sine', 880, t, 0.5, 0.12); osc('sine', 659.25, t + 0.28, 0.7, 0.12); },
  swing() { const t = now(); noise(t, 0.22, 0.05, { f: 700, sweep: 1500, q: 0.7, a: 0.06 }); },
  // a plucked string, a little like a gayageum: a bright attack that fades
  pluck(o = {}) { const t = now() + (o.at || 0), f = o.f || 440, v = o.vol ?? 1; osc('triangle', f, t, o.d || 0.5, 0.16 * v, { a: 0.004 }); osc('sine', f * 2, t, (o.d || 0.5) * 0.6, 0.05 * v, { a: 0.002 }); osc('sine', f * 3, t, 0.12, 0.025 * v, { a: 0.001 }); },
  hammer(o = {}) { SFX.clang({ pitch: 1.35 * (o.pitch || 1), vol: o.vol ?? 1 }); const t = now(); osc('sine', 90, t, 0.1, 0.4, { bend: 45 }); },
};

// ---------------------------------------------------------------- music
// A gentle tune for each floor that makes itself up as it goes: a melody wandering over a
// five-note scale, plucked like a gayageum, over slow soft chords. 1F calm, 2F bouncy, 3F dreamy.
const TUNES = {
  1: { root: 261.63, scale: [0, 2, 4, 7, 9], bpm: 78, prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]] },
  2: { root: 293.66, scale: [0, 2, 4, 7, 9], bpm: 108, prog: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]] },
  3: { root: 220.0, scale: [0, 3, 5, 7, 10], bpm: 66, prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]] },
};
let music = null;
const semis = (f, n) => f * Math.pow(2, n / 12);
function musicTick() {
  if (!music || !ctx || ctx.state !== 'running' || !prefs.music) return;
  const T = TUNES[music.floor] || TUNES[1], beat = 60 / T.bpm;
  if (music.next < ctx.currentTime - 0.2) music.next = ctx.currentTime + 0.1;   // after a pause, pick up from now
  while (music.next < ctx.currentTime + 0.5) {
    const t = music.next, bar = Math.floor(music.beat / 4), inBar = music.beat % 4;
    if (inBar === 0) {   // a soft chord at the start of every bar
      for (const n of T.prog[bar % T.prog.length]) osc('sine', semis(T.root / 2, n), t, beat * 3.6, 0.035, { a: 0.25, dest: musicBus });
    }
    // the melody: a step or two up or down the scale, sometimes a rest, sometimes two quick notes
    const r = Math.random();
    const steps = r < 0.2 ? 0 : r < 0.6 ? 1 : 2, sub = Math.random() < (music.floor === 2 ? 0.45 : 0.2) ? 2 : 1;
    for (let k = 0; k < sub; k++) {
      if (Math.random() < 0.18) continue;
      music.deg = Math.max(-3, Math.min(9, music.deg + (Math.random() < 0.5 ? -steps : steps)));
      const oct = Math.floor(music.deg / T.scale.length), idx = ((music.deg % T.scale.length) + T.scale.length) % T.scale.length;
      const f = semis(T.root, T.scale[idx] + 12 * oct), at = t + k * beat / sub;
      osc('triangle', f, at, beat * 1.4 / sub + 0.2, 0.06, { a: 0.006, dest: musicBus });
      osc('sine', f * 2, at, beat * 0.6 / sub, 0.018, { a: 0.003, dest: musicBus });
    }
    music.beat++; music.next += beat;
  }
}

export const sound = {
  startMusic(floor) {
    ensure();
    if (music && music.floor === floor) return;
    if (!music) music = { timer: setInterval(musicTick, 200) };
    music.floor = floor; music.deg = 2; music.beat = 0; music.next = (ctx ? ctx.currentTime : 0) + 0.3;
  },
  stopMusic() { if (music) { clearInterval(music.timer); music = null; } },
  // a tune: notes as [frequency in Hz, beats], at `bpm`; returns its length in seconds
  melody(notes, bpm = 140) {
    if (!ready()) return 0;
    const b = 60 / bpm; let at = 0;
    for (const [f, n] of notes) { if (f) SFX.pluck({ f, at, d: Math.max(0.25, n * b * 1.2) }); at += n * b; }
    return at;
  },
  get on() { return prefs.on; },
  get music() { return prefs.music; },
  set(on) { prefs.on = !!on; save(); if (master) master.gain.setTargetAtTime(prefs.on ? 0.9 : 0, ctx.currentTime, 0.05); if (prefs.on) unlock(); },
  setMusic(on) { prefs.music = !!on; save(); ensure(); if (musicBus) musicBus.gain.setTargetAtTime(prefs.music ? 0.32 : 0, ctx.currentTime, 0.3); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  play(name, o) { if (!ready() || !SFX[name]) return; try { SFX[name](o || {}); } catch (_) {} },

  // a plucked string: additive partials f, 2f, 3f... with amplitudes amps[n-1] and a decay
  // that is faster for higher partials, like a real string
  pluck(f, amps = [1, 0.5, 0.33, 0.25, 0.2], { decay = 2.2, vol = 0.35, inharm = 0 } = {}) {
    if (!ready() || !(f > 15)) return;
    const t = now(), out = ctx.createGain(); out.gain.value = vol; out.connect(fx);
    const norm = amps.reduce((a, b) => a + Math.abs(b), 0) || 1;
    amps.forEach((A, i) => {
      const n = i + 1, fn = f * n * Math.sqrt(1 + inharm * n * n);
      if (fn > 12000 || Math.abs(A) < 1e-4) return;
      osc(i === 0 ? 'triangle' : 'sine', fn, t, decay / (1 + 0.35 * i), Math.abs(A) / norm, { a: 0.003, dest: out });
    });
  },
  // a steady tone you can retune while it plays (a motor, a speaker, a resonance)
  hum(type = 'sine') {
    ensure();
    if (!ctx) return { set() {}, stop() {} };
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), gn = ctx.createGain(), flt = ctx.createBiquadFilter();
    o.type = type; o2.type = 'sine'; o.frequency.value = 220; o2.frequency.value = 110; gn.gain.value = 0.0001;
    flt.type = 'lowpass'; flt.frequency.value = 3000;
    o.connect(flt); o2.connect(flt); flt.connect(gn); gn.connect(fx);
    o.start(); o2.start();
    let alive = true;
    return {
      set(f, vol = 0.1, sub = 0.5) {
        if (!alive || !ctx) return;
        const t = ctx.currentTime, v = prefs.on && ctx.state === 'running' ? vol : 0;
        o.frequency.setTargetAtTime(Math.max(20, f), t, 0.03); o2.frequency.setTargetAtTime(Math.max(20, f * sub), t, 0.03);
        gn.gain.setTargetAtTime(Math.max(0.0001, v), t, 0.05);
      },
      stop() { if (!alive) return; alive = false; const t = ctx.currentTime; gn.gain.setTargetAtTime(0.0001, t, 0.05); o.stop(t + 0.3); o2.stop(t + 0.3); },
    };
  },
  context: () => ensure(),
  bus: () => { ensure(); return musicBus; },
  ready,
};
