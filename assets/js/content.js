/* =====================================================================
   PAGE CONTENT: the words on the Home page.
   config.js holds settings (name, colors, links, photo); this file holds the text.
   To start a new site from this template: copy the folder, then edit
   config.js and this file. No HTML editing needed.

   Formatting: wrap words in **double asterisks** to make them bold.
   Cards: "wide: true" spans two columns, "full: true" spans the whole row.
   ===================================================================== */
window.CONTENT = {
  hero: {
    lead: "Finance student at Colorado State University, concentrating in Investment Analysis. " +
          "I cover consumer staples for CSU's Pioneer Student Investment Fund and have traded index options on my own account since 2021."
  },

  // the four boxes under the hero
  facts: [
    { k: "Education", v: "CSU Finance (Dec '26)" },
    { k: "Focus",     v: "Investment Analysis" },
    { k: "Based in",  v: "Denver, Colorado" },
    { k: "Open to",   v: "Analyst & Trading Roles" }
  ],

  about: {
    eyebrow: "About",
    title: "About me",
    cards: [
      { title: "Education", items: [
        "**B.S. Business Finance**, Colorado State University",
        "Concentration in Investment Analysis",
        "Graduating December 2026",
        "Next: CFA program, then the CMT"
      ]},
      { title: "Pioneer Student Investment Fund", wide: true, items: [
        "**Consumer staples analyst** on a ~$600K student-run portfolio benchmarked to the S&P 500",
        "Pitched **Unilever**; helped build the team's **Monster Beverage** pitch (DCF, comps, growth projections)",
        "Presented portfolio performance and Bloomberg attribution at the Fall 2026 market update",
        "**Recruitment Committee:** gave the recruiting presentation to 200+ students"
      ]},
      { title: "Valuation", items: [
        "Johnson & Johnson group valuation, Enterprise Valuation class",
        "Built the peer regression: forward P/E vs. revenue growth and EBITDA margin, 14 pharma and MedTech peers"
      ]},
      { title: "Markets", items: [
        "Trading SPX and SPY options on my own account since 2021",
        "Built the Expected Moves tool on this site"
      ]},
      { title: "Experience", items: [
        "Walking Stick Golf Course, Pueblo: golf shop and cart barn",
        "Handled check-ins and the register for 50+ customers a day"
      ]},
      { title: "Skills & tools", full: true, chips: [
        "DCF valuation", "Comparable multiples", "Options & implied volatility",
        "Bloomberg Terminal", "TradingView", "Excel"
      ]}
    ]
  },

  work: {
    eyebrow: "Work",
    title: "Projects & experience",
    cards: [
      { tag: "Student-Managed Fund", title: "Pioneer Student Investment Fund", full: true,
        text: "Consumer staples analyst on a ~$600K student-run fund. Pitched Unilever and helped build the Monster Beverage pitch.",
        footer: "Colorado State University · Fall 2026" },
      { tag: "Enterprise Valuation", title: "Johnson & Johnson Valuation",
        text: "Built the peer regression behind our group's valuation.",
        footer: "Enterprise Valuation · Fall 2026" },
      { tag: "Live Tool", title: "Expected Moves", href: "markets.html",
        text: "Live daily, weekly and monthly ranges priced from options.",
        footer: "Open live tool →" },
      { tag: "Personal Trading", title: "Index Options",
        text: "SPX and SPY options on my own account.",
        footer: "July 2021 – Present" },
      { tag: "Equity Research", title: "CSU Finance Club",
        text: "Stock valuations with fellow members using DCF and multiples.",
        footer: "Sept 2024 – Present" }
    ]
  },

  contact: {
    eyebrow: "Contact",
    title: "Let's talk.",
    text: "The fastest way to reach me is email or LinkedIn."
  }
};
