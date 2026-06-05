import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");           // packages/pipeline/src -> repo root
const SKILL = resolve(ROOT, "skills/personality");
const read = (p: string) => readFileSync(resolve(SKILL, p), "utf8");
const CUTOFF = 0.4;                                // matches diagnose.ts SLOP_CUTOFF

describe("personality skill", () => {
  it("has a well-formed entry point", () => {
    const s = read("SKILL.md");
    expect(s).toMatch(/name: personality/);
    expect(s).toContain("## The Process");
    expect(s.toLowerCase()).toContain("ai made this");
    // the hierarchical router + the conflict tie-breaker must be wired in
    expect(s).toContain("Reference map");
    expect(s).toContain("reference/tensions.md");
  });

  it("ships all non-empty reference files", () => {
    for (const f of ["personality-moves.md", "slop-manifest.md", "craft-principles.md", "type-and-color.md", "ux-principles.md", "tensions.md"]) {
      expect(existsSync(resolve(SKILL, "reference", f)), `${f} exists`).toBe(true);
      expect(read(`reference/${f}`).trim().length, `${f} non-empty`).toBeGreaterThan(200);
    }
  });

  it("filled the generated data-tells block in the slop manifest", () => {
    const m = read("reference/slop-manifest.md");
    const body = m.split("GENERATED:data-tells:start")[1]?.split("GENERATED:data-tells:end")[0] ?? "";
    expect(body).toMatch(/\d+%/);                   // contains at least one "NN%" stat
  });

  it("never recommends a saturated font (no self-contradiction)", () => {
    const data = JSON.parse(read("reference/type-and-color.json"));
    const picks = Object.values(data.freshByCat as Record<string, Array<{ family: string; sat: number }>>).flat();
    expect(picks.length).toBeGreaterThan(10);
    for (const p of picks) expect(p.sat, `${p.family} must be fresh`).toBeLessThan(CUTOFF);
    for (const a of data.avoidFonts as Array<{ family: string; sat: number }>) {
      expect(a.sat, `${a.family} must be saturated`).toBeGreaterThanOrEqual(CUTOFF);
    }
  });
});
