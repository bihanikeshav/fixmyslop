import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "./engine.mjs";
import { canonicalSurface, connectedIntent, deriveMechanismPlan, connectedStyleGenome, connectedExploreDirections, connectedBuildSpec, CONNECTED_V2_STATUS } from "./connected.mjs";
import corpus from "./data/corpus.json" with { type: "json" };
import brands from "./data/brands.json" with { type: "json" };
import fonts from "./data/fonts.json" with { type: "json" };

const engine = createEngine({ corpus, brands, fonts });

test("connected intent canonicalizes surface aliases and grounds subject signals", () => {
  const { intent, profile } = connectedIntent({
    surface: "landing",
    brief: "A developer observability platform for incident response",
  });
  assert.equal(intent.surface, "landing-page");
  assert.equal(intent.sourceBrief, "A developer observability platform for incident response");
  assert.equal(profile, "incident-operations");
  assert.equal(intent.hue, 164);
  assert.equal(intent.formality, 0.76);
});

test("descriptive benchmark surfaces canonicalize to engine surfaces before priors run", () => {
  assert.equal(canonicalSurface("technical product dashboard"), "dashboard");
  assert.equal(canonicalSurface("public-service form"), "app");
  assert.equal(canonicalSurface("editorial research story"), "editorial");
  assert.equal(canonicalSurface("creative tool landing page"), "landing-page");
  assert.equal(canonicalSurface("API reference manual"), "docs");
});

test("semantic extraction scores mechanism evidence instead of first-keyword matching", () => {
  const cases = [
    ["technical product dashboard", "Build an observability incident workspace with a causal service timeline, logs, acknowledge and escalate.", "incident-operations"],
    ["public-service form", "A city benefits application with eligibility, household income, save-and-return, validation and confirmation.", "civic-service-flow"],
    ["editorial research story", "A research story comparing neighbourhood measurements with methodology, citations and uncertainty.", "research-evidence"],
    ["creative tool landing page", "A browser-based motion choreography tool with an editable sequence, timeline, playhead, keyframes and export formats.", "creative-tool-workbench"],
  ];
  for (const [surface, sourceBrief, expected] of cases) {
    const result = connectedIntent({ surface, sourceBrief });
    assert.equal(result.profile, expected);
    assert.ok(result.semantic.score >= 8, `${expected} score was ${result.semantic.score}`);
    assert.ok(result.semantic.evidence.length > 0);
    assert.equal(result.semantic.candidates[0].id, expected);
  }
});

test("community-service discovery routes libraries and adjacent services without stealing environmental civic briefs", () => {
  const cases = [
    {
      sourceBrief: "A public library redesign for families and local residents: browse the catalogue, see branch availability and events, place a hold, and plan a visit.",
      mechanism: "library-discovery-and-hold",
      centrepiece: "catalogue-and-program-finder",
    },
    {
      sourceBrief: "A community recreation centre for residents to find classes, compare schedules and facility access, see remaining space, register or join a waitlist, and plan a visit.",
      mechanism: "community-program-registration",
      centrepiece: "program-schedule-and-registration",
    },
    {
      sourceBrief: "A public resource directory for residents to find food support and legal clinics, verify availability, hours, language and access requirements, then contact a provider or request a referral.",
      mechanism: "community-support-directory",
      centrepiece: "service-access-finder",
    },
  ];
  const mechanisms = [];
  for (const [index, item] of cases.entries()) {
    const input = { surface: "public community service landing page", contentModel: "service", sourceBrief: item.sourceBrief };
    const result = connectedIntent(input);
    const genome = connectedStyleGenome(engine, input, { seed: 310 + index });
    assert.equal(result.profile, "community-service-discovery");
    assert.ok(result.semantic.score >= 11, `${item.mechanism} score was ${result.semantic.score}`);
    assert.equal(genome.connected.mechanism.id, item.mechanism);
    assert.equal(genome.expression.centrepiece, item.centrepiece);
    assert.equal(genome.connected.mechanism.validity.pass, true);
    assert.match(genome.connected.mechanism.interaction.primary, /find|browse|search/i);
    assert.match(genome.connected.mechanism.mobile, /availability.*location.*access/i);
    mechanisms.push(genome.connected.mechanism.id);
  }
  assert.equal(new Set(mechanisms).size, cases.length, "adjacent services collapsed to a swappable generic mechanism");

  const environmental = connectedIntent({
    surface: "editorial research story",
    sourceBrief: "A climate field journal for public conservation work with watershed observations, habitat evidence, and a map.",
  });
  assert.equal(environmental.profile, "climate-civic");
});

