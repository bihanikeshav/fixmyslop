import { describe, it, expect } from "vitest";
import {
  diagnoseImprovements,
  fontGroupsForVibe,
  palettesForVibe,
  FONT_GROUPS,
  FRESH_PALETTES,
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
