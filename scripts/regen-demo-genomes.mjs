// regen-demo-genomes.mjs — regenerate data/tmp/luna-val/genome-0..3.json from the LOCAL engine
// (same brief/seed as explore_directions) and verify determinism + the singleViewport flag.
import { createEngine } from "../apps/engine/engine.mjs";
import { exploreDirections } from "../apps/engine/explore.mjs";
import { CHROME_ROLES } from "../apps/engine/layout-families.mjs";
import corpus from "../apps/engine/data/corpus.json" with { type: "json" };
import brands from "../apps/engine/data/brands.json" with { type: "json" };
import fonts from "../apps/engine/data/fonts.json" with { type: "json" };
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "tmp", "luna-val");
const engine = createEngine({ corpus, brands, fonts });
const intent = { surface: "landing-page", job: "explain-and-convert", sourceBrief: "a landing page for a developer API platform / observability tool" };
const { directions } = exploreDirections(engine, intent, { count: 4 });

const EXPECT = [["full-bleed-diagram", "Cantique"], ["split-marquee", "Ranade"], ["contrast-band-flow", "Montagu Slab"], ["hero-thesis-single", "Epunda Slab"]];
let ok = true;
directions.forEach((d, i) => {
  const g = d.genome;
  const fam = g.layout.family, disp = g.type.display.family;
  const hero = g.layout.sectionGrammar.find((s) => !CHROME_ROLES.has(s.role));
  const sv = hero && hero.singleViewport === true;
  const match = fam === EXPECT[i][0] && disp === EXPECT[i][1];
  if (!match || !sv) ok = false;
  console.log(`${i}: ${fam}/${disp}  hero=${hero.role} singleViewport=${sv}  ${match ? "MATCH" : "*** MISMATCH expected " + EXPECT[i].join("/")}`);
});
if (!ok) { console.log("DETERMINISM/FLAG CHECK FAILED — not writing."); process.exit(1); }
directions.forEach((d, i) => writeFileSync(join(OUT, `genome-${i}.json`), JSON.stringify(d.genome, null, 1)));
console.log("OK — 4 directions unchanged, singleViewport present on every hero, genome-0..3.json written.");
