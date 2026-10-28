// GPU micromagnetic solver (WebGL2), in the spirit of mumax3, for one layer of cells.
//
// Effective field: exchange (5-point Laplacian, free boundaries), uniaxial in-plane and
// perpendicular anisotropy, Zeeman (static + antenna/rf profile × time function) and the
// full magnetostatic field, computed as H = −N * M with the Newell tensor, zero padding to
// 2Nx × 2Ny and radix-2 Stockham FFTs in fragment shaders. Landau–Lifshitz–Gilbert with
// classic RK4 at a fixed step. Per-cell damping allows absorbing boundaries.
// Textures are RGBA32F: m = (mx, my, mz, mask).

import { demagKernelFFT } from '../physics/demag.js';
import { MU0 } from '../physics/materials.js';

const VS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const HEAD = `#version 300 es
precision highp float; precision highp int; precision highp sampler2D;
`;

const FS_PACK = HEAD + `
uniform sampler2D u_m; uniform ivec2 u_N; out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  if (c.x < u_N.x && c.y < u_N.y) { vec4 m = texelFetch(u_m, c, 0); o = vec4(m.x, m.y, m.z, 0.0) * m.w; }
  else o = vec4(0.0);
}`;

function fsFFT(axis) {
  return HEAD + `
uniform sampler2D u_in; uniform sampler2D u_tw; uniform int u_S; uniform int u_L; uniform float u_sign; out vec4 o;
vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int i = c.${axis};
  int h = u_S / 2;
  int e = (i / u_S) * h + (i % h);
  ivec2 ce = c, co = c; ce.${axis} = e; co.${axis} = e + u_L / 2;
  vec4 a = texelFetch(u_in, ce, 0), b = texelFetch(u_in, co, 0);
  vec2 w = texelFetch(u_tw, ivec2((i % u_S) * (u_L / u_S), 0), 0).xy;   // exp(-2 pi i k / L)
  if (u_sign > 0.0) w.y = -w.y;
  o = vec4(a.xy + cmul(w, b.xy), a.zw + cmul(w, b.zw));
}`;
}

const FS_MULT = HEAD + `
uniform sampler2D u_Z; uniform sampler2D u_K; uniform ivec2 u_P; uniform float u_norm; out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 cm = ivec2((u_P.x - c.x) % u_P.x, (u_P.y - c.y) % u_P.y);
  vec4 z = texelFetch(u_Z, c, 0), zm = texelFetch(u_Z, cm, 0);
  vec2 Z = z.xy, Zc = vec2(zm.x, -zm.y);
  vec2 Mx = 0.5 * (Z + Zc);
  vec2 D = Z - Zc; vec2 My = 0.5 * vec2(D.y, -D.x);
  vec2 Mz = z.zw;
  vec4 K = texelFetch(u_K, c, 0);
  vec2 Hx = -(K.x * Mx + K.w * My), Hy = -(K.w * Mx + K.y * My), Hz = -K.z * Mz;
  o = vec4(Hx + vec2(-Hy.y, Hy.x), Hz) * u_norm;
}`;

