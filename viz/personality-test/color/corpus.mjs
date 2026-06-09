// corpus.mjs — the empirical "AI-overused color" corpus.
//
// Two kinds of points heat up the density field:
//   kind:'framework' — the default color scales shipped by the popular CSS
//     frameworks. These are the #1 statistical source of slop: every tutorial,
//     boilerplate, and AI-generated page reaches for the framework default, so
//     those exact swatches are massively over-represented in training data.
//     Tailwind's default palette is the single largest contributor.
//   kind:'ourbuild' — every hex we have actually shipped in
//     viz/personality-test/*.html. This is the self-heating feedback loop: it
//     makes the validator flag OUR OWN convergence (we have over-used oxblood,
//     earthy browns, and bright reds), not just the canonical AI palette.
//
// Pure-ish: framework lists are hardcoded literals. The ourbuild points are read
// from disk at load time via loadCorpus() (no network, deterministic given the
// files on disk). The library code that must stay deterministic for tests
// (density.mjs) only calls loadCorpus() once, and the test corpus is fixed.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const HTML_DIR = resolve(HERE, ".."); // viz/personality-test

// ---------------------------------------------------------------------------
// Framework default palettes. Hex values are the canonical documented defaults.
// Tailwind v3 (https://v3.tailwindcss.com/docs/customizing-colors) — full scale.
// ---------------------------------------------------------------------------

