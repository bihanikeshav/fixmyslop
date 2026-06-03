/**
 * Deterministic, LLM-free role classification.
 *
 * Given the rendered elements of a page (font family + size + position + text),
 * decide which font is the DISPLAY/HERO font (where slop is measured) and which
 * is the BODY font. Pure rules, fully auditable — same input always yields the
 * same answer.
 */

export interface RenderedElement {
  /** Resolved first family from the computed font-family stack, normalized. */
  fontFamily: string;
  /** Computed font-size in px. */
  fontSizePx: number;
  /** Visible text length (used to weight body-font dominance). */
  textLength: number;
  /** Is this the page's first <h1> (or an aria heading level 1)? */
  isH1: boolean;
  /** Was the element within the initial viewport (above the fold)? */
  aboveFold: boolean;
}

export interface RoleResult {
  /** The display/hero font, or null if the page had no usable elements. */
  heroFont: string | null;
  /** The dominant body font by total text length, or null. */
  bodyFont: string | null;
}

/**
 * Hero font selection rule (in priority order):
 *   1. The first <h1> that is above the fold, if any.
 *   2. Otherwise the element with the largest font-size among above-fold elements.
 *   3. Otherwise the largest font-size on the page.
 * Ties broken deterministically by larger font size, then by family name (asc).
 */
export function classifyRoles(elements: readonly RenderedElement[]): RoleResult {
  if (elements.length === 0) return { heroFont: null, bodyFont: null };

  const heroFont = pickHero(elements);
  const bodyFont = pickBody(elements);
  return { heroFont, bodyFont };
}

function pickHero(elements: readonly RenderedElement[]): string {
  const aboveFold = elements.filter((e) => e.aboveFold);
  const pool = aboveFold.length > 0 ? aboveFold : elements;

  const h1s = pool.filter((e) => e.isH1);
  const candidates = h1s.length > 0 ? h1s : pool;

  // Largest font-size wins; tiebreak by family name for determinism.
  const winner = [...candidates].sort(
    (a, b) => b.fontSizePx - a.fontSizePx || cmp(a.fontFamily, b.fontFamily),
  )[0]!;
  return winner.fontFamily;
}

function pickBody(elements: readonly RenderedElement[]): string {
  // Dominant family by total visible text length.
  const byFamily = new Map<string, number>();
  for (const e of elements) {
    byFamily.set(e.fontFamily, (byFamily.get(e.fontFamily) ?? 0) + e.textLength);
  }
  const ranked = [...byFamily.entries()].sort(
    (a, b) => b[1] - a[1] || cmp(a[0], b[0]),
  );
  return ranked[0]![0];
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Normalize a CSS font-family stack to its first concrete family, lowercased. */
export function normalizeFamily(stack: string): string {
  const first = stack.split(",")[0] ?? "";
  return first.trim().replace(/^["']|["']$/g, "").toLowerCase();
}
