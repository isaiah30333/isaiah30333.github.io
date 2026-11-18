/* =====================================================================
   SITE CONFIG — the one file you edit for each new site.
   Change the values below and every page (header, footer, colors,
   fonts, links) updates automatically.
   ===================================================================== */
window.SITE = {
  /* ---- Identity (shown in the shared header + footer) ---- */
  name: "Isaiah Cordova",       // ← put your name or brand here
  tagline: "Finance & Investment Analysis",
  monogram: "IC",              // 1–3 letters shown in the header badge

  /* ---- Contact ---- */
  email: "Isaiahcobusiness@gmail.com",
  linkedin: "https://www.linkedin.com/in/isaiah-cordova/",

  /* ---- Navigation (order = order in header) ---- */
  nav: [
    { label: "Home",      href: "index.html" },
    { label: "Markets",   href: "markets.html" },
    { label: "Launchpad", href: "launchpad.html" }
  ],
  // Optional button on the right of the header. Set to null to hide.
  headerCta: { label: "Contact", href: "index.html#contact" },

  /* ---- Look & feel ---- */
  theme: {
    accent: "#8A6A1F",          // main brand color (buttons, links, highlights): bronze
    accentDark: "#E0C27A",      // accent used in dark mode: light gold
    radius: "12px",             // corner roundness: "4px" sharp … "20px" soft
    defaultMode: "system"       // "system" | "light" | "dark"
  },
  fonts: {
    // Any Google Fonts family names
    heading: "Inter Tight",
    body: "Inter",
    mono: "JetBrains Mono"
  },

  /* ---- Live market data (markets.html) ----
     Free key from finnhub.io. It's visible in the page source once the site is public:
     fine for a free key, but don't use a paid one here. Set to "" to turn live prices off. */
  finnhubKey: "dbukeh9r01qv51jc580gdbukeh9r01qv51jc5810",
  liveQuoteRefreshSeconds: 60,   // backup refresh; the websocket streams trades in between
  tickerTape: true,              // scrolling TradingView price bar on the Markets page

  /* ---- Launchpad tiles (launchpad.html) ----
     Number keys 1–9 open tiles in order.
     "app: true" = desktop app opened through its link (obsidian://, antigravity://).
     "fallback" is opened if the app isn't installed. */
  launchpad: [
    { name: "Claude",        desc: "Chat & projects",        url: "https://claude.ai/new",               color: "#d97757" },
    { name: "Gemini",        desc: "Google's assistant",     url: "https://gemini.google.com/app",       color: "#4285f4" },
    { name: "AI Studio",     desc: "Gemini models & API",    url: "https://aistudio.google.com/",        color: "#1a73e8" },
    { name: "NotebookLM",    desc: "Research notebooks",     url: "https://notebooklm.google.com/",      color: "#34a853" },
    { name: "Antigravity",   desc: "Agent IDE · desktop",    url: "antigravity://",  app: true, fallback: "https://antigravity.google/", color: "#7c3aed" },
    { name: "Obsidian",      desc: "Notes vault · desktop",  url: "obsidian://open", app: true, fallback: "https://obsidian.md/",        color: "#8b5cf6" }
  ],

  /* ---- Footer ---- */
  footerNote: "Built from my site base."
};
