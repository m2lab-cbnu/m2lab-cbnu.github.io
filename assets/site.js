/* M² Lab — small page behaviours: menu, section highlighting, publication filter,
   photo viewer and the "today" marker on the project timeline. */
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

  /* Publications: counts and "led by" filter */
  var all = document.getElementById("all-publications");
  if (all) {
    var items = all.querySelectorAll(".pub-list li");
    var published = all.querySelectorAll(".pub-list li:not([data-status])").length;
    var led = all.querySelectorAll(".pub-list li[data-lead]:not([data-status])").length;
    document.querySelectorAll("[data-count='published']").forEach(function (el) { el.textContent = published; });
    document.querySelectorAll("[data-count='all']").forEach(function (el) { el.textContent = items.length; });
    document.querySelectorAll("[data-count='led']").forEach(function (el) { el.textContent = led; });
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

  /* Timeline: place the gold "today" marker */
  var tl = document.querySelector(".tl");
  if (tl) {
    var start = parseFloat(tl.getAttribute("data-start")), end = parseFloat(tl.getAttribute("data-end"));
    var d = new Date(), y = d.getFullYear() + (d.getMonth() + d.getDate() / 31) / 12;
    var pct = Math.max(0, Math.min(100, (y - start) / (end - start) * 100));
    tl.style.setProperty("--now", pct.toFixed(2) + "%");
  }

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
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
