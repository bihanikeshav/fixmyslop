/* The Index — a living octagon of eight fixes. One viewport, never scrolls.
   The blobs have real physics: a snappy spring (rAF) drives size + a lean toward
   the cursor. Whatever you're nearest to writes itself into the centre — but it
   pops in and bursts out like a balloon, with a dwell before it commits, so the
   text feels intentful. Outside the ring, a bubble pops with the crisp reason the
   fix is good. Reduced motion strips it all. Dot centre == vertex, by construction. */
const { useState: useStateIx, useRef: useRefIx, useEffect: useEffectIx, useMemo: useMemoIx, useCallback: useCbIx } = React;
const SLOP_IX = window.SLOP;

const IX = {
  paper: "#ECEDEF", ink: "#16181D", sub: "#6B6F78",
  mono: "'Martian Mono', monospace", serif: "'Instrument Serif', serif",
};
const IX_LABEL = { surfaces: "Surfaces", color: "Color", imagery: "Imagery", controls: "Controls", compose: "Layout", type: "Type", copy: "Copy", motion: "Motion" };

// physics + geometry
const IX_R = 37, IX_RINF = 36;        // vertex radius / proximity influence radius (% of stage)
const IX_BASE = 20, IX_GROW = 76;     // 20 → 96px blob
const IX_MAG = 10;                    // magnet lean, px
const IX_SNAP = 0.6, IX_MID = 52;     // below SNAP: gentle drift up to MID px. At/above: snap to full.
const IX_DWELL = 120;                 // ms nearest before the centre commits
const IX_BURST = 175;                 // ms the balloon-burst exit runs before the swap

const IX_CSS = `
  @keyframes ixPopIn  { 0%{ opacity:0; transform:scale(.76); } 66%{ opacity:1; transform:scale(1.05); } 100%{ opacity:1; transform:scale(1); } }
  @keyframes ixPopOut { 0%{ opacity:1; transform:scale(1); } 55%{ opacity:.9; transform:scale(1.14); } 100%{ opacity:0; transform:scale(1.24); } }
  .ix-pop-in  { animation: ixPopIn  .3s cubic-bezier(.2,.9,.3,1) both; }
  .ix-pop-out { animation: ixPopOut .175s cubic-bezier(.5,0,.9,.35) both; }
  @media (prefers-reduced-motion: reduce){ .ix-pop-in, .ix-pop-out{ animation:none !important; } }

  .ix-reveal{ opacity:0; transform:translateY(16px); transition:opacity .6s ease-out, transform .6s ease-out; }
  .ix-reveal.ix-in{ opacity:1; transform:none; }
  @keyframes ixBob{ 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(5px); } }
  .ix-bob{ animation:ixBob 1.9s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce){ .ix-reveal{ opacity:1 !important; transform:none !important; } .ix-bob{ animation:none !important; } }
`;

