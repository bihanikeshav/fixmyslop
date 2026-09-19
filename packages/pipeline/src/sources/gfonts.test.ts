import { describe, it, expect } from "vitest";
import { isValidRawFamily, normalizeFamily, FOUNDATIONAL_TOP_RANK } from "./gfonts.js";

describe("isValidRawFamily", () => {
  it("accepts a well-formed row", () => {
    expect(isValidRawFamily({ family: "Inter", popularity: 1 })).toBe(true);
  });
  it("rejects a missing family", () => {
    expect(isValidRawFamily({ popularity: 1 })).toBe(false);
  });
  it("rejects a blank family", () => {
    expect(isValidRawFamily({ family: "   ", popularity: 1 })).toBe(false);
  });
  it("rejects a non-numeric popularity", () => {
    expect(isValidRawFamily({ family: "Inter", popularity: "1" })).toBe(false);
  });
  it("rejects a non-finite popularity", () => {
    expect(isValidRawFamily({ family: "Inter", popularity: NaN })).toBe(false);
    expect(isValidRawFamily({ family: "Inter", popularity: Infinity })).toBe(false);
  });
  it("rejects null/non-object input", () => {
    expect(isValidRawFamily(null)).toBe(false);
    expect(isValidRawFamily("Inter")).toBe(false);
    expect(isValidRawFamily(undefined)).toBe(false);
  });
});

function rawFamily(over: Partial<Parameters<typeof normalizeFamily>[0]> = {}) {
  return {
    family: "Test Family",
    category: "sans-serif",
    subsets: ["latin"],
    fonts: ["regular", "700"],
    axes: [],
    popularity: 100,
    trending: 100,
    dateAdded: "2020-01-01",
    isBrandFont: false,
    ...over,
  };
}

describe("normalizeFamily", () => {
  it("leaves apertureOpenness unmeasured (null), not a fabricated placeholder", () => {
    const f = normalizeFamily(rawFamily());
    expect(f.metrics.apertureOpenness).toBeNull();
  });

  it("marks top-rank fonts foundational", () => {
    const f = normalizeFamily(rawFamily({ popularity: FOUNDATIONAL_TOP_RANK }));
    expect(f.isFoundational).toBe(true);
  });

  it("marks low-rank fonts non-foundational", () => {
    const f = normalizeFamily(rawFamily({ popularity: FOUNDATIONAL_TOP_RANK + 1 }));
    expect(f.isFoundational).toBe(false);
  });

  it("is robust to a missing/non-numeric popularity: never foundational", () => {
    const malformed = rawFamily();
    // @ts-expect-error -- deliberately malformed to exercise the runtime guard
    malformed.popularity = undefined;
    const f = normalizeFamily(malformed);
    expect(f.isFoundational).toBe(false);
  });
});
