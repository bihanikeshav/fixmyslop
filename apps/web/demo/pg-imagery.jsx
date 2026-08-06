/* Page · Imagery — "Two images, generated from tokens." No slop comparison.
   Two side-by-side purposeful hero images, each BUILT from a distinct token set
   our design MCP produced, and each LABELLED with the tokens that made it
   (font + palette). A: specialty-coffee roaster (Gambetta, warm clay) with a
   roast-level scale. B: trail guide (Big Shoulders, forest green) with an SVG
   elevation profile. The page now loads with a crafted, orchestrated animation:
   the elevation line draws itself and its markers pop; the roast scale fills
   segment by segment and its "this lot" marker slides into place; frames rise
   with a short stagger; token strips settle in last. Page chrome accent is a
   single ochre #B08D3C. All motion is gated by prefers-reduced-motion.
   Token: im */

const FDA_im = "'Gambetta', serif";
const FDB_im = "'Big Shoulders Display', sans-serif";
const FBA_im = "'Hanken Grotesk', sans-serif";
const FBB_im = "'Public Sans', sans-serif";
const FM_im = "'Martian Mono', monospace";

const OCH_im = "#B08D3C"; // the page's single signal accent

// image A — roaster tokens (from our MCP)
const A_im = { ground: "#EDE7DA", ink: "#211A13", accent: "#B54A28" };
// image B — trail tokens (from our MCP)
const B_im = { ground: "#ECE7DD", ink: "#1E2620", accent: "#3F6B4C" };

// image A graphic: a roast-level scale. light -> dark, with this coffee marked.
const ROAST_im = [0, 1, 2, 3, 4, 5];
const ROASTAT_im = 3; // "this lot" sits at index 3 (medium)

// image B graphic: an elevation profile. trailhead -> summit -> descent.
const PROF_im = "M0,150 L40,142 L78,126 L112,104 L150,110 L188,72 L224,40 L262,74 L300,104 L340,126 L400,140";
const FILLB_im = PROF_im + " L400,180 L0,180 Z";

