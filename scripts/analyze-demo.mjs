import { readFile, writeFile } from "node:fs/promises";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const runs = [
  { model: "opus", vibe: "ai-saas", fonts: ["Inter","Space Grotesk","Sora","Manrope","Outfit","Plus Jakarta Sans","DM Sans","Poppins","Lexend","Satoshi","Epilogue","Urbanist","Geist","Onest","Schibsted Grotesk","Hanken Grotesk","Familjen Grotesk","Unbounded","Syne","Bricolage Grotesque"] },
  { model: "sonnet", vibe: "ai-saas", fonts: ["Inter","Space Grotesk","Outfit","Syne","DM Sans","Plus Jakarta Sans","Oxanium","Rajdhani","Exo 2","Urbanist","Manrope","Lexend","Figtree","Space Mono","Orbitron","Barlow","Nunito Sans","Jost","Unbounded","Familjen Grotesk"] },
  { model: "haiku", vibe: "ai-saas", fonts: ["Sora","Inter","Space Grotesk","Outfit","Poppins","Clash Display","DM Sans","Manrope","Lexend","Montserrat","Archivo","Work Sans","Urbanist","Raleway","Proxima Nova","Rubik","IBM Plex Sans","Source Sans Pro","Mulish","Varela Round"] },
  { model: "opus", vibe: "luxury-fashion", fonts: ["Playfair Display","Cormorant Garamond","Bodoni Moda","Marcellus","Cormorant","DM Serif Display","Italiana","Forum","Tenor Sans","Prata","Cinzel","Libre Caslon Display","Bodoni Moda SC","Fraunces","Gilda Display","Abril Fatface","Ledger","Rufina","Suranna","Yeseva One"] },
  { model: "sonnet", vibe: "luxury-fashion", fonts: ["Playfair Display","Cormorant Garamond","Bodoni Moda","DM Serif Display","Libre Baskerville","Cormorant","Spectral","Freight Display Pro","Abril Fatface","Yeseva One","Cardo","EB Garamond","Josefin Slab","Ogg","Della Respira","Rufina","Luxurious Roman","Philosopher","Vidaloka","Cambo"] },
  { model: "haiku", vibe: "luxury-fashion", fonts: ["Playfair Display","Bodoni Moda","Cormorant Garamond","Freight Big","Abril Fatface","Didot","Cinzel","Orelo","Prata","Lora","Romantique","Quincy CF","Merriweather","Spectral","Libre Baskerville","Crimson Text","Trajan Pro","Copperplate","Epistolary","Unna"] },
];

await writeFile("data/synthetic-demo.json", JSON.stringify(runs, null, 2));

const index = JSON.parse(await readFile("data/fonts.index.json", "utf8"));
const indexIds = new Set(index.map((f) => f.id));

for (const vibe of ["ai-saas", "luxury-fashion"]) {
  const points = new Map();
  const rank1 = [];
  let total = 0, real = 0;
  const missing = new Set();
  for (const run of runs.filter((r) => r.vibe === vibe)) {
    rank1.push(`${run.model}→${run.fonts[0]}`);
    run.fonts.forEach((f, i) => {
      points.set(f, (points.get(f) ?? 0) + (20 - i));
      total++;
      if (indexIds.has(slug(f))) real++; else missing.add(f);
    });
  }
  const top = [...points.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\n=== ${vibe} ===`);
  console.log("rank-1 picks:", rank1.join("   "));
  console.log("aggregate slop (cross-model points):");
  for (const [f, p] of top) console.log(`   ${String(p).padStart(3)}  ${f}`);
  console.log(`real Google Fonts: ${real}/${total} (${Math.round((100 * real) / total)}%)`);
  console.log(`NOT in our index (hallucinated / commercial):`, [...missing].join(", "));
}