// kind: false = RK4 stage, true = RK4 final step, 'relax' = steepest-descent step towards equilibrium
function fsStage(final) {
  const relax = final === 'relax';
  if (relax) final = true;
  return HEAD + `
uniform sampler2D u_s; uniform sampler2D u_m; uniform sampler2D u_acc; uniform sampler2D u_hd;
uniform sampler2D u_par; uniform sampler2D u_ant;
uniform ivec2 u_N; uniform vec2 u_id2;              // 1/dx^2, 1/dy^2
uniform float u_Aex2, u_muMs, u_Ku2, u_Kp2, u_gamma, u_dt, u_c, u_w, u_rft;
uniform vec3 u_Bext, u_u; uniform int u_first;
uniform int u_demag; uniform ivec2 u_pbc;
layout(location = 0) out vec4 o0;
${final ? '' : 'layout(location = 1) out vec4 o1;'}
vec3 nb(ivec2 q, vec3 m) {
  if (u_pbc.x == 1) q.x = (q.x + u_N.x) % u_N.x;
  if (u_pbc.y == 1) q.y = (q.y + u_N.y) % u_N.y;
  if (q.x < 0 || q.y < 0 || q.x >= u_N.x || q.y >= u_N.y) return m;
  vec4 v = texelFetch(u_s, q, 0); return v.w > 0.5 ? v.xyz : m;
}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(u_s, c, 0), mb = texelFetch(u_m, c, 0);
  if (mb.w < 0.5) { o0 = vec4(0.0); ${final ? '' : 'o1 = vec4(0.0);'} return; }
  vec3 m = s.xyz;
  vec3 lap = (nb(c + ivec2(1, 0), m) + nb(c - ivec2(1, 0), m) - 2.0 * m) * u_id2.x
           + (nb(c + ivec2(0, 1), m) + nb(c - ivec2(0, 1), m) - 2.0 * m) * u_id2.y;
  vec3 B = u_Aex2 * lap + u_Bext + u_rft * texelFetch(u_ant, c, 0).xyz;
  B += u_Ku2 * dot(m, u_u) * u_u + vec3(0.0, 0.0, u_Kp2 * m.z);
  if (u_demag == 1) B += u_muMs * texelFetch(u_hd, c, 0).xyz;
  float a = texelFetch(u_par, c, 0).x;
  vec3 mxB = cross(m, B);
  vec3 k = -u_gamma / (1.0 + a * a) * (mxB + a * cross(m, mxB));
  ${relax
    ? 'vec3 tq = B - dot(B, m) * m; o0 = vec4(normalize(m + u_dt * u_gamma * tq), mb.w);'
    : final
    ? 'vec4 acc = texelFetch(u_acc, c, 0); vec3 mn = mb.xyz + u_dt / 6.0 * (acc.xyz + k); o0 = vec4(normalize(mn), mb.w);'
    : 'vec4 acc = u_first == 1 ? vec4(0.0) : texelFetch(u_acc, c, 0); o0 = vec4(mb.xyz + u_c * u_dt * k, mb.w); o1 = acc + u_w * vec4(k, 0.0);'}
}`;
}

// Sum 2x2 blocks (xyz and mask count) for averages
const FS_REDUCE = HEAD + `
uniform sampler2D u_in; uniform ivec2 u_inN; out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy) * 2; vec4 s = vec4(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    ivec2 q = c + ivec2(i, j);
    if (q.x < u_inN.x && q.y < u_inN.y) s += texelFetch(u_in, q, 0);
  }
  o = s;
}`;
// first reduction level: weight by mask so .w counts cells
const FS_REDUCE0 = HEAD + `
uniform sampler2D u_in; uniform ivec2 u_inN; out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy) * 2; vec4 s = vec4(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    ivec2 q = c + ivec2(i, j);
    if (q.x < u_inN.x && q.y < u_inN.y) { vec4 v = texelFetch(u_in, q, 0); s += vec4(v.xyz * v.w, v.w); }
  }
  o = s;
}`;

// copy one texel (the 1x1 reduction result) or a row into a recording texture
const FS_COPYROW = HEAD + `
uniform sampler2D u_in; uniform int u_row; uniform int u_srcRow; out vec4 o;
void main() { ivec2 c = ivec2(gl_FragCoord.xy); o = texelFetch(u_in, ivec2(c.x, u_srcRow), 0); }`;
const FS_COPYAVG = HEAD + `
uniform sampler2D u_in; out vec4 o;
void main() { vec4 s = texelFetch(u_in, ivec2(0, 0), 0); o = vec4(s.xyz / max(s.w, 1.0), s.w); }`;

// BLS-style accumulation of the dynamic part |m − (m·ref) ref|^2
const FS_BLS = HEAD + `
uniform sampler2D u_m; uniform sampler2D u_ref; uniform sampler2D u_prev; out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 m = texelFetch(u_m, c, 0), r = texelFetch(u_ref, c, 0), p = texelFetch(u_prev, c, 0);
  vec3 d = m.xyz - dot(m.xyz, r.xyz) * r.xyz;
  o = p + vec4(dot(d, d), d.z * d.z, 1.0, 0.0) * m.w;
}`;

// |m - snapshot|^2 in x, mask in w (for convergence checks)
const FS_DIFF = HEAD + `
uniform sampler2D u_m; uniform sampler2D u_ref; out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 m = texelFetch(u_m, c, 0), r = texelFetch(u_ref, c, 0);
  vec3 d = m.xyz - r.xyz;
  o = vec4(dot(d, d), 0.0, 0.0, m.w);
}`;