test("public library typography stays restrained and does not invent an unrequested script locale", () => {
  const input = {
    surface: "landing-page",
    contentModel: "service",
    audience: ["families and local residents"],
    sourceBrief: "A public library redesign: welcoming, legible, civic, and alive. Help residents discover resources and events, see availability and hours, place a hold, and plan a visit.",
  };
  const forbiddenLocale = /\b(arabic|bengali|devanagari|gujarati|gurmukhi|hebrew|kannada|khmer|lao|malayalam|sinhala|tamil|telugu|thai)\b/i;
  for (let seed = 0; seed < 16; seed++) {
    const genome = connectedStyleGenome(engine, input, { seed: 700 + seed });
    assert.equal(genome.connected.profile, "community-service-discovery");
    assert.ok(!["blackletter", "script", "decorative", "display-other"].includes(genome.type.pairing.displayGenre));
    assert.doesNotMatch(genome.type.display.family, forbiddenLocale);
    assert.doesNotMatch(genome.type.body.family, forbiddenLocale);
    assert.notEqual(genome.type.display.family, "Lemonada");
    assert.notEqual(genome.type.display.family, "Anek Gujarati");
    assert.notEqual(genome.type.body.family, "Anek Gujarati");
    assert.notEqual(genome.type.display.readabilityChecks?.displaySuitable, false);
    assert.notEqual(genome.type.body.readabilityChecks?.bodySuitable, false);
  }
});

test("behavioural mechanism families route unseen operational, cultural, application, media, and procedural briefs", () => {
  const cases = [
    ["hospital-bed-command", { surface: "technical product dashboard", sourceBrief: "Hospital bed command: place admissions by ward capacity and care requirements, assign or transfer beds, and track occupied, cleaning, ready, and blocked states." }, "care-capacity-command", "care-capacity-allocation", "bed-capacity-and-placement-board"],
    ["warehouse-picking", { surface: "app", sourceBrief: "A warehouse picking workflow: follow an aisle route, scan the bin and item into a tote, confirm quantity, and handle short-pick or substitution exceptions." }, "fulfillment-picking", "guided-pick-fulfillment", "guided-pick-path"],
    ["project-handoff", { surface: "app", contentModel: "workflow", sourceBrief: "A project handoff workspace showing what changed, the pending decision, owner, deadline, dependency, blocked state, and reversible next action." }, "work-handoff-coordination", "decision-handoff", "decision-and-ownership-handoff"],
    ["api-reference", { surface: "docs", sourceBrief: "An API reference for an endpoint with authentication, parameters, editable request example, response schema, status codes, errors, and version context." }, "api-reference-execution", "request-response-contract", "endpoint-request-response-workbench"],
    ["museum-collection", { surface: "editorial research story", sourceBrief: "A museum collection catalogue: browse and filter object records, inspect accession identity, creator, period, provenance, exhibition context, and related works." }, "cultural-collection-exploration", "collection-provenance-exploration", "collection-object-and-provenance"],
    ["community-music-grant", { surface: "public-service form", sourceBrief: "A community music grant application with eligibility, applicant and project details, project budget, funding request, attachments, save, review, submit, and confirmation." }, "grant-application-flow", "grant-eligibility-and-submission", "grant-application-workflow"],
    ["pottery-kiln", { surface: "app", sourceBrief: "A pottery kiln control workspace with a firing schedule, temperature ramp and soak curve, current sensor values, stage controls, alarm deviations, and a completed run record." }, "process-control", "scheduled-process-control", "process-curve-and-stage-control"],
    ["wildfire-evacuation", { surface: "landing-page", sourceBrief: "A wildfire evacuation service showing the resident's zone, leave-now instruction, safe route, road closures, shelter capacity, update time, and check-in status." }, "emergency-evacuation", "evacuation-zone-to-action", "zone-instruction-and-safe-route"],
    ["budgeting-workspace", { surface: "app", sourceBrief: "A household budgeting workspace with income, categorized transactions, account allocations, remaining amounts, planned-versus-actual variance, forecast scenarios, reconciliation, and undo." }, "financial-planning-workspace", "budget-allocation-and-forecast", "allocation-and-forecast-ledger"],
    ["meditation-audio", { surface: "landing-page", sourceBrief: "A guided meditation audio landing page with session duration, structured cues, play, pause and progress, download, offline, resume, completed, buffering, and media-error states." }, "guided-audio-session", "guided-session-playback", "guided-session-player"],
    ["font-editor", { surface: "creative tool landing page", sourceBrief: "A browser font editor with a glyph set, editable outline nodes, metrics and kerning, variable axes, a live proof specimen, undo, and font export." }, "creative-tool-workbench", "glyph-outline-editing", "glyph-canvas-and-specimen"],
    ["lab-protocol", { surface: "docs", sourceBrief: "A lab protocol runner with a versioned ordered procedure, sample and reagent inputs, quantities, timers, measurements, step completion, deviations, pause/resume, and sign-off." }, "procedural-execution", "verified-protocol-run", "protocol-step-and-run-record"],
  ];
  const genericCentrepieces = new Set(["field-instrument", "operational-instrument", "subject-proof-object", "reference-spine", "handoff-work-item"]);
  for (const [id, input, profile, mechanism, centrepiece] of cases) {
    const intentResult = connectedIntent(input);
    assert.equal(intentResult.profile, profile, `${id} routed to ${intentResult.profile}`);
    for (const seed of [0, 7, 24]) {
      const genome = connectedStyleGenome(engine, input, { seed });
      assert.equal(genome.connected.profile, profile, `${id}/${seed} profile drifted`);
      assert.equal(genome.connected.mechanism.id, mechanism, `${id}/${seed} mechanism drifted`);
      assert.equal(genome.expression.centrepiece, centrepiece, `${id}/${seed} centrepiece drifted`);
      assert.equal(genome.expression.centrepieceValidation.status, "accepted");
      assert.ok(!genericCentrepieces.has(genome.expression.centrepiece), `${id} retained a generic centrepiece`);
      assert.notEqual(genome.type.display.readabilityChecks?.displaySuitable, false);
      assert.notEqual(genome.type.body.readabilityChecks?.bodySuitable, false);
    }
  }
});