function PageImagery({ onBack }) {
  const css = `
    .impg-root, .impg-root *{ box-sizing:border-box; }
    .impg-root{ height:100vh; overflow:hidden; background:#F3EFE7; color:#211A13;
      font-family:${FBA_im}; padding:20px clamp(22px,4vw,44px) 20px; display:flex; flex-direction:column; }

    .im-frame{ position:relative; flex:1 1 auto; min-height:0; overflow:hidden;
      display:flex; flex-direction:column; justify-content:flex-end; padding:clamp(18px,2.4vw,32px);
      transition:transform .4s cubic-bezier(.22,1,.36,1); }
    .im-frame:hover{ transform:translateY(-3px); }

    .im-strip{ flex:0 0 auto; margin-top:10px; display:flex; flex-wrap:wrap; align-items:center;
      gap:4px 12px; font-family:${FM_im}; font-size:10.5px; letter-spacing:.01em;
      opacity:0; animation:im-fade .6s cubic-bezier(.22,1,.36,1) both; }
    .im-strip.a{ animation-delay:1.42s; }
    .im-strip.b{ animation-delay:1.52s; }
    .im-strip .sw{ width:9px; height:9px; flex:0 0 auto; display:inline-block; }
    .im-strip .k{ color:#9A927E; }

    .im-cta{ align-self:flex-start; margin-top:14px; cursor:default; font-family:${FM_im};
      font-weight:500; font-size:11.5px; letter-spacing:.02em; padding:9px 15px; border:none; }

    /* frames rise/settle, short stagger */
    .im-col{ opacity:0; transform:translateY(14px);
      animation:im-in .6s cubic-bezier(.22,1,.36,1) both; }
    .im-col.a{ animation-delay:.05s; }
    .im-col.b{ animation-delay:.15s; }
    @keyframes im-in{ to{ opacity:1; transform:none; } }
    @keyframes im-fade{ to{ opacity:1; } }

    /* A · roast scale fills left-to-right, then marker slides in */
    .im-roast{ position:relative; }
    .im-roastbar{ display:flex; gap:6px; align-items:center; }
    .im-seg{ flex:1; height:10px; border-radius:2px; transform:scaleX(0); transform-origin:left center;
      animation:im-fill .5s cubic-bezier(.22,1,.36,1) both; }
    @keyframes im-fill{ to{ transform:scaleX(1); } }
    .im-roastmark{ position:absolute; top:14px; display:flex; flex-direction:column; align-items:center;
      transform:translateX(-50%); animation:im-slide .7s cubic-bezier(.22,1,.36,1) both; animation-delay:1.06s; }
    @keyframes im-slide{
      from{ transform:translateX(calc(-50% - 150px)); opacity:0; }
      to{ transform:translateX(-50%); opacity:1; } }
    .im-roastmark .tri{ width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent;
      border-bottom:5px solid ${A_im.accent}; transition:transform .35s cubic-bezier(.22,1,.36,1); }
    .im-roastmark .lbl{ margin-top:3px; font-family:${FM_im}; font-size:9px; color:${A_im.accent}; white-space:nowrap;
      transition:transform .35s cubic-bezier(.22,1,.36,1); }
    .im-frame:hover .im-roastmark .tri, .im-frame:hover .im-roastmark .lbl{ transform:translateY(-2px); }
    .im-roastlabels{ display:flex; justify-content:space-between; margin-top:26px;
      font-family:${FM_im}; font-size:9px; color:#9A927E; }

    /* B · elevation line draws, fill fades, markers pop */
    .im-line{ stroke-dasharray:100; stroke-dashoffset:100;
      animation:im-draw 1.1s cubic-bezier(.22,1,.36,1) both; animation-delay:.42s; }
    @keyframes im-draw{ to{ stroke-dashoffset:0; } }
    .im-area{ fill-opacity:0; animation:im-area 1s ease-out both; animation-delay:.9s; }
    @keyframes im-area{ to{ fill-opacity:.14; } }
    .im-mark{ transform-box:fill-box; transform-origin:center; transform:scale(0); opacity:0;
      animation:im-pop .5s cubic-bezier(.22,1,.36,1) both; }
    @keyframes im-pop{ to{ transform:scale(1); opacity:1; } }
    .im-mark.trailhead{ animation-delay:.6s; }
    .im-mark.summit{ animation-delay:1.18s; }
    .im-mark.junction{ animation-delay:1.42s; }
    .im-callout{ opacity:0; animation:im-fade .5s cubic-bezier(.22,1,.36,1) both; }
    .im-callout.summit{ animation-delay:1.26s; }
    .im-callout.trailhead{ animation-delay:.66s; }

    @media (prefers-reduced-motion: reduce){
      .im-col, .im-strip, .im-seg, .im-roastmark, .im-line, .im-area, .im-mark, .im-callout{
        animation:none !important; }
      .im-col, .im-strip, .im-callout{ opacity:1 !important; transform:none !important; }
      .im-seg{ transform:scaleX(1) !important; }
      .im-roastmark{ transform:translateX(-50%) !important; opacity:1 !important; }
      .im-line{ stroke-dashoffset:0 !important; }
      .im-area{ fill-opacity:.14 !important; }
      .im-mark{ transform:scale(1) !important; opacity:1 !important; }
      .im-frame:hover{ transform:none; }
    }
    @media (max-width:1120px){ .im-grid{ gap:16px !important; } .im-frame{ min-height:210px; } }
  `;

  const eyebrow = (txt, color) => (
    <span style={{ fontFamily: FM_im, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color }}>{txt}</span>
  );

  return (
    <div className="impg-root">
      <style>{css}</style>

      {/* header */}
      <div style={{ flex: "0 0 auto", height: 40, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackTab theme={{ ink: "#211A13", line: "rgba(33,26,19,.28)", mono: FM_im, radius: 6 }} onClick={onBack} />
        {eyebrow("Antidote / Imagery", OCH_im)}
      </div>

      {/* one-line header */}
      <div style={{ flex: "0 0 auto", margin: "clamp(8px,1.6vh,16px) 0 clamp(10px,1.6vh,16px)" }}>
        <div style={{ fontFamily: FBA_im, fontWeight: 700, fontSize: "clamp(17px,1.7vw,23px)", color: "#211A13", letterSpacing: "-.01em" }}>
          Imagery, generated from tokens. <span style={{ color: OCH_im }}>Not filler.</span>
        </div>
      </div>

      {/* two images */}
      <div className="im-grid" style={{ flex: "1 1 auto", minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>

        {/* IMAGE A · specialty-coffee roaster */}
        <div className="im-col a" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            {eyebrow("Image A / roaster", A_im.accent)}
            {eyebrow("built from tokens", "#9A927E")}
          </div>

          <div className="im-frame" style={{ background: A_im.ground, border: "1px solid " + A_im.ink }}>
            {/* the purposeful mark: a roast-level scale carrying this coffee's roast */}
            <div style={{ position: "absolute", top: "clamp(18px,2.4vw,32px)", left: "clamp(18px,2.4vw,32px)", right: "clamp(18px,2.4vw,32px)" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
                {eyebrow("Origin / Huila, Colombia", A_im.ink)}
                <span style={{ fontFamily: FM_im, fontSize: 9.5, color: A_im.accent }}>1,750 m</span>
              </div>

              {/* roast scale: 6 segments fill light->dark; sliding marker names this lot */}
              <div className="im-roast">
                <div className="im-roastbar">
                  {ROAST_im.map((i) => {
                    const t = i / 5;
                    const shade = `rgba(33,26,19,${(0.16 + t * 0.72).toFixed(2)})`;
                    return <span key={i} className="im-seg" style={{ background: shade, animationDelay: (0.5 + i * 0.08).toFixed(2) + "s" }} />;
                  })}
                </div>
                <div className="im-roastmark" style={{ left: (((ROASTAT_im + 0.5) / ROAST_im.length) * 100).toFixed(2) + "%" }}>
                  <span className="tri" />
                  <span className="lbl">this lot</span>
                </div>
                <div className="im-roastlabels">
                  <span>light</span><span style={{ color: A_im.accent }}>medium</span><span>dark</span>
                </div>
              </div>
            </div>

            {/* real copy naming the coffee */}
            <div style={{ position: "relative" }}>
              {eyebrow("Single origin", A_im.accent)}
              <div style={{ fontFamily: FDA_im, fontWeight: 600, fontSize: "clamp(30px,3.4vw,50px)", lineHeight: .95, letterSpacing: "-.01em", marginTop: 4, color: A_im.ink }}>
                Acevedo Washed
              </div>
              <div style={{ fontFamily: FBA_im, fontSize: "clamp(12px,1.2vw,15px)", color: A_im.ink, opacity: .8, marginTop: 8, maxWidth: 320 }}>
                Red plum, cane sugar, a clean cocoa finish. Roasted in small batches on Thursdays.
              </div>
              <button className="im-cta" style={{ background: A_im.ink, color: A_im.ground }}>
                12 oz whole bean · <span style={{ color: A_im.accent }}>ships Friday</span>
              </button>
            </div>
          </div>

          {/* token strip A */}
          <div className="im-strip a">
            <span className="k">font</span>
            <span style={{ fontFamily: FDA_im, fontSize: 13 }}>Gambetta</span>
            <span style={{ color: A_im.accent }}>fresh</span>
            <span style={{ width: 1, height: 12, background: "rgba(33,26,19,.22)" }} />
            <span className="k">palette</span>
            <span className="sw" style={{ background: A_im.ground, outline: "1px solid rgba(33,26,19,.28)" }} />
            <span className="sw" style={{ background: A_im.ink }} />
            <span className="sw" style={{ background: A_im.accent }} />
            <span style={{ color: A_im.ink }}>#EDE7DA / #211A13 / #B54A28</span>
            <span style={{ color: A_im.accent }}>SAFE · 13.95 AAA</span>
          </div>
        </div>

        {/* IMAGE B · trail / outdoors guide */}
        <div className="im-col b" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            {eyebrow("Image B / trail guide", B_im.accent)}
            {eyebrow("built from tokens", "#9A927E")}
          </div>

          <div className="im-frame" style={{ background: B_im.ground, border: "1px solid " + B_im.ink }}>
            {/* the purposeful graphic: an elevation profile that draws itself in */}
            <svg viewBox="0 0 400 180" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              {[45, 90, 135].map((y) => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(30,38,32,.12)" strokeWidth="1" />)}
              <path className="im-area" d={FILLB_im} fill={B_im.accent} />
              <path className="im-line" d={PROF_im} pathLength="100" fill="none" stroke={B_im.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {/* markers pop after the line reaches them */}
              <circle className="im-mark trailhead" cx="0" cy="150" r="4" fill="none" stroke={B_im.ink} strokeWidth="1.6" />
              <circle className="im-mark summit" cx="224" cy="40" r="4.5" fill={B_im.accent} />
              <circle className="im-mark junction" cx="340" cy="126" r="3.5" fill="none" stroke={B_im.ink} strokeWidth="1.6" />
            </svg>
            {/* summit callout */}
            <div className="im-callout summit" style={{ position: "absolute", top: "12%", left: "52%", fontFamily: FM_im, fontSize: 9.5, color: B_im.ink }}>
              summit <b style={{ color: B_im.accent }}>2,110 m</b>
            </div>
            {/* trailhead callout */}
            <div className="im-callout trailhead" style={{ position: "absolute", top: "76%", left: "2%", fontFamily: FM_im, fontSize: 9.5, color: "#8A8578" }}>trailhead</div>

            {/* real copy naming the trail */}
            <div style={{ position: "relative" }}>
              {eyebrow("Day hike", B_im.accent)}
              <div style={{ fontFamily: FDB_im, fontWeight: 800, fontSize: "clamp(28px,3.4vw,48px)", lineHeight: .88, letterSpacing: "-.005em", textTransform: "uppercase", marginTop: 4, color: B_im.ink }}>
                Larch Basin Loop
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 10, fontFamily: FM_im, fontSize: "clamp(10px,1vw,12px)", color: B_im.ink }}>
                <span>11.4 km</span><span>720 m gain</span><span>open Jul to Oct</span>
              </div>
              <button className="im-cta" style={{ background: B_im.ink, color: B_im.ground }}>
                Download <span style={{ color: "#9BC3A6" }}>GPX + notes</span>
              </button>
            </div>
          </div>

          {/* token strip B */}
          <div className="im-strip b">
            <span className="k">font</span>
            <span style={{ fontFamily: FDB_im, fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: ".01em" }}>Big Shoulders</span>
            <span style={{ color: B_im.accent }}>fresh</span>
            <span style={{ width: 1, height: 12, background: "rgba(30,38,32,.22)" }} />
            <span className="k">palette</span>
            <span className="sw" style={{ background: B_im.ground, outline: "1px solid rgba(30,38,32,.28)" }} />
            <span className="sw" style={{ background: B_im.ink }} />
            <span className="sw" style={{ background: B_im.accent }} />
            <span style={{ color: B_im.ink }}>#ECE7DD / #1E2620 / #3F6B4C</span>
            <span style={{ color: B_im.accent }}>SAFE · used once</span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageImagery = PageImagery;