// Display
const FS_VIEW = HEAD + `
uniform sampler2D u_m; uniform sampler2D u_ref; uniform ivec2 u_N; uniform vec2 u_view; uniform int u_mode; uniform float u_gain; out vec4 o;
vec3 hsl(float h, float s, float l) {
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
vec3 div(float t) {   // blue - white - red
  t = clamp(t, -1.0, 1.0);
  return t < 0.0 ? mix(vec3(1.0), vec3(0.16, 0.27, 0.75), -t) : mix(vec3(1.0), vec3(0.80, 0.16, 0.24), t);
}
vec3 lab(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 a = vec3(0.055, 0.165, 0.30), b = vec3(0.0, 0.45, 0.62), c = vec3(0.0, 0.83, 1.0), d = vec3(1.0, 0.94, 0.67);
  return t < 0.35 ? mix(a, b, t / 0.35) : t < 0.7 ? mix(b, c, (t - 0.35) / 0.35) : mix(c, d, (t - 0.7) / 0.3);
}
vec4 fetchM(ivec2 c) { return texelFetch(u_m, clamp(c, ivec2(0), u_N - 1), 0); }
vec4 fetchR(ivec2 c) { return texelFetch(u_ref, clamp(c, ivec2(0), u_N - 1), 0); }
void main() {
  vec2 uv = gl_FragCoord.xy / u_view;
  ivec2 cn = clamp(ivec2(floor(uv * vec2(u_N))), ivec2(0), u_N - 1);
  if (texelFetch(u_m, cn, 0).w < 0.5) { o = vec4(0.918, 0.965, 0.988, 1.0); return; }
  // bilinear interpolation between cells that belong to the magnet
  vec2 p = uv * vec2(u_N) - 0.5;
  ivec2 c0 = ivec2(floor(p)); vec2 f = fract(p);
  vec3 m = vec3(0.0), r = vec3(0.0); float ws = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    ivec2 q = c0 + ivec2(i, j);
    vec4 a = fetchM(q);
    float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y) * a.w;
    m += w * a.xyz; r += w * fetchR(q).xyz; ws += w;
  }
  m = ws > 0.0 ? m / ws : fetchM(cn).xyz;
  r = ws > 0.0 ? r / ws : fetchR(cn).xyz;
  float mn = length(m); if (mn > 0.0) m /= mn;
  float rn = length(r); if (rn > 0.0) r /= rn;
  vec3 col;
  if (u_mode == 0) col = hsl(fract(atan(m.y, m.x) / 6.283185307 + 1.0), 1.0, 0.5 + 0.5 * m.z);   // mumax3 colours: +x red, +y green, -x cyan
  else if (u_mode == 1) col = div(m.x);
  else if (u_mode == 2) col = div(m.y);
  else if (u_mode == 3) col = div(m.z);
  else {
    vec3 d = m - dot(m, r) * r;
    if (u_mode == 4) col = div(u_gain * d.z);
    else col = lab(sqrt(u_gain * length(d)));
  }
  o = vec4(col, 1.0);
}`;

// block average for arrows / small readback
const FS_DOWN = HEAD + `
uniform sampler2D u_m; uniform int u_b; uniform ivec2 u_N; out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy) * u_b; vec4 s = vec4(0.0);
  for (int j = 0; j < 16; j++) { if (j >= u_b) break; for (int i = 0; i < 16; i++) { if (i >= u_b) break;
    ivec2 q = c + ivec2(i, j); if (q.x < u_N.x && q.y < u_N.y) { vec4 v = texelFetch(u_m, q, 0); s += vec4(v.xyz * v.w, v.w); } } }
  o = vec4(s.xyz / max(s.w, 1.0), s.w / float(u_b * u_b));
}`;

export function isPow2(n) { return n > 0 && (n & (n - 1)) === 0; }