test("unseen mechanisms stay seed-invariant while explore changes the authored composition", () => {
  const cases = [
    { surface: "technical product dashboard", sourceBrief: "Hospital bed command with placement requests, ward capacity, assignment, transfer, cleaning, blocked, and discharge states." },
    { surface: "editorial research story", sourceBrief: "Museum collection catalogue with object records, accession identity, provenance, filtering, inspection, and related works." },
    { surface: "creative tool landing page", sourceBrief: "A font editor with glyph outline nodes, metrics, kerning, variable axes, a live specimen, undo, and export." },
    { surface: "docs", sourceBrief: "A lab protocol runner with ordered steps, sample and reagent inputs, timers, measurements, deviations, completion, and sign-off." },
  ];
  for (const [index, input] of cases.entries()) {
    const explored = connectedExploreDirections(engine, input, { seed: 920 + index, count: 4 });
    assert.ok(explored.directions.length >= 2);
    assert.equal(new Set(explored.directions.map((direction) => direction.mechanism.id)).size, 1);
    assert.ok(new Set(explored.directions.map((direction) => direction.artDirection.composition)).size > 1);
    for (const direction of explored.directions) {
      assert.equal(direction.genome.expression.centrepieceValidation.status, "accepted");
      assert.equal(direction.genome.expression.centrepiece, direction.mechanism.centrepiece.id);
    }
  }
});

test("font handoff names the exact available local format instead of promising WOFF2", () => {
  const built = connectedBuildSpec(engine, {
    surface: "docs",
    sourceBrief: "An API reference with endpoint parameters, request and response schema, runnable example, errors, and version context.",
  }, { seed: 2408 });
  assert.match(built.spec, /licensed local font assets in the exact available format \(WOFF2 or TTF\)/);
  assert.doesNotMatch(built.spec, /licensed local WOFF2 assets/);
});

