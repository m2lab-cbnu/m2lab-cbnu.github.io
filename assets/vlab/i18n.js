// English / 한국어 for the virtual lab. The language comes from ?lang=ko|en or the visitor's last
// choice, and changing it reloads the page, so everything is drawn in one language from the start.
//
// tr(s) translates a string: an exact match in the Korean dictionary first, then the same string
// with its numbers taken out ("Field: {0} mT") so readouts with live values translate too, then
// the two halves of "Label: value" or "A · B". Untranslated strings stay in English and are listed
// by window.__i18nMissing().
//
// In Korean mode install() translates the page as it is drawn: every text node and label in the
// document (watched with a MutationObserver) and every string drawn on a canvas. Rich text
// (the guide's lines, the dialogue) is translated whole at its source and marked data-tr="no", so
// the watcher never translates it piece by piece.

const KEY = 'm2lab-lang';

function pick() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'ko' || q === 'en') { try { localStorage.setItem(KEY, q); } catch (_) {} return q; }
  } catch (_) {}
  try { const s = localStorage.getItem(KEY); if (s === 'ko' || s === 'en') return s; } catch (_) {}
  return 'en';
}

export const lang = pick();
export const isKo = lang === 'ko';
let DICT = null;
const missing = new Set();
const HANGUL = /[가-힣]/;

export async function loadLang() {
  if (!isKo) return;
  try { DICT = (await import('./i18n/ko.js')).default; } catch (e) { console.error('Korean text failed to load', e); DICT = {}; }
  document.documentElement.lang = 'ko';
}

export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch (_) {}
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u.pathname + u.search + u.hash);
}

const NUM = /[−+-]?\d+(?:[.,]\d+)*/g;
const cache = new Map();

function look(s) {
  const hit = DICT[s];
  if (hit !== undefined) return hit;
  // live values: swap the numbers for {0}, {1}… and look that up
  const nums = [];
  const key = s.replace(NUM, (m) => `{${nums.push(m) - 1}}`);
  if (nums.length && DICT[key] !== undefined) return DICT[key].replace(/\{(\d+)\}/g, (_, i) => nums[+i] ?? '');
  return undefined;
}

// a piece of a longer string, looked up without the spaces around it ("Baro  ·  Space")
function part(x) {
  const t = x.trim();
  if (!t) return undefined;
  const o = look(t);
  return o === undefined ? undefined : x.replace(t, o);
}

export function tr(s) {
  if (!DICT || typeof s !== 'string' || !s) return s;
  if (cache.has(s)) return cache.get(s);
  let out = look(s);
  if (out === undefined) {
    const t = s.trim();
    if (t !== s && t) { const o = look(t); if (o !== undefined) out = s.replace(t, o); }
  }
  if (out === undefined) {
    // "Label: value" and "A · B": translate the halves
    for (const sep of [' · ', ': ']) {
      const i = s.indexOf(sep);
      if (i <= 0) continue;
      const a = s.slice(0, i), b = s.slice(i + sep.length);
      const ta = sep === ': ' ? (part(a + ':') !== undefined ? part(a + ':').replace(/:(\s*)$/, '$1') : part(a)) : part(a);
      const tb = part(b) ?? (b.includes(sep) ? tr(b) : undefined);
      if (ta !== undefined || (tb !== undefined && tb !== b)) { out = (ta ?? a) + sep + (tb ?? b); break; }
    }
  }
  if (out === undefined) {
    out = s;
    const text = s.replace(/<[^>]*>/g, '');
    if (/[A-Za-z]{2}/.test(text) && !HANGUL.test(text)) missing.add(s);
  }
  if (cache.size > 8000) cache.clear();
  cache.set(s, out);
  return out;
}

// the same English where Korean needs a different word: trc('tab', 'Play') looks up "tab|Play" first
export function trc(ctx, s) {
  if (DICT && typeof s === 'string' && DICT[ctx + '|' + s] !== undefined) return DICT[ctx + '|' + s];
  return tr(s);
}

// a sentence with named parts: trf('You got: {0}', name) — translate the parts with tr() first
export function trf(s, ...args) {
  let t = s;
  if (DICT) { if (DICT[s] !== undefined) t = DICT[s]; else if (/[A-Za-z]{2}/.test(s)) missing.add(s); }
  return t.replace(/\{(\d+)\}/g, (_, i) => (args[+i] ?? ''));
}

export function install() {
  if (!isKo || !DICT) return;
  // text drawn on canvases (and measured, so boxes fit the Korean)
  for (const P of [window.CanvasRenderingContext2D, window.OffscreenCanvasRenderingContext2D].filter(Boolean).map((c) => c.prototype)) {
    for (const fn of ['fillText', 'strokeText']) { const o = P[fn]; P[fn] = function (t, ...a) { return o.call(this, typeof t === 'string' ? tr(t) : t, ...a); }; }
    const m = P.measureText; P.measureText = function (t) { return m.call(this, typeof t === 'string' ? tr(t) : t); };
  }
  // text in the document, as it appears
  const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
  const wrote = new WeakMap();
  const skip = (e) => !!(e && e.closest && e.closest('[data-tr="no"], script, style, code, kbd, noscript'));
  const doText = (n) => {
    const v = n.data;
    if (wrote.get(n) === v) return;
    const t = v.trim();
    if (!t || !/[A-Za-z]/.test(t) || skip(n.parentElement)) { wrote.set(n, v); return; }
    const out = tr(t);
    const nv = out === t ? v : v.replace(t, out);
    wrote.set(n, nv);
    if (nv !== v) n.data = nv;
  };
  const doEl = (e) => {
    if (!e.getAttribute || skip(e)) return;
    for (const a of ATTRS) { const v = e.getAttribute(a); if (v && /[A-Za-z]/.test(v)) { const out = tr(v); if (out !== v) e.setAttribute(a, out); } }
  };
  const walk = (root) => {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1 || skip(root)) return;
    doEl(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) => (n.nodeType === 1 && n.getAttribute('data-tr') === 'no' ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) doText(n); else doEl(n); }
  };
  walk(document.body);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doEl(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  document.title = tr(document.title);
}

// for building the dictionary: every string that was shown without a translation
if (typeof window !== 'undefined') window.__i18nMissing = () => [...missing];
