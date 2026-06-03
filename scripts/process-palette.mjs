import { readFile, writeFile } from "node:fs/promises";
const raw = await readFile(process.argv[2], "utf8");
const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);
const { runs, perVibe } = parsed.result ?? parsed;

const hue = (hex) => {
  const n = (hex || "").replace("#", "");
  if (n.length < 6) return { h: -1, name: "?" };
  const r = parseInt(n.slice(0, 2), 16) / 255, g = parseInt(n.slice(2, 4), 16) / 255, b = parseInt(n.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const l = (mx + mn) / 2;
  if (d < 0.04) return { h: -1, name: l < 0.5 ? "near-black" : "near-white" };
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = Math.round(((h * 60) + 360) % 360);
  const name = h < 18 || h > 345 ? "red" : h < 40 ? "orange/coral" : h < 65 ? "gold" : h < 160 ? "green" : h < 200 ? "teal/cyan" : h < 255 ? "blue" : "indigo/violet";
  return { h, name };
};
const isDark = (hex) => { const n = (hex || "").replace("#", ""); if (n.length < 6) return false; const r = parseInt(n.slice(0,2),16), g = parseInt(n.slice(2,4),16), b = parseInt(n.slice(4,6),16); return (r + g + b) / 3 < 96; };

const summary = [];
for (const pv of perVibe) {
  const accentHues = pv.accents.map(hue);
  const fam = {};
  for (const a of accentHues) fam[a.name] = (fam[a.name] ?? 0) + 1;
  const dominant = Object.entries(fam).sort((a, b) => b[1] - a[1])[0];
  const dupes = pv.accents.filter((c, i) => pv.accents.indexOf(c.toLowerCase()) !== i || pv.accents.findIndex((x) => x.toLowerCase() === c.toLowerCase()) !== i);
  const darkBg = pv.backgrounds.filter(isDark).length;
  summary.push({ vibe: pv.vibe, slopAccent: `${dominant[0]} (${dominant[1]}/3)`, examples: pv.accents.join(" "), bg: darkBg >= 2 ? "dark" : "light", palettes: pv.palettes });
  console.log(`${pv.vibe.padEnd(20)} accent=${dominant[0].padEnd(14)} (${dominant[1]}/3)  bg=${darkBg >= 2 ? "dark" : "light"}   ${pv.accents.join(" ")}`);
}
await writeFile("data/palette-slop.json", JSON.stringify({ summary, runs }, null, 2));
console.log("\nwrote data/palette-slop.json");
