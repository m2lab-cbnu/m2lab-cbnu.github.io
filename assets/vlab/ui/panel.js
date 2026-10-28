// Station panel: a drawer on the right (full screen on phones) with tabs. Tabs are built the first
// time they are shown and kept, so settings survive closing and reopening the panel.

import { el } from './widgets.js';

const ICON_CLOSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_WIDE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V3h5M17 12v5h-5M3 3l5.5 5.5M17 17l-5.5-5.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NARROW = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3v5H3M12 17v-5h5M8 8L2.5 2.5M12 12l5.5 5.5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export class Panel {
  constructor(root, { onClose, onTab } = {}) {
    this.onClose = onClose; this.onTab = onTab;
    this.kick = el('p', { class: 'kick' });
    this.title = el('h2', { id: 'vpanel-title' });
    this.wideBtn = el('button', { type: 'button', 'aria-pressed': 'false', title: 'Use the whole window', 'aria-label': 'Use the whole window', html: ICON_WIDE });
    this.closeBtn = el('button', { type: 'button', 'aria-label': 'Close and go back to the lab', html: ICON_CLOSE + '<span>Back to lab</span>' });
    this.tabs = el('div', { class: 'vpanel-tabs', role: 'tablist', 'aria-labelledby': 'vpanel-title' });
    this.body = el('div', { class: 'vpanel-body' });
    this.root = el('aside', { class: 'vpanel', role: 'region', 'aria-labelledby': 'vpanel-title', tabindex: '-1' },
      el('div', { class: 'vpanel-head' }, el('div', { class: 'grow' }, this.kick, this.title), this.wideBtn, this.closeBtn),
      this.tabs, this.body);
    root.append(this.root);
    this.closeBtn.addEventListener('click', () => this.close());
    this.wideBtn.addEventListener('click', () => this.setWide(!this.root.classList.contains('is-wide')));
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); this.close(); }
    });
    // Escape also works when focus is on the page itself or the 3D view
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.isOpen || e.defaultPrevented) return;
      const a = document.activeElement;
      if (!a || a === document.body || a.id === 'vl-canvas') { e.preventDefault(); this.close(); }
    });
    this.tabs.addEventListener('keydown', (e) => {
      const btns = [...this.tabs.querySelectorAll('button')], i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % btns.length;
      if (e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
      if (e.key === 'Home') j = 0;
      if (e.key === 'End') j = btns.length - 1;
      if (j >= 0) { e.preventDefault(); btns[j].focus(); btns[j].click(); }
    });
    this.cache = new Map();   // station id -> { wrap, panes: Map(tabId -> { el, ctl }) , current }
    this.station = null;
    this.isOpen = false;
    if ('ResizeObserver' in window) new ResizeObserver(() => this._resize()).observe(this.body);
  }

  setWide(on) {
    this.root.classList.toggle('is-wide', on);
    this.wideBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    this.wideBtn.innerHTML = on ? ICON_NARROW : ICON_WIDE;
    this.wideBtn.setAttribute('aria-label', on ? 'Show the lab beside the panel' : 'Use the whole window');
    this.wideBtn.title = this.wideBtn.getAttribute('aria-label');
  }

  open(station, tabId) {
    const opener = document.activeElement;
    if (this.station && this.station !== station) this._hideCurrent();
    this.station = station;
    this.kick.textContent = station.kicker || 'Station';
    this.title.textContent = station.title;
    let entry = this.cache.get(station.id);
    if (!entry) {
      entry = { wrap: el('div', { class: 'vpanel-station', 'data-station': station.id }), panes: new Map(), current: null };
      this.cache.set(station.id, entry);
      this.body.append(entry.wrap);
    }
    for (const [id, e] of this.cache) e.wrap.hidden = id !== station.id;
    // tabs
    this.tabs.replaceChildren(...station.tabs.map((t) => el('button', {
      type: 'button', role: 'tab', id: `tab-${station.id}-${t.id}`, 'aria-controls': `pane-${station.id}-${t.id}`,
      'aria-selected': 'false', tabindex: '-1', text: t.label, onclick: () => this.showTab(t.id),
    })));
    this.tabs.hidden = station.tabs.length < 2;
    this.wideBtn.hidden = !!this.flat;
    this.closeBtn.lastChild.textContent = this.flat ? 'All instruments' : 'Back to lab';
    this.showTab(tabId || entry.current || station.tabs[0].id);
    const focusTab = () => (this.tabs.hidden ? this.closeBtn : this.tabs.querySelector('[aria-selected="true"]')).focus({ preventScroll: true });
    if (!this.isOpen) {
      this.isOpen = true; this.returnFocus = opener;
      this.root.classList.add('is-open');
      setTimeout(focusTab, 60);
    } else if (!this.root.contains(document.activeElement) || document.activeElement === document.body) {
      setTimeout(focusTab, 60);   // switching stations replaced the focused tab
    }
  }

  showTab(tabId) {
    const st = this.station; if (!st) return;
    const entry = this.cache.get(st.id), tab = st.tabs.find((t) => t.id === tabId) || st.tabs[0];
    if (entry.current && entry.current !== tab.id) {
      const prev = entry.panes.get(entry.current);
      if (prev) { prev.el.hidden = true; prev.ctl && prev.ctl.hide && prev.ctl.hide(); }
    }
    let pane = entry.panes.get(tab.id);
    if (!pane) {
      const p = el('div', { class: 'vpanel-pane', role: 'tabpanel', id: `pane-${st.id}-${tab.id}`, 'aria-labelledby': `tab-${st.id}-${tab.id}`, tabindex: '-1' });
      entry.wrap.append(p);
      pane = { el: p, ctl: null };
      entry.panes.set(tab.id, pane);
      try { pane.ctl = tab.build(p) || null; }
      catch (err) { console.error(err); p.append(el('p', { class: 'note', text: 'This tool could not start: ' + err.message })); }
    }
    pane.el.hidden = false;
    entry.current = tab.id;
    this.tabs.querySelectorAll('button').forEach((b) => {
      const on = b.id === `tab-${st.id}-${tab.id}`;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
    });
    requestAnimationFrame(() => { pane.ctl && pane.ctl.show && pane.ctl.show(); });
    if (this.onTab) this.onTab(st, tab.id);
  }

  _hideCurrent() {
    const st = this.station; if (!st) return;
    const entry = this.cache.get(st.id); if (!entry || !entry.current) return;
    const pane = entry.panes.get(entry.current);
    if (pane && pane.ctl && pane.ctl.hide) pane.ctl.hide();
  }

  _resize() {
    if (!this.isOpen || !this.station) return;
    const entry = this.cache.get(this.station.id); if (!entry) return;
    const pane = entry.panes.get(entry.current);
    if (pane && pane.ctl && pane.ctl.resize) pane.ctl.resize();
  }

  close() {
    if (!this.isOpen) return;
    this._hideCurrent();
    this.isOpen = false;
    this.root.classList.remove('is-open');
    const st = this.station;
    if (this.onClose) this.onClose(st);
    const rf = this.returnFocus;
    if (rf && rf.isConnected && rf !== document.body) rf.focus({ preventScroll: true });
  }
}
