/* Live spin-wave simulation for the M² Lab hero.
 *
 * A chain of exchange-coupled spins is driven by a microwave antenna (gold).
 * Each spin's small transverse magnetization is psi_n = m_x + i m_z and obeys the
 * linearized Landau–Lifshitz–Gilbert equation
 *
 *   dpsi_n/dt = -i [ w0 psi_n + J (2 psi_n - psi_{n-1} - psi_{n+1}) ] - gamma_n psi_n
 *               + i F g_n exp(-i W t)
 *
 * giving the exchange dispersion w(k) = w0 + 2J(1 - cos k). Driving at W > w0 launches
 * propagating spin waves that decay through Gilbert-like damping; the chain ends absorb
 * (no reflections). The pointer, a tap, or the arrow keys move the antenna.
 */
(function () {
  "use strict";
  var canvas = document.getElementById("spinwave");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var toggle = document.getElementById("sim-toggle");
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  // physics (dimensionless)
  // OMEGA sits just above w0, so k ~ 0.3 rad/site (wavelength ~21 spins): long, smooth waves
  var W0 = 1.0, J = 1.6, OMEGA = 1.143, GAMMA0 = 0.015, FORCE = 0.12, SIGMA = 0.8;
  var EDGE = 14, GAMMA_EDGE = 0.6;
  var TIME_SCALE = 3.5;          // simulation time units per real second
  var H_STEP = 0.025;            // RK4 step
  // drawing
  var BETA = 0.48, CB = Math.cos(BETA), SB = Math.sin(BETA);
  var TH_MAX = 0.55;             // max cone half-angle (rad); L*sin(TH_MAX)*k < spacing, so tips never fold over

  var W = 0, H = 0, dpr = 1, N = 0, s = 0, L = 0, y0 = 0, off = 0;
  var re, im, gam, g, k1r, k1i, k2r, k2i, k3r, k3i, k4r, k4i, tr, ti;
  var t = 0, a = 0, aTarget = 0, A0 = 1;
  var running = false, paused = false, visible = true, last = 0, raf = 0;

  function alloc(n) {
    re = new Float64Array(n); im = new Float64Array(n); gam = new Float64Array(n); g = new Float64Array(n);
    k1r = new Float64Array(n); k1i = new Float64Array(n); k2r = new Float64Array(n); k2i = new Float64Array(n);
    k3r = new Float64Array(n); k3i = new Float64Array(n); k4r = new Float64Array(n); k4i = new Float64Array(n);
    tr = new Float64Array(n); ti = new Float64Array(n);
  }

  function setProfile() {
    var inv = 1 / (2 * SIGMA * SIGMA);
    for (var n = 0; n < N; n++) { var d = n - a; g[n] = Math.exp(-d * d * inv); }
  }

  function setDamping() {
    for (var n = 0; n < N; n++) {
      var e = Math.min(n, N - 1 - n), r = e < EDGE ? (EDGE - e) / EDGE : 0;
      gam[n] = GAMMA0 + GAMMA_EDGE * r * r;
    }
  }

  function deriv(xr, xi, time, outR, outI) {
    var c = Math.cos(OMEGA * time), sn = Math.sin(OMEGA * time);
    for (var n = 0; n < N; n++) {
      var l = n > 0 ? n - 1 : n, r = n < N - 1 ? n + 1 : n;
      var hr = W0 * xr[n] + J * (2 * xr[n] - xr[l] - xr[r]);
      var hi = W0 * xi[n] + J * (2 * xi[n] - xi[l] - xi[r]);
      outR[n] = hi - gam[n] * xr[n] + FORCE * g[n] * sn;
      outI[n] = -hr - gam[n] * xi[n] + FORCE * g[n] * c;
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
  }

  function advance(simTime) {
    var steps = Math.max(1, Math.ceil(simTime / H_STEP)), h = simTime / steps;
    for (var i = 0; i < steps; i++) rk4(h);
  }

  function setup() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    s = W < 560 ? 15 : W < 1000 ? 19 : 22;
    var oldN = N, oldA = a;
    N = Math.max(18, Math.floor(W / s));
    off = (W - N * s) / 2;
    L = Math.min(H * 0.55, 110);
    y0 = H * 0.78;
    alloc(N);
    a = aTarget = oldN ? Math.min(N - 4, Math.max(3, oldA * N / oldN)) : Math.max(4, Math.round(N * 0.22));
    setProfile(); setDamping();
    t = 0;
    for (var i = 0; i < 6000; i++) rk4(0.05);   // settle into the driven steady state (300 time units)
    var m = 0;
    for (var n = 0; n < N; n++) m = Math.max(m, Math.hypot(re[n], im[n]));
    A0 = m || 1;
  }

  function xOf(n) { return off + (n + 0.5) * s; }

  var tipsX = [], tipsY = [], depth = [], order = [];
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // waveguide strip (lies in the y = 0 plane, seen from slightly above)
    var hw = 0.5 * L * SB;
    ctx.fillStyle = "rgba(120,175,235,0.09)";
    ctx.fillRect(0, y0 - hw, W, 2 * hw);
    ctx.strokeStyle = "rgba(150,195,240,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y0 - hw + 0.5); ctx.lineTo(W, y0 - hw + 0.5);
    ctx.moveTo(0, y0 + hw - 0.5); ctx.lineTo(W, y0 + hw - 0.5); ctx.stroke();

    // antenna: gold strip line across the waveguide, glowing with the drive phase
    var ax = off + (a + 0.5) * s, glow = 0.5 + 0.5 * Math.sin(OMEGA * t);
    ctx.save();
    ctx.shadowColor = "rgba(217,164,65,0.75)";
    ctx.shadowBlur = 6 + 10 * glow;
    ctx.fillStyle = "rgba(217,164,65," + (0.78 + 0.22 * glow).toFixed(3) + ")";
    ctx.fillRect(ax - 0.24 * s, y0 - 1.7 * hw, 0.48 * s, 3.4 * hw);
    ctx.restore();

    // spins
    var n;
    for (n = 0; n < N; n++) {
      var amp = Math.hypot(re[n], im[n]);
      var th = TH_MAX * Math.min(1, amp / A0);   // linear in amplitude, so damping is visible
      var ph = Math.atan2(im[n], re[n]);
      var st = Math.sin(th);
      var mx = st * Math.cos(ph), mz = st * Math.sin(ph), my = Math.cos(th);
      tipsX[n] = xOf(n) + L * mx;
      tipsY[n] = y0 - L * CB * my + L * SB * mz;
      depth[n] = mz / Math.sin(TH_MAX);       // -1 (back) .. 1 (front)
      order[n] = n;
    }
    order.length = N;

    // wavefront through the arrow tips
    ctx.strokeStyle = "rgba(0,212,255,0.32)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tipsX[0], tipsY[0]);
    for (n = 1; n < N - 1; n++) {
      var mxp = (tipsX[n] + tipsX[n + 1]) / 2, myp = (tipsY[n] + tipsY[n + 1]) / 2;
      ctx.quadraticCurveTo(tipsX[n], tipsY[n], mxp, myp);
    }
    ctx.lineTo(tipsX[N - 1], tipsY[N - 1]);
    ctx.stroke();

    order.sort(function (i, j) { return depth[i] - depth[j]; });
    for (var q = 0; q < N; q++) {
      n = order[q];
      var bx = xOf(n), by = y0, tx = tipsX[n], ty = tipsY[n];
      var d = 0.5 + 0.5 * depth[n];               // 0 back .. 1 front
      var alpha = 0.45 + 0.55 * d;
      var dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      var head = Math.min(8, len * 0.2), half = head * 0.48;
      ctx.strokeStyle = "rgba(0,212,255," + alpha.toFixed(3) + ")";
      ctx.lineWidth = 1.3 + 0.9 * d;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx - ux * head * 0.8, ty - uy * head * 0.8); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - ux * head - uy * half, ty - uy * head + ux * half);
      ctx.lineTo(tx - ux * head + uy * half, ty - uy * head - ux * half);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(232,241,250,0.35)";
      ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, 6.2832); ctx.fill();
    }
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (Math.abs(aTarget - a) > 0.01) { a += (aTarget - a) * 0.12; setProfile(); }
    advance(dt * TIME_SCALE);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || paused || reduceMQ.matches || !visible) return;
    running = true; last = 0; raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

  function moveTo(clientX) {
    var r = canvas.getBoundingClientRect();
    aTarget = Math.min(N - 4, Math.max(3, (clientX - r.left - off) / s - 0.5));
    if (!running) { a = aTarget; setProfile(); advance(60); draw(); }
  }

  canvas.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") moveTo(e.clientX); });
  canvas.addEventListener("pointerdown", function (e) { moveTo(e.clientX); });
  canvas.addEventListener("keydown", function (e) {
    var step = e.shiftKey ? 6 : 2;
    if (e.key === "ArrowLeft") aTarget = Math.max(3, aTarget - step);
    else if (e.key === "ArrowRight") aTarget = Math.min(N - 4, aTarget + step);
    else return;
    e.preventDefault();
    if (!running) { a = aTarget; setProfile(); advance(60); draw(); }
  });

  function setPaused(p) {
    paused = p;
    if (toggle) {
      toggle.textContent = p ? "Play animation" : "Pause animation";
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

  function onReduceChange() {
    if (reduceMQ.matches) { stop(); if (toggle) toggle.hidden = true; draw(); }
    else { if (toggle) toggle.hidden = false; start(); }
  }
  if (reduceMQ.addEventListener) reduceMQ.addEventListener("change", onReduceChange);

  var rt = 0;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var r = canvas.getBoundingClientRect();
      if (Math.abs(r.width - W) < 2 && Math.abs(r.height - H) < 2) return;
      setup(); draw();
    }, 150);
  });

  setup();
  draw();
  if (reduceMQ.matches && toggle) toggle.hidden = true;
  start();
})();
