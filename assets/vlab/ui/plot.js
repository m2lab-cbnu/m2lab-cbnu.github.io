// Small canvas plotting library for the virtual lab: line plots, heat maps, markers,
// a cursor readout, and a dark "instrument screen" theme for 3D textures.

export const COLORS = {
  ink: '#12243A', grid: '#D4ECF7', axis: '#12243A', cyan: '#00A9D6', signal: '#00739E',
  pink: '#E0457B', gold: '#C98A12', violet: '#6B5BE6', green: '#1F9D6B', navy: '#0E2A4D',
};
export const SERIES = [COLORS.cyan, COLORS.pink, COLORS.violet, COLORS.gold, COLORS.green, COLORS.signal];

const THEMES = {
  paper: { bg: '#FFFFFF', fg: '#12243A', grid: '#D4ECF7', frame: '#12243A', font: '500 12px "Plex", "IBM Plex Sans", system-ui, sans-serif' },
  screen: { bg: '#04121F', fg: '#9FE6FF', grid: 'rgba(0,212,255,0.18)', frame: 'rgba(0,212,255,0.45)', font: '600 13px "Plex", "IBM Plex Sans", system-ui, sans-serif' },
  chalk: { bg: '#1E4A3A', fg: '#F4F1E6', grid: 'rgba(244,241,230,0.18)', frame: 'rgba(244,241,230,0.7)', font: '600 15px "Plex", "IBM Plex Sans", system-ui, sans-serif' },
};

// Colormaps: arrays of [t, r, g, b]
const MAPS = {
  // dark navy -> signal blue -> cyan -> pale yellow -> white (absorption, intensity)
  lab: [[0, 14, 42, 77], [0.35, 0, 115, 158], [0.65, 0, 212, 255], [0.88, 255, 240, 170], [1, 255, 255, 255]],
  // blue - white - red, symmetric data
  diverging: [[0, 40, 70, 190], [0.5, 255, 255, 255], [1, 200, 40, 60]],
  // perceptual magma-like for spectra
  heat: [[0, 8, 6, 30], [0.3, 90, 20, 110], [0.6, 220, 70, 80], [0.85, 253, 180, 80], [1, 252, 253, 191]],
};

export function colormap(name, t) {
  const m = MAPS[name] || MAPS.lab;
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < m.length; i++) {
    if (t <= m[i][0]) {
      const a = m[i - 1], b = m[i], u = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
    }
  }
  const l = m[m.length - 1]; return [l[1], l[2], l[3]];
}

function niceStep(range, target) {
  const raw = range / Math.max(1, target), p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p;
}
function fmtTick(v, step) {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const s = Math.abs(v) < step / 1e6 ? '0' : v.toFixed(Math.min(d, 6));
  return s.replace('-', '−');
}

