// dashboard.mjs — deterministic dashboard geometry + Fluid Functionalism registry plans.
//
// This module is pure: no filesystem, network, clock, or random state. It does not
// imitate Fluid components. It returns install instructions for the real MIT-licensed
// shadcn registry at fluidfunctionalism.com, then limits this engine to layout and the
// surrounding personality layer.

const FLUID_HOME = "https://www.fluidfunctionalism.com";
const FLUID_REPO = "https://github.com/mickadesign/fluid-functionalism";
const FLUID_REGISTRY = `${FLUID_HOME}/r`;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n)));
const finite = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
const snap = (n, base = 4) => Math.round(Number(n) / base) * base;
const unique = (xs) => [...new Set(xs)];

// Names are registry item names, not reimplementations. `base` means Fluid publishes
// a Base UI sibling whose registry slug is `${name}-base`.
export const FLUID_COMPONENT_CATALOG = Object.freeze({
  surfaces: { kind: "foundation", base: false, use: "Eight relative elevation levels." },
  "size-context": { kind: "foundation", base: false, use: "Default 36px and compact 28px density contexts." },
  springs: { kind: "foundation", base: false, use: "Fluid fast, moderate, and slow spring presets." },
  button: { kind: "control", base: true, use: "Primary, secondary, tertiary, ghost, icon, and loading actions." },
  badge: { kind: "data", base: false, use: "Compact labels and status metadata." },
  card: { kind: "surface", base: false, use: "Fluid surface-aware card composition and CardGroup layout." },
  table: { kind: "data", base: false, use: "Proximity-aware, scannable data rows." },
  "input-group": { kind: "control", base: false, use: "Label, error, and proximity-aware text input composition." },
  select: { kind: "control", base: true, use: "Selection with collision-aware animated content." },
  dropdown: { kind: "control", base: true, use: "Proximity hover, animated selection, collision handling, and typeahead." },
  "tabs-subtle": { kind: "navigation", base: true, use: "Proximity-aware tabs with an animated selection pill." },
  tabs: { kind: "navigation", base: true, use: "Prominent dashboard view switching." },
  dialog: { kind: "overlay", base: true, use: "Modal confirmation and focused workflows." },
  tooltip: { kind: "overlay", base: true, use: "Concise secondary explanation." },
  switch: { kind: "control", base: true, use: "Spring-animated boolean settings." },
  slider: { kind: "control", base: true, use: "Continuous ranges and thresholds." },
  "scroll-area": { kind: "layout", base: true, use: "Contained high-density regions." },
  "input-copy": { kind: "control", base: false, use: "Copyable IDs, endpoints, and tokens." },
  "input-message": { kind: "ai", base: false, use: "AI message composer." },
  "thinking-indicator": { kind: "ai", base: false, use: "Compact in-progress AI state." },
  "thinking-steps": { kind: "ai", base: true, use: "Inspectable AI progress and reasoning stages." },
  "chat-message": { kind: "ai", base: false, use: "Conversation message presentation." },
  "ask-user-questions": { kind: "ai", base: false, use: "Structured follow-up questions." },
  "color-picker": { kind: "control", base: false, use: "Color selection when the product genuinely needs it." },
});

const FLUID_PRESETS = Object.freeze({
  core: ["surfaces", "size-context", "springs", "button", "card", "badge", "tooltip"],
  table: ["table", "input-group", "select", "dropdown", "tabs-subtle", "dialog", "switch", "scroll-area"],
  analytics: ["table", "select", "dropdown", "tabs", "slider", "input-copy", "scroll-area"],
  workflow: ["table", "input-group", "select", "dropdown", "tabs-subtle", "dialog", "switch", "scroll-area"],
  ai: ["input-message", "thinking-indicator", "thinking-steps", "chat-message", "ask-user-questions", "scroll-area"],
});

function fluidSlug(name, primitive) {
  const entry = FLUID_COMPONENT_CATALOG[name];
  return primitive === "base" && entry?.base ? `${name}-base` : name;
}

