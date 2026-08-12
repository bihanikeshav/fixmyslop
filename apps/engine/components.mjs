// components.mjs - deterministic component composition logic inspired by the
// copy/paste + registry model of Magic UI. This is a recipe layer, not a clone
// of Magic UI source: the returned component remains the current registry's
// implementation, while fixmyslop owns selection, composition, and quality gates.

const MAGIC_UI_HOME = "https://magicui.design";
const MAGIC_UI_REPO = "https://github.com/magicuidesign/magicui";
const MAGIC_UI_DOCS = `${MAGIC_UI_HOME}/docs/components`;

const COMPONENTS = Object.freeze({
  "bento-grid": { family: "composition", purpose: "Asymmetric feature grid with varied spans and a clear lead tile.", role: "feature-grid", motion: "subtle", variants: ["editorial", "dense", "spotlight"] },
  marquee: { family: "proof", purpose: "Continuous logo, testimonial, or signal rail.", role: "social-proof", motion: "subtle", variants: ["horizontal", "vertical", "static-wrap"] },
  "avatar-circles": { family: "proof", purpose: "Compact people or team proof without a card stack.", role: "social-proof", motion: "none", variants: ["overlap", "stack", "labeled"] },
  terminal: { family: "proof", purpose: "Product-native command or output surface.", role: "product-proof", motion: "subtle", variants: ["static", "typing", "streaming"] },
  globe: { family: "anchor", purpose: "Geographic or network visual anchor.", role: "hero", motion: "expressive", variants: ["orbit", "signal-pins", "static-poster"] },
  "warp-background": { family: "anchor", purpose: "Ambient spatial field behind a short hero claim.", role: "hero", motion: "expressive", variants: ["slow-drift", "edge-bloom", "static-gradient"] },
  "animated-grid-pattern": { family: "ambient", purpose: "Structured technical texture behind content.", role: "ambient", motion: "subtle", variants: ["grid", "flicker", "static-grid"] },
  "retro-grid": { family: "ambient", purpose: "Perspective grid for a deliberate retro/technical register.", role: "ambient", motion: "subtle", variants: ["horizon", "floor", "static"] },
  "blur-fade": { family: "text", purpose: "Reveal a short heading or section entry without hiding content at load.", role: "text", motion: "subtle", variants: ["stagger", "word", "static"] },
  "text-animate": { family: "text", purpose: "Animate a short message where emphasis improves comprehension.", role: "text", motion: "subtle", variants: ["fade", "slide", "static"] },
  "word-rotate": { family: "text", purpose: "Rotate a small set of interchangeable words in a fixed message slot.", role: "text", motion: "subtle", variants: ["loop", "manual", "static"] },
  "typing-animation": { family: "text", purpose: "Reveal a short command, status, or product phrase character by character.", role: "text", motion: "subtle", variants: ["typing", "cursor", "static"] },
  "number-ticker": { family: "data", purpose: "Animate a changing number while preserving its unit and label.", role: "metric", motion: "subtle", variants: ["count", "odometer", "static"] },
  "animated-circular-progress-bar": { family: "data", purpose: "Show a bounded progress or completion value.", role: "metric", motion: "subtle", variants: ["ring", "arc", "static"] },
  "shiny-button": { family: "cta", purpose: "Give one primary action a restrained moving highlight.", role: "cta", motion: "subtle", variants: ["sheen", "edge-sheen", "static"] },
  "shimmer-button": { family: "cta", purpose: "Use a directional sheen to distinguish one high-value action.", role: "cta", motion: "subtle", variants: ["sweep", "slow-sweep", "static"] },
  "ripple-button": { family: "cta", purpose: "Give click/tap feedback while preserving the button's semantic state.", role: "cta", motion: "subtle", variants: ["ripple", "ink-spread", "static"] },
  "rainbow-button": { family: "cta", purpose: "A high-commitment accent action for an earned celebratory moment.", role: "cta", motion: "expressive", variants: ["border", "fill", "static"] },
  "magic-card": { family: "surface", purpose: "Provide a pointer-aware surface treatment for one featured card.", role: "supporting", motion: "subtle", variants: ["spotlight", "tilt", "static"] },
  "border-beam": { family: "surface", purpose: "Trace attention around one active or featured surface.", role: "supporting", motion: "subtle", variants: ["orbit", "pulse", "static"] },
  "shine-border": { family: "surface", purpose: "Add a controlled edge highlight to a selected surface.", role: "supporting", motion: "subtle", variants: ["sweep", "pulse", "static"] },
  "glare-hover": { family: "surface", purpose: "Reveal surface material on fine-pointer hover.", role: "supporting", motion: "subtle", variants: ["glare", "spotlight", "static"] },
  particles: { family: "ambient", purpose: "Low-density ambient field where the subject earns atmosphere.", role: "ambient", motion: "expressive", variants: ["float", "drift", "static"] },
  "flickering-grid": { family: "ambient", purpose: "Sparse signal texture for a technical or instrument surface.", role: "ambient", motion: "expressive", variants: ["flicker", "pulse", "static"] },
  "dot-pattern": { family: "ambient", purpose: "Quiet repeatable texture for a margin or empty field.", role: "ambient", motion: "none", variants: ["dot", "fade", "static"] },
  "grid-pattern": { family: "ambient", purpose: "Quiet geometric texture that supports alignment.", role: "ambient", motion: "none", variants: ["grid", "masked", "static"] },
  "light-rays": { family: "ambient", purpose: "Directional light cue for a single expressive scene.", role: "ambient", motion: "expressive", variants: ["rays", "bloom", "static"] },
  dock: { family: "navigation", purpose: "Compact spatial navigation with clear active state.", role: "navigation", motion: "subtle", variants: ["bottom", "rail", "static"] },
  "animated-list": { family: "navigation", purpose: "Reveal or reorder a list while preserving item identity.", role: "list", motion: "subtle", variants: ["enter", "reorder", "static"] },
});