// The real dashboard, embedded verbatim below the octagon. The dashboard's entire
// <style> is scoped with @scope(.engine-embed) so nothing leaks to the antidote
// pages, its :root vars are re-bound to .engine-embed, and its global body{} rule
// is dropped. app.js is loaded after mount to wire the Lab + Foundry by DOM id.
const ENGINE_CSS = `
.engine-embed{ --paper:#ECEDEF; --panel:#f4f2eb; --panel-2:#e5e2d8; --ink:#17150f; --ink-2:#57534a; --ink-3:#8a857a; --rule:#cdc8bb; --rule-2:#ddd9cd; --accent:#c8175a; --accent-deep:#a4124a; --ok:#2f7d4f; --warn:#b8791a; --bad:#c02d21; --display:"Rowan",Georgia,serif; --body:"Technor",system-ui,sans-serif; --mono:"Spline Sans Mono",ui-monospace,monospace; --sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:36px;--sp-7:56px;--sp-8:84px;--sp-9:120px; --maxw:1180px; --e:cubic-bezier(.16,1,.3,1); font-family:var(--body); color:var(--ink); }
  .engine-embed *{box-sizing:border-box}
  .engine-embed ::selection{background:var(--accent);color:#fff}
  .engine-embed a{color:inherit}
  .engine-embed h1,.engine-embed h2,.engine-embed h3,.engine-embed h4{margin:0;font-weight:400;line-height:1}
  .engine-embed p{margin:0}
  .engine-embed .wrap{max-width:var(--maxw);margin-inline:auto;padding-inline:var(--sp-5)}
  .engine-embed .mono{font-family:var(--mono)}
  .engine-embed .band{border-top:1.5px solid var(--ink)}

  /* masthead */
  .engine-embed header.top{border-bottom:1.5px solid var(--ink);position:sticky;top:0;background:var(--paper);z-index:20}
  .engine-embed header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-5);padding-block:var(--sp-3)}
  .engine-embed .mark{font-family:var(--mono);font-weight:600;font-size:15px;letter-spacing:.02em;display:flex;align-items:center;gap:9px}
  .engine-embed .mark .sq{width:12px;height:12px;background:var(--accent);display:inline-block}
  .engine-embed nav{display:flex;gap:var(--sp-5);align-items:center;font-family:var(--mono);font-size:13px;letter-spacing:.03em}
  .engine-embed nav a{text-decoration:none;color:var(--ink-2);border-bottom:2px solid transparent;padding-bottom:2px;transition:color .15s,border-color .15s}
  .engine-embed nav a:hover{color:var(--ink);border-color:var(--accent)}
  .engine-embed nav a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}

  .engine-embed .btn{font-family:var(--mono);font-size:13px;letter-spacing:.04em;text-transform:uppercase;background:var(--accent);color:#fff;
    border:1.5px solid var(--ink);padding:11px 20px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;
    box-shadow:3px 3px 0 var(--ink);transition:transform .12s var(--e),background .15s}
  .engine-embed .btn:hover{transform:translate(-1px,-1px);background:var(--accent-deep)}
  .engine-embed .btn:active{transform:translate(2px,2px)}
  .engine-embed .btn:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
  .engine-embed .btn.ghost{background:transparent;color:var(--ink)}
  .engine-embed .btn.ghost:hover{background:var(--panel)}
  .engine-embed .btn.sm{padding:7px 12px;box-shadow:2px 2px 0 var(--ink)}

  /* hero */
  .engine-embed .hero .wrap{padding-block:var(--sp-8) var(--sp-7)}
  .engine-embed .kicker{font-family:var(--mono);font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);display:flex;align-items:center;gap:10px;margin-bottom:var(--sp-5)}
  .engine-embed .kicker::before{content:"";width:34px;height:2px;background:var(--accent)}
  .engine-embed h1{font-family:var(--display);font-size:clamp(46px,8.2vw,104px);letter-spacing:-.015em;line-height:.98;max-width:15ch}
  .engine-embed h1 em{font-style:italic;color:var(--accent)}
  .engine-embed .lede{margin-top:var(--sp-6);font-size:clamp(18px,2.1vw,23px);color:var(--ink-2);max-width:60ch;line-height:1.45}
  .engine-embed .lede b{color:var(--ink);font-weight:600}
  .engine-embed .hero-cta{margin-top:var(--sp-6);display:flex;gap:var(--sp-4);flex-wrap:wrap;align-items:center}
  .engine-embed .stat-row{margin-top:var(--sp-7);display:flex;gap:var(--sp-7);flex-wrap:wrap;border-top:1px solid var(--rule);padding-top:var(--sp-5)}
  .engine-embed .stat .n{font-family:var(--display);font-size:34px;line-height:1}
  .engine-embed .stat .l{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3);margin-top:6px}

  /* section head */
  .engine-embed .sec{padding-block:var(--sp-8)}
  .engine-embed .sec-head{display:flex;align-items:baseline;gap:var(--sp-4);flex-wrap:wrap;margin-bottom:var(--sp-6)}
  .engine-embed .sec-no{font-family:var(--mono);font-size:13px;color:var(--accent);letter-spacing:.08em}
  .engine-embed h2{font-family:var(--display);font-size:clamp(30px,4.6vw,54px);letter-spacing:-.01em}
  .engine-embed .sec-lede{font-family:var(--mono);font-size:13px;color:var(--ink-3);letter-spacing:.02em;line-height:1.6;margin-left:auto;max-width:40ch}

  /* ---- Palette Lab ---- */
  .engine-embed .lab{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1.5px solid var(--ink);background:var(--ink)}
  .engine-embed .lab > div{background:var(--panel)}
  .engine-embed .lab-controls{padding:var(--sp-6)}
  .engine-embed .lab-preview{padding:0;border-left:1.5px solid var(--ink);display:flex;flex-direction:column}
  .engine-embed .role{margin-bottom:var(--sp-5)}
  .engine-embed .role-top{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);margin-bottom:var(--sp-2)}
  .engine-embed .role-name{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)}
  .engine-embed .verdict{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border:1.5px solid var(--ink);font-weight:500}
  .engine-embed .verdict[data-v="SAFE"],.engine-embed .verdict[data-v="NEUTRAL-ok"]{background:var(--ok);color:#fff;border-color:var(--ok)}
  .engine-embed .verdict[data-v="OVERUSED"]{background:var(--warn);color:#fff;border-color:var(--warn)}
  .engine-embed .verdict[data-v="HARD-BANNED"]{background:var(--bad);color:#fff;border-color:var(--bad)}
  .engine-embed .swatch-row{display:flex;gap:var(--sp-3);align-items:stretch}
  .engine-embed .swatch{width:52px;flex:0 0 52px;border:1.5px solid var(--ink);cursor:pointer;position:relative;overflow:hidden}
  .engine-embed .swatch input[type=color]{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);border:0;padding:0;cursor:pointer;opacity:0}
  .engine-embed .hexin{flex:1;font-family:var(--mono);font-size:16px;border:1.5px solid var(--ink);background:var(--paper);padding:0 12px;color:var(--ink);text-transform:lowercase}
  .engine-embed .hexin:focus{outline:2px solid var(--accent);outline-offset:1px}
  .engine-embed .reason{font-family:var(--mono);font-size:11.5px;color:var(--ink-3);line-height:1.5;margin-top:8px;min-height:1.5em}
  .engine-embed .fixes{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
  .engine-embed .fix{font-family:var(--mono);font-size:11px;border:1px solid var(--ink);background:var(--paper);padding:4px 7px 4px 4px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .12s}
  .engine-embed .fix:hover{background:var(--accent);color:#fff}
  .engine-embed .fix .chip{width:13px;height:13px;border:1px solid rgba(0,0,0,.3);display:inline-block}

  .engine-embed .composite{margin-top:var(--sp-5);border-top:1.5px solid var(--ink);padding-top:var(--sp-5);display:flex;align-items:center;gap:var(--sp-4);flex-wrap:wrap}
  .engine-embed .bigverdict{font-family:var(--display);font-size:40px;line-height:1}
  .engine-embed .bigverdict.pass{color:var(--ok)} .engine-embed .bigverdict.fail{color:var(--bad)}
  .engine-embed .meta-mono{font-family:var(--mono);font-size:12px;color:var(--ink-2);line-height:1.6}

  /* live preview pane uses the chosen palette via CSS vars set in JS */
  .engine-embed .pv{--g:#eceae3;--i:#17150f;--a:#c8175a;background:var(--g);color:var(--i);flex:1;padding:var(--sp-6);display:flex;flex-direction:column;justify-content:center;gap:var(--sp-4);transition:background .2s,color .2s}
  .engine-embed .pv .pv-kick{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--a)}
  .engine-embed .pv .pv-h{font-family:var(--display);font-size:clamp(28px,4vw,44px);line-height:1;max-width:12ch}
  .engine-embed .pv .pv-h em{color:var(--a);font-style:italic}
  .engine-embed .pv .pv-p{font-size:15px;opacity:.8;max-width:34ch;line-height:1.5}
  .engine-embed .pv .pv-btn{align-self:flex-start;font-family:var(--mono);font-size:12px;text-transform:uppercase;letter-spacing:.05em;background:var(--a);color:#fff;padding:9px 16px;border:1.5px solid var(--i)}
  .engine-embed .pv .pv-tag{display:inline-block;font-family:var(--mono);font-size:11px;border:1.5px solid var(--a);color:var(--a);padding:3px 8px;align-self:flex-start}
  .engine-embed .pv-label{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);padding:var(--sp-3) var(--sp-6);border-bottom:1px solid var(--rule);background:var(--panel)}

  /* ---- Type foundry ---- */
  .engine-embed .foundry{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:var(--sp-6)}
  .engine-embed .specimen{min-width:0;border:1.5px solid var(--ink);background:var(--panel);padding:var(--sp-6);box-shadow:5px 5px 0 rgba(23,21,15,.13)}
  .engine-embed .spec-meta{display:flex;justify-content:space-between;align-items:baseline;gap:var(--sp-4);border-bottom:1px solid var(--rule);padding-bottom:var(--sp-3);margin-bottom:var(--sp-5);font-family:var(--mono);font-size:12px;color:var(--ink-3)}
  .engine-embed .spec-display{font-size:clamp(40px,6vw,76px);line-height:.98;letter-spacing:-.01em;margin-bottom:var(--sp-4);word-break:break-word}
  .engine-embed .spec-body{font-size:18px;line-height:1.55;color:var(--ink-2);max-width:52ch}
  .engine-embed .spec-tags{margin-top:var(--sp-5);display:flex;gap:var(--sp-3);flex-wrap:wrap;font-family:var(--mono);font-size:11px}
  .engine-embed .tag{border:1px solid var(--ink);padding:4px 9px;letter-spacing:.04em}
  .engine-embed .tag.fresh{background:var(--ok);color:#fff;border-color:var(--ok)}
  .engine-embed .foundry-side{display:flex;flex-direction:column;gap:var(--sp-5)}
  .engine-embed .panelbox{border:1.5px solid var(--ink);background:var(--panel);padding:var(--sp-5)}
  .engine-embed .panelbox h4{font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);margin-bottom:var(--sp-3)}
  .engine-embed .checkrow{display:flex;gap:var(--sp-3)}
  .engine-embed .checkrow input{flex:1;font-family:var(--mono);font-size:15px;border:1.5px solid var(--ink);background:var(--paper);padding:9px 12px}
  .engine-embed .checkrow input:focus{outline:2px solid var(--accent);outline-offset:1px}
  .engine-embed .fontverdict{margin-top:var(--sp-3);font-family:var(--mono);font-size:12.5px;line-height:1.5}
  .engine-embed .fontverdict .v{font-weight:600}
  .engine-embed .altlist{margin-top:var(--sp-3);font-family:var(--mono);font-size:12px;color:var(--ink-2);line-height:1.7}
  .engine-embed .altlist b{color:var(--ink)}

  /* structure cards */
  .engine-embed .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--sp-5)}
  .engine-embed .card{border:1.5px solid var(--ink);background:var(--panel);padding:var(--sp-5)}
  .engine-embed .card .cn{font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:.06em;margin-bottom:var(--sp-3)}
  .engine-embed .card h3{font-family:var(--display);font-size:26px;margin-bottom:var(--sp-3);line-height:1.05}
  .engine-embed .card p{font-size:15px;color:var(--ink-2)}
  .engine-embed .vizcard{text-decoration:none;display:flex;flex-direction:column;transition:transform .14s var(--e),box-shadow .14s var(--e),border-color .14s}
  .engine-embed .vizcard:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--ink);border-color:var(--accent)}
  .engine-embed .vizcard:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
  .engine-embed .vizcard .vizgo{margin-top:auto;padding-top:var(--sp-4);font-family:var(--mono);font-size:12px;letter-spacing:.04em;color:var(--accent)}
  .engine-embed .viz-cards{grid-template-columns:repeat(3,1fr)}
  @media(max-width:900px){.engine-embed .viz-cards{grid-template-columns:1fr}}

  /* MCP */
  .engine-embed .mcp{border:1.5px solid var(--ink);background:var(--ink);color:var(--paper);padding:var(--sp-7)}
  .engine-embed .mcp h2{color:var(--paper)}
  .engine-embed .mcp .sec-lede{color:#b3ad9f}
  .engine-embed .mcp-grid{display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-6);margin-top:var(--sp-5)}
  .engine-embed .mcp-tools{font-family:var(--mono);font-size:13px;line-height:2}
  .engine-embed .mcp-tools .t{color:var(--accent)}
  .engine-embed pre{margin:0;font-family:var(--mono);font-size:12.5px;line-height:1.65;background:#0f0e0a;border:1px solid #333029;padding:var(--sp-5);overflow-x:auto;color:#d8d4c8}
  .engine-embed pre .k{color:#e592b0}
  .engine-embed .copy{margin-top:var(--sp-3)}

  .engine-embed footer{border-top:1.5px solid var(--ink)}
  .engine-embed footer .wrap{padding-block:var(--sp-7);display:flex;justify-content:space-between;gap:var(--sp-6);flex-wrap:wrap}
  .engine-embed footer .big{font-family:var(--display);font-size:clamp(24px,3vw,34px);max-width:20ch;line-height:1.1}
  .engine-embed .fmeta{font-family:var(--mono);font-size:12px;color:var(--ink-3);line-height:1.8}

  @media(max-width:900px){
    .engine-embed .lab{grid-template-columns:1fr} .engine-embed .lab-preview{border-left:0;border-top:1.5px solid var(--ink)}
    .engine-embed .foundry{grid-template-columns:1fr} .engine-embed .cards{grid-template-columns:1fr} .engine-embed .mcp-grid{grid-template-columns:1fr}
    .engine-embed .sec-lede{margin-left:0}
  }
  @media(max-width:560px){ .engine-embed nav .nl{display:none} .engine-embed h1{font-size:clamp(38px,12vw,60px)} }

  @media(prefers-reduced-motion:no-preference){
    .engine-embed .rev{opacity:0;transform:translateY(14px)}
    .engine-embed .rev.in{opacity:1;transform:none;transition:opacity .5s var(--e),transform .5s var(--e)}
  }
`;

