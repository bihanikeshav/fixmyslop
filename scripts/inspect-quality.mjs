import { createEngine } from "../apps/engine/engine.mjs";
import { connectedStyleGenome } from "../apps/engine/connected.mjs";
import { fontSpaceEvidence } from "../apps/engine/connected-v2.mjs";

const cases = [
  ["coffee", "A tactile independent coffee roastery: origin stories, craft, and a calm subscription conversion path.", "marketing", "light"],
  ["observability", "A precise observability console for incident response, with calm urgency and high signal density.", "dashboard", "dark"],
  ["archive", "An art director portfolio built around a single moving image archive, asymmetrical pacing, and editorial confidence.", "portfolio", "light"],
  ["docs", "Documentation for a small, serious developer tool: readable, navigable, restrained, and quietly crafted.", "docs", "light"],
  ["workspace", "A project workspace that makes handoffs, decisions, and next actions feel clear without becoming sterile.", "app", "light"],
  ["pricing", "Straightforward pricing for an ethical cooperative software product; transparent, warm, and confidence-building.", "pricing", "light"],
  ["climate", "A climate field journal with maps, field notes, photographs, and long-form reporting that should feel human rather than corporate.", "editorial", "light"],
  ["music", "A launch page for an experimental electronic record: kinetic, nocturnal, physical, and unmistakably tied to sound.", "landing-page", "dark"],
  ["ceramic", "A small ceramic studio selling limited vessels, with material tactility, restraint, and one memorable product moment.", "marketing", "light"],
  ["library", "A public library redesign: welcoming, legible, civic, and alive without looking like a generic SaaS landing page.", "landing-page", "light"],
];

const engine = createEngine();
const report = cases.map(([id, sourceBrief, surface, theme], index) => {
  const genome = connectedStyleGenome(engine, {
    surface,
    job: "explain-and-convert",
    contentModel: "story",
    theme,
    sourceBrief,
  }, { seed: 1701 + index * 97 });
  const pair = genome.type?.pairing?.v2;
  const summarise = (font) => font && ({
    family: font.family,
    quality: font.quality,
    popularityRank: font.popularityRank,
    observedUsage: font.usage?.total || 0,
    available: font.asset?.available === true,
    humanValidation: font.humanValidation,
  });
  return {
    id,
    display: summarise(pair?.display),
    body: summarise(pair?.body),
    accent: summarise(pair?.accent?.evidence),
    layout: genome.layout?.family,
    component: genome.material?.component?.dialect,
    texture: genome.material?.texture?.dialect,
  };
});
console.log(JSON.stringify(report, null, 2));

const profileIntent = { surface: "marketing", sourceBrief: "A tactile independent coffee roastery: origin stories, craft, and a calm subscription conversion path." };
console.log(JSON.stringify({
  displayCandidates: engine.retrieveFonts({ role: "display", intent: profileIntent, n: 25 }).map((font) => ({ family: font.family, genre: engine.classifyFontGenre(font), quality: fontSpaceEvidence(font).quality, category: font.category })),
  bodyCandidates: engine.retrieveFonts({ role: "body", intent: profileIntent, n: 25 }).map((font) => ({ family: font.family, quality: fontSpaceEvidence(font).quality, category: font.category })),
}, null, 2));
