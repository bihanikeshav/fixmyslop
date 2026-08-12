const base = process.argv[2] || "https://fixmyslop.bihanikeshav.workers.dev";
async function call(id, method, params) {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
  return response.json();
}
const list = await call(1, "tools/list");
const names = (list.result?.tools || []).map((tool) => tool.name);
const fonts = await call(2, "tools/call", { name: "suggest_fonts", arguments: { n: 6 } });
const connected = await call(3, "tools/call", { name: "connected_style_genome", arguments: { surface: "marketing", job: "explain-and-convert", contentModel: "story", theme: "light", audience: ["coffee curious adults"], sourceBrief: "A tactile independent coffee roastery: origin stories, craft, and a calm subscription conversion path.", seed: 1701 } });
const svg = await call(4, "tools/call", { name: "check_svg", arguments: { svg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg>' } });
const prompt = await call(5, "prompts/get", { name: "typeset", arguments: {} });
const promptText = prompt.result?.messages?.[0]?.content?.text || "";
const connectedValue = JSON.parse(connected.result?.content?.[0]?.text || "{}");
console.log(JSON.stringify({
  tools: { count: names.length, connectedStyleGenome: names.includes("connected_style_genome"), connectedBuildSpec: names.includes("connected_build_spec"), checkSvg: names.includes("check_svg") },
  fonts: (() => { const value = JSON.parse(fonts.result?.content?.[0]?.text || "{}"); return { pairing: value.pairing, loadSpecPresent: !!value.pairing?.assets?.display?.loadSpec }; })(),
  connected: {
    error: connected.error || null,
    profile: connectedValue.connected?.profile || null,
    display: connectedValue.type?.pairing?.v2?.display?.family || null,
    body: connectedValue.type?.pairing?.v2?.body?.family || null,
    displayQuality: connectedValue.type?.pairing?.v2?.display?.quality || null,
    bodyQuality: connectedValue.type?.pairing?.v2?.body?.quality || null,
    assetsAvailable: !!connectedValue.type?.pairing?.v2?.display?.asset?.available && !!connectedValue.type?.pairing?.v2?.body?.asset?.available,
  },
  svg: JSON.parse(svg.result?.content?.[0]?.text || "{}"),
  prompt: { fontAssetGate: promptText.includes("pairing.assets"), svgGate: promptText.includes("check_svg") },
}, null, 2));
