// app.js — wires the pure engine to the Palette Lab + Type Foundry, live in-browser.
import { createEngine, oklchToOklab, oklabToSrgb } from "./vendor/engine.mjs";

const DATA = "./vendor/data/";
const [corpus, brands, fonts] = await Promise.all(
  ["corpus", "brands", "fonts"].map((n) => fetch(DATA + n + ".json").then((r) => r.json())),
);
const eng = createEngine({ corpus, brands, fonts });

// live stats
const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
setText("stat-fonts", fonts.length.toLocaleString());
setText("stat-corpus", corpus.length.toLocaleString());

const HEX = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
const norm = (h) => {
  h = h.trim().replace(/^#?/, "#");
  if (h.length === 4) h = "#" + h.slice(1).split("").map((c) => c + c).join("");
  return h.toLowerCase();
};

// ===========================================================================
// Palette Lab
// ===========================================================================
const ROLES = [
  { key: "ground", label: "Ground", def: "#eceae3" },
  { key: "ink", label: "Ink", def: "#17150f" },
  { key: "accent", label: "Accent", def: "#c8175a" },
];
const state = { ground: "#eceae3", ink: "#17150f", accent: "#c8175a" };
const controls = document.getElementById("lab-controls");
const composite = document.getElementById("composite");
const pv = document.getElementById("pv");

// build role blocks (before the composite element)
for (const role of ROLES) {
  const wrap = document.createElement("div");
  wrap.className = "role";
  wrap.dataset.key = role.key;
  wrap.innerHTML = `
    <div class="role-top">
      <span class="role-name">${role.label}</span>
      <span class="verdict" data-v="">—</span>
    </div>
    <div class="swatch-row">
      <label class="swatch" style="background:${state[role.key]}">
        <input type="color" value="${state[role.key]}" aria-label="${role.label} color picker">
      </label>
      <input class="hexin" value="${state[role.key]}" spellcheck="false" aria-label="${role.label} hex">
    </div>
    <div class="reason"></div>
    <div class="fixes"></div>`;
  controls.insertBefore(wrap, composite);

  const colorIn = wrap.querySelector('input[type="color"]');
  const hexIn = wrap.querySelector(".hexin");
  const swatch = wrap.querySelector(".swatch");
  colorIn.addEventListener("input", () => { hexIn.value = colorIn.value; apply(role.key, colorIn.value); });
  hexIn.addEventListener("input", () => {
    if (!HEX.test(hexIn.value)) return;
    const h = norm(hexIn.value);
    colorIn.value = h; swatch.style.background = h; apply(role.key, h);
  });
}

function apply(key, hex) {
  if (!HEX.test(hex)) return;
  state[key] = norm(hex);
  const wrap = controls.querySelector(`.role[data-key="${key}"]`);
  wrap.querySelector(".swatch").style.background = state[key];
  renderRole(key);
  renderComposite();
  renderPreview();
}

function renderRole(key) {
  const wrap = controls.querySelector(`.role[data-key="${key}"]`);
  let r;
  try { r = eng.checkColor(state[key]); } catch { return; }
  const chip = wrap.querySelector(".verdict");
  chip.textContent = r.verdict;
  chip.dataset.v = r.verdict;
  wrap.querySelector(".reason").textContent = r.reason.detail;
  const fixes = wrap.querySelector(".fixes");
  fixes.innerHTML = "";
  if (r.alternatives.length) {
    const lbl = document.createElement("span");
    lbl.className = "role-name"; lbl.style.alignSelf = "center"; lbl.textContent = "fix →";
    fixes.appendChild(lbl);
    for (const a of r.alternatives) {
      const b = document.createElement("button");
      b.className = "fix";
      b.innerHTML = `<span class="chip" style="background:${a.hex}"></span>${a.hex}`;
      b.title = a.reason;
      b.addEventListener("click", () => {
        const w = controls.querySelector(`.role[data-key="${key}"]`);
        w.querySelector(".hexin").value = a.hex;
        w.querySelector('input[type="color"]').value = a.hex;
        apply(key, a.hex);
      });
      fixes.appendChild(b);
    }
  }
}

function renderComposite() {
  let p;
  try { p = eng.checkPalette(state.ground, state.ink, state.accent); } catch { return; }
  const dupeNote = p.duplicates.length ? ` · <b style="color:var(--bad)">${p.duplicates.map((d) => d.a + "≈" + d.b).join(", ")} too close</b>` : "";
  const contrastNote = p.contrast != null
    ? `ink/ground contrast <b>${p.contrast}:1</b> ${p.contrast >= 4.5 ? "(AA ✓)" : "(below AA)"}`
    : "";
  composite.innerHTML = `
    <div class="bigverdict ${p.pass ? "pass" : "fail"}">${p.pass ? "PASS" : "FLAGGED"}</div>
    <div class="meta-mono">${p.pass ? "This palette is off the slop map." : "One or more roles need a fix."}${dupeNote}<br>${contrastNote}</div>`;
}

function renderPreview() {
  pv.style.setProperty("--g", state.ground);
  pv.style.setProperty("--i", state.ink);
  pv.style.setProperty("--a", state.accent);
}

// initial paint
for (const r of ROLES) renderRole(r.key);
renderComposite();
renderPreview();

// ===========================================================================
// Type Foundry
// ===========================================================================
const loadedFonts = new Set();
function loadFont(family, supplier) {
  const kkey = family.toLowerCase();
  if (loadedFonts.has(kkey)) return;
  loadedFonts.add(kkey);
  let href;
  if (supplier === "google") {
    href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@400;500;700&display=swap`;
  } else { // fontshare (velvetyne/uncut have no public CDN css API — filtered out of the pool)
    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    href = `https://api.fontshare.com/v2/css?f[]=${slug}@400,500,700&display=swap`;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet"; link.href = href;
  document.head.appendChild(link);
}

// pool of preview-loadable fresh fonts (google + fontshare only, so the specimen always renders)
function freshPool() {
  const picks = eng.suggestFonts(80).picks.filter((p) => p.supplier === "google" || p.supplier === "fontshare");
  return {
    display: picks.filter((p) => p.category === "display"),
    body: picks.filter((p) => p.category === "sans-serif" || p.category === "serif"),
  };
}
const pool = freshPool();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

const specName = document.getElementById("spec-name");
const specRank = document.getElementById("spec-rank");
const specDisplay = document.getElementById("spec-display");
const specBody = document.getElementById("spec-body");
const specTags = document.getElementById("spec-tags");
const pairingNote = document.getElementById("pairing-note");

// ---- disintegrate + rearrange morph (Web Animations API; transform/opacity/filter only) ----
const prefersReduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const rnd = (a, b) => a + Math.random() * (b - a);

// the specimen is fixed to two forced lines: "Typographic voice," then bold "restored." — always
const DISPLAY_LINES = [
  { text: "Typographic voice,", bold: false },
  { text: "restored.", bold: true },
];

// render the two lines as in-flow word spans (each line a nowrap block); return word spans in reading order
function renderDisplay(el) {
  el.textContent = "";
  const spans = [];
  for (const line of DISPLAY_LINES) {
    const lineEl = document.createElement("span");
    lineEl.style.display = "block";
    lineEl.style.whiteSpace = "nowrap";        // the break is forced between lines; line 1 never wraps internally
    if (line.bold) lineEl.style.fontWeight = "700";
    for (const part of line.text.split(/(\s+)/)) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) { lineEl.appendChild(document.createTextNode(part)); continue; }
      const s = document.createElement("span");
      s.textContent = part;
      s.style.display = "inline-block";
      s.style.willChange = "opacity, filter";
      lineEl.appendChild(s);
      spans.push(s);
    }
    el.appendChild(lineEl);
  }
  el.morphSpans = spans;
  return spans;
}

