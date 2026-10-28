// The speech box at the bottom of the screen: a portrait, a name, text that types itself out,
// and optional choices or a number to type in. Every call returns a promise.

import { portrait } from './sprites.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ADVANCE = new Set([' ', 'Enter', 'e', 'E', 'z', 'Z']);

function fmt(text) {
  const esc = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

export class Dialog {
  constructor(root, { onOpen, onClose, styleOf } = {}) {
    this.onOpen = onOpen; this.onClose = onClose; this.styleOf = styleOf || (() => 'teal');
    this.el = document.createElement('div');
    this.el.className = 'rpg-dialog';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="rpg-dlg-box" role="dialog" aria-modal="false" aria-labelledby="rpg-dlg-name">
        <div class="rpg-dlg-face"><canvas width="16" height="20" aria-hidden="true"></canvas></div>
        <div class="rpg-dlg-main">
          <p class="rpg-dlg-name" id="rpg-dlg-name"></p>
          <p class="rpg-dlg-text" aria-live="polite"></p>
          <div class="rpg-dlg-choices" role="group"></div>
          <form class="rpg-dlg-input" hidden><label class="vh" for="rpg-dlg-num">Your answer</label><input id="rpg-dlg-num" type="text" inputmode="decimal" autocomplete="off"><span class="unit"></span><button type="submit">Tell</button><button type="button" class="later">Not yet</button></form>
        </div>
        <button class="rpg-dlg-next" type="button" aria-label="Next">▼</button>
      </div>`;
    root.append(this.el);
    this.box = this.el.querySelector('.rpg-dlg-box');
    this.face = this.el.querySelector('canvas');
    this.nameEl = this.el.querySelector('.rpg-dlg-name');
    this.textEl = this.el.querySelector('.rpg-dlg-text');
    this.choicesEl = this.el.querySelector('.rpg-dlg-choices');
    this.form = this.el.querySelector('form');
    this.input = this.form.querySelector('input');
    this.unitEl = this.form.querySelector('.unit');
    this.nextBtn = this.el.querySelector('.rpg-dlg-next');
    this.open = false;
    this._typing = null;
    this.nextBtn.addEventListener('click', () => this._advance());
    this.textEl.addEventListener('click', () => this._advance());
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      const a = document.activeElement;
      if (a === this.input) return;
      if (this.choicesEl.childElementCount && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const b = [...this.choicesEl.querySelectorAll('button')], i = b.indexOf(a);
        const j = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? (i + 1) % b.length : (i - 1 + b.length) % b.length;
        b[j < 0 ? 0 : j].focus(); e.preventDefault(); return;
      }
      if (ADVANCE.has(e.key) && !this.choicesEl.childElementCount && this.form.hidden) { e.preventDefault(); this._advance(); }
      if (e.key === 'Escape' && this._escape) { e.preventDefault(); this._escape(); }
    }, true);
  }

  _show(who) {
    if (!this.open) { this.open = true; this.el.hidden = false; if (this.onOpen) this.onOpen(); }
    const id = who && who.id;
    this.box.dataset.who = id || 'none';
    this.nameEl.textContent = (who && who.name) || '';
    this.nameEl.hidden = !(who && who.name);
    const fc = this.el.querySelector('.rpg-dlg-face');
    fc.hidden = !id;
    if (id) {
      const img = portrait(id, this.styleOf());
      this.face.width = img.width; this.face.height = img.height;
      const g = this.face.getContext('2d'); g.clearRect(0, 0, img.width, img.height); g.drawImage(img, 0, 0);
    }
  }

  _type(html) {
    return new Promise((resolve) => {
      this.textEl.innerHTML = html;
      const full = this.textEl.textContent;
      if (reduceMotion || full.length < 2) { this._typing = null; resolve(); return; }
      // reveal the text a few letters at a time, keeping the markup
      const nodes = [];
      const walk = (n) => { for (const c of n.childNodes) { if (c.nodeType === 3) { nodes.push([c, c.textContent]); c.textContent = ''; } else walk(c); } };
      walk(this.textEl);
      let i = 0, total = full.length;
      const step = () => {
        i = Math.min(total, i + 2);
        let left = i;
        for (const [n, t] of nodes) { const k = Math.min(t.length, left); n.textContent = t.slice(0, k); left -= k; }
        if (i < total) this._typing = { timer: setTimeout(step, 18), finish };
        else { this._typing = null; resolve(); }
      };
      const finish = () => { clearTimeout(this._typing && this._typing.timer); for (const [n, t] of nodes) n.textContent = t; this._typing = null; resolve(); };
      step();
    });
  }

  _advance() {
    if (this._typing) { this._typing.finish(); return; }
    if (this._next) { const n = this._next; this._next = null; n(); }
  }

  // say one or more lines; resolves when the last one is dismissed
  async say(who, lines, { keepOpen = false } = {}) {
    lines = Array.isArray(lines) ? lines : [lines];
    this._show(who);
    this.choicesEl.replaceChildren(); this.form.hidden = true;
    for (const line of lines) {
      this.nextBtn.hidden = true;
      await this._type(fmt(line));
      this.nextBtn.hidden = false;
      this.nextBtn.focus({ preventScroll: true });
      await new Promise((r) => { this._next = r; this._escape = () => { this._advance(); }; });
    }
    if (!keepOpen) this.close();
  }

  // a question with buttons; resolves with the index chosen (or -1 on Escape)
  async ask(who, line, choices) {
    this._show(who);
    this.form.hidden = true; this.nextBtn.hidden = true;
    this.choicesEl.replaceChildren();
    await this._type(fmt(line));
    return new Promise((resolve) => {
      const done = (i) => { this.choicesEl.replaceChildren(); this._escape = null; resolve(i); };
      choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.innerHTML = fmt(c);
        b.addEventListener('click', () => done(i));
        this.choicesEl.append(b);
      });
      this._escape = () => done(-1);
      const first = this.choicesEl.querySelector('button');
      if (first) first.focus({ preventScroll: true });
    });
  }

  // ask for a number; resolves with a number, or null for "not yet"
  async askNumber(who, line, { unit = '' } = {}) {
    this._show(who);
    this.choicesEl.replaceChildren(); this.nextBtn.hidden = true;
    await this._type(fmt(line));
    this.form.hidden = false; this.unitEl.textContent = unit; this.input.value = '';
    this.input.focus({ preventScroll: true });
    return new Promise((resolve) => {
      const finish = (v) => { this.form.hidden = true; this.form.onsubmit = null; this._escape = null; resolve(v); };
      this.form.onsubmit = (e) => {
        e.preventDefault();
        const v = parseFloat(this.input.value.replace(',', '.').replace('−', '-'));
        if (!Number.isFinite(v)) { this.input.focus(); this.input.select(); return; }
        finish(v);
      };
      this.form.querySelector('.later').onclick = () => finish(null);
      this._escape = () => finish(null);
      this.input.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); finish(null); } };
    });
  }

  close() {
    if (!this.open) return;
    this.open = false; this.el.hidden = true;
    this._next = null; this._escape = null;
    if (this.onClose) this.onClose();
  }
}
