import { describe, it, expect } from "vitest";
// spam-filter.mjs is plain ESM JS (executed directly with node, not tsx);
// vitest/esbuild can import it directly with no loader.
import { scoreRecord, THRESHOLDS } from "./spam-filter.mjs";

function record(host: string, snippets: string[], headings: string[] = []): any {
  return {
    host,
    desktop: {
      elements: snippets.map((s) => ({ textSnippet: s })),
      sections: headings.map((h) => ({ heading: h })),
    },
    mobile: null,
  };
}

describe("scoreRecord - documented cases", () => {
  it("a single stray 'Login' word alone must NOT flag a real site (sequoiacap.com case)", () => {
    const result = scoreRecord(
      record("sequoiacap.com", [
        "Login",
        "Sequoia backs the boldest founders from idea to IPO and beyond.",
        "Our portfolio spans consumer, enterprise, fintech, and healthcare.",
      ]),
    );
    expect(result).not.toBeNull();
    expect(result!.hardFlag).toBe(false);
    expect(result!.score).toBeLessThan(THRESHOLDS.softFlagThreshold);
  });

  it("returns null for a record with no usable text (crawl failure)", () => {
    const result = scoreRecord({ host: "dead.example", desktop: null, mobile: null });
    expect(result).toBeNull();
  });

  it("returns null for a record whose captured text is empty/whitespace-only", () => {
    const result = scoreRecord(record("blank.example", ["   ", ""]));
    expect(result).toBeNull();
  });

  it("hard-flags a page dense with strong gambling lexicon terms", () => {
    const spamText =
      "situs slot gacor terpercaya, daftar judi online, bocoran maxwin hari ini, link alternatif wargaqq, ratucasino terbaik, jnt188 udin88 pragmatic play gacor";
    const result = scoreRecord(record("spam-slots.example", [spamText]));
    expect(result).not.toBeNull();
    expect(result!.hardFlag).toBe(true);
    expect(result!.signals.some((s: string) => s.includes("gambling-lexicon-dense"))).toBe(true);
  });

  it("does not hard-flag a long, ordinary page containing only weak/ambiguous gambling-adjacent words", () => {
    // "slot" (time slot) and "login" are WEAK terms with legitimate everyday
    // use; weighted density is per-1000-chars, so a couple of weak hits in a
    // page of ordinary length should stay well under the hard threshold.
    const result = scoreRecord(
      record("scheduling-app.example", [
        "Book your next available slot in seconds with our scheduling platform.",
        "Login to manage your calendar and see upcoming meetings across every team.",
        "Trusted by thousands of teams worldwide for scheduling meetings, syncing calendars, and avoiding double-booking across time zones.",
        "Our platform integrates with every major calendar provider and keeps your day organized without the back-and-forth of finding a time that works.",
      ]),
    );
    expect(result).not.toBeNull();
    expect(result!.hardFlag).toBe(false);
  });

  it("flags an explicit parked-domain page", () => {
    const result = scoreRecord(
      record("parked.example", ["This domain is for sale. Buy this domain. Click here to purchase."]),
    );
    expect(result).not.toBeNull();
    expect(result!.hardFlag).toBe(true);
    expect(result!.signals.some((s: string) => s.includes("parked-domain"))).toBe(true);
  });
});