export function fluidComponents({ preset = "table", primitive = "radix", needs = [] } = {}) {
  const resolvedPrimitive = primitive === "base" ? "base" : "radix";
  const presetKey = Object.hasOwn(FLUID_PRESETS, preset) ? preset : "table";
  const requested = Array.isArray(needs) ? needs.map(String) : [];
  const unknown = requested.filter((name) => !FLUID_COMPONENT_CATALOG[name]);
  const names = unique([...FLUID_PRESETS.core, ...FLUID_PRESETS[presetKey], ...requested])
    .filter((name) => FLUID_COMPONENT_CATALOG[name]);
  const components = names.map((name) => {
    const slug = fluidSlug(name, resolvedPrimitive);
    return {
      name,
      slug,
      kind: FLUID_COMPONENT_CATALOG[name].kind,
      use: FLUID_COMPONENT_CATALOG[name].use,
      install: `npx shadcn@latest add @fluid/${slug}`,
      registryUrl: `${FLUID_REGISTRY}/${slug}.json`,
      source: "fluid-functionalism-registry",
    };
  });

  return {
    schemaVersion: "fluid-components.v1",
    provider: {
      name: "Fluid Functionalism",
      homepage: FLUID_HOME,
      repository: FLUID_REPO,
      license: "MIT",
      registryNamespace: "@fluid",
    },
    primitive: resolvedPrimitive,
    preset: presetKey,
    setup: "npx shadcn@latest registry add @fluid",
    components,
    installAll: components.map((item) => item.install),
    unknown,
    contract: [
      "Install these registry sources; do not recreate lookalike controls.",
      "Let Fluid own component anatomy, state transitions, proximity behavior, and spring physics.",
      "Use the dashboard geometry only to place components and compose regions.",
      "Backgrounds, fades, faint patterns, and ambient motion stay outside component internals.",
    ],
  };
}

function densityFor(requested, width) {
  if (requested === "compact" || requested === "default") return requested;
  return width < 1240 ? "compact" : "default";
}

function region(id, x, y, width, height, extra = {}) {
  return {
    id,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
    ...extra,
  };
}

function typeTokens(density, viewportWidth) {
  const compact = density === "compact";
  const responsiveTitle = compact
    ? "clamp(1.25rem, 1.08rem + 0.55vw, 1.5rem)"
    : "clamp(1.375rem, 1.16rem + 0.68vw, 1.75rem)";
  return {
    scale: compact ? "compact" : "default",
    familyRoles: { ui: "body workhorse", data: "tabular sans or monospace", display: "precise sans/slab only" },
    roles: {
      meta: { px: compact ? 11 : 12, lineHeight: compact ? 16 : 16, weight: 500, trackingEm: 0.015 },
      label: { px: compact ? 12 : 13, lineHeight: compact ? 16 : 20, weight: 500, trackingEm: 0 },
      body: { px: compact ? 13 : 14, lineHeight: compact ? 20 : 20, weight: 400, trackingEm: 0 },
      control: { px: compact ? 12 : 13, lineHeight: 16, weight: 500, trackingEm: 0 },
      sectionTitle: { px: compact ? 15 : 17, lineHeight: compact ? 20 : 24, weight: 600, trackingEm: -0.01 },
      pageTitle: { px: compact ? 22 : 24, lineHeight: compact ? 28 : 32, weight: 650, trackingEm: -0.025, css: responsiveTitle },
      metric: { px: viewportWidth < 768 ? 24 : (compact ? 28 : 32), lineHeight: viewportWidth < 768 ? 28 : 36, weight: 600, trackingEm: -0.025, numeric: "tabular-nums" },
    },
    limits: { maximumRoleCount: 7, heroTypeAllowed: false, bodyMeasureCh: [45, 72] },
  };
}