export class Plot {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.o = Object.assign({ xlabel: '', ylabel: '', theme: 'paper', pad: null, legend: true, aspect: null }, opts);
    this.series = []; this.heat = null; this.markers = []; this.vlines = []; this.hlines = []; this.texts = [];
    this.cursor = null; this._cb = null; this._img = null;
    this.xlim = opts.xlim || null; this.ylim = opts.ylim || null;
    if (!opts.static) this._bind();
  }
  _bind() {
    const at = (e) => {
      const r = this.c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const p = this.pad();
      if (x < p.l || x > this.W - p.r || y < p.t || y > this.H - p.b) return null;
      return this.toData(x, y);
    };
    let down = false;
    this.c.addEventListener('pointerdown', (e) => { const d = at(e); if (!d) return; down = true; try { this.c.setPointerCapture(e.pointerId); } catch (_) {} this._fire(d, true); });
    this.c.addEventListener('pointermove', (e) => { const d = at(e); if (d && (down || this.o.hover)) this._fire(d, down); });
    this.c.addEventListener('pointerup', () => { down = false; });
    this.c.addEventListener('pointercancel', () => { down = false; });
  }
  _fire(d, pressed) { if (this._cb) this._cb(d[0], d[1], pressed); }
  onCursor(cb) { this._cb = cb; return this; }
  size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = this.c.clientWidth || this.c.width, H = this.c.clientHeight || this.c.height;
    if (this.c.width !== Math.round(W * dpr) || this.c.height !== Math.round(H * dpr)) {
      this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr);
    }
    this.W = W; this.H = H; this.dpr = dpr;
  }
  pad() {
    if (this.o.pad) return this.o.pad;
    const t = this.o.theme === 'paper';
    return { l: this._padL || (t ? 58 : 60), r: this.heat && this.o.colorbar ? 64 : 16, t: 14, b: t ? 42 : 44 };
  }
  setSeries(s) { this.series = s; return this; }
  setHeatmap(h) { this.heat = h; this._img = null; return this; }
  setMarkers(m) { this.markers = m; return this; }
  setVLines(v) { this.vlines = v; return this; }
  setHLines(h) { this.hlines = h; return this; }
  setTexts(t) { this.texts = t; return this; }
  limits() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    if (this.heat) { x0 = this.heat.x0; x1 = this.heat.x1; y0 = this.heat.y0; y1 = this.heat.y1; }
    for (const s of this.series) {
      for (let i = 0; i < s.x.length; i++) {
        const X = s.x[i], Y = s.y[i];
        if (!Number.isFinite(X) || !Number.isFinite(Y)) continue;
        if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      }
    }
    if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; y0 = 0; y1 = 1; }
    if (x1 === x0) { x1 = x0 + 1; }
    if (y1 === y0) { y1 = y0 + 1; y0 -= 1; }
    if (!this.heat && !this.o.tightY) { const m = (y1 - y0) * 0.06; y0 -= m; y1 += m; }
    return [this.xlim ? this.xlim[0] : x0, this.xlim ? this.xlim[1] : x1, this.ylim ? this.ylim[0] : y0, this.ylim ? this.ylim[1] : y1];
  }
  toPx(x, y) { const p = this.pad(), L = this._L; return [p.l + (x - L[0]) / (L[1] - L[0]) * (this.W - p.l - p.r), this.H - p.b - (y - L[2]) / (L[3] - L[2]) * (this.H - p.t - p.b)]; }
  toData(px, py) { const p = this.pad(), L = this._L || this.limits(); return [L[0] + (px - p.l) / (this.W - p.l - p.r) * (L[1] - L[0]), L[2] + (this.H - p.b - py) / (this.H - p.t - p.b) * (L[3] - L[2])]; }
  _heatImage() {
    const h = this.heat;
    if (this._img) return this._img;
    const off = document.createElement('canvas'); off.width = h.nx; off.height = h.ny;
    const g = off.getContext('2d'), img = g.createImageData(h.nx, h.ny);
    let vmin = h.vmin, vmax = h.vmax;
    if (vmin === undefined || vmax === undefined) {
      vmin = Infinity; vmax = -Infinity;
      for (let i = 0; i < h.data.length; i++) { const v = h.data[i]; if (Number.isFinite(v)) { if (v < vmin) vmin = v; if (v > vmax) vmax = v; } }
      if (h.symmetric) { const a = Math.max(Math.abs(vmin), Math.abs(vmax)); vmin = -a; vmax = a; }
    }
    const span = vmax - vmin || 1;
    for (let j = 0; j < h.ny; j++) for (let i = 0; i < h.nx; i++) {
      const v = h.data[j * h.nx + i];
      let t = (v - vmin) / span; if (h.gamma) t = Math.pow(Math.max(0, t), h.gamma);
      const c = colormap(h.colormap || 'lab', t), o = ((h.ny - 1 - j) * h.nx + i) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this._img = off; this._vrange = [vmin, vmax];
    return off;
  }
  draw() {
    this.size();
    const g = this.ctx, th = THEMES[this.o.theme] || THEMES.paper, p = this.pad();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = th.bg; g.fillRect(0, 0, this.W, this.H);
    const L = this._L = this.limits();
    if (!this.o.pad) {   // make room for the widest y tick label
      g.font = th.font;
      const ph0 = this.H - 14 - (this.o.theme === 'paper' ? 42 : 44), ys0 = niceStep(L[3] - L[2], Math.max(3, ph0 / 50));
      let wmax = 0;
      for (let v = Math.ceil(L[2] / ys0) * ys0; v <= L[3] + ys0 * 1e-9; v += ys0) wmax = Math.max(wmax, g.measureText(fmtTick(v, ys0)).width);
      this._padL = Math.max(this.o.theme === 'paper' ? 58 : 60, Math.ceil(wmax) + 34);
    }
    p.l = this.pad().l;
    const pw = this.W - p.l - p.r, ph = this.H - p.t - p.b;
    // heat map
    if (this.heat) {
      g.imageSmoothingEnabled = this.heat.smooth !== false;
      const [ax, ay] = this.toPx(this.heat.x0, this.heat.y1), [bx, by] = this.toPx(this.heat.x1, this.heat.y0);
      g.save(); g.beginPath(); g.rect(p.l, p.t, pw, ph); g.clip();
      g.drawImage(this._heatImage(), ax, ay, bx - ax, by - ay);
      g.restore();
    }
    // grid + ticks
    g.font = th.font; g.fillStyle = th.fg; g.strokeStyle = th.grid; g.lineWidth = 1;
    const xs = niceStep(L[1] - L[0], Math.max(3, pw / 90)), ys = niceStep(L[3] - L[2], Math.max(3, ph / 50));
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let v = Math.ceil(L[0] / xs) * xs; v <= L[1] + xs * 1e-9; v += xs) {
      const [x] = this.toPx(v, 0);
      if (!this.heat) { g.beginPath(); g.moveTo(Math.round(x) + 0.5, p.t); g.lineTo(Math.round(x) + 0.5, p.t + ph); g.stroke(); }
      g.fillText(fmtTick(v, xs), x, p.t + ph + 6);
    }
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let v = Math.ceil(L[2] / ys) * ys; v <= L[3] + ys * 1e-9; v += ys) {
      const [, y] = this.toPx(0, v);
      if (!this.heat) { g.beginPath(); g.moveTo(p.l, Math.round(y) + 0.5); g.lineTo(p.l + pw, Math.round(y) + 0.5); g.stroke(); }
      g.fillText(fmtTick(v, ys), p.l - 6, y);
    }
    g.strokeStyle = th.frame; g.strokeRect(p.l + 0.5, p.t + 0.5, pw - 1, ph - 1);
    // axis labels
    g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillStyle = th.fg;
    if (this.o.xlabel) g.fillText(this.o.xlabel, p.l + pw / 2, this.H - 4);
    if (this.o.ylabel) { g.save(); g.translate(13, p.t + ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText(this.o.ylabel, 0, 0); g.restore(); }
    // clip to plot area for data
    g.save(); g.beginPath(); g.rect(p.l, p.t, pw, ph); g.clip();
    for (const v of this.vlines) { const [x] = this.toPx(v.x, 0); g.strokeStyle = v.color || COLORS.gold; g.lineWidth = v.width || 1.5; g.setLineDash(v.dash || []); g.beginPath(); g.moveTo(x, p.t); g.lineTo(x, p.t + ph); g.stroke(); }
    for (const h of this.hlines) { const [, y] = this.toPx(0, h.y); g.strokeStyle = h.color || COLORS.gold; g.lineWidth = h.width || 1.5; g.setLineDash(h.dash || []); g.beginPath(); g.moveTo(p.l, y); g.lineTo(p.l + pw, y); g.stroke(); }
    g.setLineDash([]);
    this.series.forEach((s, si) => {
      g.strokeStyle = s.color || SERIES[si % SERIES.length]; g.lineWidth = s.width || 2; g.setLineDash(s.dash || []);
      if (s.fill) g.fillStyle = s.fill;
      if (s.points) {
        g.fillStyle = s.color || SERIES[si % SERIES.length];
        for (let i = 0; i < s.x.length; i++) { if (!Number.isFinite(s.y[i])) continue; const [x, y] = this.toPx(s.x[i], s.y[i]); g.beginPath(); g.arc(x, y, s.r || 2.5, 0, 2 * Math.PI); g.fill(); }
        return;
      }
      g.beginPath(); let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const X = s.x[i], Y = s.y[i];
        if (!Number.isFinite(X) || !Number.isFinite(Y)) { pen = false; continue; }
        const [x, y] = this.toPx(X, Y);
        if (!pen) { g.moveTo(x, y); pen = true; } else g.lineTo(x, y);
      }
      g.stroke();
    });
    g.setLineDash([]);
    for (const m of this.markers) {
      const [x, y] = this.toPx(m.x, m.y);
      g.fillStyle = m.color || COLORS.gold; g.strokeStyle = m.stroke || '#fff'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, m.r || 5, 0, 2 * Math.PI); g.fill(); g.stroke();
    }
    g.restore();
    for (const t of this.texts) {
      const [x, y] = t.px ? [t.x, t.y] : this.toPx(t.x, t.y);
      g.font = t.font || th.font; g.fillStyle = t.color || th.fg; g.textAlign = t.align || 'left'; g.textBaseline = t.base || 'alphabetic';
      g.fillText(t.text, x, y);
    }
    // legend
    const named = this.series.filter((s) => s.label);
    if (this.o.legend && named.length) {
      g.font = th.font; g.textAlign = 'left'; g.textBaseline = 'middle';
      let y = p.t + 12; const x = p.l + 10;
      const wmax = Math.max(...named.map((s) => g.measureText(s.label).width)) + 34;
      g.fillStyle = this.o.theme === 'paper' ? 'rgba(255,255,255,0.88)' : 'rgba(4,18,31,0.8)';
      g.fillRect(x - 6, y - 10, wmax, named.length * 18 + 2);
      named.forEach((s) => {
        const si = this.series.indexOf(s);
        g.strokeStyle = s.color || SERIES[si % SERIES.length]; g.lineWidth = 2.5; g.setLineDash(s.dash || []);
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y); g.stroke(); g.setLineDash([]);
        g.fillStyle = th.fg; g.fillText(s.label, x + 24, y); y += 18;
      });
    }
    // colour bar
    if (this.heat && this.o.colorbar) {
      const bx = this.W - p.r + 14, bw = 12;
      for (let i = 0; i < ph; i++) { const c = colormap(this.heat.colormap || 'lab', 1 - i / ph); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; g.fillRect(bx, p.t + i, bw, 1); }
      g.strokeStyle = th.frame; g.strokeRect(bx + 0.5, p.t + 0.5, bw - 1, ph - 1);
      if (this.o.colorbar.label) { g.save(); g.translate(bx + bw + 14, p.t + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = th.fg; g.fillText(this.o.colorbar.label, 0, 0); g.restore(); }
      if (this._vrange && this.o.colorbar.ticks !== false) {
        g.textAlign = 'left'; g.fillStyle = th.fg;
        const f = this.o.colorbar.fmt || ((v) => v.toPrecision(2));
        g.fillText(f(this._vrange[1]), bx - 2, p.t - 2 > 8 ? p.t - 2 : p.t + 8);
      }
    }
    return this;
  }
}

// Draw a simple one-series "instrument screen" without allocating a Plot (for 3D textures)
export function screenPlot(ctx, w, h, opts) {
  const p = new Plot({ getContext: () => ctx, width: w, height: h, clientWidth: w, clientHeight: h, addEventListener() {} }, Object.assign({ theme: 'screen', static: true, legend: false }, opts));
  p.size = function () { this.W = w; this.H = h; this.dpr = 1; };
  if (opts.series) p.setSeries(opts.series);
  if (opts.heat) p.setHeatmap(opts.heat);
  if (opts.markers) p.setMarkers(opts.markers);
  if (opts.vlines) p.setVLines(opts.vlines);
  p.draw();
}
