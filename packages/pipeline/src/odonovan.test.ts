import { describe, it, expect } from "vitest";
import { odonovanNameToId, pickCanonicalVariant } from "./sources/odonovan.js";

describe("odonovanNameToId", () => {
  it("drops style suffixes", () => {
    expect(odonovanNameToId("Alegreya-BoldItalic")).toBe("alegreya");
    expect(odonovanNameToId("Acme-Regular")).toBe("acme");
  });
  it("splits camelCase into a hyphenated GF-style id", () => {
    expect(odonovanNameToId("ArchivoNarrow-Regular")).toBe("archivo-narrow");
    expect(odonovanNameToId("PlayfairDisplay")).toBe("playfair-display");
  });
  it("lowercases single-word names", () => {
    expect(odonovanNameToId("Lobster")).toBe("lobster");
  });
});

describe("pickCanonicalVariant", () => {
  it("prefers a Regular variant over other weights, regardless of row order", () => {
    const variants = [
      { rawName: "Alegreya-BoldItalic", vec: { bold: 1 } },
      { rawName: "Alegreya-Black", vec: { bold: 1 } },
      { rawName: "Alegreya-Regular", vec: { calm: 1 } },
    ];
    expect(pickCanonicalVariant(variants).rawName).toBe("Alegreya-Regular");
  });

  it("treats a bare name (no suffix) as Regular", () => {
    const variants = [
      { rawName: "PlayfairDisplay-Bold" },
      { rawName: "PlayfairDisplay" },
    ];
    expect(pickCanonicalVariant(variants).rawName).toBe("PlayfairDisplay");
  });

  it("is row-order independent: same result whichever order the rows arrive in", () => {
    const a = { rawName: "Acme-Bold" };
    const b = { rawName: "Acme-Black" };
    expect(pickCanonicalVariant([a, b]).rawName).toBe(pickCanonicalVariant([b, a]).rawName);
  });

  it("falls back to the lexicographically smallest variant name when no Regular exists", () => {
    const variants = [{ rawName: "Foo-Black" }, { rawName: "Foo-Bold" }, { rawName: "Foo-Light" }];
    expect(pickCanonicalVariant(variants).rawName).toBe("Foo-Black");
  });

  it("recognizes 400 and Book as Regular-equivalent", () => {
    expect(pickCanonicalVariant([{ rawName: "X-Bold" }, { rawName: "X-400" }]).rawName).toBe("X-400");
    expect(pickCanonicalVariant([{ rawName: "Y-Bold" }, { rawName: "Y-Book" }]).rawName).toBe("Y-Book");
  });
});
