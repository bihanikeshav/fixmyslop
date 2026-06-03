import { describe, it, expect } from "vitest";
import { odonovanNameToId } from "./sources/odonovan.js";

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
