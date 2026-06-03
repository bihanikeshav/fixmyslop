import { describe, it, expect } from "vitest";
import { parseRankedList, buildRankedPrompt } from "./signals/openai.js";

describe("parseRankedList", () => {
  it("parses an array of {rank,font} objects", () => {
    const r = parseRankedList('[{"rank":1,"font":"Inter"},{"rank":2,"font":"Sora"}]');
    expect(r).toEqual([{ rank: 1, font: "Inter" }, { rank: 2, font: "Sora" }]);
  });

  it("parses a bare array of strings, assigning ranks by position", () => {
    const r = parseRankedList('["Playfair Display", "Cormorant Garamond"]');
    expect(r).toEqual([{ rank: 1, font: "Playfair Display" }, { rank: 2, font: "Cormorant Garamond" }]);
  });

  it("tolerates surrounding prose and re-sorts by rank", () => {
    const r = parseRankedList('Here you go:\n[{"rank":2,"font":"B"},{"rank":1,"font":"A"}]\nthanks');
    expect(r.map((x) => x.font)).toEqual(["A", "B"]);
  });

  it("returns [] on junk", () => {
    expect(parseRankedList("no json")).toEqual([]);
    expect(parseRankedList("[broken")).toEqual([]);
  });

  it("buildRankedPrompt embeds the vibe and demands JSON", () => {
    const p = buildRankedPrompt("a luxury fashion house");
    expect(p).toContain("a luxury fashion house");
    expect(p).toContain("JSON array");
  });
});
