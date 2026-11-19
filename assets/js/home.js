/* Builds the Home page from window.CONTENT (content.js).
   Runs at the end of <body>, before site.js's reveal animations start. */
(function () {
  var C = window.CONTENT;
  if (!C) return;
  var esc = window.SiteUtil.esc;

  // escape everything, then turn **text** into bold
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function set(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
  function delay(i) { return i % 3 ? ' style="--d:' + (i % 3) * 0.05 + 's"' : ""; }

  if (C.hero) set("hero-lead", fmt(C.hero.lead));

  set("facts", (C.facts || []).map(function (f) {
    return '<div><span class="fact-k">' + esc(f.k) + '</span><span class="fact-v">' + esc(f.v) + "</span></div>";
  }).join(""));

  if (C.about) {
    set("about-head", '<p class="eyebrow">' + esc(C.about.eyebrow) + "</p><h2>" + esc(C.about.title) + "</h2>");
    set("about-grid", C.about.cards.map(function (c, i) {
      var cls = "about-card reveal" + (c.wide ? " about-wide" : "") + (c.full ? " about-full" : "");
      var body = c.chips
        ? '<ul class="chips">' + c.chips.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"
        : '<ul class="about-list">' + c.items.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") + "</ul>";
      return '<article class="' + cls + '"' + delay(i) + '><h3 class="about-k">' + esc(c.title) + "</h3>" + body + "</article>";
    }).join(""));
  }

  if (C.work) {
    set("work-head", '<p class="eyebrow">' + esc(C.work.eyebrow) + "</p><h2>" + esc(C.work.title) + "</h2>");
    set("work-grid", C.work.cards.map(function (c, i) {
      var tag = c.href ? "a" : "div";
      var href = c.href ? ' href="' + esc(c.href) + '"' : "";
      return "<" + tag + ' class="card project reveal' + (c.full ? " span-full" : "") + '"' + href + delay(i) + ">" +
        '<span class="tag">' + esc(c.tag) + "</span>" +
        "<h3>" + esc(c.title) + "</h3>" +
        '<p class="muted">' + fmt(c.text) + "</p>" +
        '<span class="card-link">' + esc(c.footer) + "</span>" +
      "</" + tag + ">";
    }).join(""));
  }

  if (C.contact) {
    set("contact-head", '<p class="eyebrow">' + esc(C.contact.eyebrow) + "</p><h2>" + esc(C.contact.title) + '</h2><p class="muted">' + fmt(C.contact.text) + "</p>");
  }
})();
