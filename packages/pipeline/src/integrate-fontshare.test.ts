import { describe, it, expect } from "vitest";
import { isAllowedLicense, normalizeLicense, LICENSE_ALLOWLIST } from "./integrate-fontshare.js";

describe("normalizeLicense", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeLicense("  SIL Open   Font  License  ")).toBe("sil open font license");
  });
  it("normalizes underscores to hyphens", () => {
    expect(normalizeLicense("Apache_2.0")).toBe("apache-2.0");
  });
});

describe("isAllowedLicense", () => {
  it("accepts every allowlisted licence, case/spacing-insensitive", () => {
    for (const l of LICENSE_ALLOWLIST) {
      expect(isAllowedLicense(l)).toBe(true);
      expect(isAllowedLicense(l.toUpperCase())).toBe(true);
      expect(isAllowedLicense(`  ${l}  `)).toBe(true);
    }
  });

  it("accepts common real-world spellings", () => {
    expect(isAllowedLicense("OFL")).toBe(true);
    expect(isAllowedLicense("SIL Open Font License")).toBe(true);
    expect(isAllowedLicense("SIL Open Font License 1.1")).toBe(true);
    expect(isAllowedLicense("Apache-2.0")).toBe(true);
    expect(isAllowedLicense("Apache 2.0")).toBe(true);
    expect(isAllowedLicense("ITF Free Font License")).toBe(true);
    expect(isAllowedLicense("CC0")).toBe(true);
    expect(isAllowedLicense("MIT")).toBe(true);
    expect(isAllowedLicense("UFL")).toBe(true);
  });

  it("rejects a restrictive or unrecognized licence", () => {
    expect(isAllowedLicense("All Rights Reserved")).toBe(false);
    expect(isAllowedLicense("Proprietary")).toBe(false);
    expect(isAllowedLicense("CC-BY-NC-4.0")).toBe(false);
    expect(isAllowedLicense("GPL-3.0")).toBe(false);
  });

  it("rejects missing licence data", () => {
    expect(isAllowedLicense(undefined)).toBe(false);
    expect(isAllowedLicense(null)).toBe(false);
    expect(isAllowedLicense("")).toBe(false);
  });
});