function spacingTokens(base, density) {
  const compact = density === "compact";
  const values = compact ? [4, 8, 12, 16, 20, 24, 32, 40] : [4, 8, 12, 16, 24, 32, 40, 48];
  return {
    base,
    values,
    tokens: Object.fromEntries(values.map((value) => [`s${value / base}`, value])),
    withinControl: compact ? 8 : 8,
    withinGroup: compact ? 12 : 16,
    betweenGroups: compact ? 24 : 32,
    relationshipRule: "between-groups >= 2 * within-group where hierarchy needs separation",
  };
}

function personalityLayers(personality, density) {
  if (personality === "quiet") return [];
  const expressive = personality === "expressive";
  const gridSize = density === "compact" ? 20 : 24;
  return [
    {
      id: "faint-grid",
      role: "background-only",
      opacity: expressive ? 0.045 : 0.028,
      pointerEvents: "none",
      css: `linear-gradient(to right, color-mix(in oklab, var(--foreground) 7%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 7%, transparent) 1px, transparent 1px); background-size: ${gridSize}px ${gridSize}px; mask-image: radial-gradient(circle at 64% 18%, black, transparent 72%)`,
    },
    {
      id: "accent-fade",
      role: "background-only",
      opacity: expressive ? 0.08 : 0.055,
      pointerEvents: "none",
      css: "radial-gradient(60% 52% at 78% -8%, color-mix(in oklab, var(--accent) 14%, transparent), transparent 76%)",
    },
  ];
}

function componentPreset(content) {
  if (content === "analytics") return "analytics";
  if (content === "ai") return "ai";
  if (content === "workflow") return "workflow";
  return "table";
}

function makeContentPlacements({ content, x, y, width, height, columns, gutter, sectionGap, headerHeight, toolbarHeight, base }) {
  const placements = [];
  const colWidth = (width - gutter * (columns - 1)) / columns;
  const atColumns = (id, start, span, top, h, extra = {}) => region(
    id,
    x + start * (colWidth + gutter),
    top,
    span * colWidth + (span - 1) * gutter,
    h,
    { grid: { start: start + 1, span }, ...extra },
  );

  placements.push(region("page-header", x, y, width, headerHeight, { role: "heading", typeRole: "pageTitle" }));
  let cursor = y + headerHeight + sectionGap;
  placements.push(region("toolbar", x, cursor, width, toolbarHeight, { role: "filters-and-actions", fluid: ["input-group", "select", "dropdown", "button"] }));
  cursor += toolbarHeight + sectionGap;
  const remaining = Math.max(snap(240, base), height - (cursor - y));

  if (content === "analytics" || content === "mixed") {
    const metricCount = columns >= 12 ? 4 : (columns >= 6 ? 3 : 2);
    const metricSpan = Math.floor(columns / metricCount);
    const metricHeight = snap(92, base);
    for (let i = 0; i < metricCount; i++) {
      const span = i === metricCount - 1 ? columns - metricSpan * i : metricSpan;
      placements.push(atColumns(`metric-${i + 1}`, metricSpan * i, span, cursor, metricHeight, { role: "metric", fluid: ["card"] }));
    }
    cursor += metricHeight + sectionGap;
    const lowerHeight = Math.max(snap(160, base), height - (cursor - y));
    if (columns >= 12) {
      placements.push(atColumns("primary-chart", 0, 8, cursor, lowerHeight, { role: "primary-work", fluid: ["card", "tabs-subtle"] }));
      placements.push(atColumns("activity", 8, 4, cursor, lowerHeight, { role: "supporting-context", fluid: ["card", "table"] }));
    } else {
      placements.push(atColumns("primary-chart", 0, columns, cursor, lowerHeight, { role: "primary-work", fluid: ["card", "tabs-subtle"] }));
    }
  } else if (content === "ai") {
    if (columns >= 12) {
      placements.push(atColumns("conversation", 0, 8, cursor, remaining, { role: "primary-work", fluid: ["chat-message", "input-message", "thinking-indicator"] }));
      placements.push(atColumns("sources", 8, 4, cursor, remaining, { role: "supporting-context", fluid: ["card", "thinking-steps"] }));
    } else {
      placements.push(atColumns("conversation", 0, columns, cursor, remaining, { role: "primary-work", fluid: ["chat-message", "input-message", "thinking-indicator"] }));
    }
  } else {
    placements.push(atColumns("object-table", 0, columns, cursor, remaining, { role: "primary-work", fluid: ["table", "badge", "dropdown"] }));
  }

  return { placements: placements.map((item) => ({ ...item, parentId: "canvas" })), columnWidth: +colWidth.toFixed(3) };
}

