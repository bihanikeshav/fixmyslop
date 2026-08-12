import { test } from "node:test";
import assert from "node:assert/strict";
import { magicUiComponent, checkMagicUiComposition } from "./components.mjs";

test("magicUiComponent returns a grounded registry recipe with controlled variants", () => {
  const recipe = magicUiComponent({ role: "hero", sourceBrief: "a weather instrument", variation: 1, surface: "landing" });
  assert.equal(recipe.schemaVersion, "magic-ui-component.v1");
  assert.equal(recipe.selection.slug, "animated-grid-pattern");
  assert.match(recipe.provider.install, /@magicui\/animated-grid-pattern/);
  assert.equal(recipe.selection.variant.options.length, 3);
  assert.ok(recipe.motion.budget.highMotionComponentsPerViewport === 1);
  assert.ok(recipe.interaction.requiredStates.includes("focus-visible"));
  assert.equal(recipe.provider.license, "MIT");
});

test("magicUiComponent is deterministic and supports explicit component variants", () => {
  const args = { component: "bento-grid", role: "feature-grid", sourceBrief: "a research catalog", variation: 2, motion: "none" };
  const a = magicUiComponent(args);
  const b = magicUiComponent(args);
  assert.deepEqual(a, b);
  assert.equal(a.selection.variant.id, "spotlight");
  assert.equal(a.motion.intensity, "none");
  assert.equal(a.motion.reducedMotion.includes("preserve content"), true);
});

test("checkMagicUiComposition blocks stacked effects and incomplete interaction", () => {
  const audit = checkMagicUiComposition({
    surface: "landing",
    components: [
      { slug: "warp-background", role: "hero", motionIntensity: "expressive" },
      { slug: "globe", role: "anchor", motionIntensity: "expressive" },
      { slug: "marquee", role: "supporting", autoplay: true, pauseOnFocus: false, pauseOnHover: false },
      { slug: "shiny-button", role: "cta", interactive: true, keyboard: false, focusVisible: false },
      { slug: "grid-pattern", role: "ambient", opacity: 0.12 },
    ],
  });
  assert.equal(audit.verdict, "SLOP");
  const codes = new Set(audit.issues.map((issue) => issue.code));
  assert.ok(codes.has("MULTIPLE_ANCHORS"));
  assert.ok(codes.has("MOTION_STACKING"));
  assert.ok(codes.has("AUTOPLAY_NO_PAUSE"));
  assert.ok(codes.has("INTERACTIVE_A11Y"));
  assert.ok(codes.has("AMBIENT_TOO_STRONG"));
});

test("checkMagicUiComposition accepts one quiet anchor and one supporting effect", () => {
  const audit = checkMagicUiComposition({
    surface: "app",
    reducedMotion: true,
    components: [
      { slug: "terminal", role: "hero", motion: "none" },
      { slug: "shiny-button", role: "cta", interactive: true, keyboard: true, focusVisible: true, motion: "subtle" },
    ],
  });
  assert.equal(audit.verdict, "CLEAN");
  assert.equal(audit.issues.length, 0);
});
