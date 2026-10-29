// Form controls for station panels. Every control has a visible label and works with the keyboard.

import { tr, trf } from '../i18n.js';

let uid = 0;
const id = (p) => `${p}-${++uid}`;

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') { const t = tr(v); e.innerHTML = t; if (t !== v) e.setAttribute('data-tr', 'no'); }   // rich text: translated whole
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function fmtNum(v, digits = 3) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) {
    const [mant, ex] = v.toExponential(2).split('e');
    return `${mant.replace('-', '−')} × 10${[...String(+ex)].map((c) => SUP[c] || c).join('')}`;
  }
  return (+v.toPrecision(digits)).toString().replace('-', '−');
}
export { fmtNum };

// Slider with an editable number box. log: true makes the slider logarithmic.
export function slider({ label, min, max, step, value, unit = '', log = false, digits = 3, onInput, hint }) {
  const sid = id('sl'), nid = id('nb');
  const toPos = (v) => log ? (Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)) * 1000 : v;
  const fromPos = (p) => log ? Math.pow(10, Math.log10(min) + p / 1000 * (Math.log10(max) - Math.log10(min))) : +p;
  const range = el('input', { type: 'range', id: sid, min: log ? 0 : min, max: log ? 1000 : max, step: log ? 1 : (step || 'any'), value: toPos(value) });
  const num = el('input', { type: 'number', id: nid, class: 'num', step: 'any', value: fmtPlain(value, digits), 'aria-label': unit ? trf('{0} in {1}', tr(label), unit) : label });
  const wrap = el('div', { class: 'ctl ctl-slider' },
    el('div', { class: 'ctl-head' }, el('label', { for: sid, text: label }), el('span', { class: 'ctl-val' }, num, unit ? el('span', { class: 'unit', text: unit }) : null)),
    range, hint ? el('p', { class: 'ctl-hint', text: hint }) : null);
  let cur = value;
  const set = (v, fire = true) => {
    if (!Number.isFinite(v)) return;
    v = Math.min(max, Math.max(min, v)); cur = v;
    range.value = toPos(v); num.value = fmtPlain(v, digits);
    if (fire && onInput) onInput(v);
  };
  range.addEventListener('input', () => set(fromPos(+range.value)));
  num.addEventListener('change', () => set(parseFloat(num.value)));
  wrap.get = () => cur; wrap.set = set;
  return wrap;
}
function fmtPlain(v, digits) { const a = Math.abs(v); return a !== 0 && (a < 1e-3 || a >= 1e6) ? v.toExponential(2) : (+v.toPrecision(digits + 1)).toString(); }

export function select({ label, options, value, onChange }) {
  const sid = id('sel');
  const s = el('select', { id: sid }, options.map((o) => el('option', { value: o.value, text: o.label, selected: o.value === value })));
  s.addEventListener('change', () => onChange && onChange(s.value));
  const wrap = el('div', { class: 'ctl ctl-select' }, el('label', { for: sid, text: label }), s);
  wrap.get = () => s.value; wrap.set = (v) => { s.value = v; };
  return wrap;
}

// Segmented buttons (radio group)
export function segmented({ label, options, value, onChange }) {
  const name = id('seg');
  const group = el('div', { class: 'vseg', role: 'radiogroup', 'aria-label': label });
  let cur = value;
  const buttons = options.map((o) => {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': o.value === value ? 'true' : 'false', 'data-v': o.value, text: o.label });
    b.addEventListener('click', () => set(o.value, true));
    return b;
  });
  group.append(...buttons);
  function set(v, fire) {
    cur = v; buttons.forEach((b) => b.setAttribute('aria-checked', b.dataset.v === String(v) ? 'true' : 'false'));
    if (fire && onChange) onChange(v);
  }
  group.addEventListener('keydown', (e) => {
    const i = options.findIndex((o) => String(o.value) === String(cur));
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); const n = options[(i + 1) % options.length]; set(n.value, true); buttons[(i + 1) % options.length].focus(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const k = (i - 1 + options.length) % options.length; set(options[k].value, true); buttons[k].focus(); }
  });
  const wrap = el('div', { class: 'ctl ctl-seg' }, el('span', { class: 'ctl-label', id: name, text: label }), group);
  wrap.get = () => cur; wrap.set = (v) => set(v, false);
  return wrap;
}

export function button(label, onClick, kind = 'secondary', attrs = {}) {
  return el('button', Object.assign({ type: 'button', class: `vbtn vbtn-${kind}`, onclick: onClick, text: label }, attrs));
}

export function checkbox({ label, checked, onChange }) {
  const cid = id('cb');
  const c = el('input', { type: 'checkbox', id: cid, checked: !!checked });
  c.addEventListener('change', () => onChange && onChange(c.checked));
  const wrap = el('div', { class: 'ctl ctl-check' }, c, el('label', { for: cid, text: label }));
  wrap.get = () => c.checked; wrap.set = (v) => { c.checked = !!v; };
  return wrap;
}

export function group(title, ...kids) {
  return el('fieldset', { class: 'grp' }, el('legend', { text: title }), ...kids);
}

export function readout(label) {
  const v = el('span', { class: 'ro-val', text: '–' });
  const w = el('div', { class: 'ro' }, el('span', { class: 'ro-label', text: label }), v);
  w.set = (t) => { v.textContent = t; };
  return w;
}

// Canvas that fills its box; returns the canvas element inside a wrapper with an aspect ratio
export function canvasBox(cls = '', aspect = '16 / 10', label = '') {
  const c = el('canvas', { role: 'img', 'aria-label': label || 'Plot' });
  const w = el('div', { class: `cbox ${cls}`, style: { aspectRatio: aspect } }, c);
  w.canvas = c;
  return w;
}

export function note(text) { return el('p', { class: 'note', html: text }); }
