// Light for the building: the time of day follows the visitor's own clock (sunbeams in the
// morning, a sunset in the evening, the city lit up at night), lamps and screens glow, and the
// sky outside the windows changes with it. Add ?tod=dawn|day|dusk|night to the address to try
// a time without waiting for it.

import { TILE } from './tiles.js';
import { mix } from './pix.js';

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function timeOfDay(now = new Date()) {
  let q = null;
  try { q = new URLSearchParams(location.search).get('tod'); } catch (_) {}
  const fixed = { dawn: 6.6, morning: 9.5, day: 13, afternoon: 15.5, dusk: 18.0, evening: 19.2, night: 22.5 };
  const h = q && fixed[q] !== undefined ? fixed[q] : now.getHours() + now.getMinutes() / 60;
  // a gentle seasonal shift of sunrise and sunset (northern mid-latitudes)
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
  const season = Math.cos((doy - 172) / 365 * 2 * Math.PI);      // 1 in June, -1 in December
  const rise = 6.4 - 0.9 * season, set = 18.4 + 1.1 * season;
  const sun = smooth(rise - 0.4, rise + 0.9, h) * (1 - smooth(set - 0.9, set + 0.4, h));
  const warm = Math.min(1, Math.exp(-(((h - set) / 0.85) ** 2)) + 0.8 * Math.exp(-(((h - rise) / 0.7) ** 2)));
  const night = 1 - sun;
  const phase = sun > 0.8 ? 'day' : warm > 0.35 ? (h < 12 ? 'dawn' : 'dusk') : sun < 0.2 ? 'night' : (h < 12 ? 'dawn' : 'dusk');
  // the sun's direction: east in the morning, west in the afternoon (-1 .. 1)
  const az = Math.max(-1, Math.min(1, (h - (rise + set) / 2) / ((set - rise) / 2)));
  return { h, sun, warm, night, phase, az, key: `${phase}:${Math.round(h * 4)}` };
}

// colours of the light that fills a room: [r, g, b] in 0..1
export function ambient(tod, floor) {
  const tint = { 1: [1.0, 0.985, 0.95], 2: [0.985, 0.97, 1.0], 3: [0.95, 0.985, 1.0] }[floor] || [1, 1, 1];
  const day = [0.93, 0.93, 0.92], night = [0.56, 0.6, 0.8], dusk = [0.95, 0.8, 0.7];
  const c = [0, 1, 2].map((i) => (day[i] * tod.sun + night[i] * tod.night) * (1 - 0.6 * tod.warm) + dusk[i] * 0.6 * tod.warm);
  return c.map((v, i) => Math.max(0, Math.min(1, v * tint[i])));
}
export const rgb = (c, k = 1) => `rgb(${Math.round(Math.min(1, c[0] * k) * 255)},${Math.round(Math.min(1, c[1] * k) * 255)},${Math.round(Math.min(1, c[2] * k) * 255)})`;

// ---------------------------------------------------------------- the view through the windows
export function skyAt(tod) {
  // top and bottom colours of the sky
  const day = ['#8FD3FF', '#D9F4FF'], night = ['#0B1630', '#22325C'], dusk = ['#5B6FD0', '#FFB98A'], dawn = ['#8FB5F0', '#FFD3B8'];
  const w = tod.warm, s = tod.sun;
  const pick = (i) => {
    let c = mix(night[i], day[i], s);
    if (w > 0.05) c = mix(c, tod.h < 12 ? dawn[i] : dusk[i], Math.min(1, w));
    return c;
  };
  return [pick(0), pick(1)];
}

