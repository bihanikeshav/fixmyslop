import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createEngine } from "../apps/engine/engine.mjs";
import { connectedStyleGenome, connectedBuildSpec } from "../apps/engine/connected.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data", "tmp", "distinct-proofs");
mkdirSync(OUT, { recursive: true });

const cases = [
  {
    id: "night-market",
    kind: "night",
    intent: { surface: "landing-page", job: "explain-and-convert", contentModel: "event", theme: "dark", audience: ["night-shift city people"], sourceBrief: "An after-hours city music program that feels intimate, electric, and local, with a schedule people can scan quickly." },
    title: "Stay for the last song.",
    intro: "Small rooms, late trains, and a program that starts when the city gets honest.",
  },
  {
    id: "field-notes",
    kind: "field",
    intent: { surface: "editorial", job: "tell-a-story", contentModel: "research", theme: "light", audience: ["curious readers"], sourceBrief: "A field journal about coastal weather, made precise and tactile like a working notebook rather than a marketing page." },
    title: "Wind is a form of evidence.",
    intro: "A working record of pressure, salt, and the small decisions made between one forecast and the next.",
  },
  {
    id: "atelier-index",
    kind: "atelier",
    intent: { surface: "portfolio", job: "showcase-work", contentModel: "gallery", theme: "light", audience: ["commissioning editors"], sourceBrief: "A quiet studio index where projects are read as a sequence of decisions, not as identical cards." },
    title: "A studio in the interval.",
    intro: "Selected work in moving image, objects, and the space where a question becomes a form.",
  },
  {
    id: "service-guide",
    kind: "service",
    intent: { surface: "landing-page", job: "explain-and-convert", contentModel: "service", theme: "light", audience: ["people seeking care"], sourceBrief: "A humane service guide for a neighborhood repair clinic: practical, calm, warm, and easy to navigate." },
    title: "Good care has a shape.",
    intro: "Bring the thing that is not working. We will make the next step clear.",
  },
];

const engine = createEngine();

function cssFaces(font) {
  return (font?.asset?.loadSpec?.localFaces || font?.asset?.loadSpec?.faces || [])
    .map((face) => face.replaceAll('url("data/', 'url("../../../'))
    .join("\n");
}