test("connected genomes are deterministic and preserve a readable dual-font pair", () => {
  const input = {
    surface: "marketing",
    job: "explain-and-convert",
    sourceBrief: "An independent coffee roastery with tactile origin stories",
  };
  const a = connectedStyleGenome(engine, input, { seed: 1701 });
  const b = connectedStyleGenome(engine, input, { seed: 1701 });
  assert.deepEqual(a, b);
  assert.equal(a.connected.profile, "earth-craft");
  assert.notEqual(a.type.display.family, a.type.body.family);
  assert.equal(a.type.body.category === "serif" || a.type.body.category === "sans-serif", true);
  assert.equal(engine.checkTypeFit({ display: a.type.display.family, body: a.type.body.family }, input).pass, true);
  assert.equal(a.type.pairing.strategy, "subject-register-contrast-v1");
});

test("connected one-shot typography applies the empirical quality floor", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "marketing",
    sourceBrief: "A tactile independent coffee roastery with origin stories",
  }, { seed: 1701 });
  const pair = genome.type.pairing.v2;
  assert.ok(pair.display.asset.available && pair.body.asset.available);
  assert.ok(pair.display.quality >= 0.74, `${pair.display.family} fell below the display quality floor`);
  assert.ok(pair.body.quality >= 0.72, `${pair.body.family} fell below the body quality floor`);
  assert.notEqual(pair.display.family, "Kihim");
  assert.notEqual(pair.body.family, "Rag");
});

test("connected register filter prevents decorative faces on civic and technical subjects", () => {
  for (const sourceBrief of [
    "A climate field journal for public conservation work",
    "A developer API observability console for SRE teams",
  ]) {
    const genome = connectedStyleGenome(engine, { surface: "landing", sourceBrief }, { seed: 7 });
    const genre = engine.classifyFontGenre(genome.type.display);
    assert.ok(!["blackletter", "script", "decorative"].includes(genre), `${sourceBrief} picked ${genre}`);
  }
});

test("connected theme and concept handoff stay coherent for a dark subject", () => {
  const input = {
    surface: "landing-page",
    theme: "dark",
    sourceBrief: "An experimental electronic record launch with a playable sound archive",
  };
  const genome = connectedStyleGenome(engine, input, { seed: 808 });
  const groundL = engine.classify(genome.color.ground).oklch.L;
  const inkL = engine.classify(genome.color.ink).oklch.L;
  assert.equal(genome.color.mood, "dark");
  assert.ok(groundL < 0.35 && inkL > groundL, `dark palette lightness mismatch: ground ${groundL}, ink ${inkL}`);
  const built = connectedBuildSpec(engine, input, { seed: 808 });
  assert.match(built.spec, /Subject concept card/);
  assert.match(built.spec, /playable sound object|track-driven visual instrument/);
});

test("unprofiled pricing uses a restrained register and direction font exclusions", () => {
  const input = {
    surface: "pricing",
    job: "explain-and-convert",
    contentModel: "comparison",
    sourceBrief: "Straightforward pricing for an ethical cooperative software product",
  };
  const one = connectedStyleGenome(engine, input, { seed: 606 });
  assert.equal(one.type.pairing.register, "neutral-corporate");
  assert.ok(!["blackletter", "script", "decorative", "display-other"].includes(one.type.pairing.displayGenre));
  const explored = connectedExploreDirections(engine, input, { seed: 606, count: 4 });
  const displays = explored.directions.map((d) => d.genome.type.display.family);
  assert.equal(new Set(displays).size, displays.length);
});

test("concept card branches by surface for docs and project workspaces", () => {
  const docs = connectedBuildSpec(engine, {
    surface: "docs",
    contentModel: "reference",
    sourceBrief: "Documentation for a small developer tool",
  }, { seed: 44 });
  const workspace = connectedBuildSpec(engine, {
    surface: "app",
    contentModel: "workflow",
    sourceBrief: "A project workspace for handoffs and decisions",
  }, { seed: 45 });
  assert.match(docs.spec, /navigable reference spine/);
  assert.match(docs.spec, /runnable example/);
  assert.match(workspace.spec, /living handoff surface/);
  assert.match(workspace.spec, /owner, deadline, dependency/);
});

