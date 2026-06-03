import { describe, it, expect } from "vitest";
import {
  metricsFloorPass,
  metricsFloorFailures,
  objectiveQuality,
  compositeQuality,
  personalityMatch,
  classifyRoles,
  normalizeFamily,
  computeSaturation,
  DEFAULT_SATURATION_CONFIG,
  recommend,
  slopScore,
  type FontMetrics,
  type FontRecord,
  type Candidate,
  type RecommendQuery,
  type Observation,
  type SaturationStat,
} from "./index.js";

const goodMetrics: FontMetrics = {
  xHeightRatio: 0.52,
  apertureOpenness: 0.7,
  counterSize: 0.6,
  strokeContrast: 0.35,
  weightCount: 6,
  hasItalics: true,
  charsetCompleteness: 0.95,
};

const brokenMetrics: FontMetrics = {
  xHeightRatio: 0.3, // too small
  apertureOpenness: 0.1, // too closed
  counterSize: 0.15, // clogged
  strokeContrast: 0.99, // extreme
  weightCount: 1, // too few
  hasItalics: false,
  charsetCompleteness: 0.4, // incomplete
};

function font(over: Partial<FontRecord> & { id: string }): FontRecord {
  return {
    family: over.id,
    supplier: "google",
    category: "sans-serif",
    metrics: goodMetrics,
    personality: {},
    isFoundational: false,
    ...over,
  };
}

function cand(over: Partial<Candidate> & { font: FontRecord }): Candidate {
  return {
    quality: 0.8,
    saturation: { fontId: over.font.id, display: 0, body: 0, trend: 0 },
    ...over,
  };
}

describe("metrics floor", () => {
  it("passes a well-formed font", () => {
    expect(metricsFloorPass(goodMetrics)).toBe(true);
    expect(metricsFloorFailures(goodMetrics)).toEqual([]);
  });

  it("rejects a broken/limited font with reasons", () => {
    expect(metricsFloorPass(brokenMetrics)).toBe(false);
    expect(metricsFloorFailures(brokenMetrics).length).toBeGreaterThan(3);
  });
});

describe("objectiveQuality", () => {
  it("scores a good font higher than a broken one", () => {
    expect(objectiveQuality(goodMetrics)).toBeGreaterThan(objectiveQuality(brokenMetrics));
  });
  it("stays within 0..1", () => {
    expect(objectiveQuality(goodMetrics)).toBeLessThanOrEqual(1);
    expect(objectiveQuality(brokenMetrics)).toBeGreaterThanOrEqual(0);
  });
});

describe("compositeQuality: the LLM vote is outvotable", () => {
  it("a strong metrics+data consensus survives a zero LLM vote", () => {
    const q = compositeQuality({ objective: 0.9, attribute: 0.9, curation: 0.9, llm: 0.0 });
    // objective+attribute+curation dominate; one cynical LLM cannot tank it.
    expect(q).toBeGreaterThan(0.65);
  });
  it("renormalizes when votes are missing", () => {
    const q = compositeQuality({ objective: 0.8 });
    expect(q).toBeCloseTo(0.8, 5);
  });
});

describe("personalityMatch", () => {
  it("empty target matches everything", () => {
    expect(personalityMatch({}, { bold: 0.9 })).toBe(1);
  });
  it("aligned vectors score high, opposed score low", () => {
    const target = { bold: 1, dramatic: 1 };
    const aligned = personalityMatch(target, { bold: 0.9, dramatic: 0.8 });
    const opposed = personalityMatch(target, { calm: 0.9, delicate: 0.9 });
    expect(aligned).toBeGreaterThan(0.9);
    expect(opposed).toBe(0);
  });
});

describe("role classification (deterministic, no LLM)", () => {
  it("hero = first above-fold h1; body = dominant family by text length", () => {
    const r = classifyRoles([
      { fontFamily: "clash display", fontSizePx: 64, textLength: 20, isH1: true, aboveFold: true },
      { fontFamily: "inter", fontSizePx: 16, textLength: 800, isH1: false, aboveFold: true },
      { fontFamily: "inter", fontSizePx: 16, textLength: 600, isH1: false, aboveFold: false },
    ]);
    expect(r.heroFont).toBe("clash display");
    expect(r.bodyFont).toBe("inter");
  });

  it("falls back to largest font when no h1", () => {
    const r = classifyRoles([
      { fontFamily: "big", fontSizePx: 40, textLength: 10, isH1: false, aboveFold: true },
      { fontFamily: "small", fontSizePx: 14, textLength: 500, isH1: false, aboveFold: true },
    ]);
    expect(r.heroFont).toBe("big");
  });

  it("is deterministic for equal sizes (tiebreak by family name)", () => {
    const els = [
      { fontFamily: "zeta", fontSizePx: 40, textLength: 10, isH1: false, aboveFold: true },
      { fontFamily: "alpha", fontSizePx: 40, textLength: 10, isH1: false, aboveFold: true },
    ];
    expect(classifyRoles(els).heroFont).toBe("alpha");
  });

  it("normalizeFamily strips quotes and fallbacks", () => {
    expect(normalizeFamily('"Clash Display", sans-serif')).toBe("clash display");
  });
});

