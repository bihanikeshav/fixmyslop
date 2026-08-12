import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createEngine } from "../apps/engine/engine.mjs";
import { connectedStyleGenome, connectedBuildSpec } from "../apps/engine/connected.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "tmp", "quality-proof");
mkdirSync(OUT, { recursive: true });

const intent = {
  surface: "marketing",
  job: "explain-and-convert",
  contentModel: "story",
  theme: "light",
  audience: ["coffee curious adults"],
  sourceBrief: "A tactile independent coffee roastery: origin stories, craft, and a calm subscription conversion path.",
};

const engine = createEngine();
const seed = 1701;
const genome = connectedStyleGenome(engine, intent, { seed });
const spec = connectedBuildSpec(engine, intent, { seed }).spec;
const pairing = genome.type?.pairing?.v2;
const display = pairing?.display;
const body = pairing?.body;
const accent = pairing?.accent?.evidence || null;

function cssFaces(font, role) {
  return (font?.asset?.loadSpec?.localFaces || font?.asset?.loadSpec?.faces || []).map((face) => face
    .replaceAll('url("data/', 'url("../../')
    .replace(`font-family: "${font.family}"`, `font-family: "${font.family}"`)
    + ` /* ${role} */`).join("\n");
}

const color = genome.color || {};
const component = genome.material?.component || {};
const button = component.button || {};
const shadow = component.shadow || {};
const texture = genome.material?.texture || {};
const expression = genome.expression || {};
const layout = genome.layout || {};
const radius = genome.material?.radiusLanguage || "soft-rounded";

const meta = {
  schemaVersion: "quality-proof.v1",
  generatedAt: new Date().toISOString(),
  source: "connected_style_genome",
  seed,
  intent,
  layoutFamily: layout.family,
  display: { family: display?.family, quality: display?.quality, asset: display?.asset },
  body: { family: body?.family, quality: body?.quality, asset: body?.asset },
  accent: accent ? { family: accent.family, quality: accent.quality, asset: accent.asset } : null,
  palette: color,
  component,
  texture,
  expression,
  responsive: genome.responsive,
};

writeFileSync(path.join(OUT, "genome.json"), JSON.stringify(meta, null, 2) + "\n");
writeFileSync(path.join(OUT, "build-spec.md"), spec + "\n");

const html = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="proof-source" content="connected_style_genome" />
<title>Field Notes — a coffee roastery</title>
<style>
${cssFaces(display, "display")}
${cssFaces(body, "body")}
${cssFaces(accent, "accent")}

:root {
  --ground: ${color.ground};
  --surface: ${color.surface};
  --ink: ${color.ink};
  --accent: ${color.accent};
  --accent-2: ${color.accent2};
  --display: "${display?.family || "Georgia"}";
  --body: "${body?.family || "system-ui"}";
  --accent-font: "${accent?.family || display?.family || "Georgia"}";
  --container: min(1240px, calc(100vw - 64px));
  --hairline: color-mix(in srgb, var(--ink) 18%, transparent);
  --deep: color-mix(in srgb, var(--ink) 94%, var(--accent) 6%);
  --radius: ${radius.includes("sharp") ? "2px" : radius.includes("controlled") ? "10px" : "18px"};
  --button-radius: ${button.shape?.includes("pill") ? "999px" : "4px"};
  --rest-shadow: ${shadow.resting || "0 8px 0 color-mix(in srgb, var(--ink) 14%, transparent)"};
  --hover-shadow: ${shadow.hover || "0 12px 0 color-mix(in srgb, var(--ink) 20%, transparent)"};
}