const ENGINE_HTML = `
<section class="sec band" id="lab">
  <div class="wrap">
    <div class="sec-head">
      <span class="sec-no">01</span><h2>The Palette Lab</h2>
      <p class="sec-lede">Type any hex. Every color is scored against the empirical corpus in real time — banned bands, brand-clones, and crowded zones — with an escape route out.</p>
    </div>
    <div class="lab">
      <div class="lab-controls" id="lab-controls">
        <!-- roles injected -->
        <div class="composite" id="composite"></div>
        <button class="btn" id="rollpal" style="margin-top:var(--sp-5);width:100%;justify-content:center">Roll a fresh palette ↻</button>
      </div>
      <div class="lab-preview">
        <div class="pv-label">Live preview — your palette, applied</div>
        <div class="pv" id="pv">
          <span class="pv-kick">Fintech · AI · SaaS</span>
          <div class="pv-h">Ship something <em>nobody</em> has seen.</div>
          <p class="pv-p">This card repaints from your three colors. If the palette passes, this is a page that doesn't look generated.</p>
          <span class="pv-tag">v1.0 · shipping</span>
          <span class="pv-btn">Get started</span>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sec band" id="type">
  <div class="wrap">
    <div class="sec-head">
      <span class="sec-no">02</span><h2>The Type Foundry</h2>
      <p class="sec-lede">Fresh display + body pairings from indie foundries off the AI monoculture. Roll one, or audit a font you're already using.</p>
    </div>
    <div class="foundry">
      <div class="specimen" id="specimen">
        <div class="spec-meta"><span id="spec-name">—</span><span id="spec-rank"></span></div>
        <div class="spec-display" id="spec-display"><span style="display:block">Typographic voice,</span><span style="display:block;font-weight:700">restored.</span></div>
        <div class="spec-body" id="spec-body">The quick brown fox jumps over the lazy dog. 0123456789. A distinctive body face carries running text without collapsing into the same three grotesques every model reaches for.</div>
        <div class="spec-tags" id="spec-tags"></div>
      </div>
      <div class="foundry-side">
        <div class="panelbox">
          <h4>Fresh pairing</h4>
          <p class="meta-mono" id="pairing-note" style="margin-bottom:12px">—</p>
          <button class="btn" id="roll" style="width:100%;justify-content:center">Roll a new pairing ↻</button>
        </div>
        <div class="panelbox">
          <h4>Check a font</h4>
          <div class="checkrow">
            <input id="fontq" placeholder="e.g. Inter, Satoshi…" spellcheck="false">
            <button class="btn sm" id="fontgo">Check</button>
          </div>
          <div class="fontverdict" id="fontverdict"></div>
          <div class="altlist" id="fontalts"></div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="sec band" id="structure">
  <div class="wrap">
    <div class="sec-head">
      <span class="sec-no">03</span><h2>Structure, not templates</h2>
      <p class="sec-lede">The layout is slop too. Refuse the split-hero + three-cards reflex — start from an archetype grounded in the subject.</p>
    </div>
    <div class="cards">
      <div class="card"><div class="cn">ARCHETYPE / 01</div><h3>The Instrument</h3><p>A working, data-driven component the page is remembered for — a computed gauge, a live waterfall, a specimen — not a hero image.</p></div>
      <div class="card"><div class="cn">ARCHETYPE / 02</div><h3>The Editorial Grid</h3><p>Asymmetric magazine columns, a dominant display face, and real hierarchy — instead of centered hero + evenly-spaced cards.</p></div>
      <div class="card"><div class="cn">ARCHETYPE / 03</div><h3>The Ledger</h3><p>Dense, structural, tabular. Rules and columns doing the work. Reads as a designed object, not a landing-page kit.</p></div>
    </div>
  </div>
</section>

<section class="sec band" id="viz">
  <div class="wrap">
    <div class="sec-head">
      <span class="sec-no">04</span><h2>The Visual Field</h2>
      <p class="sec-lede">The engine, made visible. Every crawl and every metric, plotted — the maps the recommender actually reasons over.</p>
    </div>
    <div class="cards viz-cards">
      <a class="card vizcard" href="./viz/font-map.html" target="_blank" rel="noopener">
        <div class="cn">FONTS / SIMILARITY</div>
        <h3>The Font Field</h3>
        <p>2,075 typefaces plotted by visual similarity (DINOv2 embeddings). The monoculture clusters; the fresh picks sit in the open.</p>
        <span class="vizgo">Open map →</span>
      </a>
      <a class="card vizcard" href="./viz/color-lanes.html" target="_blank" rel="noopener">
        <div class="cn">COLOR / SATURATION</div>
        <h3>Color Slop Lanes</h3>
        <p>Every hue ranked by how crowded it is in real AI sites — the banned bands flagged, the open lanes still worth reaching for.</p>
        <span class="vizgo">Open ranking →</span>
      </a>
      <a class="card vizcard" href="./viz/slop-density.html" target="_blank" rel="noopener">
        <div class="cn">COLOR / DENSITY</div>
        <h3>The Density Field</h3>
        <p>The KDE heatmap in OKLab space — the crowded zones everyone keeps reaching for, and the cool regions nobody has claimed.</p>
        <span class="vizgo">Open heatmap →</span>
      </a>
      <a class="card vizcard" href="./viz/color-space.html" target="_blank" rel="noopener">
        <div class="cn">COLOR / SPACE</div>
        <h3>The OKLab Space</h3>
        <p>The full perceptual color space, with the corpus and the framework defaults located inside it. Rotate through where slop lives.</p>
        <span class="vizgo">Open space →</span>
      </a>
      <a class="card vizcard" href="./viz/sites-gates.html" target="_blank" rel="noopener">
        <div class="cn">STRUCTURE / CORPUS</div>
        <h3>Sites Across the Gates</h3>
        <p>The crawled AI-product sites, scored against every gate at once — the layout, color and type tells, site by site.</p>
        <span class="vizgo">Open corpus →</span>
      </a>
    </div>
  </div>
</section>

<section class="sec band" id="mcp">
  <div class="wrap">
    <div class="mcp">
      <div class="sec-head">
        <span class="sec-no" style="color:var(--accent)">05</span><h2>Query it from your LLM</h2>
        <p class="sec-lede">Point any MCP-capable model at the engine. It asks for fresh fonts and non-slop colors mid-build — and gets answers grounded in this week's crawl.</p>
      </div>
      <div class="mcp-grid">
        <div>
          <div class="mcp-tools">
            <div><span class="t">check_color</span>(hex) → verdict, slop, brand-clone, fixes</div>
            <div><span class="t">check_palette</span>(ground, ink, accent) → pass / fail</div>
            <div><span class="t">suggest_fonts</span>(n) → fresh display + body pairing</div>
            <div><span class="t">check_font</span>(family) → slop or fresh + alternatives</div>
            <div><span class="t">structure_ideas</span>(brief) → layout archetypes</div>
          </div>
        </div>
        <div>
          <pre id="mcpcfg"><span class="k">"ai-slop-font"</span>: {
  <span class="k">"url"</span>: "https://ai-slop-font.bihanikeshav.workers.dev/mcp"
}</pre>
          <button class="btn sm ghost copy" id="copycfg" style="color:var(--paper);border-color:var(--paper)">Copy config</button>
        </div>
      </div>
    </div>
  </div>
</section>

<footer>
  <div class="wrap">
    <div class="big">Free &amp; open. The anti-inductive engine against design homogeneity.</div>
    <div class="fmeta">
      Palette Lab · Type Foundry · MCP<br>
      Corpus refreshed from 1,279 AI-product sites<br>
      Fonts: Google · Fontshare · Velvetyne · Uncut<br>
      © 2026 ai-slop-font
    </div>
  </div>
</footer>
`;

