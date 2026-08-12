import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardSystem, fluidComponents, checkDashboardLayout } from "./dashboard.mjs";

test("dashboardSystem resolves exact wide-screen geometry on one base grid", () => {
  const spec = dashboardSystem({ viewportWidth: 1440, viewportHeight: 900, content: "mixed", density: "compact", inspector: true });
  assert.equal(spec.schemaVersion, "dashboard-system.v1");
  assert.equal(spec.math.columns, 12);
  assert.equal(spec.inputs.inspector, "docked");
  assert.equal(spec.controls.visualHeightPx, 28);
  assert.ok(spec.geometry.placements.some((item) => item.id === "primary-chart"));
  for (const item of [...spec.geometry.shell, ...spec.geometry.placements]) {
    assert.equal(item.x % 4, 0, `${item.id}.x`);
    assert.equal(item.y % 4, 0, `${item.id}.y`);
    assert.equal(item.width % 4, 0, `${item.id}.width`);
    assert.equal(item.height % 4, 0, `${item.id}.height`);
  }
  assert.ok(spec.personality.layers.length <= 2);
  assert.ok(spec.personality.layers.every((layer) => layer.pointerEvents === "none" && layer.opacity <= 0.08));
});

test("dashboardSystem collapses dashboard chrome at narrow widths", () => {
  const spec = dashboardSystem({ viewportWidth: 390, viewportHeight: 844, content: "table", navigation: "sidebar", inspector: true });
  assert.equal(spec.math.columns, 1);
  assert.equal(spec.inputs.navigation, "drawer");
  assert.equal(spec.inputs.inspector, "drawer");
  assert.equal(spec.geometry.shell.find((item) => item.id === "main-shell").width, 390);
  assert.ok(spec.geometry.overlays.some((item) => item.id === "inspector-drawer"));
});

test("mobile analytics placements remain inside the initial canvas", () => {
  const spec = dashboardSystem({ viewportWidth: 390, viewportHeight: 480, content: "analytics" });
  const canvas = spec.geometry.canvas;
  for (const item of spec.geometry.placements) {
    assert.ok(item.x >= canvas.x && item.x + item.width <= canvas.x + canvas.width, `${item.id} horizontal bounds`);
    assert.ok(item.y >= canvas.y && item.y + item.height <= canvas.y + canvas.height, `${item.id} vertical bounds`);
  }
});

test("fluidComponents returns actual @fluid registry source installs", () => {
  const manifest = fluidComponents({ preset: "analytics", primitive: "base", needs: ["color-picker", "does-not-exist"] });
  assert.equal(manifest.provider.repository, "https://github.com/mickadesign/fluid-functionalism");
  assert.equal(manifest.provider.license, "MIT");
  assert.equal(manifest.setup, "npx shadcn@latest registry add @fluid");
  assert.ok(manifest.components.some((item) => item.slug === "button-base"));
  assert.ok(manifest.components.some((item) => item.slug === "card"));
  assert.ok(manifest.components.every((item) => item.registryUrl === `https://www.fluidfunctionalism.com/r/${item.slug}.json`));
  assert.deepEqual(manifest.unknown, ["does-not-exist"]);
  assert.match(manifest.contract.join(" "), /do not recreate lookalike controls/i);
});

test("checkDashboardLayout rejects off-grid overlaps, fake components, and intrusive decor", () => {
  const audit = checkDashboardLayout({
    viewportWidth: 1000,
    viewportHeight: 700,
    regions: [
      { id: "main", x: 13, y: 0, width: 700, height: 700 },
      { id: "inspector", x: 680, y: 0, width: 320, height: 700 },
    ],
    components: [{ name: "button", source: "local-lookalike", height: 40 }],
    personalityLayers: [
      { id: "grid", opacity: 0.1, pointerEvents: "auto" },
      { id: "fade", opacity: 0.04, pointerEvents: "none" },
      { id: "noise", opacity: 0.02, pointerEvents: "none" },
    ],
  });
  assert.equal(audit.verdict, "SLOP");
  const codes = new Set(audit.issues.map((issue) => issue.code));
  assert.ok(codes.has("OFF_GRID"));
  assert.ok(codes.has("REGION_OVERLAP"));
  assert.ok(codes.has("NON_FLUID_COMPONENT"));
  assert.ok(codes.has("DECOR_LAYER_SPRAWL"));
  assert.ok(codes.has("DECOR_TOO_STRONG"));
  assert.ok(codes.has("DECOR_INTERCEPTS_INPUT"));
  assert.equal(audit.baseline.schemaVersion, "dashboard-system.v1");
});

test("checkDashboardLayout accepts clean grid-aligned Fluid regions", () => {
  const audit = checkDashboardLayout({
    viewportWidth: 1200,
    viewportHeight: 800,
    density: "compact",
    regions: [
      { id: "nav", x: 0, y: 0, width: 240, height: 800 },
      { id: "main", x: 240, y: 0, width: 960, height: 800 },
    ],
    components: [{ name: "button", source: "fluid-functionalism-registry", height: 28 }],
    personalityLayers: [{ id: "grid", opacity: 0.03, pointerEvents: "none" }],
  });
  assert.equal(audit.verdict, "CLEAN");
  assert.equal(audit.issues.length, 0);
  assert.equal(audit.baseline, null);
});

test("checkDashboardLayout understands intentional parent-child containment", () => {
  const audit = checkDashboardLayout({
    viewportWidth: 1200,
    viewportHeight: 800,
    regions: [
      { id: "main", parentId: "viewport", x: 240, y: 0, width: 960, height: 800 },
      { id: "canvas", parentId: "main", x: 272, y: 32, width: 896, height: 736 },
      { id: "table", parentId: "canvas", x: 272, y: 160, width: 896, height: 608 },
    ],
    components: [{ name: "table", source: "fluid-functionalism-registry" }],
  });
  assert.equal(audit.verdict, "CLEAN");
  assert.ok(!audit.issues.some((issue) => issue.code === "REGION_OVERLAP"));
});