const cssTemplate = `:root{--ground:__GROUND__;--surface:__SURFACE__;--ink:__INK__;--accent:__ACCENT__;--accent2:__ACCENT2__;--title:__TITLE__;--accent-font:__ACCENT_FONT__;--body:__BODY__;--measure:min(1240px,calc(100vw - 72px));--button:__BUTTON__;--button-radius:__RADIUS__}
*{box-sizing:border-box}
html{background:var(--ground);color:var(--ink);scroll-behavior:smooth}
body{margin:0;background:var(--ground);font-family:var(--body),sans-serif;font-size:16px;line-height:1.55;overflow-x:clip}
body:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:10;opacity:__TEXTURE__;background-image:radial-gradient(circle at 20% 30%,var(--ink) 0 .55px,transparent .8px),radial-gradient(circle at 70% 75%,var(--accent) 0 .5px,transparent .8px);background-size:11px 13px,17px 19px}
a{color:inherit;text-decoration:none}
h1,h2,strong{font-family:var(--title),sans-serif;font-weight:700}
h1,h2,p{margin-top:0}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.wordmark{font-family:var(--title),sans-serif;font-size:20px;font-weight:700;letter-spacing:-.05em}
.line-button{display:inline-flex;align-items:center;gap:16px;padding:12px 16px;border:1px solid var(--ink);background:var(--button);color:var(--ground);border-radius:var(--button-radius);transition:transform .2s ease,background-color .2s ease}
.line-button:hover{transform:translateY(-3px);background:var(--accent2)}
.line-button:focus-visible,a:focus-visible{outline:3px solid var(--accent);outline-offset:4px}
.night-nav,.field-head,.atelier-head,.service-head{width:var(--measure);margin:0 auto;min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid color-mix(in srgb,var(--ink) 22%,transparent)}
.proof-foot{width:var(--measure);margin:0 auto;padding:16px 0 22px;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}

.night{background:#160f19;color:#f0e9df;min-height:100vh}
.night .night-nav{border-color:rgba(240,233,223,.18)}
.night .nav-link{color:#d5a6c8}
.night-lead{width:var(--measure);min-height:calc(100vh - 76px);margin:0 auto;padding:90px 0 60px;display:grid;grid-template-columns:1.05fr .95fr;grid-template-rows:auto 1fr auto;column-gap:clamp(50px,9vw,150px);align-items:end}
.night-stamp{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;color:#d5a6c8}
.stamp-mark{display:grid;place-items:center;width:56px;height:56px;border:1px solid #d5a6c8;border-radius:50%;font-family:var(--accent-font),serif;font-size:30px}
.night-lead h1{grid-column:1;font-size:clamp(62px,8.6vw,142px);line-height:.87;letter-spacing:-.065em;margin:36px 0 24px}
.night-lead h1 em,.field-title h1 em,.atelier-rail h1 em,.service-lead h1 em{font-family:var(--accent-font),serif;font-weight:500;color:var(--accent)}
.night-lead p{grid-column:2;max-width:34ch;margin:0 0 26px;color:#c7c0bb;font-size:18px}
.night-lead .line-button{grid-column:2;justify-self:start;margin-bottom:4px;background:#f0e9df;color:#160f19;border-color:#f0e9df}
.night-ticker{grid-column:1/-1;overflow:hidden;border-top:1px solid rgba(240,233,223,.2);border-bottom:1px solid rgba(240,233,223,.2);margin-top:80px;padding:14px 0;display:flex;justify-content:space-between;color:#8fcd9e;white-space:nowrap}
.lineup{width:var(--measure);margin:0 auto;padding:80px 0 130px}
.night .section-head,.lineup-row{display:grid;grid-template-columns:.8fr 1.2fr 1fr .35fr;gap:24px;align-items:baseline}
.night .section-head{padding-bottom:16px;color:#b8aea9;border-bottom:1px solid rgba(240,233,223,.22)}
.lineup-row{padding:24px 0;border-bottom:1px solid rgba(240,233,223,.16)}
.lineup-row b{color:#d5a6c8;font-family:ui-monospace,monospace}
.lineup-row strong{font-size:clamp(22px,2.5vw,36px);line-height:1}
.lineup-row span{color:#b8aea9}
.lineup-row a{justify-self:end;color:#8fcd9e}
.night-close{background:#f0e9df;color:#160f19;padding:90px max(36px,calc((100vw - 1240px)/2)) 110px;display:flex;justify-content:space-between;align-items:end;gap:40px}
.night-close h2{font-size:clamp(56px,8vw,120px);line-height:.88;max-width:8ch;margin:22px 0 0}
.night-close .invert{background:#160f19;color:#f0e9df;border-color:#160f19}

.field-head,.atelier-head,.service-head{background:var(--ground)}
.field-head a,.service-head a{font-size:13px}
.field-lead{width:var(--measure);margin:0 auto;padding:110px 0 130px;display:grid;grid-template-columns:1.05fr .95fr;gap:clamp(50px,10vw,170px);align-items:center}
.field-title h1{font-size:clamp(62px,8vw,126px);line-height:.88;letter-spacing:-.07em;max-width:8ch;margin:24px 0}
.field-title p{max-width:44ch;font-size:18px;color:color-mix(in srgb,var(--ink) 68%,transparent)}
.specimen{min-height:470px;border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);padding:22px 0;display:flex;flex-direction:column;justify-content:space-between}
.specimen-orbit{position:relative;height:320px;border:1px solid color-mix(in srgb,var(--ink) 30%,transparent);border-radius:50%;transform:rotate(-11deg) scale(.84);transform-origin:center;background:radial-gradient(circle at 50% 45%,var(--accent) 0 3%,transparent 3.5%),linear-gradient(90deg,transparent 49.8%,color-mix(in srgb,var(--ink) 16%,transparent) 50%,transparent 50.2%),linear-gradient(transparent 49.8%,color-mix(in srgb,var(--ink) 16%,transparent) 50%,transparent 50.2%)}
.specimen-orbit:before,.specimen-orbit:after{content:"";position:absolute;inset:12% 24%;border:1px solid var(--accent2);border-radius:50%;transform:rotate(57deg)}
.specimen-orbit:after{inset:26% 8%;border-color:var(--accent);transform:rotate(-32deg)}
.specimen-orbit i{position:absolute;width:12px;height:12px;background:var(--ink);border-radius:50%}
.specimen-orbit i:nth-child(1){left:13%;top:38%}.specimen-orbit i:nth-child(2){right:18%;top:22%;background:var(--accent2)}.specimen-orbit i:nth-child(3){right:28%;bottom:18%;background:var(--accent)}
.specimen-orbit b{position:absolute;left:43%;top:42%;font-family:var(--accent-font),serif;font-size:32px;line-height:.8;transform:rotate(11deg)}
.field-log{width:var(--measure);margin:0 auto;border-top:1px solid var(--ink);padding:24px 0 110px}
.log-label{display:flex;justify-content:space-between;color:color-mix(in srgb,var(--ink) 60%,transparent)}
.log-entry{display:grid;grid-template-columns:.8fr 1.2fr 1fr;gap:24px;padding:28px 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 18%,transparent)}
.log-entry b{font-family:ui-monospace,monospace;color:var(--accent2)}
.log-entry strong{font-size:clamp(24px,3vw,42px);line-height:1}
.log-entry p{max-width:34ch;color:color-mix(in srgb,var(--ink) 68%,transparent);margin:0}
.field-foot{width:var(--measure);margin:0 auto;padding:18px 0 28px;display:flex;justify-content:space-between;border-top:1px solid var(--ink)}

.atelier-layout{width:var(--measure);margin:0 auto;padding:110px 0 150px;display:grid;grid-template-columns:.75fr 1.25fr;gap:clamp(50px,11vw,180px)}
.atelier-head nav{display:flex;gap:24px}
.atelier-rail{position:sticky;top:34px;align-self:start}
.atelier-rail h1{font-size:clamp(60px,7vw,112px);line-height:.88;letter-spacing:-.07em;max-width:7ch;margin:28px 0}
.atelier-rail p{max-width:28ch;color:color-mix(in srgb,var(--ink) 68%,transparent);font-size:17px}
.rail-link{display:inline-block;border-bottom:1px solid var(--ink);padding-bottom:5px;margin-top:22px}
.project-index{border-top:1px solid var(--ink)}
.project-row{min-height:190px;display:grid;grid-template-columns:44px 1fr 130px 70px;gap:18px;align-items:center;border-bottom:1px solid color-mix(in srgb,var(--ink) 22%,transparent);transition:padding .24s ease}
.project-row:hover{padding-left:14px}.project-row.active{min-height:310px}
.project-no{font-family:ui-monospace,monospace;color:var(--accent2)}
.project-row h2{font-size:clamp(27px,4vw,58px);line-height:.94;letter-spacing:-.05em;max-width:9ch;margin:0}
.project-row p{font-size:12px;color:color-mix(in srgb,var(--ink) 55%,transparent);margin:16px 0 0}
.project-mark{width:112px;height:112px;justify-self:end;border-radius:50% 44% 52% 38%;transform:rotate(-12deg)}
.mark-red{background:var(--accent)}.mark-blue{background:var(--accent2);border-radius:42% 58% 50% 38%;transform:rotate(16deg)}.mark-green{background:color-mix(in srgb,var(--accent2) 55%,var(--ground));border-radius:38% 60% 40% 55%;transform:rotate(-27deg)}
.project-row a{font-family:ui-monospace,monospace;font-size:11px;justify-self:end}
.atelier-note{padding:70px max(36px,calc((100vw - 1240px)/2)) 120px;background:var(--ink);color:var(--ground);display:grid;grid-template-columns:.75fr 1.25fr;gap:clamp(50px,11vw,180px)}
.atelier-note p{font-family:var(--accent-font),serif;color:var(--accent);font-size:clamp(38px,5vw,72px);line-height:.95;max-width:11ch;margin:0}
.atelier-foot{padding:18px max(36px,calc((100vw - 1240px)/2));display:flex;justify-content:space-between;gap:20px;font-size:12px}

.service-lead{width:var(--measure);margin:0 auto;padding:110px 0 140px;display:grid;grid-template-columns:.35fr 1fr .85fr;gap:clamp(34px,7vw,110px);align-items:end}
.service-lead .line-button,.service-close .line-button{background:var(--ink);color:var(--ground);border-color:var(--ink)}
.service-count{align-self:start;color:color-mix(in srgb,var(--ink) 55%,transparent)}
.service-lead h1{font-size:clamp(62px,8vw,130px);line-height:.88;letter-spacing:-.07em;max-width:7ch;margin:0 0 28px}
.service-lead p{font-size:18px;max-width:32ch;color:color-mix(in srgb,var(--ink) 68%,transparent)}
.service-illustration{min-height:430px;background:var(--surface);padding:20px;display:flex;flex-direction:column;justify-content:space-between}
.arch{height:310px;border:1px solid var(--ink);border-bottom:0;border-radius:180px 180px 0 0;position:relative;background:linear-gradient(90deg,transparent 49.8%,var(--accent) 50%,transparent 50.2%),linear-gradient(0deg,transparent 49.8%,var(--accent2) 50%,transparent 50.2%);background-size:50% 50%;background-position:center}
.arch:after{content:"";position:absolute;width:80px;height:80px;border-radius:50%;background:var(--accent2);left:calc(50% - 40px);top:calc(50% - 40px);mix-blend-mode:multiply}
.service-steps{padding:80px max(36px,calc((100vw - 1240px)/2)) 120px;border-top:1px solid var(--ink);display:grid;grid-template-columns:1fr 1fr 1fr;gap:0}
.steps-intro{grid-column:1/-1;display:grid;grid-template-columns:1fr 2fr;gap:clamp(50px,11vw,180px);padding-bottom:55px}
.steps-intro h2{font-size:clamp(42px,5vw,76px);line-height:.9;max-width:8ch;margin:0}
.step{padding:22px 30px 22px 0;border-top:1px solid color-mix(in srgb,var(--ink) 25%,transparent);margin-right:24px}
.step:not(:first-of-type){border-left:1px solid color-mix(in srgb,var(--ink) 25%,transparent);padding-left:24px}
.step strong{display:block;font-size:28px;line-height:1;margin:28px 0 14px}.step p{max-width:25ch;color:color-mix(in srgb,var(--ink) 68%,transparent);margin:0}
.service-close{background:var(--ink);color:var(--ground);padding:90px max(36px,calc((100vw - 1240px)/2)) 110px;display:flex;justify-content:space-between;align-items:end;gap:40px}
.service-close h2{font-size:clamp(56px,8vw,120px);line-height:.88;max-width:7ch;margin:0}.service-close .invert{background:var(--accent);color:var(--ink);border-color:var(--accent)}

@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*:before,*:after{animation-duration:.001ms!important;transition-duration:.001ms!important}}
@media(max-width:720px){
 :root{--measure:calc(100vw - 36px)}.night-nav,.field-head,.atelier-head,.service-head{min-height:64px}
 .night-nav .mono,.field-head .mono:nth-child(2),.service-head .mono{display:none}
 .night-lead,.field-lead,.atelier-layout{display:block;padding:70px 0 90px}.night-lead h1{font-size:clamp(64px,17vw,102px);margin:42px 0 25px}.night-lead p{font-size:17px}.night-lead .line-button{margin-top:10px}.night-ticker{margin-top:72px;gap:70px;justify-content:flex-start}.night-ticker span:nth-child(n+2){display:none}
 .lineup{padding:65px 0 90px}.night .section-head{display:flex;justify-content:space-between}.lineup-row{display:grid;grid-template-columns:56px 1fr auto;gap:11px}.lineup-row span{grid-column:2}.lineup-row a{grid-column:3;grid-row:1/3}.night-close,.service-close{display:block;padding:72px 18px 88px}.night-close .line-button,.service-close .line-button{margin-top:35px}
 .field-title h1,.atelier-rail h1,.service-lead h1{font-size:clamp(62px,17vw,105px);max-width:8ch;margin:25px 0}.field-title p{font-size:17px}.specimen{margin-top:65px;min-height:410px}.specimen-orbit{transform:none}.log-entry{display:block;padding:25px 0}.log-entry strong{display:block;margin:15px 0 10px}.log-entry p{max-width:38ch}.field-foot{font-size:11px}
 .atelier-rail{position:static;margin-bottom:75px}.project-row,.project-row.active{min-height:170px;grid-template-columns:30px 1fr 50px;gap:12px}.project-row h2{font-size:34px}.project-mark{width:44px;height:44px}.project-row a{display:none}.atelier-note{display:block;padding:70px 18px 90px}.atelier-note p{margin-top:28px;font-size:48px}.atelier-foot{padding:18px;display:block}.atelier-foot a{display:block;margin-top:15px}
 .service-lead{display:grid;grid-template-columns:1fr;gap:28px;padding:70px 0 90px}.service-count{order:0}.service-lead>div:nth-child(2){order:1}.service-illustration{order:2;min-height:380px;margin-top:28px}.service-steps{display:block;padding:70px 18px 90px}.steps-intro{display:block;padding-bottom:45px}.steps-intro h2{margin-top:24px;font-size:54px}.step,.step:not(:first-of-type){border-left:0;padding:22px 0;margin:0}.step strong{font-size:26px}.service-close{padding-left:18px;padding-right:18px}
}
`;