* { box-sizing: border-box; }
html { background: var(--ground); color: var(--ink); scroll-behavior: smooth; }
body { margin: 0; font-family: var(--body), sans-serif; font-size: 16px; line-height: 1.5; background: var(--ground); }
body::before { content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 5; opacity: .08; mix-blend-mode: multiply; background-image: radial-gradient(circle at 20% 20%, var(--ink) 0 0.7px, transparent 0.9px), radial-gradient(circle at 70% 65%, var(--accent) 0 0.6px, transparent 0.9px); background-size: 9px 11px, 13px 15px; }
a { color: inherit; text-decoration: none; }
button { font: inherit; }
.shell { width: var(--container); margin: 0 auto; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.3; letter-spacing: .14em; text-transform: uppercase; }
.topbar { min-height: 76px; border-bottom: 1px solid var(--hairline); display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.brand { display: flex; gap: 12px; align-items: baseline; }
.brand strong { font-family: var(--display), serif; font-size: 26px; font-weight: 700; letter-spacing: -.04em; }
.brand span { color: color-mix(in srgb, var(--ink) 58%, transparent); }
.topnav { display: flex; gap: 22px; align-items: center; color: color-mix(in srgb, var(--ink) 66%, transparent); }
.topnav a:hover { color: var(--ink); }
.button { border: 1px solid var(--ink); border-radius: var(--button-radius); padding: 12px 17px; background: var(--ink); color: var(--ground); display: inline-flex; align-items: center; gap: 18px; box-shadow: var(--rest-shadow); transition: transform .22s cubic-bezier(.16,1,.3,1), box-shadow .22s cubic-bezier(.16,1,.3,1), background-color .22s ease; cursor: pointer; }
.button::after { content: "↗"; font-size: 18px; line-height: .7; }
.button:hover { transform: translateY(-3px); box-shadow: var(--hover-shadow); background: var(--accent-2); }
.button:active { transform: translateY(2px); box-shadow: 0 2px 0 color-mix(in srgb, var(--ink) 20%, transparent); }
.button:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; }

.hero { min-height: 740px; padding: 96px 0 80px; display: grid; grid-template-columns: minmax(0, 1.04fr) minmax(320px, .76fr); gap: clamp(48px, 9vw, 150px); align-items: center; }
.eyebrow { color: color-mix(in srgb, var(--ink) 58%, transparent); margin-bottom: 26px; }
h1 { max-width: 780px; font-family: var(--display), serif; font-size: clamp(68px, 8.9vw, 142px); line-height: .86; letter-spacing: -.065em; font-weight: 700; margin: 0; }
h1 em { font-family: var(--accent-font), var(--display), serif; font-weight: 500; color: var(--accent-2); }
.dek { max-width: 45ch; margin: 34px 0 0; font-size: clamp(18px, 1.65vw, 23px); line-height: 1.3; color: color-mix(in srgb, var(--ink) 76%, transparent); }
.hero-actions { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; margin-top: 38px; }
.text-link { border-bottom: 1px solid var(--ink); padding-bottom: 3px; }
.text-link:hover { color: var(--accent-2); border-color: var(--accent-2); }

.instrument { background: var(--deep); color: var(--ground); border-radius: var(--radius); padding: 28px; min-height: 454px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 14px 14px 0 color-mix(in srgb, var(--accent) 26%, transparent); transform: rotate(1.2deg); }
.instrument-top, .instrument-bottom { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; }
.instrument .mono { color: color-mix(in srgb, var(--ground) 63%, transparent); }
.instrument h2 { margin: 62px 0 16px; font-family: var(--display), serif; font-size: clamp(38px, 4.7vw, 70px); line-height: .9; letter-spacing: -.05em; font-weight: 700; }
.curve { position: relative; height: 166px; margin: 14px 0 22px; border-bottom: 1px solid color-mix(in srgb, var(--ground) 24%, transparent); border-left: 1px solid color-mix(in srgb, var(--ground) 24%, transparent); background-image: linear-gradient(color-mix(in srgb, var(--ground) 10%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--ground) 10%, transparent) 1px, transparent 1px); background-size: 25% 25%; }
.curve::before { content: ""; position: absolute; left: 4%; right: 4%; bottom: 16%; height: 62%; border-top: 3px solid var(--accent); border-radius: 55% 45% 0 0 / 100% 70% 0 0; transform: skewY(-8deg) rotate(-2deg); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 62%, transparent)); }
.curve::after { content: ""; position: absolute; left: 4%; right: 4%; bottom: 16%; height: 26%; border-top: 1px solid color-mix(in srgb, var(--ground) 62%, transparent); transform: skewY(6deg) rotate(1deg); }
.axis { display: flex; justify-content: space-between; color: color-mix(in srgb, var(--ground) 50%, transparent); }
.instrument-note { max-width: 30ch; color: color-mix(in srgb, var(--ground) 78%, transparent); }

.field-strip { border-top: 1px solid var(--hairline); border-bottom: 1px solid var(--hairline); padding: 20px 0; display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr; gap: 20px; }
.field { min-height: 72px; border-right: 1px solid var(--hairline); padding-right: 20px; }
.field:last-child { border-right: 0; }
.field .mono { color: color-mix(in srgb, var(--ink) 52%, transparent); }
.field p { margin: 10px 0 0; font-family: var(--display), serif; font-size: 20px; line-height: 1; }