// The eight nodes — rendered once and memoised, so the rAF loop owns their size /
// transform imperatively and React never clobbers it on a centre re-render.
const HubNodes = React.memo(function HubNodes({ pages, verts, discRefs, btnRefs, numRefs, labRefs, onRoute, setFocus, clearFocus }) {
  return (
    <React.Fragment>
      {pages.map((p, i) => {
        const v = verts[i];
        return (
          <button key={p.key}
            ref={(el) => { btnRefs.current[i] = el; }}
            onFocus={() => setFocus(i)} onBlur={clearFocus}
            onClick={(e) => onRoute(p.key, e)}
            aria-label={`${IX_LABEL[p.key] || p.key}: ${p.fix}`}
            style={{ position: "absolute", left: `${v.x}%`, top: `${v.y}%`,
              transform: "translate(-50%,-50%)", width: 96, height: 96, padding: 0, border: "none",
              background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", zIndex: 3 }}>
            <span ref={(el) => { discRefs.current[i] = el; }} aria-hidden style={{
              position: "absolute", width: IX_BASE, height: IX_BASE, borderRadius: "50%", background: p.dot }} />
            <span ref={(el) => { numRefs.current[i] = el; }} style={{ position: "relative", zIndex: 1,
              fontFamily: IX.mono, fontSize: 8, fontWeight: 600, color: "#fff", opacity: 0 }}>{String(i + 1).padStart(2, "0")}</span>
            <span ref={(el) => { labRefs.current[i] = el; }} style={{ position: "absolute", top: "calc(50% + 24px)",
              left: "50%", transform: "translateX(-50%)", fontFamily: IX.mono, fontSize: "clamp(9px,1vw,12px)",
              letterSpacing: ".01em", whiteSpace: "nowrap", color: IX.sub, fontWeight: 500 }}>{IX_LABEL[p.key] || p.key}</span>
          </button>
        );
      })}
    </React.Fragment>
  );
});

function IndexLayer({ onRoute, onReset, active }) {
  const pages = SLOP_IX.PAGES;
  const N = pages.length;
  const [reduce] = useStateIx(() => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  const [activeIdx, setActiveIdx] = useStateIx(null);
  const [disp, setDisp] = useStateIx({ idx: null });   // what the centre currently shows
  const [anim, setAnim] = useStateIx("in");            // "in" (pop) | "out" (burst)

  const verts = useMemoIx(() => pages.map((_, i) => {
    const a = (-90 + i * 360 / N) * Math.PI / 180;
    return { x: 50 + IX_R * Math.cos(a), y: 50 + IX_R * Math.sin(a) };
  }), []);
  const poly = verts.map((v) => `${v.x},${v.y}`).join(" ");

  const discRefs = useRefIx([]), btnRefs = useRefIx([]), numRefs = useRefIx([]), labRefs = useRefIx([]);
  const mouseRef = useRefIx(null), focusRef = useRefIx(null), stageRef = useRefIx(null);
  const physRef = useRefIx(pages.map(() => ({ size: IX_BASE, sizeV: 0, mx: 0, mxV: 0, my: 0, myV: 0 })));
  const activeRef = useRefIx(-2), candRef = useRefIx({ idx: -2, since: 0 }), rafRef = useRefIx(0), reduceRef = useRefIx(reduce);
  const latestRef = useRefIx(null), swapRef = useRefIx(0);
  const rootRef = useRefIx(null);

  const setFocus = useCbIx((i) => { focusRef.current = i; }, []);
  const clearFocus = useCbIx(() => { focusRef.current = null; }, []);
  const scrollToEngine = useCbIx(() => {
    const el = document.getElementById("engine");
    if (el) el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [reduce]);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mouseRef.current = { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 };
  };
  const onLeave = () => { mouseRef.current = null; focusRef.current = null; };

  // centre swap: burst the old one out, then pop the new one in
  useEffectIx(() => {
    if (activeIdx === disp.idx) return undefined;
    if (reduceRef.current) { setDisp({ idx: activeIdx }); setAnim("in"); return undefined; }
    latestRef.current = activeIdx;
    setAnim("out");
    clearTimeout(swapRef.current);
    swapRef.current = setTimeout(() => { setDisp({ idx: latestRef.current }); setAnim("in"); }, IX_BURST);
    return undefined;
  }, [activeIdx]);

  useEffectIx(() => {
    reduceRef.current = reduce;
    if (!active) return undefined;
    const tick = (now) => {
      const m = mouseRef.current, ph = physRef.current;
      let best = -1, bestC = 0;
      const cs = new Array(N);
      for (let i = 0; i < N; i++) {
        let c = 0;
        if (focusRef.current === i) c = 1;
        else if (m) { const t = Math.max(0, 1 - Math.hypot(verts[i].x - m.x, verts[i].y - m.y) / IX_RINF); c = t * t * (3 - 2 * t); }
        cs[i] = c;
        if (c > bestC) { bestC = c; best = i; }
      }
      const cand = focusRef.current != null ? focusRef.current : (bestC > 0.42 ? best : -1);
      if (cand !== candRef.current.idx) candRef.current = { idx: cand, since: now };
      const dwell = focusRef.current != null ? 0 : IX_DWELL;
      if (now - candRef.current.since >= dwell && cand !== activeRef.current) {
        activeRef.current = cand; setActiveIdx(cand < 0 ? null : cand);
      }
      for (let i = 0; i < N; i++) {
        const c = cs[i], p = ph[i];
        // gentle drift while approaching, a hard SNAP to full only when almost close (or hovered), snap back off
        const snapped = c >= IX_SNAP || focusRef.current === i;
        let target = snapped ? (IX_BASE + IX_GROW) : (IX_BASE + (c / IX_SNAP) * (IX_MID - IX_BASE));
        if (!reduceRef.current && c < 0.06 && !m) target += Math.sin(now / 900 + i * 1.7) * 1.6;   // idle breathing
        if (reduceRef.current) { p.size = target; p.mx = 0; p.my = 0; }
        else {
          const gap = Math.abs(target - p.size);                 // a jump (snap on/off) catches fast; slow drift stays gentle
          const k = gap > 12 ? 0.45 : 0.15, dmp = gap > 12 ? 0.62 : 0.8;
          p.sizeV += (target - p.size) * k; p.sizeV *= dmp; p.size += p.sizeV;
          let tx = 0, ty = 0;
          if (m) { const dx = m.x - verts[i].x, dy = m.y - verts[i].y, len = Math.hypot(dx, dy) || 1; tx = (dx / len) * c * IX_MAG; ty = (dy / len) * c * IX_MAG; }
          p.mxV += (tx - p.mx) * 0.18; p.mxV *= 0.78; p.mx += p.mxV;   // the lean stays gentle
          p.myV += (ty - p.my) * 0.18; p.myV *= 0.78; p.my += p.myV;
        }
        const s = Math.max(6, p.size), disc = discRefs.current[i];
        if (disc) {
          disc.style.width = s + "px"; disc.style.height = s + "px";
          disc.style.boxShadow = c > 0.03 ? `0 12px 28px -10px ${pages[i].dot}, 0 0 0 ${(c * 9).toFixed(1)}px ${pages[i].dot}1f` : "none";
        }
        const btn = btnRefs.current[i];
        if (btn) btn.style.transform = `translate(-50%,-50%) translate(${p.mx.toFixed(2)}px, ${p.my.toFixed(2)}px)`;
        const num = numRefs.current[i], show = s >= 60;
        if (num) { num.style.opacity = show ? "1" : "0"; num.style.fontSize = (show ? Math.min(15, 8 + c * 8) : 8) + "px"; }
        const lab = labRefs.current[i];
        if (lab) { lab.style.top = `calc(50% + ${(s / 2 + 11).toFixed(1)}px)`; lab.style.color = c > 0.35 ? IX.ink : IX.sub; lab.style.fontWeight = c > 0.55 ? 600 : 500; }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, reduce]);

  // scroll-reveal for the Engine + Data sections (transform/opacity only, once)
  useEffectIx(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const els = Array.prototype.slice.call(root.querySelectorAll(".ix-reveal"));
    if (reduce || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("ix-in")); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("ix-in"); io.unobserve(e.target); } });
    }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reduce]);

  // wire the embedded Palette Lab + Type Foundry — app.js queries the ids injected above
  useEffectIx(() => {
    if (document.getElementById("engine-app-js")) return undefined;
    const s = document.createElement("script");
    s.type = "module"; s.src = "./app.js?b=40"; s.id = "engine-app-js";
    document.body.appendChild(s);
    return undefined;
  }, []);

  const cur = disp.idx != null ? pages[disp.idx] : null;
  const popCls = anim === "out" ? "ix-pop-out" : "ix-pop-in";

  return (
    <div ref={rootRef} style={{ height: "100%", overflowY: "auto", background: IX.paper, color: IX.ink, fontFamily: IX.mono, scrollBehavior: "smooth" }}>
      <style>{IX_CSS}</style>

      {/* ── SCREEN 1: the octagon hub — wrapped only, markup unchanged ── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px clamp(16px,3vw,30px)", borderBottom: `1px solid ${IX.ink}1f` }}>
        <Wordmark theme={{ ink: IX.ink, paper: IX.paper, accent: cur ? cur.dot : IX.ink, mono: IX.mono }} tag="the antidote" />
        <button onClick={onReset} style={{ fontFamily: IX.mono, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: IX.ink, border: `1.5px solid ${IX.ink}`, padding: "9px 15px", background: "transparent", cursor: "pointer" }}>← back to the slop</button>
      </div>

      <div style={{ flex: "1 1 auto", position: "relative", display: "grid", placeItems: "center", minHeight: 0, padding: "clamp(8px,2vh,24px)" }}>
        <div ref={stageRef} onMouseMove={onMove} onMouseLeave={onLeave}
          style={{ position: "relative", width: "min(78vh, 94vw)", height: "min(78vh, 94vw)" }}>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} aria-hidden="true">
            {verts.map((v, i) => {
              const on = activeIdx === i;
              return <line key={"sp" + i} x1="50" y1="50" x2={v.x} y2={v.y}
                stroke={on ? pages[i].dot : IX.ink} strokeWidth={on ? 0.6 : 0.16}
                strokeOpacity={on ? 0.85 : 0.13} style={{ transition: "stroke .22s, stroke-width .22s, stroke-opacity .22s" }} />;
            })}
            <circle cx="50" cy="50" r={IX_R} fill="none" stroke={IX.ink} strokeWidth="0.14" strokeOpacity="0.1" />
            <polygon points={poly} fill="none" stroke={IX.ink} strokeWidth="0.4" strokeOpacity="0.5" strokeLinejoin="round" />
          </svg>

          {/* centre — pops in, bursts out */}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "44%", padding: "clamp(12px,2.4vw,26px)", textAlign: "center", pointerEvents: "none", background: `radial-gradient(closest-side, ${IX.paper} 60%, ${IX.paper}dd 78%, ${IX.paper}00 100%)` }}>
            <div key={cur ? cur.key : "intent"} className={popCls} style={{ transformOrigin: "center" }}>
              {cur ? (
                <React.Fragment>
                  <div style={{ fontSize: "clamp(8px,1vw,10px)", letterSpacing: ".16em", textTransform: "uppercase", color: cur.dot, fontWeight: 600 }}>{IX_LABEL[cur.key] || cur.key}</div>
                  <div style={{ fontSize: "clamp(9.5px,1.05vw,12px)", color: IX.sub, textDecoration: "line-through", textDecorationColor: cur.dot, textDecorationThickness: "1.5px", margin: "7px 0 12px", lineHeight: 1.5 }}>{cur.tell}</div>
                  <div style={{ fontFamily: IX.serif, fontSize: "clamp(20px,2.7vw,34px)", lineHeight: 1.12 }}>{cur.fix}</div>
                  <div style={{ fontSize: "clamp(9.5px,1.02vw,12px)", color: IX.sub, marginTop: 11, lineHeight: 1.42, maxWidth: "94%", marginInline: "auto" }}>{cur.why}</div>
                  <div style={{ fontSize: "clamp(9px,.95vw,11px)", color: cur.dot, fontWeight: 600, marginTop: 12, letterSpacing: ".02em" }}>click to open →</div>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <div style={{ fontFamily: IX.serif, fontStyle: "italic", fontSize: "clamp(30px,4.6vw,60px)", lineHeight: 0.98 }}>Intent.</div>
                  <div style={{ fontSize: "clamp(8.5px,1vw,11px)", letterSpacing: ".14em", textTransform: "uppercase", color: IX.sub, marginTop: 13, lineHeight: 1.9 }}>Eight tells · eight fixes<br />made on purpose</div>
                </React.Fragment>
              )}
            </div>
          </div>

          {/* the eight living nodes (memoised; rAF owns their motion) */}
          <HubNodes pages={pages} verts={verts} discRefs={discRefs} btnRefs={btnRefs} numRefs={numRefs} labRefs={labRefs}
            onRoute={onRoute} setFocus={setFocus} clearFocus={clearFocus} />

        </div>
      </div>

        {/* gentle scroll cue → engine (bob is translateY only, killed under reduced motion) */}
        <button onClick={scrollToEngine} aria-label="Scroll down to the engine and the data" style={{ position: "absolute", left: "50%", bottom: "clamp(10px,2.4vh,24px)", transform: "translateX(-50%)", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, color: IX.sub, zIndex: 4 }}>
          <span style={{ fontFamily: IX.mono, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase" }}>the engine &amp; the data</span>
          <span className="ix-bob" aria-hidden="true" style={{ display: "block", lineHeight: 0 }}>
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none"><path d="M1 1l7 7 7-7" stroke={IX.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </button>
      </section>

      {/* ── SCREEN 2+: the real engine, embedded verbatim from dashboard.html (hero + masthead dropped), scoped + wired by app.js ── */}
      <style>{ENGINE_CSS}</style>
      <div id="engine" className="engine-embed" style={{ background: "#ECEDEF" }} dangerouslySetInnerHTML={{ __html: ENGINE_HTML }} />

    </div>
  );
}

window.IndexLayer = IndexLayer;
