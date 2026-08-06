/* Page · Glass — "Glass needs a view."
   No scenery. The thesis is proven as a clean A/B: two identical frosted reader
   panels, side by side, same chrome down to the specular edge. The left panel
   floats over a flat dead-grey field and composites to useless grey — a frost
   with nothing to reveal. The right panel floats over the real article, where
   soft ghosts of the type behind it read as depth you can feel. Because frost
   over a flat fill blurs nothing, only the right panel needs a real backdrop
   blur: it is the single backdrop-filter on the page. The left twin wears the
   same translucent fill over the grey and looks exactly the same, which is the
   point. Entrance: one specular light-band sweeps across both panes, once, so
   the eye reads them as one object catching the same light. The headline keeps
   the article's own Newsreader, its pop earned by scale, weight, and one cobalt
   key word ("view."). */
function PageGlass({ onBack }) {
  // one editorial voice: the headline and the reading wall share Newsreader
  const fam  = "'Newsreader', Georgia, serif";      // headline · body · dek · labels

  const paper  = "#E4E7EB";   // cool page (not cream)
  const sheet  = "#FDFCF8";   // brighter, warmer living article stock
  const ink    = "#141821";   // reading ink
  const muted  = "#5C636B";
  const accent = "#243BFF";   // one saturated electric cobalt, used with intent
  const accdk  = "#1A2ACC";   // its deeper edge, for the pressed / depth cues
  const flat   = "#6C727A";   // the deliberately dead, cold field, nothing behind it
  const line   = "rgba(20,24,33,.14)";

  // the shared panel chrome — identical on both twins: fill, bright edge, soft float.
  // Fill kept light enough to see THROUGH, so the frost reveals rather than hides.
  const chrome = {
    background: "rgba(252,253,255,.18)",
    border: "1px solid rgba(255,255,255,.72)",
    boxShadow: "0 44px 88px -38px rgba(17,22,38,.52), 0 16px 36px -22px rgba(17,22,38,.34), inset 0 1.5px 0 rgba(255,255,255,1), inset 0 0 0 .5px rgba(255,255,255,.35), inset 0 -1px 0 rgba(20,24,33,.05)",
    color: ink,
  };
  // THE single backdrop-blur on the page — only the twin over live content needs it.
  // 15px keeps the lines behind readable AS ghosts (heavier blur flattens them to one grey).
  const glass = {
    ...chrome,
    backdropFilter: "blur(15px) saturate(172%) brightness(1.02)",
    WebkitBackdropFilter: "blur(15px) saturate(172%) brightness(1.02)",
  };

  // real editorial content — the "view" worth seeing through
  const body_gl = [
    "Frosted glass is not a texture you paint on. It is a relationship between two layers, the pane in front and whatever sits behind it. Take the second layer away and the material has no work left to do.",
    "In a working interface the layer behind the glass is the reader's own page: a column of text, a list of messages, a map caught mid-pan. The blur lowers that layer's contrast without erasing it, so a toolbar can float on top and stay legible while the content stays present underneath.",
    "That is the whole trick, and it is why glass fails on an empty screen. With nothing behind it, a blurred panel is a grey rectangle wearing a highlight. The eye files it under decoration, because that is all it is.",
    "Hold the same panel over a page of type and the effect returns at once. Soft ghosts of the lines below tell you there is more here, just out of focus, a depth you can feel a moment before you read a single word.",
  ];

  // one reader panel, rendered twice — identical but for the layer it floats on
  const ReaderPanel = ({ real }) => (
    <div className="glg-card" style={{ ...(real ? glass : chrome), position: "relative",
      width: "clamp(288px,27vw,372px)", minHeight: "min(52vh,420px)", borderRadius: 16, overflow: "hidden",
      padding: "clamp(18px,1.7vw,24px)", display: "flex", flexDirection: "column" }}>
      {/* static specular top edge — a thin sheen, kept off the body so the frost can show depth */}
      <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: "30%",
        pointerEvents: "none", borderRadius: "16px 16px 40px 40px / 16px 16px 24px 24px",
        background: "linear-gradient(162deg, rgba(255,255,255,.6) 0%, rgba(255,255,255,.16) 55%, rgba(255,255,255,0) 100%)" }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, marginBottom: "clamp(9px,1.1vh,12px)" }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: accent }} />
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".13em", textTransform: "uppercase", color: accent }}>Reader</span>
      </div>
      <h3 style={{ position: "relative", margin: "0 0 clamp(12px,1.5vh,16px)", fontWeight: 600,
        fontSize: "clamp(18px,1.5vw,22px)", letterSpacing: "-.014em", lineHeight: 1.08, color: ink }}>
        On seeing through things
      </h3>
      <div style={{ position: "relative", height: 1, background: "rgba(23,26,31,.14)", margin: "0 0 clamp(12px,1.5vh,16px)" }} />
      <div style={{ position: "relative", marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <button className="glg-aa" style={{ font: "inherit", fontSize: 13.5, color: ink, background: "rgba(255,255,255,.55)",
          border: "1px solid rgba(23,26,31,.16)", borderRadius: 9, padding: "6px 12px", cursor: "pointer" }}>Aa</button>
        <button className="glg-contents" style={{ font: "inherit", fontSize: 13, fontWeight: 600, color: "#fff", background: accent,
          border: `1px solid ${accent}`, borderRadius: 9, padding: "7px 14px", cursor: "pointer",
          boxShadow: "0 6px 16px -5px rgba(36,59,255,.6)" }}>Contents</button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: muted }}>1 / 4</span>
      </div>
      {/* specular light-sweep — the crafted entrance, clipped to the glass, once */}
      <div className="glg-spec" aria-hidden="true" style={{ position: "absolute", top: "-30%", left: 0,
        height: "160%", width: "38%", pointerEvents: "none", mixBlendMode: "screen",
        background: "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.35) 46%, rgba(255,255,255,.95) 50%, rgba(255,255,255,.35) 54%, rgba(255,255,255,0) 100%)" }} />
    </div>
  );

  return (
    <div className="glg-root" style={{
      position: "relative", height: "100vh", overflow: "hidden", boxSizing: "border-box",
      background: paper, color: ink, fontFamily: fam,
      display: "flex", flexDirection: "column",
      padding: "clamp(16px,2.4vh,26px) clamp(20px,4vw,44px) clamp(14px,2.2vh,22px)",
    }}>
      <style>{`
        .glg-root :focus-visible{ outline: 2px solid ${accent}; outline-offset: 3px; border-radius: 2px; }
        .glg-head{ animation: glg-rise_gl .7s cubic-bezier(.2,.7,.2,1) both; }
        .glg-card{ animation: glg-rise_gl .8s cubic-bezier(.2,.75,.2,1) .16s both; }
        .glg-spec{ animation: glg-sweep_gl 1.7s cubic-bezier(.5,0,.15,1) .5s 1 both; }
        .glg-col{ column-count: 2; column-gap: clamp(20px,2.6vw,38px); }
        .glg-col p{ margin: 0 0 .72em; break-inside: avoid; }
        .glg-col p:first-of-type::first-letter{
          float: left; font-size: 3.15em; line-height: .78; font-weight: 600;
          color: ${accent}; padding: .04em .09em 0 0; }
        .glg-contents{ transition: transform .16s ease, box-shadow .16s ease, filter .16s ease; }
        .glg-contents:hover{ transform: translateY(-1px); filter: saturate(1.08) brightness(1.04);
          box-shadow: 0 8px 20px -6px rgba(36,59,255,.62); }
        .glg-aa{ transition: background .16s ease, border-color .16s ease; }
        .glg-aa:hover{ background: rgba(255,255,255,.78); border-color: rgba(23,26,31,.28); }
        @keyframes glg-rise_gl{ from{ opacity:0; transform: translateY(10px); } to{ opacity:1; transform:none; } }
        @keyframes glg-sweep_gl{
          0%{ transform: translateX(-130%) skewX(-14deg); opacity:0; }
          16%{ opacity:.95; }
          64%{ opacity:.58; }
          100%{ transform: translateX(240%) skewX(-14deg); opacity:0; }
        }
        @media (prefers-reduced-motion: reduce){
          .glg-head, .glg-card{ animation: none; opacity:1; transform:none; }
          .glg-spec{ animation: none; display:none; }
          .glg-contents, .glg-aa{ transition: none; }
        }
      `}</style>

      {/* ── header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flex: "0 0 auto" }}>
        <BackTab theme={{ ink, line: "rgba(23,26,31,.32)", mono: fam }} onClick={onBack} />
        <span style={{ fontSize: 13, color: muted }}>Antidote · Surfaces</span>
      </div>

      {/* ── headline ── */}
      <div className="glg-head" style={{ flex: "0 0 auto", marginTop: "clamp(12px,2.4vh,24px)", maxWidth: 860 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: "clamp(6px,1vh,10px)" }}>
          <span style={{ width: 22, height: 3, borderRadius: 2, background: accent }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: accent, letterSpacing: ".13em", textTransform: "uppercase" }}>Same pane, two backdrops</span>
        </div>
        <h1 style={{ margin: 0, fontFamily: fam, fontWeight: 560, fontSize: "clamp(46px,6.8vw,82px)", lineHeight: .96, letterSpacing: "-.022em" }}>
          Glass needs a <span style={{ color: accent, fontWeight: 700 }}>view.</span>
        </h1>
        <p style={{ margin: "clamp(10px,1.6vh,16px) 0 0", fontSize: "clamp(14px,1.15vw,16px)", lineHeight: 1.5, color: muted, maxWidth: 600 }}>
          Frosted blur only earns its place over something worth seeing through. Here is one reader panel, shown twice: over flat colour it is dead grey, over a live article it turns to depth.
        </p>
      </div>

      {/* ── the demonstration stage: a clean A/B of one panel over two backdrops ── */}
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, marginTop: "clamp(14px,2.6vh,28px)",
        border: `1px solid ${line}`, borderRadius: 4, overflow: "hidden", background: sheet,
        display: "flex", flexDirection: "column" }}>

        {/* the two fields, each with its identical panel floating over its own backdrop */}
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex" }}>

          {/* left field: flat, dead colour — the panel composites to useless grey */}
          <div style={{ position: "relative", flex: 1, minWidth: 0, background: flat,
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <span style={{ position: "absolute", top: 14, left: 16, fontSize: 12.5, color: "rgba(255,255,255,.82)" }}>
              Flat colour
            </span>
            <ReaderPanel real={false} />
          </div>

          {/* right field: the live article — soft ghosts of the type read as depth */}
          <div style={{ position: "relative", flex: 1, minWidth: 0, background: sheet,
            borderLeft: `1px solid ${line}`, overflow: "hidden" }}>
            <div aria-hidden="true" style={{ position: "absolute", inset: 0,
              padding: "clamp(16px,2.4vh,26px) clamp(20px,2.4vw,34px)", overflow: "hidden" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: accent, marginBottom: 5, letterSpacing: ".01em" }}>The optics desk</div>
              <h2 style={{ margin: "0 0 3px", fontWeight: 600, fontSize: "clamp(19px,1.8vw,25px)", letterSpacing: "-.012em", lineHeight: 1.05 }}>
                On seeing through things
              </h2>
              <p style={{ margin: "0 0 clamp(10px,1.4vh,16px)", fontSize: 12.5, color: muted }}>
                By the editors · Antidote Review
              </p>
              <div className="glg-col" style={{ fontSize: "clamp(13.5px,1.05vw,15px)", lineHeight: 1.42, color: "#12151B" }}>
                {body_gl.map((t, i) => <p key={i}>{t}</p>)}
              </div>
            </div>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ReaderPanel real={true} />
            </div>
          </div>
        </div>

        {/* the proof, read out beneath each field */}
        <div style={{ flex: "0 0 auto", display: "flex", borderTop: `1px solid ${line}`, background: sheet }}>
          <div style={{ flex: 1, minWidth: 0, padding: "clamp(9px,1.2vh,13px) clamp(16px,1.8vw,22px)", fontSize: 12.5, color: muted }}>
            The same panel over flat colour. Nothing behind it to reveal.
          </div>
          <div style={{ flex: 1, minWidth: 0, padding: "clamp(9px,1.2vh,13px) clamp(16px,1.8vw,22px)",
            borderLeft: `1px solid ${line}`, display: "flex", alignItems: "center", gap: 9,
            fontSize: 12.5, fontWeight: 600, color: ink }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: accent, flex: "0 0 auto" }} />
            The same panel over live text. Soft ghosts read as depth.
          </div>
        </div>
      </div>

      {/* ── footer caption (flat, no frost) ── */}
      <div style={{ flex: "0 0 auto", marginTop: "clamp(10px,1.8vh,16px)", fontSize: 12.5, color: muted }}>
        One backdrop-blur, floated over two backdrops. Only the layer behind it changes.
      </div>
    </div>
  );
}

window.PageGlass = PageGlass;