.story { padding: 136px 0 150px; display: grid; grid-template-columns: .7fr 1.3fr; gap: clamp(50px, 11vw, 180px); align-items: start; }
.story-rail { position: sticky; top: 40px; }
.story-rail h2 { font-family: var(--display), serif; font-size: clamp(44px, 5vw, 76px); line-height: .9; letter-spacing: -.055em; margin: 20px 0; }
.story-rail p { color: color-mix(in srgb, var(--ink) 65%, transparent); max-width: 25ch; }
.story-copy { max-width: 65ch; }
.story-copy p { font-size: 20px; line-height: 1.52; margin: 0 0 30px; }
.pull { border-top: 1px solid var(--ink); border-bottom: 1px solid var(--ink); padding: 30px 0; margin: 54px 0; font-family: var(--accent-font), serif; font-size: clamp(34px, 4vw, 60px); line-height: .98; letter-spacing: -.045em; color: var(--accent-2); }
.material { margin-top: 60px; min-height: 280px; background: var(--surface); border-radius: var(--radius); padding: 28px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }
.material::after { content: ""; position: absolute; width: 280px; height: 280px; right: -44px; top: -52px; border-radius: 50%; background: var(--accent); opacity: .82; mix-blend-mode: multiply; }
.material strong { font-family: var(--display), serif; font-size: 46px; line-height: .9; letter-spacing: -.05em; position: relative; z-index: 1; max-width: 8ch; }
.material small { position: relative; z-index: 1; max-width: 30ch; }

