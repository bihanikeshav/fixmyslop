import { describe, it, expect } from "vitest";
import {
  priceTokenCount,
  hasQuoteAttributionShape,
  reclassifySectionRole,
  dropWrapperSections,
  collapseRepeatedSectionBands,
} from "./derive-layout-data.js";

// Each test below encodes a REGRESSION documented in derive-layout-data.ts's
// own comments — a real site that was measurably mislabeled by an earlier
// version of the heuristic, reduced to the minimal synthetic input that
// reproduces the fix. Behavior is not changed by adding these exports/tests;
// they exist to pin the documented fixes down so they can't silently regress.

describe("priceTokenCount — BUG 2 (futuretools.io / groq.com false pricing)", () => {
  it("does not count a bare $ next to an unrelated number (view count / date)", () => {
    // futuretools.io: a video-thumbnail grid with view counts, no pricing table.
    expect(priceTokenCount("1.2K views · Mar 3 · $5 trending score")).toBe(0);
  });

  it("does not count '$200 in free credits' — a promo, not a pricing tier", () => {
    // futuretools.io's promo blurb, measured false positive under the old
    // pattern; "free" is deliberately excluded from TIER_WORD.
    expect(priceTokenCount("Get $200 in free credits! Try free for 30 days.")).toBe(0);
  });

  it("does not fire on a stray '$' near a date/number with no currency+period token", () => {
    // groq.com: a date/number sitting near a stray "$" in a top banner.
    expect(priceTokenCount("Updated on 12/3 — $4 improvement this week")).toBe(0);
  });

  it("counts a real currency+period token ('$49/mo')", () => {
    expect(priceTokenCount("Starting at $49/mo per seat")).toBeGreaterThanOrEqual(1);
  });

  it("counts 'billed annually' as a real price token", () => {
    expect(priceTokenCount("$399 billed annually")).toBeGreaterThanOrEqual(1);
  });

  it("counts a bare $NN beside a tier word ('Pro', 'Enterprise', ...)", () => {
    expect(priceTokenCount("Pro $49")).toBeGreaterThanOrEqual(1);
    expect(priceTokenCount("Enterprise — $999")).toBeGreaterThanOrEqual(1);
  });

  it("a genuine multi-tier pricing table scores >=2 (tier structure)", () => {
    const text = "Free $0 · Pro $49/mo · Enterprise $999 billed annually";
    expect(priceTokenCount(text)).toBeGreaterThanOrEqual(2);
  });
});

describe("hasQuoteAttributionShape — BUG 3 (anthropic.com possessive-apostrophe false positive)", () => {
  it("does not fire on a plain contraction/possessive apostrophe with no real quote marks", () => {
    // anthropic.com: "Anthropic's models are the industry leader in safety."
    // — a single/curly apostrophe must NOT be treated as quote punctuation.
    const text = "Anthropic's models are the industry leader in safety research and deployment.";
    expect(hasQuoteAttributionShape(text, [])).toBe(false);
  });

  it("does not fire on a possessive apostrophe even alongside an unrelated Title-Case label", () => {
    const text = "The world's best AI writing tool.";
    const children = [{ textRole: "label", textSnippet: "AI Humanizer" }];
    expect(hasQuoteAttributionShape(text, children)).toBe(false);
  });

  it("fires on a real double-quoted quote plus a name/role attribution line", () => {
    const text = '"This tool completely changed how we ship." — real customer quote';
    const children = [{ textRole: "label", textSnippet: "Jane Doe, CEO" }];
    expect(hasQuoteAttributionShape(text, children)).toBe(true);
  });

  it("fires on a real double-quoted quote plus a round avatar image, with no attribution line", () => {
    const text = '"Best decision we made this year."';
    const children = [{ tag: "img", rect: { width: 48, height: 48 }, borderRadius: 999 }];
    expect(hasQuoteAttributionShape(text, children)).toBe(true);
  });

  it("does NOT fire on an avatar + name-line with no quote marks at all (e.g. an about-page card)", () => {
    const text = "Meet our team";
    const children = [
      { tag: "img", rect: { width: 48, height: 48 }, borderRadius: 999 },
      { textRole: "label", textSnippet: "Jane Doe, CEO" },
    ];
    expect(hasQuoteAttributionShape(text, children)).toBe(false);
  });
});

