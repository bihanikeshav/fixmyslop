import { describe, it, expect } from "vitest";
import { isGlow, radiusClass, detectBento, CHROMA_CUTOFF, type ElementStyle } from "./crawl-features.js";

const baseEl = (over: Partial<ElementStyle> = {}): ElementStyle => ({
  color: "rgb(0, 0, 0)",
  backgroundColor: "rgba(0, 0, 0, 0)",
  borderColor: null,
  backgroundImage: "none",
  boxShadow: "none",
  textShadow: "none",
  filter: "none",
  backdropFilter: "none",
  borderRadius: 0,
  transitionProperty: "none",
  transitionDuration: "0s",
  transitionTiming: "ease",
  animationName: "none",
  fontFamily: "Inter",
  fontWeight: 400,
  fontSize: 16,
  textTransform: "none",
  letterSpacing: "normal",
  area: 100000,
  aboveFold: true,
  ...over,
});

describe("isGlow", () => {
  it("is false for 'none'", () => {
    expect(isGlow("none")).toBe(false);
  });

  it("is false for a grey/black shadow (no chromatic color)", () => {
    expect(isGlow("0 4px 12px rgba(0, 0, 0, 0.25)")).toBe(false);
  });

  it("is true for a saturated chromatic shadow (a colored glow)", () => {
    // Vivid purple, high chroma — a classic AI-slop glow.
    expect(isGlow("0 0 40px rgba(168, 85, 247, 0.6)")).toBe(true);
  });

  it("ignores a fully-transparent chromatic shadow color", () => {
    expect(isGlow("0 0 40px rgba(168, 85, 247, 0)")).toBe(false);
  });

  it("is true if ANY of multiple shadow layers is chromatic", () => {
    expect(isGlow("0 1px 2px rgba(0,0,0,0.2), 0 0 30px rgba(59, 130, 246, 0.5)")).toBe(true);
  });
});

describe("radiusClass", () => {
  it("classifies 0px as sharp", () => {
    expect(radiusClass(0)).toBe("sharp");
  });
  it("classifies just under the rounded threshold (7px) as sharp", () => {
    expect(radiusClass(7)).toBe("sharp");
  });
  it("classifies the rounded threshold (8px) as rounded", () => {
    expect(radiusClass(8)).toBe("rounded");
  });
  it("classifies a mid value (24px) as rounded", () => {
    expect(radiusClass(24)).toBe("rounded");
  });
  it("classifies just under the pill threshold (99px) as rounded", () => {
    expect(radiusClass(99)).toBe("rounded");
  });
  it("classifies the pill threshold (100px) as pill", () => {
    expect(radiusClass(100)).toBe("pill");
  });
  it("classifies a very large radius as pill", () => {
    expect(radiusClass(9999)).toBe("pill");
  });
});

describe("CHROMA_CUTOFF", () => {
  it("is the documented 0.03 value shared with crawl-colors.ts", () => {
    expect(CHROMA_CUTOFF).toBe(0.03);
  });
});

describe("detectBento", () => {
  const card = (over: Partial<ElementStyle> = {}): ElementStyle =>
    baseEl({ borderRadius: 12, area: 60000, boxShadow: "0 2px 8px rgba(0,0,0,0.1)", ...over });

  it("is false with no elements", () => {
    expect(detectBento([])).toBe(false);
  });

  it("is false with fewer than 6 card-shaped elements", () => {
    expect(detectBento([card(), card(), card(), card(), card()])).toBe(false);
  });

  it("is true with 6+ rounded, shadowed/bordered, mid-area elements", () => {
    expect(detectBento([card(), card(), card(), card(), card(), card()])).toBe(true);
  });

  it("does not count sharp-cornered elements as cards", () => {
    const sharp = card({ borderRadius: 0 });
    expect(detectBento([sharp, sharp, sharp, sharp, sharp, sharp])).toBe(false);
  });

  it("does not count elements with no shadow AND no border as cards", () => {
    const flat = card({ boxShadow: "none", borderColor: null });
    expect(detectBento([flat, flat, flat, flat, flat, flat])).toBe(false);
  });

  it("accepts a border in place of a shadow", () => {
    const bordered = card({ boxShadow: "none", borderColor: "rgb(230,230,230)" });
    expect(detectBento([bordered, bordered, bordered, bordered, bordered, bordered])).toBe(true);
  });

  it("excludes elements outside the card-area window (too small or too large)", () => {
    const tiny = card({ area: 100 });
    const huge = card({ area: 5_000_000 });
    expect(detectBento([tiny, tiny, tiny, huge, huge, huge])).toBe(false);
  });
});
