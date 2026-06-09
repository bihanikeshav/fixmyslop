import { describe, it, expect } from "vitest";
// The color model lives as standalone Node ESM under viz/personality-test/color
// (it ships next to slop-check.mjs as a runnable CLI). We import the pure .mjs
// modules directly; vitest resolves .mjs fine. No types — treat as any.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  hexToRgb, rgbToHex, hexToOklab, oklabToSrgb, hexToOklch,
  srgbToLinear, linearToSrgb, linearToOklab, oklabToLinear,
  contrastRatio, isInGamut,
} from "../../../viz/personality-test/color/color-space.mjs";
import {
  classify, isOverused, isNeutral, hardBanned, nearestSafe, densityHex,
  nearDuplicates,
} from "../../../viz/personality-test/color/density.mjs";

describe("color-space conversions", () => {
  it("round-trips hex <-> rgb", () => {
    expect(hexToRgb("#6366f1")).toEqual([0x63, 0x66, 0xf1]);
    expect(rgbToHex([0x63, 0x66, 0xf1])).toBe("#6366f1");
    // 3-digit shorthand expands
    expect(hexToRgb("#abc")).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it("round-trips sRGB <-> linear within tolerance", () => {
    for (const c of [[0, 0, 0], [0.2, 0.5, 0.9], [1, 1, 1]]) {
      const back = linearToSrgb(srgbToLinear(c));
      for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(c[i], 6);
    }
  });

  it("round-trips linear <-> OKLab within tolerance", () => {
    for (const c of [[0.05, 0.1, 0.4], [0.5, 0.5, 0.5], [0.9, 0.2, 0.1]]) {
      const back = oklabToLinear(linearToOklab(c));
      for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(c[i], 5);
    }
  });

  it("round-trips hex -> OKLab -> sRGB hex for in-gamut colors", () => {
    for (const hex of ["#6366f1", "#b85c2a", "#1a120b", "#f5f5f5"]) {
      const { hex: back, inGamut } = oklabToSrgb(hexToOklab(hex));
      expect(inGamut).toBe(true);
      expect(back).toBe(hex.toLowerCase());
    }
  });

  it("knows pure white/black are extreme OKLCH lightness", () => {
    expect(hexToOklch("#ffffff")[0]).toBeCloseTo(1, 2);
    expect(hexToOklch("#000000")[0]).toBeCloseTo(0, 2);
  });

  it("WCAG contrast(#000,#fff) ~= 21", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("flags out-of-gamut OKLab as not in gamut", () => {
    // a wildly over-saturated OKLab point (huge chroma) is not renderable
    expect(isInGamut([0.6, 0.5, 0.5])).toBe(false);
  });
});

describe("hard bans (must agree with slop-colors.md)", () => {
  it("flags the literal slop hexes", () => {
    for (const h of ["#6366f1", "#7c3aed", "#8b5cf6", "#818cf8", "#2563eb", "#3b82f6", "#22d3ee", "#2dd4bf"]) {
      expect(hardBanned(h), `${h} banned`).toBeTruthy();
    }
  });

  it("flags indigo/violet (1A) and fintech blue (1E) by band", () => {
    expect(hardBanned("#4f46e5")).toMatch(/1A/);   // indigo-600
    expect(hardBanned("#3b82f6")).toBeTruthy();     // blue-500 (literal)
  });

  it("does NOT ban an ink-ultramarine (dark blue reads as ink, not AI blue)", () => {
    // oklch(~0.35 0.18 255) — L<0.45 so the 1E gate does not apply
    expect(hardBanned("#1e2a6b")).toBeNull();
  });

  it("does NOT ban earthy / unexpected hues", () => {
    for (const h of ["#8a2e5e", "#6b2d4a", "#a66040", "#5e6e58"]) {
      expect(hardBanned(h), `${h} not banned`).toBeNull();
    }
  });
});

describe("overuse density classifier", () => {
  it("flags the canonical Tailwind slop (via ban and/or density)", () => {
    for (const h of ["#6366f1", "#2563eb"]) {
      const c = classify(h);
      expect(["HARD-BANNED", "OVERUSED"]).toContain(c.verdict);
    }
  });

  it("passes a deliberately off-corpus color as SAFE", () => {
    // #8a2e5e is a deep magenta-rose: verified low-density, not banned, enough
    // chroma to read as intentional. (Note: a deep BRICK like #7a2e1e is NOT a
    // good pick here — our own builds over-use warm earth, so brick reads as
    // OVERUSED in this corpus, which is the self-heating loop working.)
    const c = classify("#8a2e5e");
    expect(c.verdict).toBe("SAFE");
    expect(c.density).toBeLessThan(18);
  });

  it("exempts neutrals from the density penalty", () => {
    for (const h of ["#111111", "#f5f5f5", "#1a120b"]) {
      expect(isNeutral(h), `${h} neutral`).toBe(true);
      expect(classify(h).verdict).toBe("NEUTRAL-ok");
      expect(isOverused(h)).toBe(false);
    }
  });
});

describe("nearestSafe snapping", () => {
  it("returns in-gamut, lower-density, non-banned suggestions", () => {
    const before = densityHex("#6366f1");
    const sugg = nearestSafe("#6366f1");
    expect(sugg.length).toBeGreaterThan(0);
    for (const s of sugg) {
      expect(isInGamut(hexToOklab(s.hex))).toBe(true);
      expect(hardBanned(s.hex)).toBeNull();
      expect(s.density).toBeLessThan(18);          // below the overuse threshold
    }
    // at least the top suggestion is lower density than (or equal to) the input
    expect(sugg[0].density).toBeLessThanOrEqual(before);
  });

  it("snaps an OVERUSED earthy color to a lower-density neighbour", () => {
    const c = classify("#7c4b2a"); // warm brown we over-use
    expect(c.verdict).toBe("OVERUSED");
    const sugg = nearestSafe("#7c4b2a");
    expect(sugg.length).toBeGreaterThan(0);
    expect(sugg[0].density).toBeLessThan(c.density);
  });
});

describe("intra-set near-duplicates", () => {
  it("flags two colors within ~JND of each other", () => {
    const dupes = nearDuplicates(["#1a1810", "#1e1810", "#a66040"]);
    expect(dupes.length).toBe(1);
    expect(dupes[0].delta).toBeLessThan(0.05);
  });
});