const ROLE_DEFAULTS = Object.freeze({
  hero: ["warp-background", "animated-grid-pattern", "blur-fade"],
  "social-proof": ["marquee", "avatar-circles"],
  "feature-grid": ["bento-grid", "magic-card"],
  "product-proof": ["terminal", "animated-list"],
  cta: ["shiny-button", "shimmer-button", "ripple-button"],
  ambient: ["grid-pattern", "dot-pattern", "animated-grid-pattern"],
  text: ["blur-fade", "text-animate", "word-rotate"],
  metric: ["number-ticker", "animated-circular-progress-bar"],
  navigation: ["dock", "animated-list"],
  supporting: ["magic-card", "border-beam", "glare-hover"],
});

const ROLE_LABELS = new Set(Object.keys(ROLE_DEFAULTS));
const HIGH_MOTION = new Set(["expressive"]);

const hash = (value) => {
  let h = 2166136261 >>> 0;
  for (const ch of String(value || "")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n)));
const normalizeRole = (role) => ROLE_LABELS.has(role) ? role : "supporting";
const normalizeMotion = (motion) => ["auto", "none", "subtle", "expressive"].includes(motion) ? motion : "auto";

function chooseSlug({ component, role, sourceBrief, variation }) {
  if (component && COMPONENTS[component]) return component;
  const options = ROLE_DEFAULTS[normalizeRole(role)] || ROLE_DEFAULTS.supporting;
  const index = Number.isFinite(Number(variation))
    ? Math.abs(Math.trunc(Number(variation))) % options.length
    : hash(sourceBrief || role) % options.length;
  return options[index];
}

function motionPlan(component, requested) {
  const defaultIntensity = COMPONENTS[component].motion;
  const intensity = requested === "auto" ? defaultIntensity : requested;
  const expressive = intensity === "expressive";
  const none = intensity === "none";
  return {
    intensity,
    budget: {
      highMotionComponentsPerViewport: 1,
      supportingEffectsPerViewport: 1,
      rule: "one anchor + one supporting effect; never animate every card or every word",
    },
    entrance: none ? "none" : (expressive ? "slow, interruptible reveal" : "short ease-out reveal"),
    interaction: none ? "state change only" : "reversible hover/focus/press feedback",
    idle: none ? "none" : (expressive ? "slow ambient movement only" : "no idle loop unless it carries meaning"),
    reducedMotion: "remove displacement, autoplay, and idle loops; preserve content and instant state feedback",
    finePointerOnly: component === "magic-card" || component === "glare-hover" || component === "dock",
  };
}

