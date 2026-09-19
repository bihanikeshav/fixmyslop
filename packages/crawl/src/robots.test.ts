import { describe, it, expect } from "vitest";
import {
  parseRobotsTxt,
  selectGroupRules,
  isPathAllowed,
  evaluateRobotsAccess,
  checkRobotsAllowed,
} from "./robots.js";

describe("parseRobotsTxt", () => {
  it("parses a single wildcard group", () => {
    const groups = parseRobotsTxt(`User-agent: *\nDisallow: /admin\nAllow: /\n`);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.agents).toEqual(["*"]);
    expect(groups[0]!.rules).toEqual([
      { type: "disallow", path: "/admin" },
      { type: "allow", path: "/" },
    ]);
  });

  it("groups multiple User-agent lines that share one rule block", () => {
    const text = `User-agent: googlebot\nUser-agent: fixmyslop\nDisallow: /private\n`;
    const groups = parseRobotsTxt(text);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.agents).toEqual(["googlebot", "fixmyslop"]);
  });

  it("starts a new group after rules have started for the previous one", () => {
    const text = `User-agent: a\nDisallow: /x\nUser-agent: b\nDisallow: /y\n`;
    const groups = parseRobotsTxt(text);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.agents).toEqual(["a"]);
    expect(groups[0]!.rules).toEqual([{ type: "disallow", path: "/x" }]);
    expect(groups[1]!.agents).toEqual(["b"]);
    expect(groups[1]!.rules).toEqual([{ type: "disallow", path: "/y" }]);
  });

  it("parses Crawl-delay", () => {
    const groups = parseRobotsTxt(`User-agent: *\nCrawl-delay: 5\nDisallow: /\n`);
    expect(groups[0]!.crawlDelay).toBe(5);
  });

  it("ignores comments and blank lines", () => {
    const groups = parseRobotsTxt(`# comment\n\nUser-agent: *\n# another\nDisallow: /admin # inline comment\n`);
    expect(groups[0]!.rules).toEqual([{ type: "disallow", path: "/admin" }]);
  });

  it("returns no groups for empty text", () => {
    expect(parseRobotsTxt("")).toEqual([]);
  });

  it("lowercases user-agent tokens", () => {
    const groups = parseRobotsTxt(`User-agent: GoogleBot\nDisallow: /\n`);
    expect(groups[0]!.agents).toEqual(["googlebot"]);
  });
});

describe("selectGroupRules", () => {
  const groups = parseRobotsTxt(
    `User-agent: fixmyslop\nDisallow: /no-fixmyslop\n\nUser-agent: *\nDisallow: /no-anyone\n`,
  );

  it("matches our own UA token first", () => {
    const g = selectGroupRules(groups, "fixmyslop");
    expect(g!.rules).toEqual([{ type: "disallow", path: "/no-fixmyslop" }]);
  });

  it("falls back to the wildcard group for an unmatched token", () => {
    const g = selectGroupRules(groups, "somebotwenevermentioned");
    expect(g!.rules).toEqual([{ type: "disallow", path: "/no-anyone" }]);
  });

  it("returns null with no applicable group at all", () => {
    const onlyNamed = parseRobotsTxt(`User-agent: someotherbot\nDisallow: /x\n`);
    expect(selectGroupRules(onlyNamed, "fixmyslop")).toBeNull();
  });

  it("is case-insensitive on the UA token", () => {
    const g = selectGroupRules(groups, "FixMySlop");
    expect(g!.rules).toEqual([{ type: "disallow", path: "/no-fixmyslop" }]);
  });
});

