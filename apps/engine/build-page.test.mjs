// apps/engine/build-page.test.mjs — the genome → coded page renderer must EXEMPLIFY the gates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createEngine } from "./engine.mjs";
import { styleGenome } from "./genome.mjs";
import { renderPage } from "./build-page.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(resolve(dir, "data", f), "utf8"));
const eng = createEngine({ corpus: load("corpus.json"), brands: load("brands.json"), fonts: load("fonts.json") });
const genomeFor = (input, seed = 3) => styleGenome(eng, input, { seed });

test("build-page purity: no fs/Date.now/new Date/Math.random", () => {
  const src = readFileSync(fileURLToPath(new URL("build-page.mjs", import.meta.url)), "utf8")
    .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assert.ok(!/Math\.random|Date\.now|new Date|require\(|from "node:fs"/.test(src));
});

test("renderPage emits a charset-correct, container-tokened, gate-exemplifying page", () => {
  const g = genomeFor({ surface: "landing-page", job: "explain-and-convert", sourceBrief: "a scheduling tool for clinics" });
  const html = renderPage(eng, g);
  // the mojibake fix — always present
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /<meta name="viewport"/);
  // container tokens on the wrapper, not re-added margin on inner
  assert.match(html, /max-width:var\(--maxw\)/);
  assert.match(html, /--maxw:\d+px/);
  assert.doesNotMatch(html, /\.wrap\{[^}]*margin-inline:auto[^}]*max-width/);   // no double-count pattern
  // core content in markup on load — no opacity:0-until-scroll gating
  assert.doesNotMatch(html, /opacity:\s*0/);
  assert.match(html, /<h1>/);
  // reduced-motion path present
  assert.match(html, /prefers-reduced-motion/);
  // the genome's fonts + accent actually made it into the CSS
  assert.ok(html.includes(g.type.body.family), "body font applied");
  assert.ok(html.includes(g.color.accent), "accent applied");
});

test("accent is scarce — used on at most one primary button fill", () => {
  const g = genomeFor({ surface: "landing-page", sourceBrief: "a developer API platform" });
  const html = renderPage(eng, g);
  // the accent hex appears as a token def + the .btn-primary rule references the token, not the raw hex repeated everywhere
  const rawAccent = g.color.accent;
  const occurrences = html.split(rawAccent).length - 1;
  assert.ok(occurrences <= 2, `accent hex appears ${occurrences}× — should be scarce (token def + maybe one more), not sprayed`);
  assert.match(html, /\.btn-primary\{background:var\(--accent\)/);
  assert.equal((html.match(/class="btn btn-primary"/g) || []).length, 1, "only one action may use the primary treatment");
});

test("primary button text keeps AA contrast against generated accents", () => {
  for (let seed = 0; seed < 200; seed++) {
    const g = genomeFor({ surface: "landing-page", sourceBrief: "a scheduling tool for clinics" }, seed);
    const html = renderPage(eng, g);
    const buttonInk = html.match(/--accent-ink:(#[0-9a-f]{6})/i)?.[1];
    assert.ok(buttonInk, `seed ${seed}: missing --accent-ink`);
    const ratio = eng.contrastRatio(g.color.accent, buttonInk);
    assert.ok(ratio >= 4.5, `seed ${seed}: ${g.color.accent} / ${buttonInk} contrast ${ratio.toFixed(2)} < 4.5`);
    assert.equal((html.match(/class="btn btn-primary"/g) || []).length, 1, `seed ${seed}: expected one primary action`);
  }
});

test("renders any genome shape (dashboard section grammar) without throwing", () => {
  const g = genomeFor({ surface: "dashboard", job: "monitor", sourceBrief: "an ops dashboard" });
  const html = renderPage(eng, g);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<meta charset="utf-8">/);
  assert.ok(html.length > 800);
});

test("deterministic: same genome → identical html", () => {
  const g = genomeFor({ surface: "landing-page", sourceBrief: "a coffee subscription" }, 7);
  assert.equal(renderPage(eng, g), renderPage(eng, g));
});
