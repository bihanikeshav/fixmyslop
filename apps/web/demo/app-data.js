/* Slop-o-meter data — measured slop + the antidotes.
   Plain JS, attached to window so both vanilla + babel scripts can read it. */
(function () {
  // --- The slop font wall (slop hero only) ---
  const SLOP_FONTS = [
    { name: "Playfair Display", sat: 1.00, css: "'Playfair Display', serif", tag: "the universal serif" },
    { name: "Inter", sat: 0.94, css: "'Inter', sans-serif", tag: "hero AND body, everywhere" },
    { name: "Space Grotesk", sat: 0.88, css: "'Space Grotesk', sans-serif", tag: "the SaaS grotesk" },
    { name: "Poppins", sat: 0.81, css: "'Poppins', sans-serif", tag: "friendly rounded" },
    { name: "DM Sans", sat: 0.74, css: "'DM Sans', sans-serif", tag: "grotesk monoculture" },
    { name: "Sora", sat: 0.71, css: "'Sora', sans-serif", tag: "grotesk monoculture" },
    { name: "Manrope", sat: 0.68, css: "'Manrope', sans-serif", tag: "grotesk monoculture" },
    { name: "Outfit", sat: 0.66, css: "'Outfit', sans-serif", tag: "grotesk monoculture" },
    { name: "Cormorant Garamond", sat: 0.62, css: "'Cormorant Garamond', serif", tag: "the 'fancy' serif" },
    { name: "Bodoni Moda", sat: 0.59, css: "'Bodoni Moda', serif", tag: "first-escape serif" },
    { name: "Bricolage Grotesque", sat: 0.41, css: "'Bricolage Grotesque', sans-serif", tag: "the NEXT slop wave" },
  ];

  // --- The detected tells (light up on the slop reveal) ---
  const TELLS = [
    { id: "inter", label: "Inter for hero + body", detail: "self-hosted, but it's still Inter" },
    { id: "gradient", label: "indigo → violet gradient text", detail: "background-clip: text" },
    { id: "glass", label: "glassmorphic nav", detail: "backdrop-filter: blur(12px)" },
    { id: "pill", label: "pill buttons", detail: "border-radius: 9999px" },
    { id: "rounded", label: "rounded-2xl everything", detail: "1rem radius on every card" },
    { id: "pulse", label: "animate-pulse + fade-up", detail: "Tailwind built-ins, verbatim" },
    { id: "bento", label: "bento grid + ✨ badges", detail: "“✨ AI-powered”" },
    { id: "shadow", label: "soft shadows everywhere", detail: "shadow-xl, no contrast" },
  ];

  const SECOND_ORDER = [
    "You did the #1 AI “premium” move — Playfair + gold on near-black. Still slop.",
    "Tried to escape to warm terracotta (#FF5C38)? That's everyone's “tasteful” exit now. Still slop.",
    "“Kill gradients, hard borders, serif headlines.” The anti-slop playbook is a template too.",
  ];

  // --- Routing: each slop tell maps to a dedicated page that does it RIGHT. ---
  const PAGES = [
    { key: "surfaces", dot: "#00C2D1", tell: "glassmorphic blur on every surface", code: "backdrop-filter: blur(12px)", fix: "Glass over something worth blurring.", why: "Frost is a relationship between two layers. Take the back one away and it is just grey." },
    { key: "color", dot: "#7A2E8F", tell: "indigo → violet gradient, on everything", code: "background: linear-gradient(…)", fix: "One gradient. Three stops. Used once.", why: "Colour and gradient are one choice. Spend the whole budget in a single place." },
    { key: "imagery", dot: "#B08D3C", tell: "mesh-gradient blobs, ✨ 3D stock", code: "radial-gradient blob hero", fix: "Imagery that means something, or none.", why: "An image should carry information or a specific mood. Filler art is noise with a gradient." },
    { key: "controls", dot: "#0E7C6B", tell: "pill + gradient buttons; every action looks primary", code: "border-radius: 9999px", fix: "One primary. Honest hierarchy.", why: "When one action clearly leads, people know what to do without reading every label." },
    { key: "compose", dot: "#F04E37", tell: "bento grid, ✨ on every equal tile", code: "grid-cols-3 · rounded-2xl", fix: "Scale and position carry the hierarchy.", why: "Let size and place do the ranking and the reader's eye finds the point on its own." },
    { key: "type", dot: "#C8175A", tell: "Inter for the hero and the body", code: "font-family: Inter", fix: "Two voices that disagree.", why: "A display face that argues with the body gives a page a shape you can navigate by." },
    { key: "copy", dot: "#1F6E4C", tell: "✨ AI-powered · “unlock the power of…”", code: "vague headline; \"Submit\"", fix: "Say what it is; name what it does.", why: "Name the thing and name the action, and nobody has to guess what a control will do." },
    { key: "motion", dot: "#F0A93B", tell: "animate-pulse, fade-up, spin", code: "animation: pulse 2s infinite", fix: "Motion that reports something.", why: "Motion that obeys physics tells you something moved, and roughly why. Looping decoration says nothing." },
  ];

  // --- Searchable font index: measured slop saturation 0–1 (×100 = slop score).
  //     `near` = vector-close to a named slop font → flagged out too. ---
  const FRESH_FONTS = [
    { name: "Bitcount", sat: 0.02, css: "'Bitcount Prop Single', monospace", tag: "pixel/dot display" },
    { name: "Tektur", sat: 0.03, css: "'Tektur', sans-serif", tag: "blocky techno display" },
    { name: "Victor Mono", sat: 0.04, css: "'Victor Mono', monospace", tag: "mono w/ cursive italics" },
    { name: "Unbounded", sat: 0.05, css: "'Unbounded', sans-serif", tag: "geometric heavy display" },
    { name: "Martian Mono", sat: 0.06, css: "'Martian Mono', monospace", tag: "wide technical mono" },
    { name: "Big Shoulders Display", sat: 0.08, css: "'Big Shoulders Display', sans-serif", tag: "condensed poster" },
    { name: "Syne", sat: 0.10, css: "'Syne', sans-serif", tag: "art-world wide display" },
    { name: "Newsreader", sat: 0.13, css: "'Newsreader', serif", tag: "editorial serif" },
    { name: "Instrument Serif", sat: 0.15, css: "'Instrument Serif', serif", tag: "elegant, fresher than Playfair" },
    // vector-close to the grotesk monoculture — the escape that isn't one
    { name: "Hanken Grotesk", sat: 0.18, css: "'Hanken Grotesk', sans-serif", tag: "geometric grotesk", near: "Inter" },
    { name: "Public Sans", sat: 0.16, css: "'Public Sans', sans-serif", tag: "neutral grotesk", near: "Inter" },
    { name: "Figtree", sat: 0.30, css: "sans-serif", tag: "rounded grotesk", near: "Inter" },
    { name: "Onest", sat: 0.28, css: "sans-serif", tag: "neutral grotesk", near: "Inter" },
    { name: "Gabarito", sat: 0.33, css: "sans-serif", tag: "friendly grotesk", near: "Poppins" },
    { name: "Urbanist", sat: 0.31, css: "sans-serif", tag: "geometric sans", near: "Manrope" },
  ];
  const FONT_INDEX = [...SLOP_FONTS, ...FRESH_FONTS];
  function fontScore(sat) { return Math.round(sat * 100); }
  function fontReport(f) {
    let score = Math.round((f.sat || 0) * 100);
    if (f.near) { score = Math.max(score, 64); return { score, verdict: "≈ " + f.near + " · STILL SLOP", flag: true }; }
    const v = score >= 85 ? "TEXTBOOK SLOP" : score >= 60 ? "HEAVILY OVERUSED" : score >= 35 ? "WARMING UP" : score >= 18 ? "STILL USABLE" : "WIDE OPEN";
    return { score, verdict: v, flag: score >= 60 };
  }
  function fontVerdict(sat) { return fontReport({ sat }).verdict; }

  window.SLOP = { SLOP_FONTS, TELLS, SECOND_ORDER, PAGES, FRESH_FONTS, FONT_INDEX, fontScore, fontVerdict, fontReport };
})();
