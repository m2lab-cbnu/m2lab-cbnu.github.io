/* Spin-wave toy and "Find the resonance" game for the M² Lab hero.
 *
 * Free play. A chain of exchange-coupled spins. Each spin's small transverse magnetization
 * is psi_n = m_x + i m_z, following the linearized Landau–Lifshitz–Gilbert equation
 *
 *   dpsi_n/dt = -i [ w0 psi_n + J (2 psi_n - psi_{n-1} - psi_{n+1}) ] - gamma_n psi_n + i f_n
 *
 * (exchange dispersion w(k) = w0 + 2J(1 - cos k)). The ends reflect, so waves come back as
 * echoes. The pointer acts like a small magnet (nearby spins lean toward it), a click plucks
 * the chain, and every few seconds a small random "thermal" kick keeps it rippling.
 *
 * Game. A ferromagnetic resonance (FMR) measurement, the experiment we run most in the lab.
 * Microwaves at a fixed frequency drive the whole film while the player sweeps the magnetic
 * field (pointer position or arrow keys). The film absorbs when the field brings its
 * precession frequency to the microwave frequency, given for an in-plane film by the Kittel
 * formula f = (gamma/2pi) sqrt(B (B + mu0 Ms)). The uniform mode is a driven, damped
 * oscillator; in the frame rotating with the microwaves
 *
 *   du/dt = G [ -(1 + i d) u + i ],   d = (B - B_res) / dB,
 *
 * whose steady state has absorption Im u = 1 / (1 + d^2): a Lorentzian of half-width dB.
 * Narrow lines respond slowly (G ~ dB), so a sharp line swept too fast lags and rings, as in
 * a real measurement. Linewidths are exaggerated so the lines can be found with a finger.
 */
