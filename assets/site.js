/* M² Lab — small page behaviours: menu, section highlighting, publication filter,
   before/after photo comparison and the photo viewer. */
(function () {
  "use strict";

  /* Mobile menu */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) { links.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("is-open")) {
        links.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); toggle.focus();
      }
    });
  }

  /* Highlight the section in view */
  var navAnchors = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
  var sections = navAnchors.map(function (a) { return document.querySelector(a.getAttribute("href")); }).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    var inView = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { inView[en.target.id] = en.isIntersecting; });
      var current = null;   // stays null over the hero and the highlights row
      sections.forEach(function (s) { if (inView[s.id]) current = s.id; });
      navAnchors.forEach(function (a) {
        if (a.getAttribute("href") === "#" + current) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* Publications: "first or corresponding author" filter */
  var all = document.getElementById("all-publications");
  if (all) {
    var buttons = all.querySelectorAll(".seg button");
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        buttons.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        all.setAttribute("data-filter", b.getAttribute("data-filter"));
      });
    });
    var openIfTargeted = function () { if (location.hash === "#all-publications") all.open = true; };
    openIfTargeted();
    window.addEventListener("hashchange", openIfTargeted);
  }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Before/after photo comparison. Drag anywhere on the photo (mouse), swipe sideways (touch),
     or use the arrow keys on the hidden range input, which also carries the value for screen readers. */
  document.querySelectorAll(".compare").forEach(function (c) {
    var range = c.querySelector("input[type=range]");
    if (!range) return;
    var dragging = false, moved = false, touched = false;
    var set = function (v) {
      v = Math.max(0, Math.min(100, v));
      range.value = Math.round(v);
      c.style.setProperty("--pos", v.toFixed(2) + "%");
      c.classList.toggle("hide-before", v < 24);
      c.classList.toggle("hide-after", v > 76);
    };
    var at = function (e) { var r = c.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
    range.addEventListener("input", function () { touched = true; set(+range.value); });
    c.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      touched = true; dragging = true; moved = false;
      c.classList.add("is-dragging");
      try { c.setPointerCapture(e.pointerId); } catch (err) {}
      // a mouse jumps straight to the click; a finger waits to see whether it is swiping sideways or scrolling
      if (e.pointerType !== "touch") set(at(e));
    });
    c.addEventListener("pointermove", function (e) { if (dragging) { moved = true; set(at(e)); } });
    c.addEventListener("pointerup", function (e) {
      if (dragging && !moved && e.pointerType === "touch") set(at(e));   // a tap moves the line there
      dragging = false; c.classList.remove("is-dragging");
    });
    c.addEventListener("pointercancel", function () { dragging = false; c.classList.remove("is-dragging"); });
    set(+range.value);

    // a single gentle wiggle the first time the photo comes into view, so people see that it moves
    if (!reduce && "IntersectionObserver" in window && window.requestAnimationFrame) {
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        var t0 = null;
        var step = function (t) {
          if (touched) return;
          if (t0 === null) t0 = t;
          var p = (t - t0) / 1800;
          if (p >= 1) { set(50); return; }
          set(50 + 16 * Math.sin(p * Math.PI * 2) * (1 - p));
          requestAnimationFrame(step);
        };
        setTimeout(function () { requestAnimationFrame(step); }, 500);
      }, { threshold: 0.6 });
      io.observe(c);
    }
  });

  /* Photo viewer */
  var dlg = document.getElementById("lightbox");
  if (dlg && typeof dlg.showModal === "function") {
    var img = dlg.querySelector("img"), cap = dlg.querySelector("figcaption"), opener = null;
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-full]");
      if (!btn) return;
      e.preventDefault();
      opener = btn;
      img.src = btn.getAttribute("data-full");
      var thumb = btn.querySelector("img");
      img.alt = thumb ? thumb.alt : "";
      cap.textContent = btn.getAttribute("data-caption") || "";
      dlg.showModal();
    });
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.closest(".lb-close")) dlg.close(); });
    dlg.addEventListener("close", function () { img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; if (opener) opener.focus(); });
  } else if (dlg) {
    // very old browsers: open the large photo directly
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-full]");
      if (btn) { e.preventDefault(); window.open(btn.getAttribute("data-full"), "_blank", "noopener"); }
    });
  }

  /* Looping figure videos: play only while visible, never under reduced motion; click toggles */
  document.querySelectorAll("video[data-inview-play]").forEach(function (v) {
    var userPaused = false;
    v.addEventListener("click", function () { userPaused = !v.paused; if (v.paused) v.play(); else v.pause(); });
    if (reduce || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !userPaused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.25 }).observe(v);
  });

  /* Projects: a quantum state leaves one qubit, becomes a magnon in the YIG sphere and arrives
     at a second qubit. Geometry matches tx_svg.py. Plays once when the drawing comes into view
     (never by itself under reduced motion); the button plays it again. */
  (function () {
    var fig = document.getElementById("tx");
    if (!fig || !window.requestAnimationFrame || !document.querySelector) return;
    var btn = document.getElementById("tx-play");
    var steps = fig.querySelectorAll(".tx-step");
    var Y = 170, NS = "http://www.w3.org/2000/svg";
    var MEANDER = [[108, Y], [122, Y], [122, 130], [142, 130], [142, 210], [162, 210], [162, 130], [182, 130], [182, 210], [202, 210], [202, Y], [262, Y]];

    function track(pts) {            // polyline with cumulative lengths
      var L = [0];
      for (var i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts: pts, L: L, len: L[L.length - 1] };
    }
    function at(tr, s) {             // point at distance s along a track
      s = Math.max(0, Math.min(tr.len, s));
      for (var i = 1; i < tr.L.length; i++) if (tr.L[i] >= s) {
        var f = (s - tr.L[i - 1]) / ((tr.L[i] - tr.L[i - 1]) || 1), p = tr.pts[i - 1], q = tr.pts[i];
        return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
      }
      return tr.pts[tr.pts.length - 1];
    }
    var arts = Array.prototype.map.call(fig.querySelectorAll(".tx-svg"), function (svg) {
      var a = +svg.getAttribute("data-a"), c = +svg.getAttribute("data-c"), b = +svg.getAttribute("data-b");
      var inA = [[a + 68, Y]].concat(MEANDER.map(function (p) { return [a + p[0], p[1]]; }), [[a + 280, Y], [c - 64, Y], [c, Y]]);
      var inB = [[c, Y], [c + 64, Y], [b, Y]].concat(MEANDER.slice().reverse().map(function (p) { return [b + 280 - p[0], p[1]]; }), [[b + 280 - 68, Y]]);
      var q = svg.querySelectorAll(".tx-qglow"), pk = svg.querySelector(".tx-packet");
      return {
        c: c, A: track(inA), B: track(inB), qa: q[0], qb: q[1],
        glow: svg.querySelector(".tx-mglow"), cone: svg.querySelector(".tx-cone"),
        m: svg.querySelector(".tx-m"), head: svg.querySelector(".tx-mhead"),
        pk: pk, dots: pk.querySelectorAll("circle")
      };
    });
    if (!arts.length) return;

    var ramp = function (t, t0, t1) { return Math.max(0, Math.min(1, (t - t0) / (t1 - t0))); };
    var ease = function (x) { return x * x * (3 - 2 * x); };
    var DUR = 6800, start = 0, raf = 0, played = false;

    function draw(t, still) {
      // still: reduced-motion version, the same three stages without movement
      var qa = still ? (t < 1600 ? 1 : 0) : ease(ramp(t, 0, 600)) * (1 - ramp(t, 900, 1500));
      var mag = still ? (t >= 1600 && t < 3400 ? 1 : 0) : ease(ramp(t, 2150, 2550)) * (1 - ease(ramp(t, 3750, 4350)));
      var qb = still ? (t >= 3400 ? 1 : 0) : ease(ramp(t, 5350, 5900)) * (1 - 0.55 * ramp(t, 6200, DUR));
      var sA = still ? -1 : (t - 750) / 1500, sB = still ? -1 : (t - 3850) / 1500;
      var th = mag * 0.6, ph = still ? -0.6 : -t / 1000 * 2 * Math.PI * 1.3;
      arts.forEach(function (r) {
        r.qa.setAttribute("opacity", qa.toFixed(3));
        r.qb.setAttribute("opacity", qb.toFixed(3));
        r.glow.setAttribute("opacity", mag.toFixed(3));
        // magnetisation: precesses about the field (up) with cone angle th, seen slightly from above
        var bx = r.c, by = Y + 4, s = Math.sin(th), k = Math.cos(th);
        var dx = s * Math.cos(ph), dy = -k + 0.35 * s * Math.sin(ph), n = Math.hypot(dx, dy) || 1;
        var ux = dx / n, uy = dy / n;
        r.m.setAttribute("x2", (bx + 34 * dx).toFixed(1)); r.m.setAttribute("y2", (by + 34 * dy).toFixed(1));
        var tx = bx + 46 * dx, ty = by + 46 * dy, hx = bx + 33 * dx, hy = by + 33 * dy;
        r.head.setAttribute("d", "M" + (hx - 7 * uy).toFixed(1) + "," + (hy + 7 * ux).toFixed(1) + " L" + tx.toFixed(1) + "," + ty.toFixed(1) + " L" + (hx + 7 * uy).toFixed(1) + "," + (hy - 7 * ux).toFixed(1) + " Z");
        r.cone.setAttribute("cx", bx); r.cone.setAttribute("cy", (by - 40 * k).toFixed(1));
        r.cone.setAttribute("rx", (40 * s).toFixed(1)); r.cone.setAttribute("ry", (14 * s).toFixed(1));
        r.cone.setAttribute("opacity", (0.8 * mag).toFixed(3));
        // the travelling quantum, with a short trail
        var tr = sA >= 0 && sA <= 1 ? r.A : sB >= 0 && sB <= 1 ? r.B : null;
        if (!tr) { r.pk.setAttribute("opacity", "0"); return; }
        var f = tr === r.A ? sA : sB, d = ease(f) * tr.len;
        r.pk.setAttribute("opacity", Math.min(1, f * 12, (1 - f) * 12).toFixed(3));
        [0, 30, 20, 10, 0].forEach(function (back, i) {   // glow, trail (far to near), core
          var p = at(tr, d - back), el = r.dots[i];
          if (el) { el.setAttribute("cx", p[0].toFixed(1)); el.setAttribute("cy", p[1].toFixed(1)); }
        });
      });
      var on = still ? (t < 1600 ? 0 : t < 3400 ? 1 : 2) : (t < 2200 ? 0 : t < 4300 ? 1 : 2);
      for (var i = 0; i < steps.length; i++) steps[i].classList.toggle("is-on", i === on);
    }

    function play() {
      played = true;
      if (btn) btn.lastChild.textContent = "Send it again";
      cancelAnimationFrame(raf);
      start = 0;
      var frame = function (now) {
        if (!start) start = now;
        var t = now - start;
        draw(Math.min(t, DUR), reduce);
        if (t < DUR) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    if (btn) { btn.hidden = false; btn.addEventListener("click", play); }
    if (!reduce && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !played) { io.disconnect(); setTimeout(play, 350); }
        });
      }, { threshold: 0.6 });
      io.observe(fig.querySelector(".tx-art"));
    }
  })();

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
