import { describe, it, expect } from "vitest";
import {
  metricsFloorPass,
  metricsFloorFailures,
  objectiveQuality,
  compositeQuality,
  attributeQualityVote,
  personalityMatch,
  classifyRoles,
  normalizeFamily,
  computeSaturation,
  DEFAULT_SATURATION_CONFIG,
  MIN_TREND_EVIDENCE,
  recommend,
  slopScore,
  clamp01,
  clamp01OrMid,
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

describe("clamp01 / clamp01OrMid", () => {
  it("clamp01 clamps to [0,1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it("clamp01OrMid treats non-finite input as the 0.5 midpoint", () => {
    expect(clamp01OrMid(NaN)).toBe(0.5);
    expect(clamp01OrMid(Infinity)).toBe(0.5);
    expect(clamp01OrMid(-Infinity)).toBe(0.5);
  });

  it("clamp01OrMid still clamps finite out-of-range input", () => {
    expect(clamp01OrMid(-1)).toBe(0);
    expect(clamp01OrMid(2)).toBe(1);
    expect(clamp01OrMid(0.3)).toBe(0.3);
  });
});

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

describe("objectiveQuality: unmeasured aperture", () => {
  const measured: FontMetrics = { ...goodMetrics, apertureOpenness: 0.7 };
  const unmeasured: FontMetrics = { ...goodMetrics, apertureOpenness: null };

  it("doesn't tank the score when aperture is unmeasured", () => {
    // A font whose real aperture happens to equal the neutral score for the
    // other metrics should score about the same whether aperture is measured
    // at a middling value or left null (renormalized away), not systematically
    // lower just because one metric is missing.
    const withMidAperture: FontMetrics = { ...goodMetrics, apertureOpenness: 0.5 };
    expect(objectiveQuality(unmeasured)).toBeCloseTo(objectiveQuality(withMidAperture), 1);
  });

  it("a bad unmeasured font still scores lower than a good unmeasured font", () => {
    const badUnmeasured: FontMetrics = { ...brokenMetrics, apertureOpenness: null };
    expect(objectiveQuality(unmeasured)).toBeGreaterThan(objectiveQuality(badUnmeasured));
  });

  it("measured aperture still moves the score", () => {
    const highAperture: FontMetrics = { ...goodMetrics, apertureOpenness: 1 };
    const lowAperture: FontMetrics = { ...goodMetrics, apertureOpenness: 0 };
    expect(objectiveQuality(highAperture)).toBeGreaterThan(objectiveQuality(lowAperture));
  });

  it("stays within 0..1 whether measured or not", () => {
    expect(objectiveQuality(measured)).toBeLessThanOrEqual(1);
    expect(objectiveQuality(unmeasured)).toBeLessThanOrEqual(1);
  });
});

describe("metricsFloorFailures: unmeasured aperture never gates", () => {
  it("a font that would fail the aperture floor passes it when unmeasured", () => {
    const closedAperture: FontMetrics = { ...goodMetrics, apertureOpenness: 0.1 };
    expect(metricsFloorFailures(closedAperture)).toContain("apertures too closed");

    const unmeasured: FontMetrics = { ...goodMetrics, apertureOpenness: null };
    expect(metricsFloorFailures(unmeasured)).not.toContain("apertures too closed");
    expect(metricsFloorPass(unmeasured)).toBe(true);
  });

  it("measured aperture still gates a genuinely closed font", () => {
    const closedAperture: FontMetrics = { ...goodMetrics, apertureOpenness: 0.1 };
    expect(metricsFloorPass(closedAperture)).toBe(false);
  });
});

describe("attributeQualityVote", () => {
  it("returns undefined for an empty vector (no vote to cast)", () => {
    expect(attributeQualityVote({})).toBeUndefined();
  });

  it("scores a decisive, characterful vector high", () => {
    const v = attributeQualityVote({ bold: 0.95, dramatic: 0.9, calm: 0.05 });
    expect(v).toBeGreaterThan(0.7);
  });

  it("scores a flat, neutral vector low", () => {
    const v = attributeQualityVote({ bold: 0.5, calm: 0.5, formal: 0.5 });
    expect(v).toBeCloseTo(0, 5);
  });

  it("stays within 0..1", () => {
    const v = attributeQualityVote({ bold: 1, thin: 0 });
    expect(v).toBeLessThanOrEqual(1);
    expect(v).toBeGreaterThanOrEqual(0);
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

describe("saturation trend: thin evidence can't fake a max trend", () => {
  it("a single low-weight sighting from zero produces a small trend, not 1.0", () => {
    const obs: Observation[] = [
      { fontId: "one-off", role: "display", window: 5, count: 1, signal: "community" },
    ];
    const sat = computeSaturation(obs, { currentWindow: 5, ...DEFAULT_SATURATION_CONFIG });
    const s = sat.get("one-off")!;
    expect(s.trend).toBeGreaterThan(0);
    expect(s.trend).toBeLessThan(0.5);
  });

  it("enough evidence from zero still reaches a strong trend", () => {
    const obs: Observation[] = [
      { fontId: "surging", role: "display", window: 5, count: MIN_TREND_EVIDENCE * 4, signal: "crawl" },
    ];
    const sat = computeSaturation(obs, { currentWindow: 5, ...DEFAULT_SATURATION_CONFIG });
    const s = sat.get("surging")!;
    expect(s.trend).toBeCloseTo(1, 5);
  });

  it("is monotonic: more evidence at the same ratio never lowers the trend", () => {
    const low: Observation[] = [
      { fontId: "x", role: "display", window: 5, count: 1, signal: "community" },
    ];
    const high: Observation[] = [
      { fontId: "x", role: "display", window: 5, count: 3, signal: "community" },
    ];
    const satLow = computeSaturation(low, { currentWindow: 5, ...DEFAULT_SATURATION_CONFIG }).get("x")!;
    const satHigh = computeSaturation(high, { currentWindow: 5, ...DEFAULT_SATURATION_CONFIG }).get("x")!;
    expect(satHigh.trend).toBeGreaterThanOrEqual(satLow.trend);
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