(function () {
  "use strict";
  var canvas = document.getElementById("spinwave");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var trail = document.createElement("canvas");
  var tctx = trail.getContext("2d");
  var toggle = document.getElementById("sim-toggle");
  var gameBtn = document.getElementById("sim-game");
  var hint = document.getElementById("sim-hint");
  var caption = hint ? hint.parentNode : null;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var reduceMQ = mq("(prefers-reduced-motion: reduce)");
  var touchOnly = mq("(hover: none)").matches;

  // ---- spin chain (dimensionless) ----
  var W0 = 1.0, J = 2.0;
  var GAMMA = 0.03, GAMMA_GAME = 0.12, GAMMA_EDGE = 0.06, EDGE = 3;
  var PLUCK = 0.85, KICK = 0.42, PLUCK_SIGMA = 1.3;
  var MAG_SIGMA = 2.4, MAG_STRENGTH = 0.55;
  var TIME_SCALE = 3.2, H_STEP = 0.03;
  // ---- drawing ----
  var A_REF = 0.28, TH_MAX = 0.58;
  var BETA = 0.5, CB = Math.cos(BETA), SB = Math.sin(BETA);
  var BASE = [0, 212, 255];
  var PALETTE = [[0, 212, 255], [140, 124, 255], [255, 111, 181], [255, 196, 74]];
  var FONT = '"Plex", "IBM Plex Sans", system-ui, sans-serif';

  // ---- game ----
  // mu0*Ms in tesla; width = exaggerated half-width of the absorption line in mT
  var SAMPLES = [
    { name: "Permalloy", Ms: 1.0, width: 20, intro: " Sweep the magnetic field by moving across the spins (or with the arrow keys) until the film absorbs and the spins swing together." },
    { name: "CoFeB", Ms: 1.5, width: 12, intro: " Find its resonance." },
    { name: "YIG", Ms: 0.175, width: 6, intro: " YIG has a very sharp line, so sweep slowly." }
  ];
  var GHZ_PER_T = 28.0;       // electron gyromagnetic ratio / 2 pi
  var TAU_K = 3.6;            // ring-up time (s) = TAU_K / half-width (mT)
  var LOCK_P = 0.7, LOCK_T = 0.45;
  var A_VIS = 0.6, OMEGA_VIS = 4.2;
  var AXIS_H = 17, SPEC_TOP = 46;
  var PAD_X = 16;             // set in setup() to line up with the page's text column
  var BEST_KEY = "m2lab-resonance-best";

  var W = 0, H = 0, dpr = 1, N = 0, s = 0, L = 0, y0 = 0, off = 0;
  var re, im, gam, mag, k1r, k1i, k2r, k2i, k3r, k3i, k4r, k4i, tr, ti;
  var clock = 0, nextKick = 0;
  var ptr = { x: 0, prox: 0, target: 0, py: 0 };
  var ripples = [], parts = [], rings = [];
  var running = false, paused = false, visible = true, last = 0, raf = 0;
  var game = null;

  if (touchOnly && hint && hint.getAttribute("data-touch")) {
    var span0 = hint.querySelector("span");
    if (span0) span0.textContent = hint.getAttribute("data-touch");
  }
  if (touchOnly) SAMPLES[0].intro = " Sweep the magnetic field by dragging across the spins until the film absorbs and the spins swing together.";
  var defaultHint = hint ? hint.innerHTML : "";
  var defaultBtn = gameBtn ? gameBtn.innerHTML : "";
  var ICON_STOP = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z"/></svg>';

  function alloc(n) {
    var F = function () { return new Float64Array(n); };
    re = F(); im = F(); gam = F(); mag = F();
    k1r = F(); k1i = F(); k2r = F(); k2i = F(); k3r = F(); k3i = F(); k4r = F(); k4i = F(); tr = F(); ti = F();
  }

  function setDamping(base) {
    for (var n = 0; n < N; n++) {
      var e = Math.min(n, N - 1 - n);
      gam[n] = base + (e < EDGE ? GAMMA_EDGE * (EDGE - e) / EDGE : 0);
    }
  }

  function setMagnet() {
    var strength = MAG_STRENGTH * ptr.prox, inv = 1 / (2 * MAG_SIGMA * MAG_SIGMA);
    for (var n = 0; n < N; n++) {
      var d = ptr.x - n;
      mag[n] = strength > 1e-4 ? strength * (d / MAG_SIGMA) * Math.exp(-d * d * inv) : 0;
    }
  }

  function deriv(xr, xi, outR, outI) {
    for (var n = 0; n < N; n++) {
      var l = n > 0 ? n - 1 : n, r = n < N - 1 ? n + 1 : n;
      var hr = W0 * xr[n] + J * (2 * xr[n] - xr[l] - xr[r]);
      var hi = W0 * xi[n] + J * (2 * xi[n] - xi[l] - xi[r]);
      // -i*H*psi - gamma*psi + i*f, with f = the pointer magnet (real)
      outR[n] = hi - gam[n] * xr[n];
      outI[n] = -hr - gam[n] * xi[n] + mag[n];
    }
  }

  function rk4(h) {
    var n;
    deriv(re, im, k1r, k1i);
    for (n = 0; n < N; n++) { tr[n] = re[n] + 0.5 * h * k1r[n]; ti[n] = im[n] + 0.5 * h * k1i[n]; }
    deriv(tr, ti, k2r, k2i);
    for (n = 0; n < N; n++) { tr[n] = re[n] + 0.5 * h * k2r[n]; ti[n] = im[n] + 0.5 * h * k2i[n]; }
    deriv(tr, ti, k3r, k3i);
    for (n = 0; n < N; n++) { tr[n] = re[n] + h * k3r[n]; ti[n] = im[n] + h * k3i[n]; }
    deriv(tr, ti, k4r, k4i);
    for (n = 0; n < N; n++) {
      re[n] += h / 6 * (k1r[n] + 2 * k2r[n] + 2 * k3r[n] + k4r[n]);
      im[n] += h / 6 * (k1i[n] + 2 * k2i[n] + 2 * k3i[n] + k4i[n]);
    }
  }

  function advance(simTime) {
    var steps = Math.max(1, Math.ceil(simTime / H_STEP)), h = simTime / steps;
    for (var i = 0; i < steps; i++) rk4(h);
  }

  function pluck(at, amp) {
    var phase = Math.random() * 6.2832, cr = Math.cos(phase), ci = Math.sin(phase);
    var inv = 1 / (2 * PLUCK_SIGMA * PLUCK_SIGMA);
    for (var n = 0; n < N; n++) {
      var d = n - at, g = amp * Math.exp(-d * d * inv);
      re[n] += g * cr; im[n] += g * ci;
    }
  }

  function setup() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = trail.width = Math.round(W * dpr);
    canvas.height = trail.height = Math.round(H * dpr);
    s = W < 560 ? 15 : W < 1000 ? 19 : 22;
    N = Math.max(18, Math.floor(W / s));
    off = (W - N * s) / 2;
    L = Math.min(H * 0.5, 88);
    y0 = Math.min(H * 0.8, H - AXIS_H - 3 - 0.5 * L * SB);   // leave room for the game's field axis
    // same left and right edges as .wrap (max 1160px, gutter clamp(16px, 4vw, 40px))
    PAD_X = (W - Math.min(W, 1160)) / 2 + Math.min(40, Math.max(16, 0.04 * (window.innerWidth || W)));
    alloc(N);
    setDamping(game ? GAMMA_GAME : GAMMA);
    ptr.prox = ptr.target = 0; setMagnet();
    if (game) newBins();
    else { pluck(N * 0.3, PLUCK); advance(6); }
  }

  function xOf(n) { return off + (n + 0.5) * s; }

  function phaseColour(phi) {
    var u = ((phi / 6.2832) % 1 + 1) % 1 * PALETTE.length, i = Math.floor(u), f = u - i;
    var a = PALETTE[i % PALETTE.length], b = PALETTE[(i + 1) % PALETTE.length];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a.toFixed(2) + ")"; }

  // ---------------------------------------------------------------- game physics
  function fieldToX(b) { return PAD_X + b / game.range * (W - 2 * PAD_X); }
  function xToField(x) { return Math.min(game.range, Math.max(0, (x - PAD_X) / (W - 2 * PAD_X) * game.range)); }
  function kittel(bmT, Ms) { var B = bmT / 1000; return GHZ_PER_T * Math.sqrt(B * (B + Ms)); }            // GHz
  function resField(f, Ms) { var b = f / GHZ_PER_T; return 500 * (-Ms + Math.sqrt(Ms * Ms + 4 * b * b)); } // mT
  function specBase() { return H - AXIS_H; }
  function specY(v) { var yb = specBase(); return yb - Math.max(0, Math.min(1.08, v)) * (yb - SPEC_TOP); }

  function newBins() {
    var nb = Math.max(60, Math.round((W - 2 * PAD_X) / 2));
    game.bins = new Float32Array(nb); game.seen = new Uint8Array(nb); game.lastBin = -1;
  }
  function writeBin(b, v) {
    var g = game, nb = g.bins.length, i = Math.max(0, Math.min(nb - 1, Math.round(b / g.range * (nb - 1))));
    if (g.lastBin >= 0 && g.lastBin !== i) {                  // fill the gap so a fast sweep draws a line
      var a = g.lastBin, va = g.bins[a], step = i > a ? 1 : -1;
      for (var k = a + step; k !== i; k += step) { g.bins[k] = va + (v - va) * (k - a) / (i - a); g.seen[k] = 1; }
    }
    g.bins[i] = v; g.seen[i] = 1; g.lastBin = i;
  }

  function say(html) { if (hint) hint.innerHTML = html; }
  function setBtn(html) { if (gameBtn) gameBtn.innerHTML = html; }
  function readBest() { try { var v = parseFloat(localStorage.getItem(BEST_KEY)); return v > 0 ? v : 0; } catch (e) { return 0; } }
  function writeBest(v) { try { localStorage.setItem(BEST_KEY, v.toFixed(2)); } catch (e) { /* private mode */ } }

  function loadSample(i) {
    var g = game, sm = SAMPLES[i], pxPerMT = (W - 2 * PAD_X) / g.range, b, tries = 0;
    g.idx = i; g.sample = sm;
    g.dB = Math.max(sm.width, 9 / pxPerMT);        // never narrower than 9 px on screen
    g.G = g.dB / TAU_K;
    do { b = g.range * (0.15 + 0.7 * Math.random()); tries++; }
    while (tries < 30 && Math.abs(b - g.field) < 0.25 * g.range);
    g.f = Math.round(kittel(b, sm.Ms) * 10) / 10;
    g.bRes = resField(g.f, sm.Ms);
    g.ur = 0; g.ui = 0; g.hold = 0; g.phase = "play"; g.phaseT = 0;
    newBins();
    say("<strong>Sample " + (i + 1) + " of " + SAMPLES.length + ": " + sm.name + ", with microwaves at " +
        g.f.toFixed(1) + " GHz.</strong>" + sm.intro);
  }

  function startGame() {
    game = { range: W < 600 ? 200 : 300, field: 0, target: 0, time: 0, started: false, idx: 0, best: readBest() };
    setDamping(GAMMA_GAME);
    ptr.target = 0;
    parts = []; rings = [];
    canvas.style.touchAction = "none";
    if (caption) caption.classList.add("is-playing");
    setBtn(ICON_STOP + "<span>Stop game</span>");
    loadSample(0);
    if (paused) setPaused(false);
    start();
    try { canvas.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  }

  function endGame(keepMessage) {
    game = null;
    canvas.style.touchAction = "";
    setDamping(GAMMA);
    if (caption) caption.classList.remove("is-playing");
    if (!keepMessage) { say(defaultHint); setBtn(defaultBtn); }
    if (reduceMQ.matches) { stop(); staticFrame(); }
  }

  function found() {
    var g = game;
    g.phase = "found"; g.phaseT = 0; g.hold = LOCK_T;
    burst(fieldToX(g.bRes), specY(Math.max(0.35, g.ui)));
    say("<strong>Found it!</strong> " + g.sample.name + " resonates at " + Math.round(g.bRes) + " mT.");
  }

  function finish() {
    var g = game, tsec = g.time, best = readBest(), isBest = !best || tsec < best;
    if (isBest) writeBest(tsec);
    g.phase = "done"; g.phaseT = 0;
    say("<strong>All three found in " + tsec.toFixed(1) + " s" +
        (best ? (isBest ? ", a new best!" : " (your best is " + best.toFixed(1) + " s).") : ".") +
        "</strong> You just ran a ferromagnetic resonance (FMR) measurement, one of the main experiments in our lab.");
    setBtn(ICON_PLAY + "<span>Play again</span>");
  }

  function stepGame(dt) {
    var g = game;
    if (g.started && g.phase === "play") g.time += dt;
    g.phaseT += dt;
    // the field follows the pointer with a short lag, like a magnet power supply ramping
    var b0 = g.field, b1 = b0 + (g.target - b0) * (1 - Math.exp(-dt / 0.05));
    if (Math.abs(g.target - b1) < 0.02) b1 = g.target;
    var m = Math.min(400, Math.max(1, Math.ceil(Math.abs(b1 - b0) / (0.25 * g.dB))));
    var h = dt / m;
    for (var j = 1; j <= m; j++) {
      var bj = b0 + (b1 - b0) * j / m, d = (bj - g.bRes) / g.dB, q = 1 / (1 + d * d);
      var sr = d * q, si = q;                                   // steady state i / (1 + i d)
      var e = Math.exp(-g.G * h), c = Math.cos(d * g.G * h), sn = Math.sin(d * g.G * h);
      var xr = g.ur - sr, xi = g.ui - si;                       // (u - u_ss) e^{-(1 + i d) G h}
      g.ur = sr + e * (xr * c + xi * sn);
      g.ui = si + e * (xi * c - xr * sn);
      writeBin(bj, g.ui);
    }
    g.field = b1;
    if (g.phase === "play") {
      if (g.ui >= LOCK_P) g.hold += dt; else g.hold = Math.max(0, g.hold - 1.5 * dt);
      if (g.hold >= LOCK_T) found();
    } else if (g.phase === "found" && g.phaseT > 1.7) {
      if (g.idx < SAMPLES.length - 1) loadSample(g.idx + 1); else finish();
    } else if (g.phase === "done" && g.phaseT > 3.5) {
      endGame(true);
    }
  }

  function burst(x, y) {
    for (var i = 0; i < 32; i++) {
      var a = -Math.PI * (0.08 + 0.84 * Math.random()), sp = 70 + 170 * Math.random();
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.7 + 0.6 * Math.random(), c: PALETTE[i % PALETTE.length] });
    }
    rings.push({ x: x, y: y, life: 0 });
  }
  function stepParts(dt) {
    parts = parts.filter(function (p) { p.life += dt; return p.life < p.max; });
    parts.forEach(function (p) { p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    rings = rings.filter(function (r) { r.life += dt; return r.life < 0.7; });
  }

  function fmtTime(x) { return x.toFixed(1) + " s"; }

  function pill(x, y, w, h, fill, stroke) {
    var r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, Math.PI / 2, 1.5 * Math.PI); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function drawSpectrum() {
    var g = game, nb = g.bins.length, yb = specBase(), wpx = W - 2 * PAD_X, i = 0, k;
    var grad = ctx.createLinearGradient(0, SPEC_TOP, 0, yb);
    grad.addColorStop(0, "rgba(0,212,255,0.32)");
    grad.addColorStop(1, "rgba(0,212,255,0.03)");
    while (i < nb) {
      if (!g.seen[i]) { i++; continue; }
      var j = i;
      while (j + 1 < nb && g.seen[j + 1]) j++;
      var xa = PAD_X + i / (nb - 1) * wpx, xb = PAD_X + j / (nb - 1) * wpx;
      ctx.beginPath(); ctx.moveTo(xa, yb);
      for (k = i; k <= j; k++) ctx.lineTo(PAD_X + k / (nb - 1) * wpx, specY(g.bins[k]));
      ctx.lineTo(xb, yb); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.beginPath();
      for (k = i; k <= j; k++) {
        var x = PAD_X + k / (nb - 1) * wpx, y = specY(g.bins[k]);
        if (k === i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(150,232,255,0.95)"; ctx.lineWidth = 1.6; ctx.stroke();
      i = j + 1;
    }
    // field axis
    ctx.strokeStyle = "rgba(168,236,255,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD_X, yb + 0.5); ctx.lineTo(W - PAD_X, yb + 0.5); ctx.stroke();
    ctx.font = "500 11px " + FONT; ctx.fillStyle = "rgba(168,236,255,0.95)"; ctx.textBaseline = "alphabetic";
    for (var v = 0; v <= g.range + 0.1; v += 50) {
      var tx = fieldToX(v);
      ctx.beginPath(); ctx.moveTo(Math.round(tx) + 0.5, yb); ctx.lineTo(Math.round(tx) + 0.5, yb + 4); ctx.stroke();
      ctx.textAlign = v === 0 ? "left" : v >= g.range ? "right" : "center";
      ctx.fillText(v >= g.range ? v + " mT" : String(v), tx, H - 4);
    }
  }

  function drawGameTop() {
    var g = game, yb = specBase(), cx = fieldToX(g.field), py = specY(g.ui);
    // where the resonance was found
    if (g.phase !== "play") {
      var rx = fieldToX(g.bRes);
      ctx.strokeStyle = "rgba(255,196,74,0.75)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(rx, SPEC_TOP - 2); ctx.lineTo(rx, yb); ctx.stroke();
    }
    // field cursor and probe
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(Math.round(cx) + 0.5, SPEC_TOP - 2); ctx.lineTo(Math.round(cx) + 0.5, yb); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, py, 3.3, 0, 6.2832); ctx.fill();
    if (g.phase === "play" && g.hold > 0) {
      ctx.strokeStyle = "rgba(255,196,74,0.95)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, py, 9, -Math.PI / 2, -Math.PI / 2 + 6.2832 * Math.min(1, g.hold / LOCK_T)); ctx.stroke();
    }
    // field read-out above the cursor
    ctx.font = "600 12px " + FONT; ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
    var label = Math.round(g.field) + " mT", tw = ctx.measureText(label).width + 16;
    var lx = Math.min(W - tw - 4, Math.max(4, cx - tw / 2));
    pill(lx, 25, tw, 19, "rgba(14,42,77,0.92)", "rgba(168,236,255,0.55)");
    ctx.fillStyle = "#fff"; ctx.fillText(label, lx + tw / 2, 39);
    // status line
    ctx.textAlign = "left";
    if (g.phase === "play") {
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.fillText(g.sample.name + " at " + g.f.toFixed(1) + " GHz", PAD_X, 16);
    } else {
      ctx.fillStyle = "rgba(255,196,74,1)";
      ctx.fillText(g.sample.name + " resonates at " + Math.round(g.bRes) + " mT", PAD_X, 16);
    }
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(168,236,255,0.95)";
    ctx.fillText("Sample " + Math.min(g.idx + 1, SAMPLES.length) + " of " + SAMPLES.length + ",  " + fmtTime(g.time) +
                 (g.best && W >= 480 ? "  (best " + fmtTime(g.best) + ")" : ""), W - PAD_X, 16);
    // until the first move, show where to sweep
    if (!g.started && H >= 200) {
      ctx.textAlign = "center"; ctx.font = "500 13px " + FONT; ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(touchOnly ? "\u2190  drag sideways to sweep the field  \u2192" : "\u2190  move sideways to sweep the field  \u2192",
                   W / 2, SPEC_TOP + 8);
    }
  }

  function drawBurst() {
    rings.forEach(function (r) {
      var a = r.life / 0.7;
      ctx.strokeStyle = "rgba(255,196,74," + (0.9 * (1 - a)).toFixed(2) + ")"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, 8 + 50 * a, 0, 6.2832); ctx.stroke();
    });
    parts.forEach(function (p) {
      ctx.fillStyle = rgba(p.c, 1 - p.life / p.max);
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 6.2832); ctx.fill();
    });
  }

  // ---------------------------------------------------------------- drawing
  var tipsX = [], tipsY = [], depth = [], cols = [], amps = [], order = [];
  function draw() {
    var n;
    // in the game every spin also carries the uniform (FMR) precession
    var ore = 0, oim = 0;
    if (game) {
      var ph0 = clock * OMEGA_VIS, cp = Math.cos(ph0), sp = Math.sin(ph0);
      var k = A_VIS * Math.sqrt(game.ur * game.ur + game.ui * game.ui);
      ore = k * (game.ur * cp + game.ui * sp);
      oim = k * (game.ui * cp - game.ur * sp);
    }

    // fade the tip trails, then add this frame's tips
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.globalCompositeOperation = "destination-out";
    tctx.fillStyle = "rgba(0,0,0,0.14)";
    tctx.fillRect(0, 0, W, H);
    tctx.globalCompositeOperation = "source-over";

    for (n = 0; n < N; n++) {
      var pr = re[n] + ore, pi = im[n] + oim;
      var amp = Math.hypot(pr, pi);
      var th = TH_MAX * Math.tanh(amp / A_REF);
      var ph = Math.atan2(pi, pr);
      var st = Math.sin(th);
      tipsX[n] = xOf(n) + L * st * Math.cos(ph);
      tipsY[n] = y0 - L * CB * Math.cos(th) + L * SB * st * Math.sin(ph);
      depth[n] = st * Math.sin(ph) / Math.sin(TH_MAX);
      var m = Math.min(1, th / (0.45 * TH_MAX)); m = m * m * (3 - 2 * m);
      var pc = phaseColour(ph);
      cols[n] = [BASE[0] + (pc[0] - BASE[0]) * m, BASE[1] + (pc[1] - BASE[1]) * m, BASE[2] + (pc[2] - BASE[2]) * m];
      amps[n] = m;
      order[n] = n;
      if (m > 0.15) {
        tctx.fillStyle = rgba(cols[n], 0.25 + 0.6 * m);
        tctx.beginPath(); tctx.arc(tipsX[n], tipsY[n], 1.7, 0, 6.2832); tctx.fill();
      }
    }
    order.length = N;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // the magnetic film
    var hw = 0.5 * L * SB;
    ctx.fillStyle = "rgba(120,175,235,0.09)";
    ctx.fillRect(0, y0 - hw, W, 2 * hw);
    ctx.strokeStyle = "rgba(150,195,240,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y0 - hw + 0.5); ctx.lineTo(W, y0 - hw + 0.5);
    ctx.moveTo(0, y0 + hw - 0.5); ctx.lineTo(W, y0 + hw - 0.5); ctx.stroke();

    if (game) drawSpectrum();

    // the pointer acts as a small magnet
    if (!game && ptr.prox > 0.02) {
      var mx = xOf(ptr.x), my = Math.min(Math.max(ptr.py, 12), y0 - L - 6);
      var gr = ctx.createRadialGradient(mx, my, 0, mx, my, 26);
      gr.addColorStop(0, "rgba(255,255,255," + (0.55 * ptr.prox).toFixed(2) + ")");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, 6.2832); ctx.fill();
    }

    var nowMs = performance.now();
    ripples = ripples.filter(function (r) { return nowMs - r[2] < 650; });
    ripples.forEach(function (r) {
      var age = (nowMs - r[2]) / 650;
      ctx.strokeStyle = "rgba(255,196,74," + (0.8 * (1 - age)).toFixed(2) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r[0], r[1], 6 + 34 * age, 0, 6.2832); ctx.stroke();
    });

    ctx.drawImage(trail, 0, 0, W, H);

    // faint line through the tips
    ctx.strokeStyle = "rgba(200,235,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tipsX[0], tipsY[0]);
    for (n = 1; n < N - 1; n++) ctx.quadraticCurveTo(tipsX[n], tipsY[n], (tipsX[n] + tipsX[n + 1]) / 2, (tipsY[n] + tipsY[n + 1]) / 2);
    ctx.lineTo(tipsX[N - 1], tipsY[N - 1]);
    ctx.stroke();

    // arrows, back to front
    order.sort(function (i, j) { return depth[i] - depth[j]; });
    for (var q = 0; q < N; q++) {
      n = order[q];
      var bx = xOf(n), tx = tipsX[n], ty = tipsY[n];
      var dd = 0.5 + 0.5 * depth[n];
      var col = rgba(cols[n], 0.5 + 0.5 * dd);
      var dx = tx - bx, dy = ty - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      var head = Math.min(8, len * 0.2), half = head * 0.5;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.lineWidth = 1.3 + 0.9 * dd + 0.6 * amps[n];
      ctx.beginPath(); ctx.moveTo(bx, y0); ctx.lineTo(tx - ux * head * 0.8, ty - uy * head * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.lineTo(tx - ux * head - uy * half, ty - uy * head + ux * half);
      ctx.lineTo(tx - ux * head + uy * half, ty - uy * head - ux * half);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath(); ctx.arc(bx, y0, 1.5, 0, 6.2832); ctx.fill();
    }

    if (game) drawGameTop();
    drawBurst();
  }

  // ---------------------------------------------------------------- loop
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    clock += dt;
    ptr.prox += (ptr.target - ptr.prox) * 0.18;
    setMagnet();
    if (game) stepGame(dt);
    else if (clock >= nextKick) {                     // a small random "thermal" kick
      nextKick = clock + 1.8 + 1.8 * Math.random();
      pluck(2 + Math.random() * (N - 4), KICK);
    }
    stepParts(dt);
    advance(dt * TIME_SCALE);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || paused || !visible || (reduceMQ.matches && !game)) return;
    running = true; last = 0; raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  // ---------------------------------------------------------------- interaction
  function locate(e) {
    var r = canvas.getBoundingClientRect();
    ptr.x = Math.min(N - 1, Math.max(0, (e.clientX - r.left - off) / s - 0.5));
    ptr.py = e.clientY - r.top;
    if (game) { game.target = xToField(e.clientX - r.left); game.started = true; }
  }
  canvas.addEventListener("pointermove", function (e) { locate(e); if (!game) ptr.target = 1; });
  canvas.addEventListener("pointerdown", function (e) {
    locate(e);
    if (game) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } return; }
    ptr.target = 1;
    if (!running) return;
    pluck(ptr.x, PLUCK);
    ripples.push([xOf(ptr.x), y0 - 0.55 * L, performance.now()]);
  });
  canvas.addEventListener("pointerleave", function () { ptr.target = 0; });
  canvas.addEventListener("pointercancel", function () { ptr.target = 0; });
  canvas.addEventListener("keydown", function (e) {
    if (game) {
      var fs = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") game.target = Math.max(0, game.target - fs);
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") game.target = Math.min(game.range, game.target + fs);
      else if (e.key === "Home") game.target = 0;
      else if (e.key === "End") game.target = game.range;
      else if (e.key === "Escape") { endGame(false); if (gameBtn) gameBtn.focus(); return; }
      else return;
      game.started = true;
      e.preventDefault();
      return;
    }
    var step = e.shiftKey ? 6 : 2;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (ptr.target === 0) { ptr.x = N / 2; ptr.py = y0 - L - 30; }
      ptr.x = Math.min(N - 1, Math.max(0, ptr.x + (e.key === "ArrowLeft" ? -step : step)));
      ptr.target = 1;
    } else if (e.key === "Enter" || e.key === " ") {
      var at = ptr.target ? ptr.x : N / 2;
      pluck(at, PLUCK);
      ripples.push([xOf(at), y0 - 0.55 * L, performance.now()]);
    } else if (e.key === "Escape") {
      ptr.target = 0; return;
    } else return;
    e.preventDefault();
  });
  canvas.addEventListener("blur", function () { ptr.target = 0; });

  if (gameBtn) gameBtn.addEventListener("click", function () {
    if (game && game.phase !== "done") endGame(false); else startGame();
  });

  function setPaused(p) {
    paused = p;
    if (toggle) {
      toggle.textContent = p ? "Play" : "Pause";
      toggle.setAttribute("aria-pressed", p ? "true" : "false");
    }
    if (p) stop(); else start();
  }
  if (toggle) toggle.addEventListener("click", function () { setPaused(!paused); });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }, { threshold: 0 }).observe(canvas);
  }

  function staticFrame() {
    // a still picture for reduced motion: a wave packet partway down the chain
    for (var i = 0; i < 14; i++) draw();
  }
  function onReduceChange() {
    if (reduceMQ.matches && !game) { stop(); if (toggle) toggle.hidden = true; staticFrame(); }
    else { if (toggle) toggle.hidden = false; start(); }
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", onReduceChange);

  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var r = canvas.getBoundingClientRect();
      if (Math.abs(r.width - W) < 2 && Math.abs(r.height - H) < 2) return;
      setup(); if (running) draw(); else staticFrame();
    }, 150);
  });

  setup();
  if (reduceMQ.matches) { if (toggle) toggle.hidden = true; staticFrame(); }
  else { draw(); start(); }
})();
