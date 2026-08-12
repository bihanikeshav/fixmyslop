// Probe the keyless Google Fonts metadata endpoint to confirm shape.
const url = "https://fonts.google.com/metadata/fonts";
try {
  const res = await fetch(url, { headers: { "user-agent": "fixmyslop/0.1" } });
  console.log("HTTP", res.status);
  let text = await res.text();
  // Google prefixes JSON with an XSSI guard like ")]}'"
  text = text.replace(/^\)\]\}'\s*/, "");
  const data = JSON.parse(text);
  const list = data.familyMetadataList ?? data.items ?? [];
  console.log("families:", list.length);
  const sample = list[0];
  console.log("sample keys:", Object.keys(sample));
  console.log("sample:", JSON.stringify(sample, null, 2).slice(0, 700));
  const inter = list.find((f) => f.family === "Inter");
  if (inter) {
    console.log("Inter popularity/keys:", JSON.stringify({
      family: inter.family, category: inter.category,
      popularity: inter.popularity, trending: inter.trending,
      axes: inter.axes, fonts: inter.fonts ? Object.keys(inter.fonts) : undefined,
    }, null, 2).slice(0, 600));
  }
} catch (e) {
  console.log("ERROR:", e.message);
}