function pageMarkup(item, genome) {
  const pair = genome.type?.pairing?.v2 || {};
  const titleFont = pair.body || pair.display;
  const accentFont = pair.accent?.evidence || pair.display || titleFont;
  const c = genome.color || {};
  const component = genome.material?.component || {};
  const button = component.button || {};
  const texture = genome.material?.texture || {};
  const titleFamily = JSON.stringify(titleFont?.family || "system-ui");
  const accentFamily = JSON.stringify(accentFont?.family || titleFont?.family || "system-ui");
  const ground = c.ground || "#f3f0e8";
  const surface = c.surface || "#e6e3d8";
  const ink = c.ink || "#1d211e";
  const accent = c.accent || "#d46f55";
  const accent2 = c.accent2 || "#507b63";
  const buttonBg = button.fill || ink;
  const radius = String(genome.material?.radiusLanguage || "").includes("soft") ? "18px" : "5px";
  const faces = [cssFaces(titleFont), cssFaces(accentFont)].filter(Boolean).join("\n");
  const css = cssTemplate
    .replaceAll("__GROUND__", ground)
    .replaceAll("__SURFACE__", surface)
    .replaceAll("__INK__", ink)
    .replaceAll("__ACCENT__", accent)
    .replaceAll("__ACCENT2__", accent2)
    .replaceAll("__TITLE__", titleFamily)
    .replaceAll("__ACCENT_FONT__", accentFamily)
    .replaceAll("__BODY__", titleFamily)
    .replaceAll("__BUTTON__", buttonBg)
    .replaceAll("__RADIUS__", radius)
    .replaceAll("__TEXTURE__", texture.enabled ? ".06" : ".025");
  const common = '<footer class="proof-foot"><span class="mono">' + item.id + '</span><span class="mono">readable headline policy / connected genome</span></footer>';
  const body = {
    night: '<div class="night"><header class="night-nav"><a class="wordmark" href="#top">HUSH / CITY</a><span class="mono">06 / 09 / 26 / after hours</span><a class="nav-link" href="#lineup">View the line-up ↗</a></header><main id="top"><section class="night-lead" data-centrepiece><div class="night-stamp"><span class="mono">A program for the late shift</span><span class="stamp-mark">H</span></div><h1>Stay for the <em>last song.</em></h1><p>' + item.intro + '</p><a class="line-button" href="#lineup">Find a room</a><div class="night-ticker mono"><span>LOW LIGHT / HIGH FIDELITY</span><span>LOW LIGHT / HIGH FIDELITY</span><span>LOW LIGHT / HIGH FIDELITY</span></div></section><section class="lineup" id="lineup"><div class="section-head"><span class="mono">Tonight / four rooms</span><span class="mono">Doors 20:00</span></div><div class="lineup-row"><b>20:30</b><strong>Soft Signal</strong><span>Basement A / live set</span><a href="#top">Details ↗</a></div><div class="lineup-row"><b>22:00</b><strong>Rituals for Static</strong><span>Room 03 / listening session</span><a href="#top">Details ↗</a></div><div class="lineup-row"><b>23:45</b><strong>Afterimage FM</strong><span>Roof / broadcast</span><a href="#top">Details ↗</a></div></section><section class="night-close"><div><span class="mono">The city is still open.</span><h2>Take the long way home.</h2></div><a class="line-button invert" href="#top">Get a wristband ↗</a></section></main></div>',
    field: '<header class="field-head"><span class="mono">FIELD NOTE 047</span><span class="mono">COASTAL WEATHER UNIT / 2026</span><a href="#log">Read the log ↘</a></header><main id="top"><section class="field-lead" data-centrepiece><div class="field-title"><span class="mono">Instrument log / 06:14</span><h1>Wind is a form of <em>evidence.</em></h1><p>' + item.intro + '</p></div><div class="specimen"><span class="mono">Pressure / 1008 hPa</span><div class="specimen-orbit"><i></i><i></i><i></i><b>NW<br>17</b></div><span class="mono">salt index / 0.64</span></div></section><section class="field-log" id="log"><div class="log-label"><span class="mono">Observations</span><span class="mono">07 / 09 / 26</span></div><div class="log-entry"><b>05:40</b><strong>Gulls moved inland.</strong><p>Three streets before the rain. The harbor light flattened and the air changed temperature without warning.</p></div><div class="log-entry"><b>06:14</b><strong>Wind turned north-west.</strong><p>The instruments agreed with the body first. Doors closed. A loose sign began to knock against the wall.</p></div><div class="log-entry"><b>07:02</b><strong>Visibility returned.</strong><p>Low cloud lifted over the breakwater. Keep the west path open.</p></div></section><section class="field-foot"><span class="mono">Filed by the shore team</span><a href="#top">Next note / 048 ↗</a></section></main>',
    atelier: '<header class="atelier-head"><a class="wordmark" href="#top">INTERVAL / STUDIO</a><nav class="mono"><a href="#projects">Projects</a><a href="#about">About</a><a href="#contact">Contact</a></nav></header><main id="top" class="atelier-layout"><aside class="atelier-rail"><span class="mono">Index / 2021-26</span><h1>A studio in the <em>interval.</em></h1><p>' + item.intro + '</p><a class="rail-link" href="#about">Read the approach ↘</a></aside><section class="project-index" id="projects" data-centrepiece><div class="project-row active"><span class="project-no">01</span><div><h2>Objects for a slower room.</h2><p>Identity / moving image / 2026</p></div><div class="project-mark mark-red"></div><a href="#top">Open ↗</a></div><div class="project-row"><span class="project-no">02</span><div><h2>A manual for looking twice.</h2><p>Editorial / 2025</p></div><div class="project-mark mark-blue"></div><a href="#top">Open ↗</a></div><div class="project-row"><span class="project-no">03</span><div><h2>Light held in the archive.</h2><p>Exhibition / 2024</p></div><div class="project-mark mark-green"></div><a href="#top">Open ↗</a></div></section></main><section class="atelier-note" id="about"><span class="mono">Working note</span><p>Make the first gesture quiet enough that the second one can be seen.</p></section><footer class="atelier-foot" id="contact"><span class="mono">Available for a good question</span><a href="#top">Start a conversation ↗</a></footer>',
    service: '<header class="service-head"><a class="wordmark" href="#top">COMMON / REPAIR</a><span class="mono">Neighborhood clinic / open 09 / 18</span><a href="#steps">How it works ↘</a></header><main id="top"><section class="service-lead" data-centrepiece><div class="service-count mono">01 / welcome</div><div><h1>Good care has a <em>shape.</em></h1><p>' + item.intro + '</p><a class="line-button" href="#steps">Bring it in</a></div><div class="service-illustration"><div class="arch"></div><span class="mono">repair / return / repeat</span></div></section><section class="service-steps" id="steps"><div class="steps-intro"><span class="mono">Three useful things</span><h2>No mystery. Just a next step.</h2></div><div class="step"><span class="mono">01</span><strong>Tell us what changed.</strong><p>Call, write, or walk in. A person will listen before anyone reaches for a form.</p></div><div class="step"><span class="mono">02</span><strong>See the options.</strong><p>We explain what can be repaired today, what needs time, and what it will cost.</p></div><div class="step"><span class="mono">03</span><strong>Leave with a plan.</strong><p>You get a plain-language note and one clear action to take next.</p></div></section><section class="service-close"><h2>There is a way through.</h2><a class="line-button invert" href="#top">Book a visit ↗</a></section></main>',
  }[item.kind];
  const serializedGenome = JSON.stringify({ schemaVersion: "quality-proof.v3", source: "connected_style_genome", id: item.id, intent: item.intent, headlinePolicy: "readable-pairing-body", layout: genome.layout, title: titleFont, accent: accentFont, palette: c, component, texture }, null, 2).replaceAll("<", "\\u003c");
  const script = '<script>const titleFont=' + JSON.stringify(titleFont?.family || "system-ui") + ';const accentFont=' + JSON.stringify(accentFont?.family || "system-ui") + ';(async()=>{await document.fonts.ready;const ok=document.fonts.check("1em \\"" + titleFont + "\\"")&&document.fonts.check("1em \\"" + accentFont + "\\"");document.body.dataset.fonts=ok?"pass":"fail"})();</script>';
  return '<!doctype html><html lang="en" data-kind="' + item.kind + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + item.title + '</title><style>' + faces + css + '</style></head><body>' + body + common + script + '<script type="application/json" id="genome">' + serializedGenome + '</script></body></html>';
}

const results = [];
for (const [index, item] of cases.entries()) {
  const seed = 4701 + index * 137;
  const genome = connectedStyleGenome(engine, item.intent, { seed });
  const dir = path.join(OUT, item.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), pageMarkup(item, genome));
  writeFileSync(path.join(dir, "genome.json"), JSON.stringify({ schemaVersion: "quality-proof.v3", id: item.id, seed, intent: item.intent, genome }, null, 2) + "\n");
  writeFileSync(path.join(dir, "build-spec.md"), connectedBuildSpec(engine, item.intent, { seed }).spec + "\n");
  results.push({ id: item.id, seed, layout: genome.layout?.family, headline: genome.type?.pairing?.v2?.body?.family, accent: genome.type?.pairing?.v2?.accent?.evidence?.family || genome.type?.pairing?.v2?.display?.family, mood: genome.color?.mood, texture: genome.material?.texture?.dialect });
}
writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ schemaVersion: "quality-proofs-index.v3", generatedAt: new Date().toISOString(), headlinePolicy: "readable-pairing-body", results }, null, 2) + "\n");
console.log(JSON.stringify({ out: OUT, results }, null, 2));