export function dashboardSystem({
  viewportWidth = 1440,
  viewportHeight = 900,
  density = "auto",
  navigation = "sidebar",
  inspector = true,
  content = "table",
  theme = "light",
  personality = "balanced",
  primitive = "radix",
  needs = [],
  base = 4,
} = {}) {
  const width = clamp(finite(viewportWidth, 1440), 320, 7680);
  const height = clamp(finite(viewportHeight, 900), 480, 4320);
  const gridBase = base === 8 ? 8 : 4;
  const resolvedDensity = densityFor(density, width);
  const mobile = width < 768;
  const medium = width >= 768 && width < 1180;
  const columns = mobile ? 1 : (medium ? 6 : 12);
  const gutter = snap(resolvedDensity === "compact" ? 12 : 16, gridBase);
  const outer = snap(mobile ? 16 : (medium ? 24 : 32), gridBase);
  const sectionGap = snap(resolvedDensity === "compact" ? 16 : 24, gridBase);
  const topbarHeight = snap(resolvedDensity === "compact" ? 48 : 56, gridBase);
  const controlHeight = resolvedDensity === "compact" ? 28 : 36;
  const toolbarHeight = snap(Math.max(controlHeight, mobile ? 44 : controlHeight), gridBase);
  const headerHeight = snap(mobile ? 56 : (resolvedDensity === "compact" ? 64 : 72), gridBase);

  let navMode = mobile ? "drawer" : navigation;
  if (!["sidebar", "rail", "top", "drawer"].includes(navMode)) navMode = "sidebar";
  const navWidth = navMode === "top" || navMode === "drawer" ? 0
    : navMode === "rail" ? (resolvedDensity === "compact" ? 56 : 64)
      : snap(clamp(width * 0.18, 224, 264), gridBase);

  const availableAfterNav = width - navWidth;
  let inspectorMode = inspector ? "docked" : "none";
  let inspectorWidth = 0;
  if (inspector && width < 1280) inspectorMode = "drawer";
  if (inspectorMode === "docked") {
    inspectorWidth = snap(clamp(width * 0.22, 280, 360), gridBase);
    if (availableAfterNav - inspectorWidth < 720) {
      inspectorMode = "drawer";
      inspectorWidth = 0;
    }
  }

  const contentTop = navMode === "top" ? topbarHeight : topbarHeight;
  const mainShell = region("main-shell", navWidth, contentTop, width - navWidth - inspectorWidth, height - contentTop, { role: "main" });
  const navRegion = navMode === "top"
    ? region("navigation", 0, 0, width, topbarHeight, { mode: navMode, fluid: ["button", "dropdown"] })
    : region("navigation", 0, 0, navWidth, height, { mode: navMode, fluid: ["button", "tooltip"] });
  const topbar = navMode === "top"
    ? null
    : region("topbar", navWidth, 0, width - navWidth - inspectorWidth, topbarHeight, { fluid: ["button", "input-group", "dropdown"] });
  const inspectorRegion = inspectorMode === "docked"
    ? region("inspector", width - inspectorWidth, topbarHeight, inspectorWidth, height - topbarHeight, { mode: "docked", fluid: ["card", "tabs-subtle", "scroll-area"] })
    : null;

  const availableCanvasWidth = Math.max(280, mainShell.width - outer * 2);
  const columnGridWidth = columns === 1
    ? Math.floor(availableCanvasWidth / gridBase) * gridBase
    : columns * Math.max(gridBase, Math.floor(((availableCanvasWidth - gutter * (columns - 1)) / columns) / gridBase) * gridBase) + gutter * (columns - 1);
  const canvasWidth = Math.min(availableCanvasWidth, columnGridWidth);
  const canvasX = mainShell.x + outer + snap((availableCanvasWidth - canvasWidth) / 2, gridBase);
  const canvasY = mainShell.y + outer;
  const canvasHeight = Math.max(400, mainShell.height - outer * 2);
  const contentPlan = makeContentPlacements({
    content,
    x: canvasX,
    y: canvasY,
    width: canvasWidth,
    height: canvasHeight,
    columns,
    gutter,
    sectionGap,
    headerHeight,
    toolbarHeight,
    base: gridBase,
  });
  const layers = personalityLayers(personality, resolvedDensity);
  const fluid = fluidComponents({ preset: componentPreset(content), primitive, needs });

  return {
    schemaVersion: "dashboard-system.v1",
    inputs: { viewportWidth: width, viewportHeight: height, density: resolvedDensity, navigation: navMode, inspector: inspectorMode, content, theme, personality, primitive: fluid.primitive },
    math: {
      baseGridPx: gridBase,
      breakpoint: mobile ? "mobile" : (medium ? "medium" : "wide"),
      columns,
      gutterPx: gutter,
      outerPaddingPx: outer,
      sectionGapPx: sectionGap,
      columnWidthPx: contentPlan.columnWidth,
      formula: "columnWidth = (canvasWidth - gutter * (columns - 1)) / columns",
    },
    geometry: {
      viewport: region("viewport", 0, 0, width, height),
      shell: [navRegion, topbar, mainShell, inspectorRegion].filter(Boolean).map((item) => ({ ...item, parentId: "viewport" })),
      canvas: region("canvas", canvasX, canvasY, canvasWidth, canvasHeight, { columns, gutter, parentId: "main-shell" }),
      placements: contentPlan.placements,
      overlays: inspectorMode === "drawer" ? [{ id: "inspector-drawer", width: Math.min(360, width - 32), trigger: "explicit" }] : [],
      cssVariables: {
        "--dashboard-grid": `${gridBase}px`,
        "--dashboard-gutter": `${gutter}px`,
        "--dashboard-outer": `${outer}px`,
        "--dashboard-section-gap": `${sectionGap}px`,
        "--dashboard-control-height": `${controlHeight}px`,
        "--dashboard-columns": columns,
      },
    },
    typography: typeTokens(resolvedDensity, width),
    spacing: spacingTokens(gridBase, resolvedDensity),
    controls: {
      visualHeightPx: controlHeight,
      coarsePointerTargetPx: 44,
      implementation: "Use Fluid SizeContext for 28px compact or 36px default controls; add a 44px hit target for coarse pointers without visually inflating desktop density.",
    },
    surfaces: {
      source: "@fluid/surfaces",
      roles: { app: 1, navigation: 1, canvas: 1, card: 2, raisedCard: 3, popover: "parent + 2", dialog: "parent + 3", toast: 8 },
      rule: "Elevation is relative to the substrate; do not flatten the eight Fluid levels into one generic card shadow.",
    },
    personality: {
      placement: "background-and-margins-only",
      layers,
      ambientMotion: personality === "expressive"
        ? { id: "pattern-drift", durationMs: 18000, distancePx: 24, easing: "linear", reducedMotion: "none", appliesTo: "faint-grid only" }
        : null,
      rule: "At most two decorative layers. They never intercept input, reduce data contrast, or replace component state feedback.",
    },
    motion: {
      componentSource: "@fluid/springs",
      componentRule: "Do not override Fluid component spring behavior; it encodes hover preview, selection continuity, and reversal.",
      pageTransitions: { fastMs: 80, moderateMs: 160, slowMs: 240, feedbackMaxMs: 500 },
      reducedMotion: "Remove ambient drift and displacement; preserve instant state communication.",
    },
    fluid,
    invariants: [
      "All functional controls come from the returned Fluid registry manifest.",
      "Coordinates, gaps, and sizes align to the selected base grid.",
      "The primary work region dominates; the inspector is supporting context.",
      "Dashboard type stays compact; hero-sized display type is forbidden.",
      "Personality decor remains behind content and outside component internals.",
    ],
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function checkDashboardLayout({
  viewportWidth = 1440,
  viewportHeight = 900,
  base = 4,
  density = "default",
  regions = [],
  components = [],
  personalityLayers: layers = [],
} = {}) {
  const width = clamp(finite(viewportWidth, 1440), 320, 7680);
  const height = clamp(finite(viewportHeight, 900), 480, 4320);
  const gridBase = base === 8 ? 8 : 4;
  const issues = [];
  const advisories = [];
  const normalized = (Array.isArray(regions) ? regions : []).map((item, index) => ({
    id: String(item?.id || `region-${index + 1}`),
    x: finite(item?.x, 0), y: finite(item?.y, 0), width: finite(item?.width, 0), height: finite(item?.height, 0),
    overlay: item?.overlay === true,
    parentId: String(item?.parentId || "root"),
  }));

  for (const item of normalized) {
    if (item.width <= 0 || item.height <= 0) issues.push({ code: "NON_POSITIVE_REGION", region: item.id, fix: "Give the region positive width and height." });
    if (item.x < 0 || item.y < 0 || item.x + item.width > width || item.y + item.height > height) issues.push({ code: "OUT_OF_BOUNDS", region: item.id, fix: "Keep all four region edges inside the viewport." });
    for (const [key, value] of Object.entries({ x: item.x, y: item.y, width: item.width, height: item.height })) {
      if (Math.abs(value / gridBase - Math.round(value / gridBase)) > 1e-6) issues.push({ code: "OFF_GRID", region: item.id, property: key, value, fix: snap(value, gridBase) });
    }
  }
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      if (normalized[i].parentId === normalized[j].parentId && !normalized[i].overlay && !normalized[j].overlay && overlaps(normalized[i], normalized[j])) {
        issues.push({ code: "REGION_OVERLAP", regions: [normalized[i].id, normalized[j].id], fix: "Separate the regions or mark a true transient overlay explicitly." });
      }
    }
  }

  const componentList = Array.isArray(components) ? components : [];
  if (!componentList.length) issues.push({ code: "MISSING_COMPONENT_PROVENANCE", fix: "Pass every functional component with source: fluid-functionalism-registry." });
  for (const component of componentList) {
    if (component?.source !== "fluid-functionalism-registry") issues.push({ code: "NON_FLUID_COMPONENT", component: component?.name || "unknown", fix: "Install the matching @fluid registry component; do not ship a lookalike." });
    if (Number.isFinite(Number(component?.height))) {
      const expected = density === "compact" ? 28 : 36;
      if (Number(component.height) !== expected) advisories.push({ code: "CONTROL_DENSITY_MISMATCH", component: component?.name || "unknown", expected, actual: Number(component.height) });
    }
  }
  const decor = Array.isArray(layers) ? layers : [];
  if (decor.length > 2) issues.push({ code: "DECOR_LAYER_SPRAWL", count: decor.length, fix: "Keep at most two background personality layers." });
  for (const layer of decor) {
    if (finite(layer?.opacity, 0) > 0.08) issues.push({ code: "DECOR_TOO_STRONG", layer: layer?.id || "unknown", fix: "Cap decorative opacity at 0.08." });
    if (layer?.pointerEvents !== "none") issues.push({ code: "DECOR_INTERCEPTS_INPUT", layer: layer?.id || "unknown", fix: "Set pointer-events: none." });
  }

  return {
    schemaVersion: "dashboard-layout-audit.v1",
    verdict: issues.length ? "SLOP" : "CLEAN",
    issues,
    advisories,
    checked: { regions: normalized.length, components: componentList.length, personalityLayers: decor.length, baseGridPx: gridBase },
    baseline: issues.length ? dashboardSystem({ viewportWidth: width, viewportHeight: height, base: gridBase, density }) : null,
  };
}