test("connected explorer keeps the engine's bounded thin-pool behavior but decorates every direction", () => {
  const input = {
    surface: "pricing",
    job: "compare-plans",
    sourceBrief: "An ethical pricing page for a small cooperative",
  };
  const result = connectedExploreDirections(engine, input, { seed: 6006, count: 4 });
  const resolved = connectedIntent(input).intent;
  assert.ok(result.directions.length >= 2 && result.directions.length <= 4);
  assert.equal(result.connected.source, "connected-intent-v2");
  for (const direction of result.directions) {
    assert.ok(direction.genome.connected);
    assert.ok(direction.genome.type.display.family);
    assert.ok(direction.genome.type.body.family);
    assert.equal(engine.checkTypeFit({ display: direction.genome.type.display.family, body: direction.genome.type.body.family }, resolved).pass, true);
  }
});

test("connected v2 returns accent role, material/component personality, and bounded expressions", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "portfolio",
    sourceBrief: "An editorial archive for contemporary art",
    accentMode: "always",
    texturePreference: "paper-grain",
    expressionPreference: "asymmetric-split-pinning",
  }, { seed: 991 });
  assert.equal(genome.connected.v2.schemaVersion, "connected-style-v2");
  assert.ok(genome.type.accent?.family);
  assert.equal(genome.type.roles.body, "running text");
  assert.ok(genome.type.pairing.v2.display.available);
  assert.ok(genome.material.component.dialect);
  assert.equal(genome.material.texture.dialect, "paper-grain");
  assert.equal(genome.expression.centrepiece, "subject-archive");
  assert.equal(genome.expression.presentationTreatment, "asymmetric-split-pinning");
  assert.equal(genome.expression.centrepieceValidation.status, "accepted");
  assert.match(genome.material.component.button.interaction, /press|lift|underline|state|color/i);
  assert.ok(genome.expression.responsive["asymmetric-split-pinning"]);
  assert.ok(genome.expression.reducedMotion["asymmetric-split-pinning"]);
  const spec = connectedBuildSpec(engine, { surface: "portfolio", sourceBrief: "An art archive" }, { seed: 992 });
  assert.match(spec.spec, /Connected v2 expression handoff/);
  assert.match(spec.spec, /Accent:/);
});

test("motion-tool brief becomes an interactive workbench with a truthful proof loop", () => {
  const input = {
    surface: "creative tool landing page",
    sourceBrief: "Build a landing page for a browser-based motion choreography tool. Demonstrate a real editable sequence, explain the model, show export formats and pricing, and include keyboard, reduced-motion, and touch alternatives.",
  };
  const genome = connectedStyleGenome(engine, input, { seed: 2408 });
  assert.equal(genome.connected.profile, "creative-tool-workbench");
  assert.equal(genome.layout.family, "app-shell-workbench");
  assert.doesNotMatch(genome.layout.family, /editorial|narrative/);
  assert.equal(genome.connected.mechanism.id, "sequence-choreography");
  assert.equal(genome.connected.mechanism.proofObject.id, "editable-sequence-proof");
  assert.equal(genome.expression.centrepiece, "sequence-workbench");
  assert.equal(genome.expression.centrepieceValidation.status, "accepted");
  assert.match(genome.connected.mechanism.interaction.primary, /scrub.*edit.*preview.*export/i);
  assert.match(genome.connected.mechanism.mobile, /live stage.*timeline.*bottom sheet/i);
  assert.match(genome.connected.mechanism.reducedMotion, /disable autoplay.*scrubber.*stepped/i);
  for (const required of ["ready", "editing", "playing", "exporting", "recoverable-error"]) {
    assert.ok(genome.connected.mechanism.states.includes(required), `missing ${required}`);
  }
  assert.equal(genome.connected.mechanism.validity.pass, true);
  assert.ok(!/editorial/i.test(genome.connected.profile));
});

