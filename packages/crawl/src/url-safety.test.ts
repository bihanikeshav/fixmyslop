import { describe, it, expect } from "vitest";
import { isSafePublicUrl, checkUrlSafety } from "./url-safety.js";

describe("isSafePublicUrl — allows ordinary public sites", () => {
  it.each([
    "https://example.com/",
    "http://example.com/",
    "https://sub.example.com/path?x=1",
    "https://example.co.uk/",
    "https://example.com:8443/", // non-default port, allowed (soft signal only)
  ])("%s", (url) => {
    expect(isSafePublicUrl(url)).toBe(true);
  });
});

describe("isSafePublicUrl — protocol", () => {
  it("rejects non-http(s) protocols", () => {
    expect(isSafePublicUrl("ftp://example.com/")).toBe(false);
    expect(isSafePublicUrl("file:///etc/passwd")).toBe(false);
    expect(isSafePublicUrl("javascript:alert(1)")).toBe(false);
    expect(isSafePublicUrl("data:text/html,hi")).toBe(false);
  });

  it("rejects unparseable input", () => {
    expect(isSafePublicUrl("not a url")).toBe(false);
    expect(isSafePublicUrl("")).toBe(false);
  });
});

describe("isSafePublicUrl — credentials", () => {
  it("rejects a URL with embedded credentials", () => {
    expect(isSafePublicUrl("https://user:pass@example.com/")).toBe(false);
    expect(isSafePublicUrl("https://user@example.com/")).toBe(false);
  });
});

describe("isSafePublicUrl — localhost / internal TLDs / dotless hosts", () => {
  it.each([
    "http://localhost/",
    "http://localhost:3000/",
    "http://localhost.localdomain/",
    "http://foo.local/",
    "http://service.internal/",
    "http://box.localhost/",
    "http://intranet/", // no dot
    "http://printer/",
  ])("%s", (url) => {
    expect(isSafePublicUrl(url)).toBe(false);
  });
});

describe("isSafePublicUrl — IPv4 literals", () => {
  it.each([
    "http://127.0.0.1/",
    "http://127.1.2.3/",
    "http://10.0.0.1/",
    "http://10.255.255.255/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/", // cloud metadata endpoint — must be blocked
    "http://169.254.0.1/",
    "http://100.64.0.1/", // CGNAT
    "http://100.100.100.200/", // CGNAT (cloud metadata via CGNAT on some clouds)
    "http://0.0.0.0/",
    "http://224.0.0.1/", // multicast
    "http://255.255.255.255/", // broadcast
    "http://198.51.100.5/", // TEST-NET-2
    "http://203.0.113.5/", // TEST-NET-3
    "http://192.0.2.5/", // TEST-NET-1
  ])("%s", (url) => {
    expect(isSafePublicUrl(url)).toBe(false);
  });

  it("does not block ordinary public IPv4-range-adjacent-but-not-private addresses", () => {
    // 172.32.x.x is outside the 172.16-172.31 private range.
    expect(isSafePublicUrl("http://172.32.0.1/")).toBe(true);
    // 100.63.x.x is just outside the CGNAT range.
    expect(isSafePublicUrl("http://100.63.255.255/")).toBe(true);
  });
});

describe("isSafePublicUrl — IPv6 literals", () => {
  it.each([
    "http://[::1]/", // loopback
    "http://[::]/",
    "http://[fe80::1]/", // link-local
    "http://[fc00::1]/", // unique local
    "http://[2001:db8::1]/", // documentation range, still rejected (blanket IPv6 reject)
    "http://[::ffff:127.0.0.1]/", // IPv4-mapped loopback
  ])("%s", (url) => {
    expect(isSafePublicUrl(url)).toBe(false);
  });
});

describe("isSafePublicUrl — extra blocked suffixes", () => {
  it("rejects hosts under a caller-supplied blocked suffix", () => {
    expect(isSafePublicUrl("https://sneaky.corp-internal.example/", {
      extraBlockedSuffixes: ["corp-internal.example"],
    })).toBe(false);
    expect(isSafePublicUrl("https://corp-internal.example/", {
      extraBlockedSuffixes: ["corp-internal.example"],
    })).toBe(false);
    expect(isSafePublicUrl("https://unrelated.example/", {
      extraBlockedSuffixes: ["corp-internal.example"],
    })).toBe(true);
  });
});

describe("checkUrlSafety — gives a reason on rejection", () => {
  it("includes a human-readable reason", () => {
    const result = checkUrlSafety("http://127.0.0.1/");
    expect(result.safe).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("has no reason on success", () => {
    const result = checkUrlSafety("https://example.com/");
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
