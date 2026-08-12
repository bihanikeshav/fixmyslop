/* Page · Type - an annotated foundry specimen on grey stock. The page shows its
   own technicals: a metric-ruled "Ag" (cap / x-height / baseline / descender),
   a Newsreader type scale in real px, a Big Shoulders weight ladder, a Gambetta
   character set, and set-specs called out in mono. The two-voice thesis stays:
   a display face SHOUTS, a text face speaks. Fits one viewport, no scroll. */
function PageType({ onBack }) {
  const paper = "#E4E6E3", ink = "#141310", spot = "#C8175A", grey = "#6C6A64";
  const hair = "rgba(20,19,16,.16)";
  const mono = "'Martian Mono', monospace", display = "'Big Shoulders Display', sans-serif", text = "'Newsreader', serif", speak = "'Gambetta', serif";

  const eyebrow = { fontFamily: mono, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase" };
  const caption = { fontFamily: mono, fontSize: 11, letterSpacing: ".02em" };
  const tick = { fontFamily: mono, fontSize: 9.5, letterSpacing: ".08em", textTransform: "uppercase" };

  // metric guides on the big Ag, positioned as a fraction of the glyph box height
  const agH = 172;
  const guides = [
    ["cap height", .14], ["x-height", .47], ["baseline", .82], ["descender", .97],
  ];
  // Newsreader type scale - real px, each line set at its size
  const scale = [[48, "Display"], [28, "Subhead"], [20, "Lead"], [16, "Body"], [14, "Body"], [12, "Caption"]];
  // Big Shoulders weight ladder - each weight carries a word whose volume matches it,
  // set in that weight, so the ladder teaches which weight to reach for.
  // [weight, name, word, px, job]
  const weights = [
    [600, "Book", "whisper", 26, "captions & fine print"],
    [800, "Bold", "Speak", 37, "UI labels & subheads"],
    [900, "Black", "SHOUT", 48, "headlines & the shout"],
  ];
  const specs = ["Newsreader · 18 / 1.6", "Big Shoulders · 900 · -2% tracking", "Gambetta · 500 · upright", "Martian Mono · 11 · labels"];

  const colHead = (label, face) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingBottom: 8, marginBottom: 12, borderBottom: `1px solid ${hair}` }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, background: spot, display: "inline-block" }} aria-hidden="true" />
        <span style={{ ...eyebrow, color: ink }}>{label}</span>
      </span>
      <span style={{ ...tick, color: grey }}>{face}</span>
    </div>
  );

  return (
    <div className="typg-scope" style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", background: paper, color: ink, fontFamily: text, display: "flex", flexDirection: "column" }}>
      <style>{`
        .typg-scope, .typg-scope * { box-sizing: border-box; }
        .typg-scope :focus-visible { outline: 2.5px solid ${spot}; outline-offset: 3px; }
        .typg-spec { transition: transform .28s cubic-bezier(.2,.7,.2,1); }
        .typg-spec:hover { transform: translateY(-3px); }
        @media (prefers-reduced-motion: reduce) { .typg-scope * { transition: none !important; } }
      `}</style>

      {/* masthead - a spot-ink registration chip labels the specimen; no rules */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: "16px clamp(18px,4vw,40px)" }}>
        <BackTab theme={{ ink, line: ink, mono }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 12, height: 12, background: spot, display: "inline-block" }} aria-hidden="true" />
          <span style={{ ...eyebrow, color: ink }}>Specimen № 2 · two voices · 3 faces</span>
        </div>
      </div>

      {/* main - vertically centred; hero band over a three-column specimen strip */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: "clamp(20px,3.2vh,32px)", padding: "8px clamp(18px,4vw,40px) clamp(20px,3vh,32px)", width: "100%", maxWidth: 1240, margin: "0 auto" }}>

        {/* HERO - metric-ruled Ag beside the two-voice thesis */}
        <div style={{ display: "grid", gridTemplateColumns: "clamp(300px,26vw,352px) 1fr", gap: "clamp(24px,3vw,44px)", alignItems: "stretch" }}>

          {/* the metric diagram - display face, guide-ruled like a foundry drawing */}
          <div className="typg-spec" style={{ background: spot, color: paper, padding: "16px 20px 18px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
              <span style={{ ...eyebrow, color: paper }}>Display · metrics</span>
              <span style={{ ...tick, color: "rgba(228,230,227,.72)" }}>em {agH}</span>
            </div>
            <div style={{ position: "relative", height: agH, marginTop: 4 }}>
              {guides.map(([label, f]) => (
                <div key={label} style={{ position: "absolute", left: 0, right: 0, top: Math.round(agH * f), height: 1, background: "rgba(228,230,227,.5)" }}>
                  <span style={{ position: "absolute", right: 0, top: -13, ...tick, color: "rgba(228,230,227,.86)", background: spot, padding: "0 4px" }}>{label}</span>
                </div>
              ))}
              <div style={{ position: "absolute", left: -2, top: 0, fontFamily: display, fontWeight: 900, fontSize: agH, lineHeight: 1, letterSpacing: "-.03em" }}>Ag</div>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: paper }}>Big Shoulders</span>
              <span style={{ ...caption, color: "rgba(228,230,227,.74)" }}>condensed · 900</span>
            </div>
          </div>

          {/* the thesis - same words, the face assigns the job */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
            <div style={{ ...caption, color: grey }}>Same words. The face assigns the job.</div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 .26em", fontFamily: display, fontWeight: 900, fontSize: "clamp(38px, min(4.6vw,7.4vh), 62px)", lineHeight: .96, letterSpacing: "-.02em", textTransform: "uppercase" }}>
              <span>A headline</span>
              <span style={{ background: spot, color: paper, padding: "0 .18em", display: "inline-block", lineHeight: 1.02 }}>shouts;</span>
            </div>
            <div style={{ ...tick, color: grey }}>Big Shoulders · 900 · -2% tracking</div>
            <div style={{ fontFamily: speak, fontWeight: 500, fontSize: "clamp(26px, min(3.6vw,5.4vh), 42px)", lineHeight: 1.14, letterSpacing: "-.005em", marginTop: 8 }}>a paragraph <span style={{ color: spot }}>speaks.</span></div>
            <div style={{ ...tick, color: grey }}>Gambetta · 500 · upright</div>
          </div>
        </div>

        {/* SPECIMEN STRIP - scale, weight, character set + specs */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr 1fr", gap: "clamp(24px,3vw,40px)" }}>

          {/* type scale - Newsreader, each line set at its real px */}
          <div className="typg-spec">
            {colHead("Type scale", "Newsreader")}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {scale.map(([px, role]) => (
                <div key={px} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <span style={{ ...tick, color: grey, width: 26, flex: "0 0 auto", textAlign: "right" }}>{px}</span>
                  <span style={{ fontFamily: text, fontWeight: 400, fontSize: px, lineHeight: 1, letterSpacing: "-.01em", flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>Handgloves</span>
                  <span style={{ ...tick, color: grey, flex: "0 0 auto" }}>{role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* weight ladder - each weight speaks at its own volume; the word teaches the job */}
          <div className="typg-spec">
            {colHead("Weight", "Big Shoulders")}
            <div style={{ ...caption, color: grey, marginTop: -6, marginBottom: 12 }}>Heavier weight, louder voice.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {weights.map(([w, name, word, px, job]) => (
                <div key={w} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <span style={{ ...tick, color: grey, width: 26, flex: "0 0 auto", textAlign: "right" }}>{w}</span>
                    <span style={{ fontFamily: display, fontWeight: w, fontSize: px, lineHeight: .95, letterSpacing: "-.02em", flex: 1 }}>{word}</span>
                    <span style={{ ...tick, color: grey, flex: "0 0 auto" }}>{name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <span aria-hidden="true" style={{ width: 26, flex: "0 0 auto" }} />
                    <span style={{ ...caption, color: grey }}>{job}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* character set (Gambetta) + set specs */}
          <div className="typg-spec">
            {colHead("Character set", "Gambetta")}
            <div style={{ fontFamily: speak, fontWeight: 400, fontSize: 21, lineHeight: 1.32, letterSpacing: ".01em" }}>
              Aa Bb Cc Dd Ee Ff Gg<br />0123456789 &amp; ? !
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${hair}` }}>
              {specs.map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 5, height: 5, background: spot, display: "inline-block", flex: "0 0 auto" }} aria-hidden="true" />
                  <span style={{ ...caption, color: grey }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageType = PageType;