test("explore directions keep one mechanism while changing its composition materially", () => {
  const input = {
    surface: "creative tool landing page",
    sourceBrief: "A browser-based motion choreography tool with a real editable sequence, timeline, keyframes, stage, easing and export.",
  };
  const explored = connectedExploreDirections(engine, input, { seed: 771, count: 4 });
  assert.ok(explored.directions.length >= 3);
  assert.deepEqual(new Set(explored.directions.map((direction) => direction.mechanism.id)), new Set(["sequence-choreography"]));
  assert.equal(new Set(explored.directions.map((direction) => direction.artDirection.id)).size, explored.directions.length);
  assert.equal(new Set(explored.directions.map((direction) => direction.artDirection.composition)).size, explored.directions.length);
  for (const direction of explored.directions) {
    assert.equal(direction.genome.layout.family, "app-shell-workbench");
    assert.equal(direction.genome.expression.centrepiece, "sequence-workbench");
    assert.equal(direction.genome.expression.centrepieceValidation.mechanismMatch, true);
    assert.equal(direction.genome.connected.concept.proofObject.id, "editable-sequence-proof");
    assert.equal(direction.artDirection.mechanismId, "sequence-choreography");
  }
});

test("expression treatments are rejected as proof centrepieces and hard fallbacks stay explicit", () => {
  const plan = deriveMechanismPlan({ surface: "landing-page", sourceBrief: "motion editor" }, "creative-tool-workbench", 2);
  assert.equal(plan.validity.pass, true);
  assert.equal(plan.centrepiece.status, "accepted");
  const genome = connectedStyleGenome(engine, {
    surface: "creative tool landing page",
    sourceBrief: "A motion choreography sequence editor with timeline, stage, keyframes and export.",
    expressionPreference: "asymmetric-split-pinning",
  }, { seed: 881 });
  assert.equal(genome.expression.centrepiece, "sequence-workbench");
  assert.notEqual(genome.expression.centrepiece, genome.expression.presentationTreatment);
  if (genome.expression.presentationTreatment) {
    assert.ok(genome.expression.rejectedCentrepieces.some((entry) => entry.id === genome.expression.presentationTreatment));
  }
  assert.equal(genome.expression.centrepieceValidation.nonNull, true);
});

test("frozen UI briefs retain palette, type-role, accessibility, and mechanism gates", () => {
  const briefs = [
    { surface: "technical product dashboard", sourceBrief: "An observability incident workspace with service health, causal event timeline, logs, ownership, acknowledge, escalate, loading, empty, error and resolved states." },
    { surface: "public-service form", sourceBrief: "A city benefits application with eligibility, household and income details, progress, adjacent errors, save-and-return and confirmation." },
    { surface: "editorial research story", sourceBrief: "A heat-island research story across five neighbourhoods with sourced measurements, comparison, map evidence, methodology and uncertainty." },
    { surface: "creative tool landing page", sourceBrief: "A browser-based motion choreography tool with a real editable sequence, stage, timeline, keyframes, inspector, export, keyboard, reduced-motion and touch alternatives." },
  ];
  briefs.forEach((input, index) => {
    const genome = connectedStyleGenome(engine, input, { seed: 500 + index });
    const palette = engine.checkPalette(genome.color.ground, genome.color.ink, genome.color.accent, genome.color.accent2);
    assert.equal(palette.pass, true, `${input.surface} palette failed`);
    assert.notEqual(genome.type.display.readabilityChecks?.displaySuitable, false, `${input.surface} display role failed`);
    assert.notEqual(genome.type.body.readabilityChecks?.bodySuitable, false, `${input.surface} body role failed`);
    assert.ok(genome.color.contrast >= 4.5, `${input.surface} contrast was ${genome.color.contrast}`);
    assert.equal(genome.motion.design.defaults.respectsReducedMotion, true);
    assert.equal(genome.expression.centrepieceValidation.status, "accepted");
    assert.equal(genome.connected.mechanism.validity.pass, true);
    assert.doesNotMatch(connectedBuildSpec(engine, input, { seed: 500 + index }).spec, /BLOCKED:/);
  });
});

test("connected v2 exposes its empirical catalog and respects an explicit accent opt-out", () => {
  const genome = connectedStyleGenome(engine, {
    surface: "marketing",
    sourceBrief: "A tactile coffee roastery",
    accentMode: "none",
  }, { seed: 992 });
  assert.equal(genome.type.accent, null);
  assert.ok(CONNECTED_V2_STATUS.fontEntries > 2000);
  assert.equal(CONNECTED_V2_STATUS.candidatePairRecords, 41);
  assert.ok(CONNECTED_V2_STATUS.componentDialects.includes("playful"));
  assert.ok(CONNECTED_V2_STATUS.expressionTreatments.includes("cursor-magnetic-action"));
});
