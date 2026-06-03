import { describe, it, expect } from "vitest";
import {
  diagnoseImprovements,
  suggestReplacements,
  fontGroupsForVibe,
  palettesForVibe,
  FONT_GROUPS,
  FRESH_PALETTES,
  type SwapCandidate,
} from "./index.js";

describe("diagnoseImprovements", () => {
  it("flags a slop hero, body, and the style tells", () => {
    const imp = diagnoseImprovements({
      heroFont: "Inter", heroIsSlop: true, heroIsFoundational: true,
      bodyFont: "Inter", bodyIsSlop: true,
      tells: { aiPurpleGradient: true, glassmorphism: true, pillButtons: true },
    });
    const tells = imp.map((i) => i.tell.toLowerCase()).join(" ");
    expect(tells).toContain("inter");
    expect(tells).toContain("gradient");
    expect(tells).toContain("glassmorphic");
    expect(tells).toContain("pill");
    expect(imp.every((i) => i.fix.length > 0)).toBe(true);
  });

  it("returns nothing for a clean site", () => {
    const imp = diagnoseImprovements({
      heroFont: "Bitcount", heroIsSlop: false, heroIsFoundational: false,
      bodyFont: "Public Sans", bodyIsSlop: false, tells: {},
    });
    expect(imp).toEqual([]);
  });
});

describe("suggestReplacements", () => {
  const cands: SwapCandidate[] = [
    { id: "fresh-similar", family: "Fresh Similar", category: "sans-serif", personality: { professional: 0.8, calm: 0.6 }, displaySaturation: 0.05 },
    { id: "slop-similar", family: "Slop Similar", category: "sans-serif", personality: { professional: 0.8, calm: 0.6 }, displaySaturation: 0.9 },
    { id: "fresh-different", family: "Fresh Different", category: "display", personality: { playful: 0.9, bold: 0.8 }, displaySaturation: 0.02 },
  ];

  it("returns a same-vibe fresh font and excludes the saturated one", () => {
    const out = suggestReplacements({ personality: { professional: 0.9, calm: 0.5 }, category: "sans-serif" }, cands);
    expect(out.map((s) => s.family)).toContain("Fresh Similar");
    expect(out.map((s) => s.family)).not.toContain("Slop Similar"); // too saturated
  });

  it("ranks the similar-vibe match above the dissimilar one", () => {
    const out = suggestReplacements({ personality: { professional: 0.9, calm: 0.5 }, category: "sans-serif" }, cands);
    expect(out[0]!.family).toBe("Fresh Similar");
  });
});

describe("recommendation catalog", () => {
  it("font groups use real distinct hero/body and tag vibes", () => {
    for (const g of FONT_GROUPS) {
      expect(g.hero).not.toBe(g.body);
      expect(g.vibes.length).toBeGreaterThan(0);
    }
  });
  it("filters by vibe, falling back to the full set", () => {
    expect(fontGroupsForVibe("gaming-esports").length).toBeGreaterThan(0);
    expect(fontGroupsForVibe("nonexistent").length).toBe(FONT_GROUPS.length);
    expect(palettesForVibe("luxury-fashion").some((p) => p.id === "forest-luxe")).toBe(true);
  });
  it("every palette declares what slop default it avoids", () => {
    for (const p of FRESH_PALETTES) expect(p.avoids.length).toBeGreaterThan(0);
  });
});