// Tailwind CSS v3 default palette — the full 22 hue families × 11 steps.
const TAILWIND = {
  slate: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"],
  gray: ["#f9fafb", "#f3f4f6", "#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563", "#374151", "#1f2937", "#111827", "#030712"],
  zinc: ["#fafafa", "#f4f4f5", "#e4e4e7", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#3f3f46", "#27272a", "#18181b", "#09090b"],
  neutral: ["#fafafa", "#f5f5f5", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#525252", "#404040", "#262626", "#171717", "#0a0a0a"],
  stone: ["#fafaf9", "#f5f5f4", "#e7e5e4", "#d6d3d1", "#a8a29e", "#78716c", "#57534e", "#44403c", "#292524", "#1c1917", "#0c0a09"],
  red: ["#fef2f2", "#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d", "#450a0a"],
  orange: ["#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12", "#431407"],
  amber: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#451a03"],
  yellow: ["#fefce8", "#fef9c3", "#fef08a", "#fde047", "#facc15", "#eab308", "#ca8a04", "#a16207", "#854d0e", "#713f12", "#422006"],
  lime: ["#f7fee7", "#ecfccb", "#d9f99d", "#bef264", "#a3e635", "#84cc16", "#65a30d", "#4d7c0f", "#3f6212", "#365314", "#1a2e05"],
  green: ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#052e16"],
  emerald: ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#022c22"],
  teal: ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a", "#042f2e"],
  cyan: ["#ecfeff", "#cffafe", "#a5f3fc", "#67e8f9", "#22d3ee", "#06b6d4", "#0891b2", "#0e7490", "#155e75", "#164e63", "#083344"],
  sky: ["#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e", "#082f49"],
  blue: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"],
  indigo: ["#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81", "#1e1b4b"],
  violet: ["#f5f3ff", "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065"],
  purple: ["#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#7e22ce", "#6b21a8", "#581c87", "#3b0764"],
  fuchsia: ["#fdf4ff", "#fae8ff", "#f5d0fe", "#f0abfc", "#e879f9", "#d946ef", "#c026d3", "#a21caf", "#86198f", "#701a75", "#4a044e"],
  pink: ["#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843", "#500724"],
  rose: ["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337", "#4c0519"],
};

// Material Design 2 core palette — the 500 weights (the documented "primary"
// swatch of each hue) plus a few common accents.
const MATERIAL = [
  "#f44336", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3",
  "#03a9f4", "#00bcd4", "#009688", "#4caf50", "#8bc34a", "#cddc39",
  "#ffeb3b", "#ffc107", "#ff9800", "#ff5722", "#795548", "#9e9e9e",
  "#607d8b", // blue-grey 500
  "#536dfe", "#448aff", "#40c4ff", // common indigo/blue/light-blue accents
];

// Bootstrap 5 default theme colors.
const BOOTSTRAP = [
  "#0d6efd", // primary (blue)
  "#6610f2", // indigo
  "#6f42c1", // purple
  "#d63384", // pink
  "#dc3545", // danger / red
  "#fd7e14", // orange
  "#ffc107", // warning / yellow
  "#198754", // success / green
  "#20c997", // teal
  "#0dcaf0", // info / cyan
  "#6c757d", // secondary / gray
  "#212529", // dark
];

// Open Props — a representative slice of the default hue ramps (steps 4/6/8 of
// the major hues). Open Props is increasingly common in AI output.
const OPEN_PROPS = [
  "#ff8787", "#fa5252", "#e03131", // red
  "#f783ac", "#e64980", "#c2255c", // pink
  "#da77f2", "#be4bdb", "#9c36b5", // grape
  "#9775fa", "#7950f2", "#6741d9", // violet
  "#748ffc", "#4c6ef5", "#3b5bdb", // indigo
  "#4dabf7", "#228be6", "#1971c2", // blue
  "#3bc9db", "#15aabf", "#0c8599", // cyan
  "#38d9a9", "#12b886", "#099268", // teal
  "#69db7c", "#40c057", "#2f9e44", // green
  "#ffd43b", "#fab005", "#e67700", // yellow
  "#ffa94d", "#fd7e14", "#d9480f", // orange
];

// daisyUI default ("light"/"dark") brand colors + Chakra/Ant primaries — the
// "easy" extras requested. These overlap the blue/purple/cyan slop heavily.
const DAISY_CHAKRA_ANT = [
  // daisyUI defaults
  "#570df8", // primary (violet)
  "#f000b8", // secondary (magenta)
  "#37cdbe", // accent (teal)
  "#3abff8", // info
  "#36d399", // success
  "#fbbd23", // warning
  "#f87272", // error
  // Chakra UI default brand-ish (blue.500 family + teal)
  "#3182ce", // chakra blue.500
  "#319795", // chakra teal.500
  "#805ad5", // chakra purple.500
  // Ant Design defaults
  "#1677ff", // antd v5 primary blue
  "#1890ff", // antd v4 primary blue
  "#722ed1", // antd purple
  "#13c2c2", // antd cyan
];

function frameworkCorpus() {
  const out = [];
  const push = (hexes, source) => {
    for (const hex of hexes) out.push({ hex: hex.toLowerCase(), source, kind: "framework" });
  };
  for (const [name, hexes] of Object.entries(TAILWIND)) push(hexes, `tailwind-${name}`);
  push(MATERIAL, "material");
  push(BOOTSTRAP, "bootstrap");
  push(OPEN_PROPS, "open-props");
  push(DAISY_CHAKRA_ANT, "daisyui/chakra/ant");
  return out;
}

// Extract every hex from our shipped HTML builds (same regex family as
// slop-check.mjs). Each shipped color is a corpus point tagged 'ourbuild'.
function ourbuildCorpus() {
  const out = [];
  const files = readdirSync(HTML_DIR).filter((f) => f.endsWith(".html"));
  for (const f of files) {
    const css = readFileSync(resolve(HTML_DIR, f), "utf8").toLowerCase();
    const hexes = [...css.matchAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/g)].map((m) => m[0]);
    for (let hex of hexes) {
      if (hex.length === 4) hex = "#" + hex.slice(1).split("").map((c) => c + c).join("");
      out.push({ hex, source: `ourbuild:${f}`, kind: "ourbuild" });
    }
  }
  return out;
}

// Full corpus (framework + ourbuild). Each call re-reads HTML (cheap, and keeps
// it honest as builds change). Callers that need determinism should cache it.
export function loadCorpus({ includeOurbuild = true } = {}) {
  const corpus = frameworkCorpus();
  if (includeOurbuild) corpus.push(...ourbuildCorpus());
  return corpus;
}

export { TAILWIND, MATERIAL, BOOTSTRAP, OPEN_PROPS, DAISY_CHAKRA_ANT };