// dynamically size the font so the widest forced line fills the column, whatever the face — holds the 2-line shape
function fitDisplay(el) {
  const avail = el.clientWidth - 2; // small safety so a nowrap line never overflows and expands the grid track
  if (avail <= 0) return;
  const REF = 100;
  el.style.fontSize = REF + "px";
  let widest = 0;
  el.querySelectorAll(":scope > span").forEach((ln) => { widest = Math.max(widest, ln.scrollWidth); });
  el.style.fontSize = widest ? Math.max(30, Math.min(88, REF * (avail / widest))) + "px" : "";
}

// a left-to-right wave, dissolving in place: pure blur + fade, zero movement
function waveOut(spans) {
  const n = spans.length || 1;
  return Promise.all(spans.map((s, i) => s.animate([
    { opacity: 1, filter: "blur(0px)" },
    { opacity: 0, filter: "blur(6px)" },
  ], { duration: 340, delay: (i / n) * 200, easing: "cubic-bezier(.55,0,.85,.35)", fill: "forwards" }).finished)).catch(() => {});
}
function waveIn(spans) {
  const n = spans.length || 1;
  return Promise.all(spans.map((s, i) => s.animate([
    { opacity: 0, filter: "blur(8px)" },
    { opacity: 1, filter: "blur(0px)" },
  ], { duration: 480, delay: (i / n) * 260, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" }).finished)).catch(() => {});
}

let displayMinH = 0; // monotonic: the display line only ever grows, so content below never hops
async function morphDisplay(el, family, ready) {
  if (prefersReduced) { await ready.catch(() => {}); el.style.fontFamily = family; renderDisplay(el); fitDisplay(el); return; }

  // OUT — blur+fade each word out in a wave (every glyph stays exactly where it sits)
  const outSpans = el.morphSpans || renderDisplay(el);
  fitDisplay(el);
  displayMinH = Math.max(displayMinH, el.getBoundingClientRect().height); el.style.minHeight = displayMinH + "px";
  await waveOut(outSpans);

  // SWAP — wait for the face, set it, re-render the two forced lines and re-fit while everything is invisible
  await ready.catch(() => {});
  el.style.fontFamily = family;
  const inSpans = renderDisplay(el);
  fitDisplay(el);
  inSpans.forEach((s) => { s.style.opacity = "0"; });
  displayMinH = Math.max(displayMinH, el.getBoundingClientRect().height); el.style.minHeight = displayMinH + "px";
  await waveIn(inSpans);
  // resting state IS the structured word spans (kerning within each word intact) — no settle needed
}

let bodyMinH = 0; // same monotonic guard for the body paragraph so its font swap can't tug the tags upward
function morphBody(el, family, ready) {
  if (prefersReduced) { ready.then(() => { el.style.fontFamily = family; }); return; }
  el.animate([{ filter: "blur(0px)", opacity: 1 }, { filter: "blur(7px)", opacity: 0 }], { duration: 320, easing: "ease-in", fill: "forwards" })
    .finished.then(() => ready.catch(() => {})).then(() => {
      el.style.fontFamily = family;
      bodyMinH = Math.max(bodyMinH, el.getBoundingClientRect().height); el.style.minHeight = bodyMinH + "px";
      el.animate([{ filter: "blur(7px)", opacity: 0 }, { filter: "blur(0px)", opacity: 1 }], { duration: 460, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" });
    });
}

let rolling = false;
async function rollPairing(animate) {
  if (rolling) return;
  const d = rand(pool.display.slice(0, 40)) || pool.display[0];
  const b = rand(pool.body.slice(0, 40)) || pool.body[0];
  if (!d || !b) return;
  loadFont(d.family, d.supplier);
  loadFont(b.family, b.supplier);
  const dFam = `"${d.family}", Georgia, serif`;
  const bFam = `"${b.family}", system-ui, sans-serif`;
  specName.textContent = `${d.family} / ${b.family}`;
  specRank.textContent = `display rank ${d.popularityRank} · body rank ${b.popularityRank}`;
  pairingNote.innerHTML = `Display <b>${d.family}</b> <span style="color:var(--ink-3)">[${d.supplier}]</span><br>Body <b>${b.family}</b> <span style="color:var(--ink-3)">[${b.supplier}]</span>`;
  specTags.innerHTML =
    `<span class="tag fresh">FRESH</span>` +
    `<span class="tag">${d.supplier}</span>` +
    `<span class="tag">${b.supplier}</span>` +
    `<span class="tag">off the avoid-list</span>`;
  if (pv) { pv.style.setProperty("--display", dFam); pv.style.fontFamily = bFam; } // live preview becomes the theme
  if (!animate) {
    specDisplay.style.fontFamily = dFam;
    renderDisplay(specDisplay); fitDisplay(specDisplay);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitDisplay(specDisplay));
    specBody.style.fontFamily = bFam;
    return;
  }
  rolling = true;
  const canFonts = document.fonts && document.fonts.load;
  const ready = Promise.all([
    canFonts ? document.fonts.load(`1em "${d.family}"`).catch(() => {}) : Promise.resolve(),
    canFonts ? document.fonts.load(`1em "${b.family}"`).catch(() => {}) : Promise.resolve(),
  ]);
  morphBody(specBody, bFam, ready);
  try { await morphDisplay(specDisplay, dFam, ready); } finally { rolling = false; }
}
document.getElementById("roll").addEventListener("click", () => rollPairing(true));
rollPairing(false);
let fitT; window.addEventListener("resize", () => { clearTimeout(fitT); fitT = setTimeout(() => fitDisplay(specDisplay), 120); });

// ---- check a font ----
const fontq = document.getElementById("fontq");
const fontverdict = document.getElementById("fontverdict");
const fontalts = document.getElementById("fontalts");
const VC = { FRESH: "var(--ok)", SLOP: "var(--bad)", "SLOP-allowed-foundational": "var(--warn)", UNKNOWN: "var(--ink-3)" };
function checkFontUI() {
  const q = fontq.value.trim();
  if (!q) { fontverdict.innerHTML = ""; fontalts.innerHTML = ""; return; }
  const r = eng.checkFont(q);
  fontverdict.innerHTML = `<span class="v" style="color:${VC[r.verdict] || "var(--ink)"}">${r.verdict}</span> — ${r.why}`;
  if (r.alternatives && r.alternatives.length && r.verdict !== "FRESH") {
    fontalts.innerHTML = "try instead: " + r.alternatives.slice(0, 4).map((a) => `<b>${a.family}</b> <span style="color:var(--ink-3)">[${a.supplier}]</span>`).join(" · ");
  } else fontalts.innerHTML = "";
}
document.getElementById("fontgo").addEventListener("click", checkFontUI);
fontq.addEventListener("keydown", (e) => { if (e.key === "Enter") checkFontUI(); });

// ===========================================================================
// misc
// ===========================================================================
document.getElementById("copycfg").addEventListener("click", async (e) => {
  const cfg = document.getElementById("mcpcfg").innerText;
  try { await navigator.clipboard.writeText(cfg); e.target.textContent = "Copied ✓"; setTimeout(() => (e.target.textContent = "Copy config"), 1500); } catch { /* ignore */ }
});

// ===========================================================================
// Palette roll — sample OKLCH, keep only what the engine passes, for a complete theme
// ===========================================================================
function buildHexFromOklch(L, C, H) {
  const { hex, inGamut } = oklabToSrgb(oklchToOklab([L, C, H]));
  return inGamut ? hex : null;
}
// a vivid accent that is fresh (not banned / brand-clone / crowded); fall back to the engine's own fix
function freshAccent() {
  for (let t = 0; t < 60; t++) {
    const hex = buildHexFromOklch(rnd(.48, .66), rnd(.10, .17), Math.random() * 360);
    if (!hex) continue;
    const r = eng.checkColor(hex);
    if (r.verdict === "SAFE") return hex;
    if (r.alternatives.length) return r.alternatives[(Math.random() * r.alternatives.length) | 0].hex;
  }
  return "#1f6e4c";
}
// a near-neutral ground (light) or ink (dark) that reads as NEUTRAL-ok / SAFE
function freshNeutral(kind) {
  for (let t = 0; t < 50; t++) {
    const L = kind === "ink" ? rnd(.15, .24) : rnd(.93, .965);
    const hex = buildHexFromOklch(L, rnd(.006, .02), Math.random() * 360);
    if (!hex) continue;
    const v = eng.checkColor(hex).verdict;
    if (v === "SAFE" || v === "NEUTRAL-ok") return hex;
  }
  return kind === "ink" ? "#17150f" : "#eceae3";
}
function applyPalette(pal) {
  for (const key of ["ground", "ink", "accent"]) {
    const w = controls.querySelector(`.role[data-key="${key}"]`);
    if (w) {
      const hi = w.querySelector(".hexin"); if (hi) hi.value = pal[key];
      const ci = w.querySelector('input[type="color"]'); if (ci) ci.value = pal[key];
      const sw = w.querySelector(".swatch");
      if (sw && !prefersReduced) sw.animate([{ transform: "scale(1)" }, { transform: "scale(1.1) rotate(-2deg)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
    }
    apply(key, pal[key]);
  }
}
let rollingPal = false;
function rollPalette() {
  if (rollingPal) return;
  rollingPal = true;
  let chosen = null;
  for (let a = 0; a < 40; a++) {
    const pal = { ground: freshNeutral("ground"), ink: freshNeutral("ink"), accent: freshAccent() };
    const p = eng.checkPalette(pal.ground, pal.ink, pal.accent);
    if (p.pass && p.contrast != null && p.contrast >= 4.5) { chosen = pal; break; }
  }
  applyPalette(chosen || { ground: "#eceae3", ink: "#17150f", accent: freshAccent() });
  rollingPal = false;
}
const rollpalBtn = document.getElementById("rollpal");
if (rollpalBtn) rollpalBtn.addEventListener("click", rollPalette);