// paints the glass of every window run (a run is n tiles wide, two tiles tall) for this time
export function paintWindows(g, runs, tod, floor, t = 0) {
  const [top, bot] = skyAt(tod);
  for (const r of runs) {
    const x = r.x, y = r.y, w = r.w, h = r.h;
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    // stars and a moon at night
    if (tod.night > 0.5) {
      for (let i = 0; i < w / 5; i++) {
        const sx = x + ((i * 37 + r.seed * 13) % w), sy = y + ((i * 23 + r.seed * 7) % 14);
        const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
        g.fillStyle = `rgba(255,253,246,${(0.35 + 0.6 * tw) * Math.min(1, (tod.night - 0.5) * 2)})`;
        g.fillRect(sx, sy, 1, 1);
      }
      if (r.seed % 3 === 1) { g.fillStyle = '#FFF2C2'; g.fillRect(x + w - 12, y + 3, 4, 4); g.fillRect(x + w - 13, y + 4, 6, 2); g.fillRect(x + w - 11, y + 2, 2, 6); g.fillStyle = top; g.fillRect(x + w - 11, y + 3, 2, 2); }
    }
    // the sun low over the city at dawn and dusk
    if (tod.warm > 0.3 && r.seed % 3 === 2) {
      const sy = y + 12 + Math.round((1 - tod.sun) * 8);
      g.fillStyle = '#FFE07A'; g.fillRect(x + 8, sy, 6, 6); g.fillRect(x + 7, sy + 1, 8, 4);
      g.fillStyle = 'rgba(255,224,122,0.35)'; g.fillRect(x + 4, sy - 2, 14, 10);
    }
    // skyline: rounded future towers, darker against a bright sky, lit up at night
    const base = y + h;
    const bodyDay = ['#7FA6DA', '#6C93CC'], bodyNight = ['#1B2C4E', '#22325C'], bodyDusk = ['#5B4B8C', '#4A3A7C'];
    for (let i = 0; i < w; i++) {
      const gx = x + i, col = Math.floor((gx) / 4);
      const hh = 7 + ((col * 7 + r.seed * 3) % 9);
      const k = col % 2;
      let c = mix(bodyNight[k], bodyDay[k], tod.sun);
      if (tod.warm > 0.05) c = mix(c, bodyDusk[k], Math.min(1, tod.warm) * 0.8);
      g.fillStyle = c; g.fillRect(gx, base - hh, 1, hh);
      // windows of the towers: a few lit in the day, many at night
      if (i % 2 === 0) {
        for (let wy = base - hh + 2; wy < base - 1; wy += 3) {
          const on = ((gx * 31 + wy * 17 + r.seed) % 7) < (1 + 5 * tod.night);
          if (on) { g.fillStyle = tod.night > 0.5 ? (((gx + wy) % 5 === 0) ? '#BDEFFF' : '#FFE07A') : 'rgba(255,253,246,0.55)'; g.fillRect(gx, wy, 1, 1); }
        }
      }
      // red lights on the tallest towers at night
      if (tod.night > 0.5 && hh >= 15 && i % 4 === 1 && Math.sin(t * 3 + col) > 0.3) { g.fillStyle = '#FF5A5A'; g.fillRect(gx, base - hh - 1, 1, 1); }
    }
    if (floor === 3) { g.fillStyle = `rgba(0,212,255,${0.18 + 0.2 * tod.night})`; g.fillRect(x, y + 22, w, 1); }
    g.restore();
  }
}

// window runs on the north wall: { x, y, w, h, seed }
export function windowRuns(map) {
  const out = [], rows = map.rows;
  for (let ty = 0; ty < rows.length; ty++) for (let tx = 0; tx < rows[0].length; tx++) {
    if (rows[ty][tx] === 'O' && (tx === 0 || rows[ty][tx - 1] !== 'O')) {
      let n = 0; while (rows[ty][tx + n] === 'O') n++;
      out.push({ x: tx * TILE, y: ty * TILE, w: n * TILE, h: 2 * TILE, seed: tx, tx, ty, n });
    }
  }
  return out;
}