.closing { background: var(--deep); color: var(--ground); padding: 88px 0 100px; }
.closing-inner { display: grid; grid-template-columns: 1fr .7fr; gap: 60px; align-items: end; }
.closing h2 { font-family: var(--display), serif; font-size: clamp(52px, 7.4vw, 120px); line-height: .82; letter-spacing: -.07em; max-width: 8ch; margin: 0; }
.closing p { color: color-mix(in srgb, var(--ground) 70%, transparent); max-width: 34ch; margin: 0 0 26px; }
.closing .button { background: var(--accent); color: var(--ink); border-color: var(--accent); }
.closing .button:hover { background: var(--ground); }
footer { padding: 25px 0 40px; display: flex; justify-content: space-between; color: color-mix(in srgb, var(--ink) 54%, transparent); }
.status { position: fixed; bottom: 18px; right: 18px; z-index: 8; background: var(--ink); color: var(--ground); border-radius: 999px; padding: 8px 12px; font-size: 10px; letter-spacing: .09em; text-transform: uppercase; box-shadow: 0 7px 0 color-mix(in srgb, var(--ink) 18%, transparent); }
.status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; display: inline-block; margin-right: 7px; background: var(--accent); }
.reveal { animation: rise .72s cubic-bezier(.16,1,.3,1) both; }
.reveal:nth-child(2) { animation-delay: .08s; }
.reveal:nth-child(3) { animation-delay: .15s; }
@keyframes rise { from { transform: translateY(16px); } to { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { animation-duration: .001ms !important; transition-duration: .001ms !important; } }
@media (max-width: 720px) {
  :root { --container: min(100% - 36px, 620px); }
  .topbar { min-height: 64px; }
  .topnav a { display: none; }
  .brand strong { font-size: 22px; }
  .hero { min-height: auto; padding: 66px 0 74px; display: block; }
  h1 { font-size: clamp(62px, 18vw, 110px); max-width: 9ch; }
  .dek { font-size: 18px; max-width: 34ch; margin-top: 26px; }
  .instrument { margin: 68px 8px 0 0; min-height: 390px; transform: rotate(.7deg); }
  .field-strip { grid-template-columns: 1fr 1fr; gap: 0; }
  .field { margin: 16px 0; min-height: 58px; }
  .field:nth-child(2) { border-right: 0; }
  .story { padding: 94px 0 106px; display: block; }
  .story-rail { position: static; margin-bottom: 54px; }
  .story-rail h2 { max-width: 7ch; }
  .story-copy p { font-size: 18px; }
  .pull { font-size: 42px; }
  .closing { padding: 70px 0 78px; }
  .closing-inner { display: block; }
  .closing h2 { font-size: 76px; margin-bottom: 38px; }
  footer { display: block; }
  footer span { display: block; margin-top: 8px; }
}
</style>
</head>
<body>
  <div class="status" id="font-status">binding type</div>
  <header class="topbar shell">
    <a class="brand" href="#top"><strong>FIELD / NOTES</strong><span class="mono">Roastery 07</span></a>
    <nav class="topnav mono" aria-label="Primary"><a href="#origin">Origin</a><a href="#method">Method</a><a href="#subscribe">Subscribe</a><a class="button" href="#subscribe">Book a roast</a></nav>
  </header>
  <main id="top">
    <section class="hero shell" aria-labelledby="hero-title">
      <div class="reveal">
        <div class="eyebrow mono">Independent roasting · small lots · 2026 harvest</div>
        <h1 id="hero-title">Roast the morning <em>slowly.</em></h1>
        <p class="dek">Coffee with a place of origin, a point of view, and enough time left in the cup to notice both.</p>
        <div class="hero-actions"><a class="button" href="#origin">Trace this roast</a><a class="text-link" href="#subscribe">See the weekly drop&nbsp; ↘</a></div>
      </div>
      <div class="instrument reveal" aria-label="Roast profile instrument">
        <div class="instrument-top"><span class="mono">Roast profile / 04</span><span class="mono">Lot 7A</span></div>
        <div><h2>Washed<br />Caturra</h2><p class="instrument-note">Bright citrus, cacao nib, a finish that opens after the first sip.</p></div>
        <div><div class="curve" aria-hidden="true"></div><div class="axis mono"><span>dry</span><span>sweet</span><span>deep</span></div></div>
        <div class="instrument-bottom"><span class="mono">Cajamarca, Peru</span><span class="mono">1,842 m</span></div>
      </div>
    </section>
    <section class="field-strip shell" id="origin" aria-label="Origin details">
      <div class="field reveal"><div class="mono">The lot</div><p>Small, traceable lots</p></div>
      <div class="field reveal"><div class="mono">Elevation</div><p>1,842 m / cool nights</p></div>
      <div class="field reveal"><div class="mono">Process</div><p>Washed / 48 hour rest</p></div>
      <div class="field reveal"><div class="mono">In the cup</div><p>Mandarin / cacao / tea</p></div>
    </section>
    <section class="story shell" id="method">
      <aside class="story-rail"><div class="mono">A slower method</div><h2>Nothing added. Nothing rushed.</h2><p>We roast by response, not by a fixed timer. The curve is a record of attention.</p></aside>
      <div class="story-copy"><p>At 1,842 metres, the days are clear and the nights are cold enough to let this Caturra mature without losing its edge. We keep the roast light on its feet, then give it a little more time at the end.</p><p>That last minute is where the cup changes. Citrus becomes sweetness. The texture rounds out. The finish stays long.</p><div class="pull">“A cup should tell you where it has been.”</div><div class="material"><strong>Keep the trace.</strong><small>Every bag carries the farm, the process, and the roast curve that brought it here.</small></div></div>
    </section>
    <section class="closing" id="subscribe"><div class="closing-inner shell"><h2>The next good cup is on its way.</h2><div><p>One small-lot release every Friday. Reserve yours before the roast closes.</p><a class="button" href="mailto:hello@fieldnotes.example">Reserve the next drop</a></div></div></section>
  </main>
  <footer class="shell mono"><span>Field / Notes · Independent coffee</span><span>Built from an intent-connected style genome</span></footer>
<script>
  (async () => {
    const display = ${JSON.stringify(display?.family || "Georgia")};
    const body = ${JSON.stringify(body?.family || "system-ui")};
    try { await document.fonts.ready; } catch {}
    const ok = document.fonts.check('1em "' + display + '"') && document.fonts.check('1em "' + body + '"');
    const status = document.getElementById('font-status');
    status.textContent = ok ? 'fonts bound · specimen checked' : 'font gate failed';
    status.dataset.pass = ok ? 'true' : 'false';
  })();
</script>
</body>
</html>`;

writeFileSync(path.join(OUT, "index.html"), html);
console.log(JSON.stringify({ out: OUT, display: display?.family, body: body?.family, accent: accent?.family || null, layout: layout.family, texture: texture.dialect, button: button.shape, expression: expression.centrepiece }));
