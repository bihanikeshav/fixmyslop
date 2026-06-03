import { describe, it, expect } from "vitest";
import { analyzePage, type CrawlElement } from "./analyze.js";

const el = (over: Partial<CrawlElement> & { fontFamilyStack: string; tag: string }): CrawlElement => ({
  fontSizePx: 16,
  fontWeight: 400,
  textLength: 20,
  aboveFold: true,
  ...over,
});

describe("analyzePage", () => {
  const page = [
    el({ fontFamilyStack: '"Clash Display", sans-serif', tag: "h1", fontSizePx: 64, textLength: 12 }),
    el({ fontFamilyStack: "Space Grotesk", tag: "h2", fontSizePx: 32, textLength: 8 }),
    el({ fontFamilyStack: "Inter, system-ui", tag: "p", fontSizePx: 16, textLength: 500 }),
    el({ fontFamilyStack: "Inter, system-ui", tag: "p", fontSizePx: 16, textLength: 300, aboveFold: false }),
    el({ fontFamilyStack: "JetBrains Mono", tag: "code", fontSizePx: 14, textLength: 11 }),
  ];

  it("assigns each role to the right font", () => {
    const p = analyzePage(page);
    expect(p.heroFont).toBe("clash display");
    expect(p.headingFont).toBe("space grotesk");
    expect(p.bodyFont).toBe("inter");
    expect(p.monoFont).toBe("jetbrains mono");
  });

  it("aggregates all fonts by usage with roles tagged", () => {
    const p = analyzePage(page);
    expect(p.allFonts[0]!.family).toBe("inter"); // most text
    const hero = p.allFonts.find((f) => f.family === "clash display")!;
    expect(hero.roles).toContain("hero");
    expect(hero.maxSizePx).toBe(64);
  });

  it("handles an empty page", () => {
    expect(analyzePage([])).toEqual({
      heroFont: null, headingFont: null, bodyFont: null, monoFont: null, allFonts: [],
    });
  });

  it("ignores whitespace-only / empty text elements", () => {
    const p = analyzePage([el({ fontFamilyStack: "Inter", tag: "p", textLength: 0 })]);
    expect(p.bodyFont).toBeNull();
  });
});
