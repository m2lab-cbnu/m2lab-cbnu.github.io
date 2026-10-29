// Shared pieces for the building's experiments: the set-up strip (samples and equipment you can
// swap), an animation loop that only runs while its tab is visible, a table for your
// measurements, and a straight-line fit.

import { el, fmtNum } from '../ui/widgets.js';
import { ITEMS, itemIcon, itemWhere } from '../rpg/items.js';
import { rig } from '../rpg/state.js';
import { tr, trf } from '../i18n.js';

const notYet = (it, id) => trf('{0}: not in your bag yet. {1}', tr(it.name), tr(itemWhere(id)));

// ---------------------------------------------------------------- set-up strip
// slots: [{ id, label, options: [itemId...], def: itemId }]
// One compact row of slot buttons ("Bob: Steel ball"); each opens a small tray of the options.
let openTray = null;
document.addEventListener('pointerdown', (e) => { if (openTray && !openTray.wrap.contains(e.target)) openTray.close(); }, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openTray) { e.preventDefault(); e.stopPropagation(); const b = openTray.btn; openTray.close(); b.focus(); } }, true);

function iconCanvas(id, size = 16) {
  const cv = el('canvas', { width: 16, height: 16, 'aria-hidden': 'true', class: 'rig-ic' });
  cv.getContext('2d').drawImage(itemIcon(id), 0, 0);
  cv.style.width = cv.style.height = size + 'px';
  return cv;
}

