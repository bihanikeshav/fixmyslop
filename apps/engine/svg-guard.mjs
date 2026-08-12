// Deterministic SVG safety/quality gate.
//
// This is intentionally conservative. LLMs are good at describing an icon or
// diagram and unreliable at inventing raw path geometry, so the default
// contract rejects the failure modes that produce blank, stretched, unsafe, or
// inaccessible SVGs. It does not try to judge taste from path data.

const NUM = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d+)?";

function attrs(tag) {
  const out = {};
  const rx = /([:\w-]+)\s*=\s*(["'])(.*?)\2/g;
  let match;
  while ((match = rx.exec(tag))) out[match[1].toLowerCase()] = match[3];
  return out;
}

function issue(code, message, fix, severity = "error") {
  return { code, message, fix, severity };
}

function finiteDimension(value) {
  if (value == null || /(?:nan|infinity)/i.test(value)) return false;
  const match = String(value).trim().match(new RegExp(`^${NUM}(?:px|pt|em|rem|%)?$`, "i"));
  return !!match && Number.isFinite(Number.parseFloat(value));
}

function positiveDimension(value) {
  return finiteDimension(value) && Number.parseFloat(value) > 0;
}

function parseViewBox(value) {
  const values = String(value || "").trim().split(/[ ,]+/).map(Number);
  return values.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0 ? values : null;
}

export function validateSvg(markup, { kind = "icon", label = null, allowIllustration = false } = {}) {
  const source = String(markup || "");
  const errors = [];
  const warnings = [];
  const gates = {
    root: false,
    viewBox: false,
    geometry: false,
    safety: true,
    references: true,
    aspectRatio: false,
    accessibility: false,
    provenance: kind !== "illustration" || allowIllustration,
  };

  if (!source.trim()) {
    errors.push(issue("empty", "SVG markup is empty.", "Provide a complete <svg> root with geometry."));
    return { schemaVersion: "svg-guard.v1", pass: false, verdict: "REJECT", kind, errors, warnings, gates };
  }
  if (source.length > 250_000) errors.push(issue("oversized", "SVG exceeds 250 KB.", "Use a compact icon/diagram or an image asset instead."));
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source) || !/<\/svg>\s*$/i.test(source)) {
    errors.push(issue("root", "SVG must contain one complete root element.", "Start with <svg ...> and end with </svg>."));
  } else {
    gates.root = true;
  }
  const rootMatch = source.match(/<svg\b[^>]*>/i);
  const root = attrs(rootMatch?.[0] || "");
  if (!root.viewbox) errors.push(issue("viewbox-missing", "A viewBox is required; width/height alone are not a stable coordinate system.", "Add viewBox=\"0 0 WIDTH HEIGHT\" with positive dimensions."));
  else if (!parseViewBox(root.viewbox)) errors.push(issue("viewbox-invalid", "viewBox must contain four finite values with positive width and height.", "Use four numbers such as viewBox=\"0 0 24 24\"."));
  else gates.viewBox = true;
  if (root.width && !positiveDimension(root.width)) errors.push(issue("width-invalid", "SVG width is zero, non-finite, or malformed.", "Use a positive CSS dimension or omit width and size through CSS."));
  if (root.height && !positiveDimension(root.height)) errors.push(issue("height-invalid", "SVG height is zero, non-finite, or malformed.", "Use a positive CSS dimension or omit height and size through CSS."));
  if (root.viewbox && !root.preserveaspectratio && kind !== "icon") warnings.push(issue("aspect-ratio-explicit", "Illustrations and diagrams should declare preserveAspectRatio.", "Add preserveAspectRatio=\"xMidYMid meet\" so the composition cannot stretch.", "warning"));
  gates.aspectRatio = !!root.preserveaspectratio || kind === "icon";

  const lower = source.toLowerCase();
  if (/<(?:script|foreignobject|iframe|object|embed)\b/i.test(source)) {
    errors.push(issue("unsafe-element", "Scripts, foreign objects, and embedded documents are forbidden.", "Use static SVG geometry; use application code outside the SVG for behavior."));
    gates.safety = false;
  }
  if (/\bon[a-z]+\s*=\s*["']/i.test(source)) {
    errors.push(issue("event-handler", "Inline SVG event handlers are forbidden.", "Attach interaction in the host component, not in SVG markup."));
    gates.safety = false;
  }

  // SVG links are an execution surface, not just an image-loading surface:
  // `javascript:`/`vbscript:` can execute when a linked node is activated, while
  // relative, data, and network URLs make the result depend on an external host.
  // The only URL-like references this gate accepts are same-document fragments.
  const fragmentRefs = [];
  let hasUnsafeRef = false;
  for (const match of source.matchAll(/(?:href|xlink:href)\s*=\s*(["'])(.*?)\1/gi)) {
    const target = match[2].trim();
    if (target.startsWith("#") && target.length > 1) fragmentRefs.push(target.slice(1));
    else if (target) hasUnsafeRef = true;
  }
  for (const match of source.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)'"\s]+))\s*\)/gi)) {
    const target = String(match[2] ?? match[3] ?? "").trim();
    if (target.startsWith("#") && target.length > 1) fragmentRefs.push(target.slice(1));
    else if (target) hasUnsafeRef = true;
  }
  if (hasUnsafeRef) {
    errors.push(issue("external-reference", "Only same-document fragment references are allowed; external, relative, data, and executable URL schemes are forbidden.", "Use url(#local-id) / href=\"#local-id\", or move navigation and external assets into trusted host markup."));
    gates.safety = false;
    gates.references = false;
  }
  if (/<(?:animate|set|animatemotion|animatetransform)\b/i.test(source)) warnings.push(issue("embedded-animation", "Embedded SVG animation is difficult to validate across browsers.", "Animate the host element with CSS/GSAP and provide reduced-motion behavior.", "warning"));
  if (/(?:nan|infinity)/i.test(source)) errors.push(issue("nonfinite-geometry", "SVG contains NaN or Infinity geometry.", "Generate coordinates from finite data and validate before writing markup."));

  const geometryTags = source.match(/<(?:path|circle|ellipse|rect|line|polyline|polygon|use)\b/gi) || [];
  if (!geometryTags.length) errors.push(issue("no-geometry", "SVG contains no drawable geometry.", "Use a vetted icon/illustration asset or add valid path/shape geometry."));
  else gates.geometry = true;
  for (const tag of source.match(/<[^>]+>/g) || []) {
    const tagName = tag.match(/^<\s*([:\w-]+)/)?.[1]?.toLowerCase();
    if (!tagName || tagName.startsWith("/")) continue;
    const a = attrs(tag);
    for (const key of ["x", "y", "cx", "cy", "r", "rx", "ry", "width", "height", "x1", "x2", "y1", "y2"]) {
      const valid = ["width", "height", "r", "rx", "ry"].includes(key) ? positiveDimension(a[key]) : finiteDimension(a[key]);
      if (a[key] != null && !valid) errors.push(issue("invalid-dimension", `${tagName}.${key} is not valid geometry.`, "Use finite numeric coordinates; dimensions/radii must be positive; never emit NaN or Infinity."));
    }
    if (tagName === "path" && (!a.d || !a.d.trim())) errors.push(issue("empty-path", "A path element has no d data.", "Remove the empty path or provide validated path data."));
  }

  const ids = [];
  for (const match of source.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) ids.push(match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) errors.push(issue("duplicate-id", `Duplicate SVG id(s): ${[...new Set(duplicateIds)].join(", ")}.`, "Make every definition id unique within the document."));
  for (const ref of fragmentRefs) {
    if (!ids.includes(ref)) {
      errors.push(issue("broken-reference", `SVG references missing id #${ref}.`, "Define the referenced gradient/filter/clipPath or remove the reference."));
      gates.references = false;
    }
  }

  const decorative = root["aria-hidden"] === "true" || root.role === "presentation" || root.role === "none";
  const informative = !decorative && (kind !== "icon" || !!label || !!root["aria-label"] || !!source.match(/<title\b/i));
  if (decorative) {
    gates.accessibility = true;
    if (root["aria-label"] || root.role === "img") warnings.push(issue("decorative-label", "Decorative SVG should not expose a conflicting accessible label.", "Use aria-hidden=\"true\" and remove the label.", "warning"));
  } else if (informative && (root["aria-label"] || label || /<title\b/i.test(source))) {
    gates.accessibility = true;
  } else {
    errors.push(issue("accessibility", "Informative SVG needs a title or accessible label.", "Add <title>…</title> or aria-label, or mark a purely decorative icon aria-hidden=\"true\"."));
  }

  if (kind === "illustration" && !allowIllustration) errors.push(issue("illustration-provenance", "Raw LLM-authored illustrative SVG is blocked by default.", "Use a reviewed asset or call with allowIllustration=true plus a supplied subject/provenance record."));
  if (kind === "icon" && /<text\b/i.test(source)) warnings.push(issue("text-in-icon", "Text inside icons is fragile at small sizes.", "Prefer an icon library glyph or host HTML text.", "warning"));
  if (lower.includes("<filter") && !root.viewbox) errors.push(issue("filter-without-space", "Filters without a viewBox can clip unpredictably.", "Add a viewBox and explicit filter regions, or use CSS shadow."));

  if (!gates.provenance) errors.push(issue("provenance", "Illustration provenance is required before it enters a generated page.", "Record source asset, license, and subject alignment."));
  const pass = errors.length === 0;
  return {
    schemaVersion: "svg-guard.v1",
    pass,
    verdict: pass ? (warnings.length ? "PASS-WITH-WARNINGS" : "PASS") : "REJECT",
    kind,
    errors,
    warnings,
    gates,
    policy: {
      noScripts: true,
      noExternalReferences: true,
      viewBoxRequired: true,
      hostManagedMotion: true,
      reviewedIllustrationRequired: kind === "illustration",
    },
  };
}
