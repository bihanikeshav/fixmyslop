import { describe, it, expect } from "vitest";
import { parseChoice, choiceToFontIds, buildPrompt } from "./signals/synthetic.js";

describe("parseChoice", () => {
  it("parses a clean JSON response", () => {
    const c = parseChoice('{"headingFont":"Clash Display","bodyFont":"Inter","palette":["#1a1a2e","#16213e","#e94560"]}');
    expect(c).toEqual({
      headingFont: "Clash Display",
      bodyFont: "Inter",
      palette: ["#1a1a2e", "#16213e", "#e94560"],
    });
  });

  it("tolerates code fences and surrounding prose", () => {
    const text = "Sure! Here's my pick:\n```json\n{\"headingFont\": \"Fraunces\", \"bodyFont\": \"Source Sans 3\", \"palette\": []}\n```\nHope that helps.";
    const c = parseChoice(text);
    expect(c?.headingFont).toBe("Fraunces");
    expect(c?.bodyFont).toBe("Source Sans 3");
  });

  it("drops malformed hex colors", () => {
    const c = parseChoice('{"headingFont":"A","bodyFont":"B","palette":["#abcdef","not-a-color","#123"]}');
    expect(c?.palette).toEqual(["#abcdef"]);
  });

  it("returns null when required fields are missing", () => {
    expect(parseChoice('{"palette":[]}')).toBeNull();
    expect(parseChoice("no json here")).toBeNull();
    expect(parseChoice('{"headingFont":"","bodyFont":"X"}')).toBeNull();
  });

  it("maps choices to slugified font ids", () => {
    expect(choiceToFontIds({ headingFont: "Clash Display", bodyFont: "Source Sans 3", palette: [] }))
      .toEqual({ headingId: "clash-display", bodyId: "source-sans-3" });
  });

  it("buildPrompt names the product and demands JSON", () => {
    const p = buildPrompt("an AI note-taking app");
    expect(p).toContain("an AI note-taking app");
    expect(p).toContain("headingFont");
  });
});