export function magicUiComponent({
  component = null,
  role = "supporting",
  surface = "landing",
  sourceBrief = "",
  variation = null,
  motion = "auto",
  density = "default",
  interactive = true,
} = {}) {
  const resolvedRole = normalizeRole(role);
  const slug = chooseSlug({ component, role: resolvedRole, sourceBrief, variation });
  const entry = COMPONENTS[slug];
  const resolvedMotion = normalizeMotion(motion);
  const variantIndex = Number.isFinite(Number(variation))
    ? Math.abs(Math.trunc(Number(variation))) % entry.variants.length
    : hash(`${sourceBrief}|${slug}|${surface}`) % entry.variants.length;
  const variant = entry.variants[variantIndex];
  const motionSpec = motionPlan(slug, resolvedMotion);
  const touch = density === "compact" && surface === "dashboard" ? 44 : 44;
  const states = interactive
    ? ["resting", "hover", "focus-visible", "pressed", "disabled", "loading", "success", "error"]
    : ["resting", "reduced-motion"];

  return {
    schemaVersion: "magic-ui-component.v1",
    provider: {
      name: "Magic UI",
      homepage: MAGIC_UI_HOME,
      docs: MAGIC_UI_DOCS,
      repository: MAGIC_UI_REPO,
      license: "MIT",
      install: `npx shadcn@latest add @magicui/${slug}`,
      contract: "Use the registry implementation as the primitive; customize props and className before forking internals.",
    },
    input: { component, role: resolvedRole, surface, sourceBrief, variation, motion: resolvedMotion, density, interactive },
    selection: {
      slug,
      family: entry.family,
      role: entry.role,
      purpose: entry.purpose,
      reason: sourceBrief ? `selected for ${resolvedRole} in the subject: ${sourceBrief}` : `selected for the ${resolvedRole} role`,
      variant: { id: variant, options: entry.variants },
    },
    composition: {
      hierarchy: "one component carries the moment; nearby content stays quieter",
      anatomy: ["semantic content", "visual treatment", "interaction state", "responsive fallback"],
      slots: ["children", "className", "aria-label", "motion preferences"],
      layering: entry.family === "ambient" ? "background-only, pointer-events-none" : "content first; effect behind or around it",
      rule: "Use one primary anchor and at most one supporting effect in the same viewport.",
    },
    motion: motionSpec,
    interaction: {
      requiredStates: states,
      touchTargetPx: touch,
      keyboard: interactive ? "native semantic element, visible focus, predictable tab order" : "not interactive",
      proximity: ["marquee", "magic-card", "glare-hover", "dock"].includes(slug)
        ? "scope preview to the contiguous group; fine pointer only; never replace selection"
        : "none",
    },
    responsive: {
      desktop: "use the selected variant at the intended scale",
      mobile: "stack or wrap content; preserve the semantic action and remove decorative overflow",
      coarsePointer: "disable pointer-following effects and keep a 44px hit target",
      overflow: "reserve dimensions and never rely on hover to reveal essential content",
    },
    quality: {
      accessibility: ["semantic HTML", "accessible name", "keyboard and focus-visible support", "content remains readable over effects"],
      performance: ["avoid stacking expensive canvas effects", "lazy-load non-critical media", "pause autoplay when offscreen or unfocused"],
      validation: ["render real copy", "test empty/loading/error/success where relevant", "check 200% zoom", "test prefers-reduced-motion"],
    },
    antiSlop: [
      "Do not combine a moving background, moving text, animated border, and animated CTA in one hero.",
      "Do not use a decorative component as the primary proof of a product.",
      "Do not hide core content behind client-only reveal or hover.",
      "Do not create a new visual variant when a prop-level customization is enough.",
    ],
  };
}

export function checkMagicUiComposition({ components = [], surface = "landing", reducedMotion = false } = {}) {
  const list = Array.isArray(components) ? components.filter(Boolean) : [];
  const issues = [];
  const advisories = [];
  const primary = list.filter((item) => ["primary", "hero", "anchor"].includes(item.role));
  const highMotion = list.filter((item) => HIGH_MOTION.has(item.motionIntensity || item.motion));
  const ambient = list.filter((item) => COMPONENTS[item.slug]?.family === "ambient" || item.role === "ambient");

  if (primary.length > 1) issues.push({ code: "MULTIPLE_ANCHORS", message: `${primary.length} primary/hero components compete; keep one visual anchor per viewport` });
  if (highMotion.length > 1) issues.push({ code: "MOTION_STACKING", message: `${highMotion.length} high-motion components are stacked; cap high-motion work at one per viewport` });
  if (ambient.some((item) => ["primary", "hero", "anchor"].includes(item.role))) issues.push({ code: "AMBIENT_AS_PRIMARY", message: "Ambient patterns support content; they cannot be the primary product story" });
  if (list.some((item) => item.autoplay && item.pauseOnFocus !== true && item.pauseOnHover !== true)) {
    issues.push({ code: "AUTOPLAY_NO_PAUSE", message: "Autoplay content must pause on hover/focus and have a reduced-motion/static fallback" });
  }
  if (list.some((item) => item.interactive && (item.keyboard !== true || item.focusVisible !== true))) {
    issues.push({ code: "INTERACTIVE_A11Y", message: "Interactive components need native keyboard behavior and a visible focus state" });
  }
  if (list.some((item) => (item.contentLength || 0) > 120 && ["text", "body"].includes(item.role))) {
    issues.push({ code: "TEXT_MOTION_OVERLOAD", message: "Animate short messages, not long-form reading text" });
  }
  if (list.some((item) => Number(item.opacity) > 0.08 && (item.role === "ambient" || COMPONENTS[item.slug]?.family === "ambient"))) {
    issues.push({ code: "AMBIENT_TOO_STRONG", message: "Ambient effects should stay below 0.08 opacity so contrast and hierarchy survive" });
  }
  if (!reducedMotion && list.some((item) => item.motionIntensity || item.motion)) advisories.push("Add a prefers-reduced-motion path before shipping animated components");
  if (surface === "dashboard" && list.some((item) => item.role === "hero")) advisories.push("Dashboard surfaces usually need a functional anchor, not a landing-page hero");
  if (list.length > 3) advisories.push("Start with one anchor plus one supporting effect; add another only when it carries new meaning");

  return {
    schemaVersion: "magic-ui-composition.v1",
    verdict: issues.length ? "SLOP" : "CLEAN",
    issues,
    advisories,
    budget: { maxPrimaryAnchors: 1, maxHighMotion: 1, maxSupportingEffects: 1, ambientOpacityMax: 0.08 },
    fix: issues.length ? "Remove or demote competing effects, keep semantic content visible, and add keyboard/reduced-motion fallbacks." : null,
  };
}

export const MAGIC_UI_COMPONENT_CATALOG = COMPONENTS;
