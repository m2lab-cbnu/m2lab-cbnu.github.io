/* Spin-wave toy for the M² Lab hero.
 *
 * A chain of exchange-coupled spins. Each spin's small transverse magnetization is
 * psi_n = m_x + i m_z, following the linearized Landau–Lifshitz–Gilbert equation
 *
 *   dpsi_n/dt = -i [ w0 psi_n + J (2 psi_n - psi_{n-1} - psi_{n+1}) ] - gamma_n psi_n + i f_n(t)
 *
 * (exchange dispersion w(k) = w0 + 2J(1 - cos k)). The ends reflect, so pulses come back
 * as echoes. Three things drive the chain through f_n:
 *   - the gold antenna, which sends a short microwave pulse every few seconds;
 *   - the pointer, which acts like a small magnet: nearby spins lean toward it, and
 *     moving it stirs up waves;
 *   - a click or tap, which plucks the chain and launches a wave packet both ways.
 * Arrows are coloured by precession phase; their tips leave short trails that trace
 * the precession cones.
 */
(function () {
  "use strict";
  var canvas = document.getElementById("spinwave");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var trail = document.createElement("canvas");
  var tctx = trail.getContext("2d");
  var toggle = document.getElementById("sim-toggle");
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // ---- physics (dimensionless) ----
  var W0 = 1.0, J = 2.0;
  var GAMMA = 0.03, GAMMA_EDGE = 0.06, EDGE = 3;
  var OMEGA = 1.6;                                   // antenna carrier: k ~ 0.56 rad/spin
  var PULSE_EVERY = 13, PULSE_WIDTH = 2.2, PULSE_AMP = 0.4;
  var PLUCK = 0.85, PLUCK_SIGMA = 1.3;
  var MAG_SIGMA = 2.4, MAG_STRENGTH = 0.55;
  var TIME_SCALE = 3.2, H_STEP = 0.03;
  // ---- drawing ----
  var A_REF = 0.28, TH_MAX = 0.58;
  var BETA = 0.5, CB = Math.cos(BETA), SB = Math.sin(BETA);
  var BASE = [0, 212, 255];
  var PALETTE = [[0, 212, 255], [140, 124, 255], [255, 111, 181], [255, 196, 74]];

  var W = 0, H = 0, dpr = 1, N = 0, s = 0, L = 0, y0 = 0, off = 0, antenna = 0;
  var re, im, gam, ga, mag, k1r, k1i, k2r, k2i, k3r, k3i, k4r, k4i, tr, ti;
  var t = 0, nextPulse = 0, pulseCentre = -1e9;
  var ptr = { x: 0, active: false, prox: 0, target: 0, py: 0 };
  var ripples = [];                                  // click feedback: [x, y, startTime]
  var running = false, paused = false, visible = true, last = 0, raf = 0;

  function alloc(n) {
    var F = function () { return new Float64Array(n); };
    re = F(); im = F(); gam = F(); ga = F(); mag = F();
    k1r = F(); k1i = F(); k2r = F(); k2i = F(); k3r = F(); k3i = F(); k4r = F(); k4i = F(); tr = F(); ti = F();
  }

  function envelope(time) {
    var u = (time - pulseCentre) / PULSE_WIDTH;
    return u > -4 && u < 4 ? Math.exp(-u * u) : 0;
  }

  function setMagnet() {
    var strength = MAG_STRENGTH * ptr.prox, inv = 1 / (2 * MAG_SIGMA * MAG_SIGMA);
    for (var n = 0; n < N; n++) {
      var d = ptr.x - n;
      mag[n] = strength > 1e-4 ? strength * (d / MAG_SIGMA) * Math.exp(-d * d * inv) : 0;
    }
  }

  function deriv(xr, xi, time, outR, outI) {
    var e = envelope(time) * PULSE_AMP, c = Math.cos(OMEGA * time), sn = Math.sin(OMEGA * time);
    for (var n = 0; n < N; n++) {
      var l = n > 0 ? n - 1 : n, r = n < N - 1 ? n + 1 : n;
      var hr = W0 * xr[n] + J * (2 * xr[n] - xr[l] - xr[r]);
      var hi = W0 * xi[n] + J * (2 * xi[n] - xi[l] - xi[r]);
      // -i*H*psi - gamma*psi + i*f, with f = antenna*exp(-i*OMEGA*t) + magnet (real)
      var fa = e * ga[n];
      outR[n] = hi - gam[n] * xr[n] + fa * sn;
      outI[n] = -hr - gam[n] * xi[n] + fa * c + mag[n];
    }
  }

  function rk4(h) {
    var n;
    deriv(re, im, t, k1r, k1i);
    for (n = 0; n < N; n++) { tr[n] = re[n] + 0.5 * h * k1r[n]; ti[n] = im[n] + 0.5 * h * k1i[n]; }
    deriv(tr, ti, t + 0.5 * h, k2r, k2i);
    for (n = 0; n < N; n++) { tr[n] = re[n] + 0.5 * h * k2r[n]; ti[n] = im[n] + 0.5 * h * k2i[n]; }
    deriv(tr, ti, t + 0.5 * h, k3r, k3i);
    for (n = 0; n < N; n++) { tr[n] = re[n] + h * k3r[n]; ti[n] = im[n] + h * k3i[n]; }
    deriv(tr, ti, t + h, k4r, k4i);
    for (n = 0; n < N; n++) {
      re[n] += h / 6 * (k1r[n] + 2 * k2r[n] + 2 * k3r[n] + k4r[n]);
      im[n] += h / 6 * (k1i[n] + 2 * k2i[n] + 2 * k3i[n] + k4i[n]);
    }
    t += h;
    if (t >= nextPulse) { pulseCentre = t + 2.5 * PULSE_WIDTH; nextPulse = t + PULSE_EVERY; }
  }

  function advance(simTime) {
    var steps = Math.max(1, Math.ceil(simTime / H_STEP)), h = simTime / steps;
    for (var i = 0; i < steps; i++) rk4(h);
  }

  function pluck(at) {
    var phase = Math.random() * 6.2832, cr = Math.cos(phase), ci = Math.sin(phase);
    var inv = 1 / (2 * PLUCK_SIGMA * PLUCK_SIGMA);
    for (var n = 0; n < N; n++) {
      var d = n - at, g = PLUCK * Math.exp(-d * d * inv);
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
    y0 = H * 0.8;
    antenna = Math.max(3, Math.round(N * 0.12));
    alloc(N);
    for (var n = 0; n < N; n++) {
      var e = Math.min(n, N - 1 - n);
      gam[n] = GAMMA + (e < EDGE ? GAMMA_EDGE * (EDGE - e) / EDGE : 0);
      var d = n - antenna; ga[n] = Math.exp(-d * d / 1.28);
    }
    t = 0; nextPulse = 0; ptr.prox = ptr.target = 0; setMagnet();
    advance(9);                                 // first pulse already on its way at load
  }

  function xOf(n) { return off + (n + 0.5) * s; }

  function phaseColour(phi) {
    var u = ((phi / 6.2832) % 1 + 1) % 1 * PALETTE.length, i = Math.floor(u), f = u - i;
    var a = PALETTE[i % PALETTE.length], b = PALETTE[(i + 1) % PALETTE.length];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  var tipsX = [], tipsY = [], depth = [], cols = [], amps = [], order = [];
  function draw() {
    var n;
    // fade the tip trails, then add this frame's tips
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.globalCompositeOperation = "destination-out";
    tctx.fillStyle = "rgba(0,0,0,0.14)";
    tctx.fillRect(0, 0, W, H);
    tctx.globalCompositeOperation = "source-over";

    for (n = 0; n < N; n++) {
      var amp = Math.hypot(re[n], im[n]);
      var th = TH_MAX * Math.tanh(amp / A_REF);
      var ph = Math.atan2(im[n], re[n]);
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
        tctx.fillStyle = "rgba(" + (cols[n][0] | 0) + "," + (cols[n][1] | 0) + "," + (cols[n][2] | 0) + "," + (0.25 + 0.6 * m).toFixed(2) + ")";
        tctx.beginPath(); tctx.arc(tipsX[n], tipsY[n], 1.7, 0, 6.2832); tctx.fill();
      }
    }
    order.length = N;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // waveguide strip
    var hw = 0.5 * L * SB;
    ctx.fillStyle = "rgba(120,175,235,0.09)";
    ctx.fillRect(0, y0 - hw, W, 2 * hw);
    ctx.strokeStyle = "rgba(150,195,240,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y0 - hw + 0.5); ctx.lineTo(W, y0 - hw + 0.5);
    ctx.moveTo(0, y0 + hw - 0.5); ctx.lineTo(W, y0 + hw - 0.5); ctx.stroke();

    // antenna: brighter while it is sending a pulse
    var glow = envelope(t), ax = xOf(antenna);
    ctx.save();
    ctx.shadowColor = "rgba(255,196,74,0.9)";
    ctx.shadowBlur = 4 + 18 * glow;
    ctx.fillStyle = "rgba(217,164,65," + (0.75 + 0.25 * glow).toFixed(2) + ")";
    ctx.fillRect(ax - 0.24 * s, y0 - 1.7 * hw, 0.48 * s, 3.4 * hw);
    ctx.restore();

    // the pointer acts as a small magnet
    if (ptr.prox > 0.02) {
      var mx = xOf(ptr.x), my = Math.min(Math.max(ptr.py, 12), y0 - L - 6);
      var g = ctx.createRadialGradient(mx, my, 0, mx, my, 26);
      g.addColorStop(0, "rgba(255,255,255," + (0.55 * ptr.prox).toFixed(2) + ")");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
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
      var alpha = 0.5 + 0.5 * dd;
      var c = cols[n], rgba = "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + alpha.toFixed(2) + ")";
      var dx = tx - bx, dy = ty - y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      var head = Math.min(8, len * 0.2), half = head * 0.5;
      ctx.strokeStyle = rgba; ctx.fillStyle = rgba;
      ctx.lineWidth = 1.3 + 0.9 * dd + 0.6 * amps[n];
      ctx.beginPath(); ctx.moveTo(bx, y0); ctx.lineTo(tx - ux * head * 0.8, ty - uy * head * 0.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.lineTo(tx - ux * head - uy * half, ty - uy * head + ux * half);
      ctx.lineTo(tx - ux * head + uy * half, ty - uy * head - ux * half);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(232,241,250,0.35)";
      ctx.beginPath(); ctx.arc(bx, y0, 1.5, 0, 6.2832); ctx.fill();
    }
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    ptr.prox += (ptr.target - ptr.prox) * 0.18;
    setMagnet();
    advance(dt * TIME_SCALE);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || paused || reduceMQ.matches || !visible) return;
    running = true; last = 0; raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  // ---- interaction ----
  function locate(e) {
    var r = canvas.getBoundingClientRect();
    ptr.x = Math.min(N - 1, Math.max(0, (e.clientX - r.left - off) / s - 0.5));
    ptr.py = e.clientY - r.top;
  }
  canvas.addEventListener("pointermove", function (e) {
    locate(e); ptr.target = 1;
  });
  canvas.addEventListener("pointerdown", function (e) {
    locate(e); ptr.target = 1;
    if (!running) return;
    pluck(ptr.x);
    ripples.push([xOf(ptr.x), y0 - 0.55 * L, performance.now()]);
  });
  canvas.addEventListener("pointerleave", function () { ptr.target = 0; });
  canvas.addEventListener("pointercancel", function () { ptr.target = 0; });
  canvas.addEventListener("keydown", function (e) {
    var step = e.shiftKey ? 6 : 2;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (ptr.target === 0) { ptr.x = N / 2; ptr.py = y0 - L - 30; }
      ptr.x = Math.min(N - 1, Math.max(0, ptr.x + (e.key === "ArrowLeft" ? -step : step)));
      ptr.target = 1;
    } else if (e.key === "Enter" || e.key === " ") {
      var at = ptr.target ? ptr.x : N / 2;
      pluck(at);
      ripples.push([xOf(at), y0 - 0.55 * L, performance.now()]);
    } else if (e.key === "Escape") {
      ptr.target = 0; return;
    } else return;
    e.preventDefault();
  });
  canvas.addEventListener("blur", function () { ptr.target = 0; });

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
    // a still picture for reduced motion: one pulse partway down the chain
    for (var i = 0; i < 14; i++) draw();
  }
  function onReduceChange() {
    if (reduceMQ.matches) { stop(); if (toggle) toggle.hidden = true; staticFrame(); }
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

  // touch screens cannot hover: adjust the hint
  var hint = document.getElementById("sim-hint");
  if (hint && window.matchMedia && window.matchMedia("(hover: none)").matches) {
    var span = hint.querySelector("span");
    if (span && hint.getAttribute("data-touch")) span.textContent = hint.getAttribute("data-touch");
  }

  setup();
  if (reduceMQ.matches) { if (toggle) toggle.hidden = true; advance(14); staticFrame(); }
  else { draw(); start(); }
})();