describe("saturation (role-aware, recency-weighted)", () => {
  const obs: Observation[] = [
    { fontId: "trendy", role: "display", window: 5, count: 60, signal: "crawl" },
    { fontId: "trendy", role: "display", window: 4, count: 20, signal: "crawl" },
    { fontId: "stable", role: "body", window: 5, count: 90, signal: "crawl" },
  ];
  const sat = computeSaturation(obs, { currentWindow: 5, ...DEFAULT_SATURATION_CONFIG });

  it("flags a rising display font with positive trend", () => {
    const s = sat.get("trendy")!;
    expect(s.display).toBeGreaterThan(0);
    expect(s.trend).toBeGreaterThan(0);
  });

  it("keeps body saturation separate from display", () => {
    const s = sat.get("stable")!;
    expect(s.body).toBeGreaterThan(0);
    expect(s.display).toBe(0);
  });
});

describe("recommend: the hard rules", () => {
  const baseQuery: RecommendQuery = {
    target: {},
    role: "display",
    freshness: 1,
    qualityThreshold: 0.5,
    limit: 10,
  };

  it("never recommends a low-quality font, even at zero saturation", () => {
    const candidates = [
      cand({ font: font({ id: "ugly-but-rare" }), quality: 0.2 }),
      cand({ font: font({ id: "good" }), quality: 0.8 }),
    ];
    const recs = recommend(candidates, baseQuery);
    expect(recs.map((r) => r.font.id)).toEqual(["good"]);
  });

  it("excludes foundational fonts from display picks", () => {
    const candidates = [
      cand({ font: font({ id: "inter", isFoundational: true }), quality: 0.95 }),
      cand({ font: font({ id: "distinctive" }), quality: 0.8 }),
    ];
    const recs = recommend(candidates, baseQuery);
    expect(recs.map((r) => r.font.id)).toEqual(["distinctive"]);
  });

  it("freshness=1 demotes a saturated font below a rarer equal-quality one", () => {
    const candidates = [
      cand({
        font: font({ id: "everywhere" }),
        quality: 0.8,
        saturation: { fontId: "everywhere", display: 0.9, body: 0, trend: 0 },
      }),
      cand({
        font: font({ id: "hidden-gem" }),
        quality: 0.8,
        saturation: { fontId: "hidden-gem", display: 0.05, body: 0, trend: 0 },
      }),
    ];
    const recs = recommend(candidates, { ...baseQuery, freshness: 1 });
    expect(recs[0]!.font.id).toBe("hidden-gem");
  });

  it("freshness=0 ignores saturation and ranks purely on quality", () => {
    const candidates = [
      cand({
        font: font({ id: "everywhere" }),
        quality: 0.9,
        saturation: { fontId: "everywhere", display: 0.9, body: 0, trend: 0 },
      }),
      cand({
        font: font({ id: "hidden-gem" }),
        quality: 0.8,
        saturation: { fontId: "hidden-gem", display: 0.05, body: 0, trend: 0 },
      }),
    ];
    const recs = recommend(candidates, { ...baseQuery, freshness: 0 });
    expect(recs[0]!.font.id).toBe("everywhere");
  });

  it("is deterministic across runs", () => {
    const candidates = [
      cand({ font: font({ id: "b" }), quality: 0.8 }),
      cand({ font: font({ id: "a" }), quality: 0.8 }),
    ];
    const a = recommend(candidates, baseQuery).map((r) => r.font.id);
    const b = recommend(candidates, baseQuery).map((r) => r.font.id);
    expect(a).toEqual(b);
    expect(a).toEqual(["a", "b"]); // equal score -> tiebreak by id
  });
});

describe("slopScore", () => {
  const satMap = new Map<string, SaturationStat>([
    ["inter", { fontId: "inter", display: 0.95, body: 0.9, trend: 0.1 }],
    ["clash display", { fontId: "clash display", display: 0.04, body: 0, trend: 0 }],
  ]);
  const input = (heroFont: string | null, bodyFont: string | null = "inter") => ({
    page: { heroFont, bodyFont },
    saturationOf: (f: string) => satMap.get(f),
    isFoundational: (f: string) => f === "inter",
  });

  it("scores a foundational hero font as peak slop", () => {
    const r = slopScore(input("inter"));
    expect(r.score).toBeGreaterThan(75);
    expect(r.verdict).toBe("peak-slop");
    expect(r.offenders).toContain("inter");
  });

  it("scores a rare distinctive hero font as fresh", () => {
    const r = slopScore(input("clash display"));
    expect(r.score).toBeLessThan(20);
    expect(r.verdict).toBe("fresh");
  });
});
