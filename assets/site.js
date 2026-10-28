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

  /* Footer year */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