export function rigStrip(bench) {
  return (host) => {
    const box = el('div', { class: 'rig', role: 'group', 'aria-label': 'Samples and equipment' }, el('span', { class: 'rig-title', text: 'Set-up' }));
    const hint = el('p', { class: 'rig-hint', 'aria-live': 'polite' });
    const slots = [];
    const avail = (id) => (ITEMS[id] && ITEMS[id].where === 'free') || rig.has(id);
    for (const slot of bench.slots) {
      const btn = el('button', { type: 'button', class: 'rig-slot-btn', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
      const tray = el('div', { class: 'rig-tray', role: 'radiogroup', 'aria-label': slot.label, hidden: true });
      const wrap = el('div', { class: 'rig-slot' }, btn, tray);
      const opts = slot.options.map((id) => {
        const it = ITEMS[id] || { name: id };
        const b = el('button', { type: 'button', class: 'rig-opt', role: 'radio', 'data-id': id }, iconCanvas(id, 28), el('span', { class: 'nm', text: it.name }), el('small', { class: 'ds' }));
        b.addEventListener('click', () => {
          if (!avail(id)) { hint.textContent = notYet(it, id); return; }
          rig.mount(bench.id, slot.id, id, 'strip');
          hint.textContent = it.desc || '';
          close(); btn.focus({ preventScroll: true });
        });
        b.addEventListener('focus', () => { hint.textContent = avail(id) ? (it.desc || '') : notYet(it, id); });
        b.addEventListener('pointerenter', () => { hint.textContent = avail(id) ? (it.desc || '') : notYet(it, id); });
        return b;
      });
      tray.append(...opts);
      const close = () => { tray.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (openTray && openTray.btn === btn) openTray = null; };
      const open = () => {
        if (openTray) openTray.close();
        tray.hidden = false; btn.setAttribute('aria-expanded', 'true');
        openTray = { wrap, btn, close };
        const cur = tray.querySelector('[aria-checked="true"]') || opts[0];
        setTimeout(() => cur && cur.focus({ preventScroll: true }), 20);
      };
      btn.addEventListener('click', () => (tray.hidden ? open() : close()));
      tray.addEventListener('keydown', (e) => {
        const i = opts.indexOf(document.activeElement); if (i < 0) return;
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (k) { e.preventDefault(); opts[(i + k + opts.length) % opts.length].focus(); }
      });
      slots.push({ slot, btn, opts });
      box.append(wrap);
    }
    host.append(el('div', { class: 'rig-bar' }, box, hint));
    function refresh() {
      for (const { slot, btn, opts } of slots) {
        const cur = current(bench, slot.id), it = ITEMS[cur] || { name: cur };
        btn.replaceChildren(iconCanvas(cur, 24), el('span', { class: 'l', text: slot.label }), el('b', { text: it.name }), el('span', { class: 'car', 'aria-hidden': 'true', text: '▾' }));
        btn.setAttribute('aria-label', trf('{0}: {1}. Change', tr(slot.label), tr(it.name)));
        for (const b of opts) {
          const id = b.dataset.id, on = id === cur, ok = avail(id);
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          b.classList.toggle('is-locked', !ok);
          b.querySelector('.ds').textContent = ok ? '' : 'not found yet';
          b.title = ok ? (ITEMS[id] && ITEMS[id].desc) || '' : itemWhere(id);
        }
      }
    }
    refresh();
    rig.on('mount', (m) => { if (m.bench === bench.id) refresh(); });
    rig.on('item', refresh);
    rig.on('flag', refresh);
    rig.on('reset', refresh);
  };
}

// the item mounted in a slot, falling back to the slot's default when it is not available
export function current(bench, slotId) {
  const slot = bench.slots.find((s) => s.id === slotId);
  const id = rig.mounted(bench.id, slotId, slot.def);
  const ok = (ITEMS[id] && ITEMS[id].where === 'free') || rig.has(id);
  return ok ? id : slot.def;
}
export function phys(bench, slotId) { const id = current(bench, slotId); return { id, ...(ITEMS[id] && ITEMS[id].phys), item: ITEMS[id] }; }
export function onRig(bench, fn) {
  const offs = [rig.on('mount', (m) => { if (m.bench === bench.id) fn(m); }), rig.on('item', () => fn({})), rig.on('reset', () => fn({}))];
  return () => offs.forEach((f) => f());
}

// ---------------------------------------------------------------- animation loop
// runs draw(dt, t) every frame while the pane is visible; returns { start, stop }
export function loop(step) {
  let raf = 0, last = 0, t = 0, on = false;
  const frame = (now) => {
    if (!on) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; t += dt;
    step(dt, t);
  };
  return {
    start() { if (on) return; on = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { on = false; cancelAnimationFrame(raf); },
    get running() { return on; },
  };
}

// ---------------------------------------------------------------- data table
// cols: [{ key, label, fmt? }]
export function dataTable(cols, { caption = 'Your measurements', onChange, max = 40 } = {}) {
  const rows = [];
  const tbody = el('tbody');
  const table = el('table', { class: 'dtab' },
    el('caption', { text: caption }),
    el('thead', {}, el('tr', {}, ...cols.map((c) => el('th', { scope: 'col', text: c.label })), el('th', { scope: 'col' }, el('span', { class: 'vh', text: 'Remove' })))),
    tbody);
  const empty = el('p', { class: 'dtab-empty', text: 'Nothing recorded yet.' });
  const wrap = el('div', { class: 'dtab-wrap' }, table, empty);
  function render() {
    tbody.replaceChildren(...rows.map((r, i) => el('tr', {},
      ...cols.map((c) => el('td', { text: c.fmt ? c.fmt(r[c.key], r) : (typeof r[c.key] === 'number' ? fmtNum(r[c.key], 4) : (r[c.key] ?? '')) })),
      el('td', {}, el('button', { type: 'button', class: 'dtab-x', 'aria-label': 'Remove this row', text: '×', onclick: () => { rows.splice(i, 1); render(); onChange && onChange(rows); } })))));
    empty.hidden = rows.length > 0;
    table.hidden = rows.length === 0;
  }
  render();
  return {
    el: wrap, rows,
    add(r) { rows.push(r); if (rows.length > max) rows.shift(); render(); onChange && onChange(rows); },
    clear() { rows.length = 0; render(); onChange && onChange(rows); },
    csv() { return [cols.map((c) => c.label).join(','), ...rows.map((r) => cols.map((c) => r[c.key]).join(','))].join('\n'); },
  };
}

// least-squares straight line; returns { a (slope), b (intercept), sa, sb, r2 }
export function fitLine(x, y) {
  const n = x.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; syy += y[i] * y[i]; }
  const d = n * sxx - sx * sx;
  if (Math.abs(d) < 1e-300) return null;
  const a = (n * sxy - sx * sy) / d, b = (sy - a * sx) / n;
  let ss = 0;
  for (let i = 0; i < n; i++) { const r = y[i] - (a * x[i] + b); ss += r * r; }
  const s2 = n > 2 ? ss / (n - 2) : 0;
  const sa = Math.sqrt(n * s2 / d), sb = Math.sqrt(s2 * sxx / d);
  const my = sy / n; let st = 0; for (let i = 0; i < n; i++) st += (y[i] - my) ** 2;
  return { a, b, sa, sb, r2: st > 0 ? 1 - ss / st : 1 };
}
// line through the origin: y = a x
export function fitProp(x, y) {
  let sxx = 0, sxy = 0; const n = x.length;
  for (let i = 0; i < n; i++) { sxx += x[i] * x[i]; sxy += x[i] * y[i]; }
  if (!sxx) return null;
  const a = sxy / sxx; let ss = 0;
  for (let i = 0; i < n; i++) ss += (y[i] - a * x[i]) ** 2;
  return { a, sa: n > 1 ? Math.sqrt(ss / (n - 1) / sxx) : 0 };
}

// gaussian random number (Box-Muller)
export function gauss() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// size a canvas to its box, for direct drawing with a device-pixel transform
export function fitCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth || 300, h = c.clientHeight || 150;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h, dpr };
}

export { fmtNum };