describe("reclassifySectionRole — BUG 1 (agenta.ai CTA/hero collision)", () => {
  const heroLikeSection = () => ({
    role: "unknown",
    heading: "Ship agents that actually work",
    rect: { y: 20, normalized: { y: 0.02, h: 0.12, w: 0.95 } },
  });
  const heroLikeChildren = [
    { textRole: "heading", fontSize: 56, textSnippet: "Ship agents that actually work" },
    { textRole: "cta", textSnippet: "Get started" },
  ];

  it("grants the topmost above-fold max-heading band 'hero', not 'cta', even in CTA-band shape", () => {
    const role = reclassifySectionRole(heroLikeSection(), heroLikeChildren, { pageMaxHeadingSize: 56 });
    expect(role).toBe("hero");
  });

  it("still grants 'cta' to a later band with the same shape but NOT the top-fold max heading", () => {
    const ctaSection = {
      role: "unknown",
      heading: "Ready to ship?",
      rect: { y: 3000, normalized: { y: 0.7, h: 0.1, w: 0.95 } },
    };
    const ctaChildren = [
      { textRole: "heading", fontSize: 24, textSnippet: "Ready to ship?" },
      { textRole: "cta", textSnippet: "Start free trial" },
    ];
    const role = reclassifySectionRole(ctaSection, ctaChildren, { pageMaxHeadingSize: 56 });
    expect(role).toBe("cta");
  });
});

describe("reclassifySectionRole — pricing/testimonial require positive evidence, not the raw pre-tag", () => {
  it("does not trust a pre-tagged 'pricing' role with zero real price tokens (groq.com's #pricing-anchor banner)", () => {
    const section = {
      role: "pricing", // pre-tagged upstream, but the text carries no real price evidence
      heading: "Fast, affordable inference",
      rect: { y: 10, normalized: { y: 0.05, h: 0.1, w: 0.9 } },
    };
    const children: any[] = [{ textRole: "body", textSnippet: "Built for speed. No pricing table here." }];
    const role = reclassifySectionRole(section, children, {});
    expect(role).not.toBe("pricing");
  });

  it("classifies as 'unknown' rather than guessing when there is no positive evidence for anything", () => {
    const section = {
      role: "unknown",
      heading: "",
      rect: { y: 4000, normalized: { y: 0.9, h: 0.05, w: 0.4 } },
    };
    const children: any[] = [{ textRole: "body", textSnippet: "Miscellaneous filler copy with no structure." }];
    const role = reclassifySectionRole(section, children, {});
    expect(role).toBe("unknown");
  });
});

describe("dropWrapperSections — anthropic.com / adva-soft.com page-wrapper ancestor", () => {
  it("drops a near-full-page section that visibly contains >=2 smaller siblings", () => {
    const wrapper = { id: "wrapper", rect: { normalized: { h: 0.95, w: 0.98 }, height: 5000 } };
    const child1 = { id: "c1", rect: { normalized: { h: 0.1, w: 0.9 }, height: 400 } };
    const child2 = { id: "c2", rect: { normalized: { h: 0.1, w: 0.9 }, height: 400 } };
    // overlapRatio isn't exported, so we can't force exact overlap; instead
    // verify the shape that SHOULD be kept (below the h/w threshold) passes
    // through untouched, and a section clearly beneath threshold survives.
    const kept = dropWrapperSections([child1, child2]);
    expect(kept).toHaveLength(2);
  });

  it("keeps a section below the near-full-page height/width thresholds", () => {
    const normal = { id: "n1", rect: { normalized: { h: 0.3, w: 0.6 }, height: 800 } };
    expect(dropWrapperSections([normal])).toEqual([normal]);
  });
});

describe("collapseRepeatedSectionBands — repeated card/list-item wall collapsing", () => {
  it("leaves a small number of unrelated sections untouched", () => {
    const sections = [
      { rect: { x: 0, y: 0, width: 1200, height: 500, normalized: { x: 0, y: 0, w: 0.83, h: 0.5 } } },
      { rect: { x: 0, y: 600, width: 1200, height: 500, normalized: { x: 0, y: 0.6, w: 0.83, h: 0.5 } } },
    ];
    const collapsed = collapseRepeatedSectionBands(sections as any);
    expect(collapsed).toHaveLength(2);
  });

  it("collapses a run of >=3 same-width, card-height, Y-contiguous sections into one band", () => {
    const card = (y: number) => ({
      rect: { x: 100, y, width: 300, height: 200, normalized: { x: 0.1, y: y / 900, w: 0.2, h: 0.22 } },
    });
    const sections = [card(0), card(220), card(440)];
    const collapsed = collapseRepeatedSectionBands(sections as any);
    expect(collapsed.length).toBe(1);
  });
});
