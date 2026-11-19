/* S&P 500 heat map: sectors laid out by index weight (squarified treemap, d3-hierarchy),
   each sector filled with Voronoi cells (d3-delaunay) seeded at its companies' treemap
   centers, so bigger weight ⇒ bigger cell. Colored by today's % change. Cells near the
   pointer light up and close their gaps; hover for details, click to chart it.
   Data: data/heatmap.json, built by scripts/fetch_expected_moves.py. */
(function () {
  var stage = document.getElementById("heat-stage");
  var canvas = document.getElementById("heat-canvas");
  var tip = document.getElementById("heat-tip");
  var section = document.getElementById("heat");
  if (!stage || !canvas || !window.d3 || !d3.Delaunay || !d3.treemap) return;
  var esc = window.SiteUtil.esc;
  var ctx = canvas.getContext("2d");

  var BG = "#0c0b10";
  var LABEL_H = 18;          // sector label strip
  var GAP = 3;               // space between sectors
  var data = null, cells = [], sectors = [], W = 0, H = 0, dpr = 1;
  var hover = null, pointer = null, raf = 0, tappedSym = null;

  /* ---------- color: red ← gray → green, saturating at ±3% ---------- */
  var NEU = [64, 68, 82], RED = [214, 58, 58], GRN = [34, 166, 90];
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function colorFor(cp) {
    var t = Math.min(1, Math.abs(cp) / 3);
    t = Math.pow(t, 0.75);
    return mix(NEU, cp < 0 ? RED : GRN, t);
  }
  function rgb(c, lift) {
    lift = lift || 0;
    return "rgb(" + Math.round(c[0] + (255 - c[0]) * lift) + "," + Math.round(c[1] + (255 - c[1]) * lift) + "," + Math.round(c[2] + (255 - c[2]) * lift) + ")";
  }
  function pct(v) { return (v > 0 ? "+" : "") + v.toFixed(2) + "%"; }

  /* ---------- layout ---------- */
  function layout() {
    var r = stage.getBoundingClientRect();
    W = Math.max(280, Math.floor(r.width));
    H = Math.max(320, Math.floor(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";

    var bySec = {};
    data.stocks.forEach(function (s) { (bySec[s.sec] = bySec[s.sec] || []).push(s); });
    var root = d3.hierarchy({ children: Object.keys(bySec).map(function (k) { return { name: k, children: bySec[k] }; }) })
      .sum(function (d) { return d.w || 0; })
      .sort(function (a, b) { return b.value - a.value; });
    d3.treemap().size([W, H]).tile(d3.treemapSquarify.ratio(1.2))
      .paddingOuter(GAP).paddingInner(GAP).paddingTop(function (n) { return n.depth === 1 ? LABEL_H : GAP; })(root);

    cells = []; sectors = [];
    root.children.forEach(function (sec) {
      var leaves = sec.leaves();
      var b = [sec.x0, sec.y0 + LABEL_H, sec.x1, sec.y1];
      if (b[2] - b[0] < 4 || b[3] - b[1] < 4) return;
      var pts = leaves.map(function (l) { return [(l.x0 + l.x1) / 2, (l.y0 + l.y1) / 2]; });
      var del = d3.Delaunay.from(pts);
      var vor = del.voronoi(b);
      var wSum = 0, cpSum = 0;
      var secObj = { name: sec.data.name, x0: sec.x0, y0: sec.y0, x1: sec.x1, y1: sec.y1, b: b, del: del, first: cells.length, cells: [] };
      leaves.forEach(function (l, i) {
        var poly = vor.cellPolygon(i);
        if (!poly) return;
        // true area centroid (shoelace) so labels sit in the visual middle of the cell
        var s = l.data, A = 0, cx = 0, cy = 0, n = poly.length - 1, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (var k = 0; k < n; k++) {
          var x0 = poly[k][0], y0 = poly[k][1], x1 = poly[k + 1][0], y1 = poly[k + 1][1], f = x0 * y1 - x1 * y0;
          A += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
          minX = Math.min(minX, x0); maxX = Math.max(maxX, x0);
          minY = Math.min(minY, y0); maxY = Math.max(maxY, y0);
        }
        if (Math.abs(A) > 1e-6) { cx /= 3 * A; cy /= 3 * A; } else { cx = (minX + maxX) / 2; cy = (minY + maxY) / 2; }
        var cell = { s: s, sec: secObj, poly: poly, cx: cx, cy: cy, w: maxX - minX, h: maxY - minY,
                     color: colorFor(s.cp), glow: 0, target: 0, idx: i };
        cells.push(cell); secObj.cells[i] = cell;
        wSum += s.w; cpSum += s.w * s.cp;
      });
      secObj.cp = wSum ? cpSum / wSum : 0;
      sectors.push(secObj);
    });
    draw();
  }

  /* ---------- draw ---------- */
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    cells.forEach(function (c) {
      var k = 0.94 + 0.06 * c.glow;                 // gaps close as a cell lights up
      ctx.beginPath();
      for (var i = 0; i < c.poly.length - 1; i++) {
        var x = c.cx + (c.poly[i][0] - c.cx) * k, y = c.cy + (c.poly[i][1] - c.cy) * k;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = rgb(c.color, 0.22 * c.glow);
      ctx.fill();
      if (c === hover) { ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.stroke(); }
    });

    // labels: shrink the font until every line fits the cell, drop the price (then the %)
    // when it can't, and clip to the cell so text never spills onto a neighbor
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var SANS = "Inter, system-ui, sans-serif", MONO = "'JetBrains Mono', ui-monospace, monospace";
    cells.forEach(function (c) {
      if (Math.min(c.w, c.h) < 22) return;
      var lines = [c.s.s, pct(c.s.cp), "$" + c.s.p.toFixed(2)];
      var fs = Math.min(26, Math.min(c.w, c.h) / 3.4), fits = false;
      while (!fits && lines.length) {
        // irregular cells taper toward their corners: give 3-line labels a tighter box
        var maxW = c.w * (lines.length === 3 ? 0.6 : 0.7), maxH = c.h * (lines.length === 3 ? 0.55 : 0.6);
        for (var f = fs; f >= 8.5; f -= 0.5) {
          var lh = f * 1.12, wide = 0;
          lines.forEach(function (t, i) {
            ctx.font = (i ? "500 " + f * 0.72 + "px " + MONO : "700 " + f + "px " + SANS);
            wide = Math.max(wide, ctx.measureText(t).width);
          });
          if (wide <= maxW && lines.length * lh <= maxH) { fs = f; fits = true; break; }
        }
        if (!fits) lines.pop();                      // no room: drop price, then %, then ticker
      }
      if (!fits) return;

      ctx.save();
      ctx.beginPath();
      for (var i = 0; i < c.poly.length - 1; i++) {
        var px = c.cx + (c.poly[i][0] - c.cx) * 0.94, py = c.cy + (c.poly[i][1] - c.cy) * 0.94;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.clip();
      var lh2 = fs * 1.12, top = c.cy - (lines.length - 1) * lh2 / 2;
      lines.forEach(function (t, i) {
        ctx.font = (i ? "500 " + fs * 0.72 + "px " + MONO : "700 " + fs + "px " + SANS);
        ctx.fillStyle = ["rgba(255,255,255,.96)", "rgba(255,255,255,.86)", "rgba(255,255,255,.62)"][i];
        ctx.fillText(t, c.cx, top + i * lh2);
      });
      ctx.restore();
    });

    // sector labels in the strip above each sector
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    sectors.forEach(function (s) {
      var room = s.x1 - s.x0 - 8;
      if (room < 40) return;
      ctx.font = "600 10.5px 'JetBrains Mono', ui-monospace, monospace";
      var name = s.name.toUpperCase(), p = " " + pct(s.cp);
      while (name.length > 3 && ctx.measureText(name + p).width > room) name = name.slice(0, -2) + "…";
      ctx.fillStyle = "rgba(255,255,255,.72)";
      ctx.fillText(name, s.x0 + 4, s.y0 + 13);
      var nw = ctx.measureText(name).width;
      ctx.fillStyle = s.cp >= 0 ? "#5fd18f" : "#f07a7a";
      ctx.fillText(p, s.x0 + 4 + nw, s.y0 + 13);
    });
  }

  /* ---------- interaction ---------- */
  function cellAt(x, y) {
    for (var i = 0; i < sectors.length; i++) {
      var s = sectors[i], b = s.b;
      if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return s.cells[s.del.find(x, y)] || null;
    }
    return null;
  }

  function setTargets() {
    cells.forEach(function (c) {
      if (!pointer) { c.target = 0; return; }
      if (c === hover) { c.target = 1; return; }
      var d = Math.hypot(c.cx - pointer[0], c.cy - pointer[1]);
      c.target = Math.max(0, 1 - d / 140) * 0.38;      // soft light around the pointer
    });
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    var moving = false;
    cells.forEach(function (c) {
      var d = c.target - c.glow;
      if (Math.abs(d) > 0.004) { c.glow += d * 0.2; moving = true; } else c.glow = c.target;
    });
    draw();
    raf = moving ? requestAnimationFrame(tick) : 0;
  }

  function showTip(c, x, y) {
    if (!c) { tip.hidden = true; return; }
    var s = c.s;
    tip.innerHTML =
      '<div class="heat-tip-top"><strong>' + esc(s.s) + '</strong><span class="' + (s.cp >= 0 ? "up" : "down") + '">' + pct(s.cp) + "</span></div>" +
      '<div class="heat-tip-name">' + esc(s.n) + "</div>" +
      '<div class="heat-tip-row"><span>Price</span><span>$' + s.p.toFixed(2) + "</span></div>" +
      '<div class="heat-tip-row"><span>Change</span><span>' + (s.c > 0 ? "+" : "") + s.c.toFixed(2) + "</span></div>" +
      '<div class="heat-tip-row"><span>Sector</span><span>' + esc(s.sec) + "</span></div>" +
      '<div class="heat-tip-row"><span>S&amp;P weight</span><span>' + s.w.toFixed(2) + "%</span></div>";
    tip.hidden = false;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = x + 16 + tw > W ? x - tw - 16 : x + 16;
    var top = Math.min(Math.max(8, y - th / 2), H - th - 8);
    tip.style.transform = "translate(" + Math.max(8, left) + "px," + top + "px)";
  }

  function localXY(e) { var r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  canvas.addEventListener("pointermove", function (e) {
    if (!data) return;
    pointer = localXY(e);
    var c = cellAt(pointer[0], pointer[1]);
    if (c !== hover) { hover = c; canvas.style.cursor = c ? "pointer" : "default"; }
    showTip(hover, pointer[0], pointer[1]);
    setTargets();
  });
  canvas.addEventListener("pointerleave", function () {
    pointer = null; hover = null; tappedSym = null; tip.hidden = true; setTargets();
  });
  canvas.addEventListener("click", function (e) {
    if (!data) return;
    var xy = localXY(e), c = cellAt(xy[0], xy[1]);
    if (!c) return;
    // touch: first tap shows the details, a second tap on the same stock opens it
    if (e.pointerType === "touch" && tappedSym !== c.s.s) { tappedSym = c.s.s; return; }
    if (window.MarketsSelect && window.MarketsSelect(c.s.s)) return;   // in the watchlist: chart it here
    window.open("https://www.tradingview.com/chart/?symbol=" + encodeURIComponent(c.s.s.replace("-", ".")), "_blank", "noopener");
  });

  /* ---------- data ---------- */
  function describe() {
    var s = data.stocks.slice().sort(function (a, b) { return b.cp - a.cp; });
    var up = data.stocks.filter(function (x) { return x.cp > 0; }).length;
    canvas.setAttribute("aria-label", "S&P 500 heat map: " + up + " of " + data.stocks.length + " stocks up. Biggest gainers " +
      s.slice(0, 3).map(function (x) { return x.s + " " + pct(x.cp); }).join(", ") + ". Biggest decliners " +
      s.slice(-3).reverse().map(function (x) { return x.s + " " + pct(x.cp); }).join(", ") + ".");
    var when = new Date(data.generatedAt);
    document.getElementById("heat-meta").textContent = "· " + up + " of " + data.stocks.length + " up · prices as of " +
      (isNaN(when) ? data.asOf : when.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }));
  }

  function load() {
    if (location.protocol.indexOf("http") !== 0) return Promise.resolve(null);   // needs the published site
    return fetch("data/heatmap.json?t=" + Math.floor(Date.now() / 300000))
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  function apply(d) {
    if (!d || !d.stocks || !d.stocks.length) return;
    var changed = !data || d.generatedAt !== data.generatedAt;
    data = d;
    section.hidden = false;
    if (changed) { describe(); layout(); }
  }

  load().then(apply);
  setInterval(function () { load().then(apply); }, 5 * 60000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (data) draw(); });

  var rt = 0;
  new ResizeObserver(function () {
    if (!data) return;
    clearTimeout(rt);
    rt = setTimeout(layout, 120);
  }).observe(stage);
})();
