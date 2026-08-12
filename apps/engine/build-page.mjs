// apps/engine/build-page.mjs — the genome → coded page path. Turns a StyleGenome into ONE
// self-contained, gate-passing HTML page: the design engine's decisions rendered as real code,
// not a markdown spec. Pure string authoring (no fs/Date/random). It EXEMPLIFIES the gates it
// teaches: emits <!doctype html> + <meta charset="utf-8"> (the mojibake fix), styles the wrapper
// with container tokens (no double-counted margin), keeps neutrals dominant and the accent scarce
// (one primary CTA), makes ONE hero dominant, and ships all core content in markup with a
// reduced-motion-safe, opacity-never-gated entrance. Content is professional SCAFFOLD — a caller
// swaps in real copy; the point is that the SHELL is correct and non-slop by construction.
//
// renderPage(engine, genome, { viewport }) → html string.  engine is needed for the two things the
// genome deliberately doesn't carry: container tokens (engine.layout) and the type scale (engine.typeScale).

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// font-family stack: the genome family first, then a robust same-category fallback so the page is
// self-contained (no external CDN). A real build wires the @font-face load contract; noted inline.
function fontStack(font) {
  const fam = font && font.family ? `"${font.family}", ` : "";
  const cat = (font && font.category) || "sans-serif";
  if (cat === "serif") return `${fam}Georgia, "Times New Roman", serif`;
  if (cat === "monospace") return `${fam}ui-monospace, "SF Mono", Menlo, monospace`;
  return `${fam}ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
}

// derive a small set of neutral tints from ground/ink so surfaces + hairlines exist without asking
// the caller for more colors. Works in both light and dark grounds (mix toward the opposite).
function neutrals(ground, ink, surface, mood) {
  const dark = mood === "dark";
  return {
    surface: surface || `color-mix(in oklab, ${ground} ${dark ? 88 : 96}%, ${ink})`,
    line: `color-mix(in oklab, ${ground} ${dark ? 82 : 90}%, ${ink})`,
    dim: `color-mix(in oklab, ${ink} 62%, ${ground})`,
  };
}

const CHROME = new Set(["nav", "footer", "topbar", "appbar", "masthead", "page-header", "header", "reading-header"]);

// role → a professional content block. Unknown roles get a titled generic section so ANY genome
// renders a coherent page. Accent is spent ONLY on the hero/cta primary button.
function sectionHtml(role, i, ctx) {
  const r = role.toLowerCase();
  const focal = ctx.focal || "left";
  const alignClass = focal === "center" ? "center" : focal === "right" ? "right" : "left";
  const heading = (t, sub) => `<p class="eyebrow">${esc(ctx.brand)} · ${esc(r)}</p><h2>${esc(t)}</h2>${sub ? `<p class="lede">${esc(sub)}</p>` : ""}`;

  if (CHROME.has(r) && (r === "nav" || r === "masthead" || r === "header" || r === "topbar" || r === "page-header")) {
    return `<header class="nav">
      <a class="brand" href="#">${esc(ctx.brand)}</a>
      <nav class="nav-links"><a href="#">Product</a><a href="#">Docs</a><a href="#">Pricing</a></nav>
      <a class="btn btn-ghost" href="#">Sign in</a>
    </header>`;
  }
  if (r === "footer") {
    return `<footer class="footer">
      <div class="brand">${esc(ctx.brand)}</div>
      <nav class="foot-cols"><a href="#">Product</a><a href="#">Docs</a><a href="#">Changelog</a><a href="#">Contact</a></nav>
      <p class="dim small">© ${esc(ctx.brand)}. All rights reserved.</p>
    </footer>`;
  }
  if (/hero|opening|thesis|intro/.test(r)) {
    const actionClass = ctx.primary ? "btn-primary" : "btn-ghost";
    return `<section class="section hero ${alignClass}" style="min-height:${ctx.heroMin}px">
      <p class="eyebrow">${esc(ctx.tagline)}</p>
      <h1>${esc(ctx.headline)}</h1>
      <p class="lede">${esc(ctx.subhead)}</p>
      <div class="cta-row"><a class="btn ${actionClass}" href="#">${esc(ctx.cta)}</a><a class="btn btn-ghost" href="#">See how it works</a></div>
    </section>`;
  }
  if (/feature|evidence|argument|benefit|capabilit/.test(r)) {
    const cols = clamp(ctx.columns || 3, 2, 4);
    const cards = Array.from({ length: cols }, (_, k) => `<article class="card"><h3>${esc(["Built for speed", "Precise by default", "Yours to shape", "Quietly powerful"][k] || "Considered")}</h3><p class="dim">Every surface earns its place — dense where it counts, calm where you decide.</p></article>`).join("");
    return `<section class="section ${alignClass}"><div class="head">${heading("What makes it different", "Three ideas, carried through every screen.")}</div><div class="grid" style="--cols:${cols}">${cards}</div></section>`;
  }
  if (/proof|logo|trust|social/.test(r)) {
    return `<section class="section proof center"><p class="dim small">Trusted by teams that care about craft</p><div class="logos">${["NORTH", "Cadence", "Ledger", "Atlas", "Foundry"].map((n) => `<span class="logo">${esc(n)}</span>`).join("")}</div></section>`;
  }
  if (/cta|close|conversion/.test(r)) {
    const actionClass = ctx.primary ? "btn-primary" : "btn-ghost";
    return `<section class="section cta-band center"><h2>${esc(ctx.ctaHeadline)}</h2><p class="lede">${esc(ctx.subhead)}</p><a class="btn ${actionClass}" href="#">${esc(ctx.cta)}</a></section>`;
  }
  // generic (pricing, faq, table, band, chapter, gallery, etc.)
  return `<section class="section ${alignClass}"><div class="head">${heading(ctx.headline, ctx.subhead)}</div><p class="body-copy">This section carries the ${esc(r)} content. The type scale, spacing, color, and material below all come from the generated design system — swap this scaffold for real copy.</p></section>`;
}

export function renderPage(engine, genome, { viewport = 1440 } = {}) {
  const g = genome || {};
  const color = g.color || {};
  const type = g.type || {};
  const layout = g.layout || {};
  const material = g.material || {};
  const macro = layout.macro || {};
  const setting = type.setting || {};
  const mood = color.mood === "dark" ? "dark" : "light";

  const ground = color.ground || (mood === "dark" ? "#14120f" : "#f6f5f2");
  const ink = color.ink || (mood === "dark" ? "#efece6" : "#1a1815");
  const accent = color.accent || "#b5522f";
  const nt = neutrals(ground, ink, color.surface, mood);
  // Button text is chosen against the ACTUAL generated accent, not inferred
  // from the page mood. Mid-lightness accents frequently fail with white even
  // on a light page; the palette's ground/ink pair gives us two coherent poles.
  let buttonInk = mood === "dark" ? "#0f0d0b" : "#fff";
  if (engine && typeof engine.contrastRatio === "function") {
    const coherent = [ink, ground].map((hex) => ({ hex, contrast: engine.contrastRatio(accent, hex) }));
    buttonInk = coherent.find((candidate) => candidate.contrast >= 4.5)?.hex
      || ["#000000", "#ffffff"].map((hex) => ({ hex, contrast: engine.contrastRatio(accent, hex) }))
        .sort((a, b) => b.contrast - a.contrast)[0].hex;
  }

  // container tokens (the genome doesn't carry these — the skill's own rule: style the wrapper with
  // container.maxWidth + paddingInline, never re-add margin on inner).
  const baseFont = 17;
  const L = (engine && typeof engine.layout === "function") ? engine.layout({ viewport, baseFont }) : { container: { maxWidth: 1120, paddingInline: 24 } };
  const maxW = num(L.container && L.container.maxWidth, 1120);
  const pad = num(L.container && L.container.paddingInline, 24);

  // type scale — hero honors the genome's headingScaleRatio; the rest is a tight modular scale.
  const headingRatio = clamp(num(layout.hierarchy && layout.hierarchy.headingScaleRatio, 2.2), 1.3, 3.4);
  const hero = Math.round(clamp(baseFont * headingRatio, 26, 60));
  const h2 = Math.round(clamp(hero * 0.52, 20, 34));
  const h3 = Math.round(clamp(h2 * 0.72, 16, 24));
  const small = 14;
  const lhBody = num(setting.body && setting.body.leading, 1.55);
  const lhDisplay = num(setting.display && setting.display.leading, 1.1);
  const trackDisplay = (setting.display && setting.display.tracking) || "-0.02em";

  const radii = material.radii || { sm: 4, md: 8, lg: 12 };
  const shadow = (material.shadow && material.shadow.css) || "0 1px 2px rgba(0,0,0,0.06), 0 8px 24px -12px rgba(0,0,0,0.12)";
  const whitespace = clamp(num(macro.whitespace, 0.4), 0.15, 0.85);
  const sectionPad = Math.round(clamp(48 + whitespace * 72, 40, 128)); // more air = more breathing room
  const heroMin = Math.round(clamp((layout.sectionGrammar && layout.sectionGrammar.find((s) => /hero|opening|thesis/i.test(s.role))?.heightShare) || 0.5, 0.28, 0.95) * 640 + 120);

  const displayStack = fontStack(type.display);
  const bodyStack = fontStack(type.body);
  const cap = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  // a wordmark placeholder: first meaningful word (skip articles/prepositions), capitalized.
  const brandWord = (g.sourceBrief || "Northbeam").split(/[\s,–—-]+/).filter((w) => w && !/^(a|an|the|for|of|to|in|on|with|and)$/i.test(w))[0] || "Northbeam";
  const brand = cap(brandWord.replace(/[^A-Za-z0-9]/g, "")) || "Northbeam";

  const grammar = (Array.isArray(layout.sectionGrammar) && layout.sectionGrammar.length)
    ? layout.sectionGrammar
    : [{ role: "nav" }, { role: "hero", heightShare: 0.55 }, { role: "features" }, { role: "proof" }, { role: "cta" }, { role: "footer" }];
  // Spend the primary action once: prefer the first hero/opening; if the
  // grammar has none, promote the first closing CTA. Later actions stay quiet.
  let primarySectionIndex = grammar.findIndex((s) => /hero|opening|thesis|intro/i.test(String(s?.role || "")));
  if (primarySectionIndex < 0) primarySectionIndex = grammar.findIndex((s) => /cta|close|conversion/i.test(String(s?.role || "")));

  const ctx = {
    brand,
    tagline: "Introducing " + brand,
    headline: cap(g.sourceBrief ? g.sourceBrief.replace(/^(a|an)\s+/i, "").replace(/\.$/, "") : "The interface your work deserves"),
    subhead: "A calm, deliberate surface — dense where it matters, generous where you decide. Built on a design system, not a template.",
    ctaHeadline: "Ready when you are",
    cta: "Get started",
    columns: num(macro.columnCount, 3),
  };

  const body = grammar.map((s, i) => sectionHtml(s.role || "section", i, { ...ctx, focal: s.focalPoint, heroMin, primary: i === primarySectionIndex })).join("\n      ");

  const css = `
  :root{
    --ground:${ground}; --ink:${ink}; --accent:${accent}; --accent-ink:${buttonInk}; --surface:${nt.surface}; --line:${nt.line}; --dim:${nt.dim};
    --maxw:${maxW}px; --pad:${pad}px;
    --r-sm:${num(radii.sm, 4)}px; --r-md:${num(radii.md, 8)}px; --r-lg:${num(radii.lg, 12)}px;
    --shadow:${shadow};
    --hero:${hero}px; --h2:${h2}px; --h3:${h3}px; --body:${baseFont}px; --small:${small}px;
    --lh-body:${lhBody}; --lh-display:${lhDisplay}; --track-display:${trackDisplay};
    --sp:${sectionPad}px;
  }
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{margin:0;background:var(--ground);color:var(--ink);font-family:${bodyStack};font-size:var(--body);line-height:var(--lh-body);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
  .wrap{max-width:var(--maxw);margin-inline:auto;padding-inline:var(--pad)}
  h1,h2,h3{font-family:${displayStack};line-height:var(--lh-display);letter-spacing:var(--track-display);margin:0;text-wrap:balance}
  h1{font-size:var(--hero);font-weight:680} h2{font-size:var(--h2);font-weight:640} h3{font-size:var(--h3);font-weight:620}
  p{margin:0}
  a{color:inherit;text-decoration:none}
  .dim{color:var(--dim)} .small{font-size:var(--small)}
  .eyebrow{font-size:var(--small);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:14px}
  .lede{max-width:62ch;color:var(--dim);font-size:calc(var(--body) + 2px);line-height:1.6;margin-top:16px}
  .section{padding-block:var(--sp)} .section + .section{border-top:1px solid var(--line)}
  .section.center{text-align:center} .section.center .lede{margin-inline:auto} .section.right{text-align:right}
  .head{max-width:60ch} .center .head{margin-inline:auto}
  .nav{display:flex;align-items:center;gap:24px;padding-block:22px;border-bottom:1px solid var(--line)}
  .brand{font-family:${displayStack};font-weight:680;font-size:19px;letter-spacing:-.01em}
  .nav-links{display:flex;gap:22px;margin-left:auto;color:var(--dim);font-size:var(--small)}
  .nav-links a:hover{color:var(--ink)}
  .hero{display:flex;flex-direction:column;justify-content:center}
  .hero.center{align-items:center}
  .cta-row{display:flex;gap:12px;margin-top:28px} .center .cta-row{justify-content:center}
  .btn{display:inline-flex;align-items:center;height:44px;padding:0 18px;border-radius:var(--r-md);font-size:var(--small);font-weight:600;transition:transform .12s ease, background .12s ease;border:1px solid transparent}
  .btn:active{transform:translateY(1px)}
  .btn-primary{background:var(--accent);color:var(--accent-ink)}
  .btn-primary:hover{filter:brightness(1.05)}
  .btn-ghost{background:transparent;border-color:var(--line);color:var(--ink)}
  .btn-ghost:hover{background:var(--surface)}
  .grid{display:grid;grid-template-columns:repeat(var(--cols),1fr);gap:22px;margin-top:36px}
  .card{padding:22px;border-radius:var(--r-lg);background:var(--surface);border:1px solid var(--line)}
  .card h3{margin-bottom:8px}
  .proof .logos{display:flex;flex-wrap:wrap;gap:32px;justify-content:center;margin-top:18px;color:var(--dim)}
  .logo{font-weight:640;letter-spacing:.02em}
  .cta-band{background:var(--surface);border-radius:var(--r-lg)} .cta-band .btn{margin-top:22px}
  .body-copy{max-width:66ch;margin-top:20px;color:var(--dim)}
  .footer{display:flex;flex-wrap:wrap;align-items:center;gap:18px;padding-block:40px;border-top:1px solid var(--line);color:var(--dim);font-size:var(--small)}
  .foot-cols{display:flex;gap:20px;margin-left:auto} .foot-cols a:hover{color:var(--ink)}
  @media (max-width:760px){ .grid{grid-template-columns:1fr} .nav-links{display:none} .hero{min-height:auto!important} }
  @media (prefers-reduced-motion:reduce){ *{transition:none!important;animation:none!important;scroll-behavior:auto!important} }
  `.trim();

  return `<!doctype html>
<html lang="en" data-mood="${mood}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand)}</title>
<!-- Fonts: ${esc((type.display && type.display.family) || "—")} (display) / ${esc((type.body && type.body.family) || "—")} (body). Wire the real @font-face load contract before ship. -->
<style>
${css}
</style>
</head>
<body>
<div class="wrap">
      ${body}
</div>
</body>
</html>`;
}