describe("isPathAllowed", () => {
  it("allows everything with no rules", () => {
    expect(isPathAllowed([], "/anything")).toBe(true);
  });

  it("disallows an exact matched prefix", () => {
    const rules = [{ type: "disallow" as const, path: "/admin" }];
    expect(isPathAllowed(rules, "/admin/settings")).toBe(false);
    expect(isPathAllowed(rules, "/public")).toBe(true);
  });

  it("treats an empty Disallow value as allow-all", () => {
    const rules = [{ type: "disallow" as const, path: "" }];
    expect(isPathAllowed(rules, "/anything")).toBe(true);
  });

  it("longest match wins regardless of order", () => {
    const rules = [
      { type: "disallow" as const, path: "/" },
      { type: "allow" as const, path: "/public" },
    ];
    expect(isPathAllowed(rules, "/public/page")).toBe(true);
    expect(isPathAllowed(rules, "/private")).toBe(false);
  });

  it("ties between equal-length Allow and Disallow favor Allow", () => {
    const rulesAllowFirst = [
      { type: "allow" as const, path: "/x" },
      { type: "disallow" as const, path: "/x" },
    ];
    expect(isPathAllowed(rulesAllowFirst, "/x")).toBe(true);
    const rulesDisallowFirst = [
      { type: "disallow" as const, path: "/x" },
      { type: "allow" as const, path: "/x" },
    ];
    expect(isPathAllowed(rulesDisallowFirst, "/x")).toBe(true);
  });

  it("defaults to '/' when path is falsy", () => {
    const rules = [{ type: "disallow" as const, path: "/" }];
    expect(isPathAllowed(rules, "")).toBe(false);
  });
});

describe("evaluateRobotsAccess", () => {
  it("combines parse + select + match", () => {
    const text = `User-agent: fixmyslop\nDisallow: /blocked\nCrawl-delay: 2\n`;
    expect(evaluateRobotsAccess(text, "fixmyslop", "/blocked/x")).toEqual({ allowed: false, crawlDelay: 2 });
    expect(evaluateRobotsAccess(text, "fixmyslop", "/ok")).toEqual({ allowed: true, crawlDelay: 2 });
  });

  it("allows everything when no group applies", () => {
    const text = `User-agent: someotherbot\nDisallow: /\n`;
    expect(evaluateRobotsAccess(text, "fixmyslop", "/anything")).toEqual({ allowed: true, crawlDelay: null });
  });
});

describe("checkRobotsAllowed — fail-open / fail-closed semantics", () => {
  it("fails open when the fetch errors (network error)", async () => {
    const fetchImpl = async () => {
      throw new Error("ECONNREFUSED");
    };
    const result = await checkRobotsAllowed("https://example.com/anything", {
      fetchImpl,
      cache: new Map(),
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toMatch(/fail-open/);
  });

  it("fails open when robots.txt returns non-2xx", async () => {
    const fetchImpl = async () => ({ ok: false, status: 404, text: async () => "" });
    const result = await checkRobotsAllowed("https://example.com/anything", {
      fetchImpl: fetchImpl as any,
      cache: new Map(),
    });
    expect(result.allowed).toBe(true);
  });

  it("fails closed on an explicit matching Disallow", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => `User-agent: *\nDisallow: /admin\n`,
    });
    const result = await checkRobotsAllowed("https://example.com/admin/panel", {
      fetchImpl: fetchImpl as any,
      cache: new Map(),
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/disallowed/);
  });

  it("allows a path not covered by Disallow", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => `User-agent: *\nDisallow: /admin\n`,
    });
    const result = await checkRobotsAllowed("https://example.com/products", {
      fetchImpl: fetchImpl as any,
      cache: new Map(),
    });
    expect(result.allowed).toBe(true);
  });

  it("respects --ignore-robots (ignoreRobots: true) unconditionally", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      text: async () => `User-agent: *\nDisallow: /\n`,
    });
    const result = await checkRobotsAllowed("https://example.com/anything", {
      fetchImpl: fetchImpl as any,
      cache: new Map(),
      ignoreRobots: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("--ignore-robots");
  });

  it("caches per origin — only fetches once for repeated URLs on the same host", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      return { ok: true, status: 200, text: async () => `User-agent: *\nDisallow: /a\n` };
    };
    const cache = new Map();
    await checkRobotsAllowed("https://example.com/a", { fetchImpl: fetchImpl as any, cache });
    await checkRobotsAllowed("https://example.com/b", { fetchImpl: fetchImpl as any, cache });
    await checkRobotsAllowed("https://example.com/c", { fetchImpl: fetchImpl as any, cache });
    expect(calls).toBe(1);
  });

  it("fails open on an unparseable URL", async () => {
    const result = await checkRobotsAllowed("not a url", { cache: new Map() });
    expect(result.allowed).toBe(true);
  });
});