export class LLGSim {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('This browser does not offer WebGL 2, which the simulator needs.');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('This graphics driver cannot render to float textures (EXT_color_buffer_float), which the simulator needs.');
    this.gl = gl;
    this.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.prog = {
      pack: this._program(FS_PACK), fftx: this._program(fsFFT('x')), ffty: this._program(fsFFT('y')),
      mult: this._program(FS_MULT), stage: this._program(fsStage(false)), final: this._program(fsStage(true)), relax: this._program(fsStage('relax')),
      reduce0: this._program(FS_REDUCE0), reduce: this._program(FS_REDUCE), copyrow: this._program(FS_COPYROW),
      copyavg: this._program(FS_COPYAVG), bls: this._program(FS_BLS), view: this._program(FS_VIEW), down: this._program(FS_DOWN), diff: this._program(FS_DIFF),
    };
    this.t = 0; this.steps = 0;
    this.Bext = [0, 0, 0];
    this.rf = { on: false, f: 2e9, amp: 1e-3, kind: 'cw', t0: 0, fmax: 8e9, width: 0.1e-9, ramp: 1e-9 };
    this.demagOn = true;
  }

  _program(fs) {
    const gl = this.gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s) + '\n' + src);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  _tex(w, h, data = null) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { t, w, h, fb: null };
  }
  _fbo(...texs) {
    const gl = this.gl, fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    texs.forEach((tx, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tx.t, 0));
    gl.drawBuffers(texs.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer incomplete: ' + st);
    return fb;
  }
  _target(tex) { if (!tex.fb) tex.fb = this._fbo(tex); return tex.fb; }

  _run(prog, fb, w, h, uniforms, textures) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, w, h);
    let unit = 0;
    for (const [name, tex] of Object.entries(textures || {})) {
      if (!(name in prog.u)) continue;
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex.t); gl.uniform1i(prog.u[name], unit); unit++;
    }
    for (const [name, v] of Object.entries(uniforms || {})) {
      const loc = prog.u[name]; if (loc === undefined) continue;
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (v.i !== undefined) { if (Array.isArray(v.i)) (v.i.length === 2 ? gl.uniform2i(loc, v.i[0], v.i[1]) : gl.uniform3i(loc, ...v.i)); else gl.uniform1i(loc, v.i); }
      else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ------------------------------------------------------------------ configuration
  // g: { Nx, Ny, dx, dy, dz, pbc: [Rx, Ry] }, mat: { Ms, A, alpha, gamma (Hz/T), Ku, phiU (deg), Kp }
  // kernel: optional precomputed demagKernelFFT result (e.g. from a worker)
  configure(g, mat, kernel) {
    const gl = this.gl;
    if (!isPow2(g.Nx) || !isPow2(g.Ny)) throw new Error('Grid sizes must be powers of two');
    g = { pbc: [0, 0], ...g };
    const pbcKey = (x) => (x.pbc || [0, 0]).join(',');
    const resize = !this.g || this.g.Nx !== g.Nx || this.g.Ny !== g.Ny || pbcKey(this.g) !== pbcKey(g);
    const rekernel = resize || this.g.dx !== g.dx || this.g.dy !== g.dy || this.g.dz !== g.dz;
    this.g = { ...g }; this.mat = { ...mat };
    const { Nx, Ny } = g, Px = g.pbc[0] ? Nx : 2 * Nx, Py = g.pbc[1] ? Ny : 2 * Ny;
    this.P = [Px, Py];
    if (resize) {
      this._free();
      this.mA = this._tex(Nx, Ny); this.mB = this._tex(Nx, Ny);
      this.sA = this._tex(Nx, Ny); this.sB = this._tex(Nx, Ny);
      this.accA = this._tex(Nx, Ny); this.accB = this._tex(Nx, Ny);
      this.fbStageA = this._fbo(this.sA, this.accA); this.fbStageB = this._fbo(this.sB, this.accB);
      this.F0 = this._tex(Px, Py); this.F1 = this._tex(Px, Py);
      this.twX = this._twiddles(Px); this.twY = this._twiddles(Py);
      this.K = this._tex(Px, Py);
      this.par = this._tex(Nx, Ny); this.ant = this._tex(Nx, Ny);
      this.ref = this._tex(Nx, Ny);
      this.blsA = this._tex(Nx, Ny); this.blsB = this._tex(Nx, Ny);
      this.snap = this._tex(Nx, Ny); this.tmp = this._tex(Nx, Ny);
      // reduction chain
      this.red = []; let w = Nx, h = Ny;
      while (w > 1 || h > 1) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); this.red.push(this._tex(w, h)); }
      this.avgTex = this._tex(1, 1);
      this.m = this.mA; this.mNext = this.mB;
      this.bls = this.blsA; this.blsNext = this.blsB;
      this.rec = null; this.trace = null;
    }
    if (rekernel) {
      const K = kernel && kernel.px === Px && kernel.py === Py ? kernel : demagKernelFFT(Nx, Ny, g.dx, g.dy, g.dz, 48, g.pbc);
      gl.bindTexture(gl.TEXTURE_2D, this.K.t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, Px, Py, 0, gl.RGBA, gl.FLOAT, K.data);
    }
    this.setDamping();
    if (resize) { this.clearAntenna(); this.blsReset(); }
    this._dtAuto();
  }

  _twiddles(L) {
    const d = new Float32Array(L * 4);
    for (let k = 0; k < L; k++) { const a = -2 * Math.PI * k / L; d[4 * k] = Math.cos(a); d[4 * k + 1] = Math.sin(a); }
    return this._tex(L, 1, d);
  }

  _free() {
    const gl = this.gl;
    for (const k of ['mA', 'mB', 'sA', 'sB', 'accA', 'accB', 'F0', 'F1', 'K', 'par', 'ant', 'ref', 'blsA', 'blsB', 'avgTex', 'twX', 'twY', 'snap', 'tmp', 'coarse']) {
      if (this[k]) { gl.deleteTexture(this[k].t); if (this[k].fb) gl.deleteFramebuffer(this[k].fb); this[k] = null; }
    }
    if (this.red) for (const r of this.red) { gl.deleteTexture(r.t); if (r.fb) gl.deleteFramebuffer(r.fb); }
    for (const k of ['fbStageA', 'fbStageB']) if (this[k]) { gl.deleteFramebuffer(this[k]); this[k] = null; }
    if (this.rec) { gl.deleteTexture(this.rec.t); if (this.rec.fb) gl.deleteFramebuffer(this.rec.fb); this.rec = null; }
    if (this.trace) { gl.deleteTexture(this.trace.t); if (this.trace.fb) gl.deleteFramebuffer(this.trace.fb); this.trace = null; }
  }

  // Largest stable step for RK4 from the stiffest precession frequency, with a safety margin
  _dtAuto() {
    const { dx, dy, Nx, Ny } = this.g, m = this.mat;
    const Bex = 2 * m.A / m.Ms * ((Nx > 1 ? 4 / (dx * dx) : 0) + (Ny > 1 ? 4 / (dy * dy) : 0));
    const Bmax = Bex + MU0 * m.Ms + Math.hypot(...this.Bext) + 2 * (Math.abs(m.Ku || 0) + Math.abs(m.Kp || 0)) / m.Ms + 0.05;
    this.dt = 1.3 / (2 * Math.PI * m.gamma * Bmax);
    return this.dt;
  }
  setMaterial(mat) { this.mat = { ...this.mat, ...mat }; this.setDamping(); this._dtAuto(); }
  setField(B) { this.Bext = [...B]; this._dtAuto(); }

  // Per-cell damping; edges: { left, right, bottom, top } widths in cells for absorbing ramps
  setDamping(edges = this.edges || {}) {
    this.edges = edges;
    const { Nx, Ny } = this.g, a0 = this.mat.alpha, amax = 0.5;
    const d = new Float32Array(Nx * Ny * 4);
    for (let y = 0; y < Ny; y++) for (let x = 0; x < Nx; x++) {
      let a = a0;
      const ramp = (dist, w) => { if (w > 0 && dist < w) { const u = 1 - dist / w; a = Math.max(a, a0 + (amax - a0) * u * u); } };
      ramp(x, edges.left || 0); ramp(Nx - 1 - x, edges.right || 0); ramp(y, edges.bottom || 0); ramp(Ny - 1 - y, edges.top || 0);
      d[4 * (y * Nx + x)] = a;
    }
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.par.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Nx, Ny, gl.RGBA, gl.FLOAT, d);
  }

  // Antenna / rf field profile in tesla per unit amplitude: Float32Array RGBA (bx, by, bz, 0)
  setAntennaProfile(data) {
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.ant.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.g.Nx, this.g.Ny, gl.RGBA, gl.FLOAT, data);
  }
  clearAntenna() { this.setAntennaProfile(new Float32Array(this.g.Nx * this.g.Ny * 4)); }

  // Magnetization state: Float32Array RGBA (mx, my, mz, mask)
  setState(data) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.m.t);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.g.Nx, this.g.Ny, gl.RGBA, gl.FLOAT, data);
  }
  readState() {
    const gl = this.gl, out = new Float32Array(this.g.Nx * this.g.Ny * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._target(this.m));
    gl.readPixels(0, 0, this.g.Nx, this.g.Ny, gl.RGBA, gl.FLOAT, out);
    return out;
  }
  // one row of cells (j) of m or of the reference state: Float32Array RGBA, Nx texels
  readRow(j, which = 'm') {
    const gl = this.gl, out = new Float32Array(this.g.Nx * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._target(which === 'ref' ? this.ref : this.m));
    gl.readPixels(0, j, this.g.Nx, 1, gl.RGBA, gl.FLOAT, out);
    return out;
  }
  setReference() {   // copy m -> ref
    const gl = this.gl, src = this._target(this.m), dst = this._target(this.ref);   // create both before binding
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
    gl.blitFramebuffer(0, 0, this.g.Nx, this.g.Ny, 0, 0, this.g.Nx, this.g.Ny, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  // ------------------------------------------------------------------ time stepping
  rfValue(t) {
    const r = this.rf; if (!r.on) return 0;
    if (r.fn) return r.fn(t);
    const tt = t - (r.t0 || 0);
    if (r.kind === 'cw') { const ramp = r.ramp > 0 ? Math.min(1, Math.max(0, tt / r.ramp)) : 1; return tt < 0 ? 0 : r.amp * ramp * Math.sin(2 * Math.PI * r.f * tt); }
    if (r.kind === 'sinc') { const x = 2 * Math.PI * r.fmax * (tt - 4 / r.fmax); return r.amp * (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x); }
    if (r.kind === 'pulse') { const w = r.width || 50e-12; return tt >= 0 && tt <= w ? r.amp : 0; }
    if (r.kind === 'dc') return tt >= 0 ? r.amp : 0;
    return 0;
  }

  _demag(src) {
    const { Nx, Ny } = this.g, [Px, Py] = this.P;
    this._run(this.prog.pack, this._target(this.F0), Px, Py, { u_N: { i: [Nx, Ny] } }, { u_m: src });
    let a = this.F0, b = this.F1;
    const pass = (prog, L, sign) => {
      const tw = prog === this.prog.fftx ? this.twX : this.twY;
      for (let S = 2; S <= L; S <<= 1) {
        this._run(prog, this._target(b), Px, Py, { u_S: { i: S }, u_L: { i: L }, u_sign: sign }, { u_in: a, u_tw: tw });
        const t = a; a = b; b = t;
      }
    };
    pass(this.prog.fftx, Px, -1); pass(this.prog.ffty, Py, -1);
    this._run(this.prog.mult, this._target(b), Px, Py, { u_P: { i: [Px, Py] }, u_norm: 1 / (Px * Py) }, { u_Z: a, u_K: this.K });
    { const t = a; a = b; b = t; }
    pass(this.prog.fftx, Px, 1); pass(this.prog.ffty, Py, 1);
    return a;
  }

  step(n = 1) {
    const { Nx, Ny, dx, dy } = this.g, m = this.mat, dt = this.dt;
    const phi = (m.phiU || 0) * Math.PI / 180;
    const common = {
      u_N: { i: [Nx, Ny] }, u_id2: [1 / (dx * dx), 1 / (dy * dy)], u_Aex2: 2 * m.A / m.Ms, u_muMs: MU0 * m.Ms,
      u_Ku2: 2 * (m.Ku || 0) / m.Ms, u_Kp2: 2 * (m.Kp || 0) / m.Ms, u_gamma: 2 * Math.PI * m.gamma, u_dt: dt,
      u_Bext: this.Bext, u_u: [Math.cos(phi), Math.sin(phi), 0], u_demag: { i: this.demagOn ? 1 : 0 },
      u_pbc: { i: [this.g.pbc[0] ? 1 : 0, this.g.pbc[1] ? 1 : 0] },
    };
    for (let k = 0; k < n; k++) {
      const t = this.t;
      const stages = [
        { s: this.m, acc: this.accB, fb: this.fbStageA, c: 0.5, w: 1, first: 1, tt: t },
        { s: this.sA, acc: this.accA, fb: this.fbStageB, c: 0.5, w: 2, first: 0, tt: t + dt / 2 },
        { s: this.sB, acc: this.accB, fb: this.fbStageA, c: 1.0, w: 2, first: 0, tt: t + dt / 2 },
      ];
      for (const st of stages) {
        const hd = this.demagOn ? this._demag(st.s) : this.F0;
        this._run(this.prog.stage, st.fb, Nx, Ny, { ...common, u_c: st.c, u_w: st.w, u_first: { i: st.first }, u_rft: this.rfValue(st.tt) },
          { u_s: st.s, u_m: this.m, u_acc: st.acc, u_hd: hd, u_par: this.par, u_ant: this.ant });
      }
      const hd = this.demagOn ? this._demag(this.sA) : this.F0;
      this._run(this.prog.final, this._target(this.mNext), Nx, Ny, { ...common, u_rft: this.rfValue(t + dt) },
        { u_s: this.sA, u_m: this.m, u_acc: this.accA, u_hd: hd, u_par: this.par, u_ant: this.ant });
      const tmp = this.m; this.m = this.mNext; this.mNext = tmp;
      this.t += dt; this.steps++;
      if (this.blsOn) this._blsAccumulate();
      if (this.recording) this._recordSample();
    }
  }

  // Steepest descent towards the nearest energy minimum: one field evaluation per iteration.
  // Each step turns m towards B_eff by about `angle` radians for the stiffest field in the problem.
  relaxSteps(n = 1, angle = 0.3) {
    const { Nx, Ny, dx, dy } = this.g, m = this.mat;
    const phi = (m.phiU || 0) * Math.PI / 180;
    const Bex = 2 * m.A / m.Ms * ((Nx > 1 ? 4 / (dx * dx) : 0) + (Ny > 1 ? 4 / (dy * dy) : 0));
    const Bmax = Bex + MU0 * m.Ms + Math.hypot(...this.Bext) + 2 * (Math.abs(m.Ku || 0) + Math.abs(m.Kp || 0)) / m.Ms + 0.01;
    const gam = 2 * Math.PI * m.gamma, h = angle / (gam * Bmax);
    const uni = {
      u_N: { i: [Nx, Ny] }, u_id2: [1 / (dx * dx), 1 / (dy * dy)], u_Aex2: 2 * m.A / m.Ms, u_muMs: MU0 * m.Ms,
      u_Ku2: 2 * (m.Ku || 0) / m.Ms, u_Kp2: 2 * (m.Kp || 0) / m.Ms, u_gamma: gam, u_dt: h, u_rft: 0,
      u_Bext: this.Bext, u_u: [Math.cos(phi), Math.sin(phi), 0], u_demag: { i: this.demagOn ? 1 : 0 },
      u_pbc: { i: [this.g.pbc[0] ? 1 : 0, this.g.pbc[1] ? 1 : 0] },
    };
    for (let k = 0; k < n; k++) {
      const hd = this.demagOn ? this._demag(this.m) : this.F0;
      this._run(this.prog.relax, this._target(this.mNext), Nx, Ny, uni, { u_s: this.m, u_m: this.m, u_hd: hd, u_par: this.par, u_ant: this.ant, u_acc: this.accA });
      const tmp = this.m; this.m = this.mNext; this.mNext = tmp;
    }
  }

  // ------------------------------------------------------------------ measurements
  _reduceAvg() {
    let src = this.m, w = this.g.Nx, h = this.g.Ny;
    this.red.forEach((r, i) => {
      this._run(i === 0 ? this.prog.reduce0 : this.prog.reduce, this._target(r), r.w, r.h, { u_inN: { i: [w, h] } }, { u_in: src });
      src = r; w = r.w; h = r.h;
    });
    this._run(this.prog.copyavg, this._target(this.avgTex), 1, 1, {}, { u_in: src });
    return this.avgTex;
  }
  average() {
    const gl = this.gl, out = new Float32Array(4);
    this._reduceAvg();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._target(this.avgTex));
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out);
    return [out[0], out[1], out[2]];
  }

  // Record, without stalling the GPU, either a row of m (for dispersion maps) or the average m
  // (for spectra) every `every` steps into a texture with `samples` rows.
  startRecording({ kind = 'row', row = 0, every = 1, samples = 512 }) {
    const gl = this.gl;
    const w = kind === 'row' ? this.g.Nx : 1;
    if (this.rec) { gl.deleteTexture(this.rec.t); if (this.rec.fb) gl.deleteFramebuffer(this.rec.fb); }
    this.rec = this._tex(w, samples);
    this.recCfg = { kind, row, every, samples, w, n: 0, t0: this.t, dtSample: every * this.dt, counter: 0 };
    this.recording = true;
  }
  _recordSample() {
    const r = this.recCfg;
    if (++r.counter < r.every) return;
    r.counter = 0;
    const gl = this.gl;
    const src = r.kind === 'row' ? this.m : this._reduceAvg();
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, r.n, r.w, 1);
    this._run(this.prog.copyrow, this._target(this.rec), r.w, r.samples, { u_srcRow: { i: r.kind === 'row' ? r.row : 0 } }, { u_in: src });
    gl.disable(gl.SCISSOR_TEST);
    r.n++;
    if (r.n >= r.samples) this.recording = false;
  }
  readRecording() {
    const gl = this.gl, r = this.recCfg, out = new Float32Array(r.w * r.samples * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._target(this.rec));
    gl.readPixels(0, 0, r.w, r.samples, gl.RGBA, gl.FLOAT, out);
    return { data: out, w: r.w, n: r.n, samples: r.samples, dtSample: r.dtSample };
  }

  blsReset() {
    const gl = this.gl, z = new Float32Array(this.g.Nx * this.g.Ny * 4);
    for (const t of [this.blsA, this.blsB]) { gl.bindTexture(gl.TEXTURE_2D, t.t); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.g.Nx, this.g.Ny, gl.RGBA, gl.FLOAT, z); }
    this.blsSamples = 0;
  }
  _blsAccumulate() {
    this._run(this.prog.bls, this._target(this.blsNext), this.g.Nx, this.g.Ny, {}, { u_m: this.m, u_ref: this.ref, u_prev: this.bls });
    const t = this.bls; this.bls = this.blsNext; this.blsNext = t;
    this.blsSamples++;
  }
  readBLS() {
    const gl = this.gl, out = new Float32Array(this.g.Nx * this.g.Ny * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._target(this.bls));
    gl.readPixels(0, 0, this.g.Nx, this.g.Ny, gl.RGBA, gl.FLOAT, out);
    return out;
  }

  _copy(src, dst) {
    const gl = this.gl, a = this._target(src), b = this._target(dst);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, a); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, b);
    gl.blitFramebuffer(0, 0, this.g.Nx, this.g.Ny, 0, 0, this.g.Nx, this.g.Ny, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }
  snapshot() { this._copy(this.m, this.snap); }
  // root-mean-square change of m per cell since the last snapshot
  changeSinceSnapshot() {
    this._run(this.prog.diff, this._target(this.tmp), this.g.Nx, this.g.Ny, {}, { u_m: this.m, u_ref: this.snap });
    let src = this.tmp, w = this.g.Nx, h = this.g.Ny;
    this.red.forEach((r, i) => {
      this._run(i === 0 ? this.prog.reduce0 : this.prog.reduce, this._target(r), r.w, r.h, { u_inN: { i: [w, h] } }, { u_in: src });
      src = r; w = r.w; h = r.h;
    });
    const out = new Float32Array(4), gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._target(src));
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out);
    return Math.sqrt(out[0] / Math.max(1, out[3]));
  }

  // Block-averaged magnetization (for arrows), block size b (power of two)
  readCoarse(b) {
    const gl = this.gl, w = Math.max(1, this.g.Nx / b), h = Math.max(1, this.g.Ny / b);
    if (!this.coarse || this.coarse.w !== w || this.coarse.h !== h) {
      if (this.coarse) { gl.deleteTexture(this.coarse.t); if (this.coarse.fb) gl.deleteFramebuffer(this.coarse.fb); }
      this.coarse = this._tex(w, h);
    }
    this._run(this.prog.down, this._target(this.coarse), w, h, { u_b: { i: b }, u_N: { i: [this.g.Nx, this.g.Ny] } }, { u_m: this.m });
    const out = new Float32Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, out);
    return { data: out, w, h };
  }

  // ------------------------------------------------------------------ display
  render(mode = 0, gain = 1) {
    const gl = this.gl, c = this.canvas;
    const W = c.width, H = c.height;
    this._run(this.prog.view, null, W, H, { u_N: { i: [this.g.Nx, this.g.Ny] }, u_view: [W, H], u_mode: { i: mode }, u_gain: gain }, { u_m: this.m, u_ref: this.ref });
  }

  // Synchronise with the GPU (for timing)
  finish() { const out = new Float32Array(4); const gl = this.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, this._target(this.m)); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out); }
}
