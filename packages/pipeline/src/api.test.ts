import { describe, it, expect, beforeAll, afterAll } from "vitest";
// The build-time API lives as standalone Node ESM next to the other checkers
// (viz/personality-test/api.mjs). We import the pure functions directly; vitest
// resolves .mjs fine. No types — treat as any.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
  colorReport, paletteReport, fontReport, freshFonts, audit, autoFix,
} from "../../../viz/personality-test/api.mjs";
import { writeFileSync, rmSync, copyFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const HTML_DIR = resolve(__dirname, "../../../viz/personality-test");

describe("color()", () => {
  it("flags #6366f1 as banned with a lower-slop alternative", () => {
    const r = colorReport("#6366f1");
    expect(r.verdict).toBe("HARD-BANNED");
    expect(r.slop).toBeGreaterThan(0);
    expect(r.alternatives.length).toBeGreaterThan(0);
    // every alternative is strictly lower-slop than the (maxed) input
    for (const a of r.alternatives) expect(a.slop).toBeLessThan(r.slop);
    // closest-first ordering: first alt has the smallest deltaEok
    expect(r.alternatives[0].deltaEok).toBeLessThanOrEqual(r.alternatives[1].deltaEok);
  });

  it("names a brand clone when a hex ~= a known identity color", () => {
    const r = colorReport("#6366f1");
    // #6366f1 sits ~JND from Stripe's identity indigo in the getdesign corpus
    expect(["brand-clone", "framework-default"]).toContain(r.reason.kind);
  });

  it("passes an off-corpus color as SAFE/fresh with no alternatives", () => {
    const r = colorReport("#8a2e5e");
    expect(r.verdict).toBe("SAFE");
    expect(r.reason.kind).toBe("fresh");
    expect(r.alternatives.length).toBe(0);
  });
});

describe("font() — SLOP-unless-foundational", () => {
  it("treats Inter as slop but ALLOWED because it is foundational", () => {
    const r = fontReport("Inter");
    expect(r.isFoundational).toBe(true);
    expect(r.verdict).toBe("SLOP-allowed-foundational");
    expect(r.why).toMatch(/foundational/i);
    // still offers fresher display alternatives
    expect(r.alternatives.length).toBeGreaterThan(0);
  });

  it("treats a non-foundational avoid-list font (Space Grotesk) as hard SLOP", () => {
    const r = fontReport("Space Grotesk");
    expect(r.isFoundational).toBe(false);
    expect(r.verdict).toBe("SLOP");
    expect(r.alternatives.length).toBeGreaterThan(0);
  });

  it("never recommends an avoid-list font as an alternative", () => {
    const r = fontReport("Space Grotesk");
    const avoid = ["inter", "poppins", "montserrat", "space grotesk"];
    for (const a of r.alternatives) expect(avoid).not.toContain(a.family.toLowerCase());
  });
});

describe("fonts()", () => {
  it("suggests fresh, non-slop families (display + body), none on the avoid list", () => {
    const r = freshFonts(4);
    expect(r.picks.length).toBe(4);
    const avoid = ["inter", "poppins", "montserrat", "roboto", "space grotesk", "fraunces"];
    for (const p of r.picks) expect(avoid).not.toContain(p.family.toLowerCase());
    expect(r.pairing.display).toBeTruthy();
    expect(r.pairing.body).toBeTruthy();
  });
});

describe("palette()", () => {
  it("flags the indigo accent in (white, #111, #6366f1) with a fix", () => {
    const r = paletteReport("#ffffff", "#111111", "#6366f1");
    expect(r.pass).toBe(false);
    expect(r.perRole.ground.verdict).toBe("NEUTRAL-ok");
    expect(r.perRole.ink.verdict).toBe("NEUTRAL-ok");
    expect(r.perRole.accent.verdict).toBe("HARD-BANNED");
    expect(r.perRole.accent.fix.length).toBeGreaterThan(0);
  });
});

describe("audit()", () => {
  it("returns issues on a crafted slop snippet", () => {
    const f = resolve(tmpdir(), `slop-${Date.now()}.html`);
    writeFileSync(
      f,
      `<!doctype html><html><head>
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk&display=swap" rel="stylesheet">
      <style>
        body{background:#0a0a0a;color:#fff;font-family:'Space Grotesk',sans-serif}
        .a{color:#6366f1}
        .glow{box-shadow:0 0 40px #6366f1}
        .x{transition:all .3s; width:100px}
      </style></head><body><h1>✨ AI-powered</h1></body></html>`,
    );
    try {
      const r = audit(f);
      expect(r.pass).toBe(false);
      expect(r.issues.length).toBeGreaterThan(0);
      const types = new Set(r.issues.map((i) => i.type));
      expect(types.has("color")).toBe(true);
      expect(types.has("font")).toBe(true);
      // structural-check catches the ✨ emoji/badge + glow
      expect(r.structuralSeverity).toBeGreaterThan(0);
      // every issue carries an actionable fix
      for (const i of r.issues) expect(i.fix).toBeTruthy();
    } finally {
      rmSync(f, { force: true });
    }
  });

  it("passes a clean snippet", () => {
    const f = resolve(tmpdir(), `clean-${Date.now()}.html`);
    writeFileSync(
      f,
      `<!doctype html><html class="js"><head>
      <link href="https://fonts.googleapis.com/css2?family=Rowan&display=swap" rel="stylesheet">
      <style>
        body{background:#f0f2f5;color:#141416;font-family:'Rowan',serif}
        @media (prefers-reduced-motion: no-preference){.x{transition:opacity .3s ease-out}}
      </style></head><body>
      <button onclick="go()">go</button>
      <script>document.addEventListener('click',()=>{});function go(){}</script>
      </body></html>`,
    );
    try {
      const r = audit(f);
      expect(r.pass).toBe(true);
      expect(r.issues.length).toBe(0);
      expect(r.structuralSeverity).toBe(0);
    } finally {
      rmSync(f, { force: true });
    }
  });

  it("self-verify: portfolio-treatment.html has issues; ca-ledger.html is ~clean", () => {
    const portfolio = audit(resolve(HTML_DIR, "portfolio-treatment.html"));
    expect(portfolio.pass).toBe(false);
    expect(portfolio.issues.length).toBeGreaterThan(0);

    const ledger = audit(resolve(HTML_DIR, "ca-ledger.html"));
    // ca-ledger is the clean reference: no structural slop (severity 0).
    expect(ledger.structuralSeverity).toBe(0);
  });
});

describe("audit --fix (autoFix)", () => {
  let copy: string;
  let bak: string;
  beforeAll(() => {
    copy = resolve(tmpdir(), `portfolio-fix-${Date.now()}.html`);
    copyFileSync(resolve(HTML_DIR, "portfolio-treatment.html"), copy);
    bak = copy + ".bak";
  });
  afterAll(() => {
    rmSync(copy, { force: true });
    rmSync(bak, { force: true });
  });

  it("snaps slop colors in place, writes a .bak, and reports remaining non-color issues", () => {
    const r = autoFix(copy);
    expect(existsSync(bak)).toBe(true);
    expect(r.colorsFixed).toBeGreaterThan(0);
    // each replacement was applied at least once in the file
    for (const rep of r.replacements) {
      expect(rep.count).toBeGreaterThan(0);
      expect(readFileSync(copy, "utf8")).toContain(rep.to);
    }
    // colors are now clean, but structure/font/motion remain for Claude
    expect(r.remaining.every((i) => i.type !== "color")).toBe(true);
    expect(r.remaining.length).toBeGreaterThan(0);
  });
});