// ---------------------------------------------------------------- lamps and glowing things
// anchor as a fraction of the prop's sprite; r in world pixels; i = strength; c = colour
export const LIGHT_DEFS = {
  directory: [{ fx: 0.5, fy: 0.32, r: 40, c: '#7FE4FF', i: 0.32, emit: true }],
  vending: [{ fx: 0.5, fy: 0.3, r: 34, c: '#FFC2D1', i: 0.34, emit: true }],
  coffee: [{ fx: 0.5, fy: 0.45, r: 16, c: '#FFB46B', i: 0.28, emit: true }],
  cooler: [{ fx: 0.5, fy: 0.3, r: 16, c: '#9CCBFF', i: 0.22 }],
  counter: [{ fx: 0.5, fy: 0.72, r: 46, c: '#7FE4FF', i: 0.28, emit: true }],
  cabinet: [{ fx: 0.5, fy: 0.45, r: 30, c: '#FFE07A', i: 0.18 }],
  optics: [{ fx: 0.15, fy: 0.42, r: 26, c: '#FF7070', i: 0.36, flicker: 0.25, emit: true }],
  fieldtable: [{ fx: 0.5, fy: 0.45, r: 34, c: '#C9BCFF', i: 0.24 }],
  desk: [{ fx: 0.5, fy: 0.3, r: 22, c: '#9CCBFF', i: 0.26, emit: true }],
  lamp: [{ fx: 0.5, fy: 0.15, r: 70, c: '#FFD9A0', i: 0.55, night: true, emit: true }],
  arcade: [{ fx: 0.5, fy: 0.35, r: 38, c: '#FF8FAB', i: 0.4, flicker: 0.35, emit: true }],
  snackbar: [{ fx: 0.5, fy: 0.3, r: 40, c: '#FFD9A0', i: 0.28 }],
  darkroom: [{ fx: 0.5, fy: 0.55, r: 56, c: '#FF5A5A', i: 0.3, emit: true }],
  chladni: [{ fx: 0.5, fy: 0.4, r: 26, c: '#FFE07A', i: 0.18 }],
  holoboard: [{ fx: 0.5, fy: 0.5, r: 84, c: '#00D4FF', i: 0.5, flicker: 0.12, emit: true }],
  holodoor: [{ fx: 0.5, fy: 0.55, r: 64, c: '#00D4FF', i: 0.5, flicker: 0.15, emit: true }],
  rack: [{ fx: 0.5, fy: 0.35, r: 30, c: '#7CFFB2', i: 0.3, flicker: 0.2, emit: true }],
  magnet: [{ fx: 0.5, fy: 0.5, r: 30, c: '#7FE4FF', i: 0.2 }],
  optable: [{ fx: 0.5, fy: 0.45, r: 54, c: '#7CFFB2', i: 0.34, flicker: 0.15, emit: true }],
  simdesk: [{ fx: 0.5, fy: 0.3, r: 54, c: '#9CCBFF', i: 0.4, emit: true }],
  gpurack: [{ fx: 0.5, fy: 0.5, r: 40, c: '#00D4FF', i: 0.3, flicker: 0.35, emit: true }],
  fridge: [{ fx: 0.5, fy: 0.5, r: 40, c: '#A8ECFF', i: 0.3 }],
  server: [{ fx: 0.5, fy: 0.5, r: 22, c: '#7CFFB2', i: 0.24, flicker: 0.4, emit: true }],
  pipetower: [{ fx: 0.5, fy: 0.3, r: 24, c: '#FFD9A0', i: 0.14 }],
  launcher: [{ fx: 0.7, fy: 0.4, r: 20, c: '#FFE07A', i: 0.14 }],
  // 3F: the spin gallery and the paper gallery
  spintop: [{ fx: 0.5, fy: 0.4, r: 30, c: '#FF8FAB', i: 0.26, flicker: 0.2, emit: true }],
  wavechain: [{ fx: 0.5, fy: 0.4, r: 44, c: '#B9A8FF', i: 0.26, flicker: 0.25, emit: true }],
  kerr: [{ fx: 0.5, fy: 0.35, r: 30, c: '#9CCBFF', i: 0.3, emit: true }],
  cavity: [{ fx: 0.5, fy: 0.45, r: 30, c: '#FFB46B', i: 0.26, flicker: 0.15, emit: true }],
  logicbench: [{ fx: 0.5, fy: 0.4, r: 34, c: '#7CFFB2', i: 0.26, flicker: 0.3, emit: true }],
  braggtable: [{ fx: 0.5, fy: 0.45, r: 36, c: '#FFE07A', i: 0.2 }],
  rodstand: [{ fx: 0.5, fy: 0.4, r: 22, c: '#FFD9A0', i: 0.14 }],
  frame: [{ fx: 0.5, fy: 0.45, r: 18, c: '#FFE3B8', i: 0.12, night: true }],
  chorong: [{ fx: 0.5, fy: 0.35, r: 30, c: '#FFB08A', i: 0.32, flicker: 0.2, emit: true }],
  noraebang: [{ fx: 0.5, fy: 0.15, r: 40, c: '#FF8FAB', i: 0.36, flicker: 0.3, emit: true }],
  claw: [{ fx: 0.5, fy: 0.35, r: 30, c: '#FFC2D1', i: 0.3, flicker: 0.2, emit: true }],
  cstore: [{ fx: 0.5, fy: 0.45, r: 30, c: '#BFEFFF', i: 0.3, emit: true }],
  pumpkin: [{ fx: 0.5, fy: 0.55, r: 26, c: '#FFB46B', i: 0.4, flicker: 0.45, emit: true }],
  xtree: [{ fx: 0.5, fy: 0.5, r: 30, c: '#FFE07A', i: 0.3, flicker: 0.4, emit: true }],
};

// lights for one floor: from the props, plus ceiling lamps over the open floor
export function floorLights(f) {
  const out = [];
  for (const q of f.props) {
    const defs = LIGHT_DEFS[q.type]; if (!defs || !q.img) continue;
    for (const d of defs) out.push({ ...d, x: q.px + q.img.width * d.fx, y: q.py + q.img.height * d.fy, seed: q.x * 7 + q.y * 3 });
  }
  for (const q of f.wallProps || []) {
    const defs = LIGHT_DEFS[q.type]; if (!defs || !q.img) continue;
    for (const d of defs) out.push({ ...d, x: q.px + q.img.width * d.fx, y: q.py + q.img.height * d.fy, seed: q.x * 5 + q.y });
  }
  for (let ty = 5; ty < f.H - 1; ty += 6) for (let tx = 4; tx < f.W - 2; tx += 7) {
    out.push({ x: tx * TILE + 8, y: ty * TILE + 8, r: 74, c: '#FFE3B8', i: 0.16, nightBoost: 0.3, ceiling: true });
  }
  return out;
}
