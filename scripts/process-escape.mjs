import { readFile, writeFile } from "node:fs/promises";
const raw = await readFile(process.argv[2], "utf8");
const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
const { runs, perIntent } = parsed.result ?? parsed;
await writeFile("data/escape-directions.json", JSON.stringify({ runs, perIntent }, null, 2));

const hue = (hex) => {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d < 0.04) return "achromatic";
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(((h * 60) + 360) % 360);
  const name = h < 18 || h > 345 ? "red" : h < 40 ? "orange" : h < 65 ? "gold/yellow" : h < 160 ? "green" : h < 255 ? "blue" : "purple";
  return `${h}° ${name}`;
};

for (const pi of perIntent) {
  console.log(`\n=== "${pi.intent}" ===`);
  console.log("  heading fonts:", Object.entries(pi.headingByModel).map(([m, f]) => `${m}→${f}`).join("  "));
  console.log("  accent colors:", pi.accents.map((c) => `${c} (${hue(c)})`).join("  "));
  console.log("  style moves:");
  for (const s of pi.styleMoves) console.log("     " + s);
}
