/* =====================================================================
   SITE CORE — renders the shared header + footer from config.js,
   applies theme colors/fonts, and handles light/dark + mobile nav.
   You normally don't need to edit this file.
   ===================================================================== */
(function () {
  var S = window.SITE || {};
  var root = document.documentElement;

  /* ---------- storage helpers (never throw) ---------- */
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) { return null; }
  }

  /* ---------- theme tokens from config ---------- */
  var t = S.theme || {};
  if (t.accent) root.style.setProperty("--accent-light", t.accent);
  if (t.accentDark) root.style.setProperty("--accent-dark", t.accentDark);
  if (t.radius) root.style.setProperty("--radius", t.radius);

  /* ---------- heading photo (config.heroImage) ---------- */
  // Absolute URL so the CSS variable resolves the same from every page.
  if (S.heroImage) {
    root.classList.add("has-hero-img");
    root.style.setProperty("--hero-img", 'url("' + new URL(S.heroImage, document.baseURI).href + '")');
  }

  var mode = store("site-mode") || t.defaultMode || "system";
  function applyMode(m) {
    if (m === "light" || m === "dark") root.setAttribute("data-theme", m);
    else root.removeAttribute("data-theme");
  }
  applyMode(mode);

  /* ---------- fonts from config ---------- */
  var f = S.fonts || {};
  var fams = [f.heading, f.body, f.mono].filter(Boolean);
  if (fams.length) {
    var q = fams.map(function (n) {
      return "family=" + encodeURIComponent(n).replace(/%20/g, "+") + ":wght@400;500;600;700";
    }).join("&");
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?" + q + "&display=swap";
    document.head.appendChild(link);
    if (f.heading) root.style.setProperty("--font-heading", '"' + f.heading + '"');
    if (f.body) root.style.setProperty("--font-body", '"' + f.body + '"');
    if (f.mono) root.style.setProperty("--font-mono", '"' + f.mono + '"');
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var here = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ---------- header ---------- */
  function renderHeader() {
    var el = document.getElementById("site-header");
    if (!el) return;
    var links = (S.nav || []).map(function (n) {
      var file = n.href.split("#")[0].toLowerCase();
      var active = file === here ? ' aria-current="page"' : "";
      return '<a href="' + esc(n.href) + '"' + active + ">" + esc(n.label) + "</a>";
    }).join("");
    var cta = S.headerCta
      ? '<a class="btn btn-sm" href="' + esc(S.headerCta.href) + '">' + esc(S.headerCta.label) + "</a>"
      : "";

    el.innerHTML =
      '<div class="header-inner container">' +
        '<a class="brand" href="index.html">' +
          '<span class="brand-mark" aria-hidden="true">' + esc(S.monogram || (S.name || "?").charAt(0)) + "</span>" +
          '<span class="brand-name">' + esc(S.name || "Site") + "</span>" +
        "</a>" +
        '<nav class="nav" id="site-nav" aria-label="Main">' + links + "</nav>" +
        '<div class="header-actions">' +
          '<button class="icon-btn" id="mode-toggle" type="button" aria-label="Toggle light or dark mode">' +
            '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
            '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
          "</button>" +
          cta +
          '<button class="icon-btn menu-btn" id="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="site-nav">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>' +
          "</button>" +
        "</div>" +
      "</div>";

    // light/dark toggle
    document.getElementById("mode-toggle").addEventListener("click", function () {
      var dark = root.getAttribute("data-theme") === "dark" ||
        (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
      var next = dark ? "light" : "dark";
      applyMode(next);
      store("site-mode", next);
    });

    // mobile menu
    var btn = document.getElementById("menu-toggle");
    btn.addEventListener("click", function () {
      var open = el.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    el.querySelectorAll(".nav a").forEach(function (a) {
      a.addEventListener("click", function () { el.classList.remove("open"); });
    });

    // hairline shadow once scrolled
    var onScroll = function () { el.classList.toggle("scrolled", window.scrollY > 4); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- footer ---------- */
  function renderFooter() {
    var el = document.getElementById("site-footer");
    if (!el) return;
    var year = new Date().getFullYear();
    var social = "";
    if (S.linkedin) social += '<a href="' + esc(S.linkedin) + '" target="_blank" rel="noopener">LinkedIn</a>';
    if (S.email) social += '<a href="mailto:' + esc(S.email) + '">Email</a>';
    var credit = S.heroImage && S.heroCredit
      ? ' · <a class="photo-credit" href="' + esc(S.heroCredit.url) + '" target="_blank" rel="noopener">' + esc(S.heroCredit.text) + "</a>"
      : "";
    el.innerHTML =
      '<div class="footer-inner container">' +
        "<p>© " + year + " " + esc(S.name || "") + (S.footerNote ? " · " + esc(S.footerNote) : "") + credit + "</p>" +
        '<div class="footer-links">' + social + "</div>" +
      "</div>";
  }

  /* ---------- fill [data-site] placeholders ---------- */
  // e.g. <span data-site="name"></span>, <a data-site-href="linkedin">
  function fillPlaceholders() {
    document.querySelectorAll("[data-site]").forEach(function (n) {
      var v = S[n.getAttribute("data-site")];
      if (v != null) n.textContent = v;
    });
    document.querySelectorAll("[data-site-href]").forEach(function (n) {
      var key = n.getAttribute("data-site-href");
      var v = S[key];
      if (!v) return;
      n.setAttribute("href", key === "email" ? "mailto:" + v : v);
    });
    document.querySelectorAll("[data-gmail-compose]").forEach(function (n) {
      if (S.email) n.setAttribute("href", "https://mail.google.com/mail/?view=cm&to=" + encodeURIComponent(S.email));
    });
    if (S.name && document.title.indexOf("{name}") > -1) {
      document.title = document.title.replace("{name}", S.name);
    }
  }

  /* ---------- scroll reveal ---------- */
  function reveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (i) { i.classList.add("in"); });
      return;
    }
    // After an element has faded in, mark it "done" so hover effects use quick transitions
    // instead of the slow, delayed reveal transition.
    function finish(el) { el.classList.add("done"); }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add("in");
        io.unobserve(el);
        el.addEventListener("transitionend", function onEnd(ev) {
          if (ev.target === el && ev.propertyName === "opacity") { el.removeEventListener("transitionend", onEnd); finish(el); }
        });
        setTimeout(function () { finish(el); }, 1500); // fallback
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (i) { io.observe(i); });
  }

  /* ---------- gibberish decode on hover ----------
     Hovering a tile/card scrambles its small monospace label into random characters,
     then decodes it left to right (~0.45s). Monospace keeps the width steady.
     Add data-scramble to any element to opt it in; tiles below are wired by default. */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%#&@";
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function scramble(el) {
    if (reduceMotion || !el) return;
    var text = el.getAttribute("data-text");
    if (text == null) { text = el.textContent; el.setAttribute("data-text", text); el.setAttribute("aria-label", text); }
    if (el._raf) cancelAnimationFrame(el._raf);
    else {
      // lock the width while scrambling so proportional fonts don't make neighbors shift
      el.style.minWidth = el.getBoundingClientRect().width + "px";
      el.style.whiteSpace = "nowrap";
    }
    var dur = 450, start = performance.now(), last = 0, out = text;
    function frame(now) {
      var p = Math.min(1, (now - start) / dur);
      if (now - last > 35 || p === 1) {                 // re-roll glyphs ~28×/s: crisp, not a blur
        last = now;
        var done = Math.floor(p * text.length);
        out = "";
        for (var i = 0; i < text.length; i++) {
          var c = text[i];
          if (i < done || !/[A-Za-z0-9]/.test(c)) { out += c; continue; }
          var g = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          out += c === c.toLowerCase() && c !== c.toUpperCase() ? g.toLowerCase() : g;   // keep each letter's case
        }
        el.textContent = out;
      }
      if (p < 1) el._raf = requestAnimationFrame(frame);
      else { el.textContent = text; el._raf = null; el.style.minWidth = ""; el.style.whiteSpace = ""; }
    }
    el._raf = requestAnimationFrame(frame);
  }

  // [hovered element, label inside it that decodes], across every page.
  // Delegated, so cards that pages re-draw on the fly (Markets, Launchpad) keep working.
  var SCRAMBLE = [
    [".facts > div", ".fact-k"],          // Home: quick-facts labels
    [".card.project", ".tag"],            // Home: Work card tags
    [".contact-row", ".contact-k"],       // Home: Email / LinkedIn labels
    [".pin-card", ".pin-sym"],            // Markets: pinned ticker symbols
    ["#em-table tbody tr", ".sym"],       // Markets: table ticker symbols
    [".launch-tile", ".launch-name"],     // Launchpad: tool names
    ["[data-scramble-host]", "[data-scramble]"]
  ];
  var hostSel = SCRAMBLE.map(function (p) { return p[0]; }).join(",");

  function onEnter(e) {
    var host = e.target.closest && e.target.closest(hostSel);
    if (!host || (e.relatedTarget && host.contains(e.relatedTarget))) return;   // moving inside the same tile
    for (var i = 0; i < SCRAMBLE.length; i++) {
      if (host.matches(SCRAMBLE[i][0])) { scramble(host.querySelector(SCRAMBLE[i][1])); return; }
    }
  }

  function wireScramble() {
    document.addEventListener("mouseover", onEnter);
    document.addEventListener("focusin", onEnter);
  }

  function init() {
    renderHeader();
    renderFooter();
    fillPlaceholders();
    reveal();
    wireScramble();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.SiteUtil = { esc: esc };
})();
