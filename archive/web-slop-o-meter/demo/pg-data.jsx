/* Page · Honest Dataviz — a chart is an argument, so label the scale and say the point. */
function PageData({ onBack }) {
  const ink = "#141A1E", paper = "#F4F1EA", accent = "#5E7C8C";
  const line = "rgba(20,26,30,.14)";
  const mono = "'Martian Mono', monospace", display = "'Big Shoulders Display', sans-serif", body = "'Public Sans', sans-serif";

  // Weekly signups. Real shape: a drop at W5 when the button moved below the fold.
  const weeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
  const vals = [820, 910, 880, 940, 730, 690, 710, 900];
  const hi = 4; // index of the point that matters (W5)

  // chart geometry (SVG user units)
  const X0 = 52, X1 = 384, Y0 = 20, Y1 = 196, YMAX = 1000;
  const px = i => X0 + (X1 - X0) * (i / (weeks.length - 1));
  const py = v => Y1 - (Y1 - Y0) * (v / YMAX);
  const ticks = [0, 250, 500, 750, 1000];
  const pts = vals.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");

  return (
    <div style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", background: paper, color: ink, fontFamily: body, display: "flex", flexDirection: "column", padding: "20px clamp(20px,3.4vw,48px) 22px" }}>
      {/* header band */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto" }}>
        <BackTab theme={{ ink, line, mono }} onClick={onBack} />
        <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", opacity: .6 }}>Antidote · dashboard</div>
      </div>

      {/* thesis hero */}
      <div style={{ flex: "0 0 auto", marginTop: "clamp(10px,1.6vh,20px)", maxWidth: 1080 }}>
        <h1 style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(34px,5vw,66px)", lineHeight: .96, letterSpacing: "-.01em", margin: 0, textTransform: "uppercase" }}>
          A chart is an <span style={{ color: accent }}>argument.</span>
        </h1>
        <p style={{ fontSize: "clamp(14px,1.15vw,17px)", lineHeight: 1.5, margin: "12px 0 0", maxWidth: 720, color: "rgba(20,26,30,.78)" }}>
          Decoration that hides the scale defeats the point. A glowing number with no axis is a mood, not a measurement. So we label the scale, ink on paper, and spend one accent to mark the thing that matters.
        </p>
      </div>

      {/* A / B */}
      <div style={{ flex: "1 1 auto", minHeight: 0, marginTop: "clamp(12px,2vh,22px)", display: "grid", gridTemplateColumns: "0.62fr 1fr", gap: "clamp(16px,2vw,32px)", alignItems: "stretch" }}>

        {/* A — the slop specimen */}
        <section style={{ position: "relative", border: `1px solid ${line}`, background: "#101418", color: "#E8ECF0", padding: "16px 18px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, background: "#ff4d6d", borderRadius: 2 }} />
            <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "#ff8fa3" }}>The tell · dashboard slop</span>
          </div>

          {/* glowing gradient KPI */}
          <div style={{ marginTop: "clamp(8px,1.4vh,16px)" }}>
            <div style={{ fontFamily: body, fontSize: 12, letterSpacing: ".04em", color: "rgba(232,236,240,.55)" }}>Growth</div>
            <div style={{
              fontFamily: display, fontWeight: 800, fontSize: "clamp(48px,6vw,86px)", lineHeight: .9, letterSpacing: "-.02em",
              background: "linear-gradient(96deg,#6366f1,#8b5cf6 46%,#22d3ee)",
              WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              filter: "drop-shadow(0 0 22px rgba(139,92,246,.55))"
            }}>+247%</div>
          </div>

          {/* rainbow sparkline, no axis */}
          <div style={{ marginTop: "auto" }}>
            <svg viewBox="0 0 320 84" preserveAspectRatio="none" style={{ width: "100%", height: "clamp(56px,9vh,88px)", display: "block" }}>
              <defs>
                <linearGradient id="da-rainbow" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="40%" stopColor="#6366f1" />
                  <stop offset="70%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <polyline points="0,64 40,58 80,66 120,40 160,52 200,22 240,34 280,10 320,18"
                fill="none" stroke="url(#da-rainbow)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 8px rgba(99,102,241,.7))" }} />
            </svg>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".04em", color: "rgba(232,236,240,.4)", marginTop: 6 }}>
              no y-axis · no units · no baseline · 247% of what?
            </div>
          </div>
        </section>

        {/* B — the honest chart */}
        <section style={{ border: `1px solid ${line}`, background: paper, padding: "16px clamp(16px,1.6vw,24px) 14px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(18px,1.7vw,24px)", letterSpacing: "-.01em", textTransform: "uppercase" }}>New signups, per week</div>
              <div style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".04em", color: "rgba(20,26,30,.55)", marginTop: 3 }}>Q3 · unique verified accounts</div>
            </div>
            <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: accent }}>The fix</span>
          </div>

          <div style={{ flex: "1 1 auto", minHeight: 0, marginTop: 10 }}>
            <svg viewBox="0 0 400 210" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
              {/* gridlines + y-axis labels */}
              {ticks.map(t => (
                <g key={t}>
                  <line x1={X0} y1={py(t)} x2={X1} y2={py(t)} stroke={line} strokeWidth="1" />
                  <text x={X0 - 8} y={py(t) + 3.5} textAnchor="end" fontFamily={mono} fontSize="9" fill="rgba(20,26,30,.6)">{t}</text>
                </g>
              ))}
              {/* axes */}
              <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="rgba(20,26,30,.4)" strokeWidth="1" />
              <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="rgba(20,26,30,.4)" strokeWidth="1" />
              {/* x-axis labels */}
              {weeks.map((w, i) => (
                <text key={w} x={px(i)} y={Y1 + 14} textAnchor="middle" fontFamily={mono} fontSize="9" fill={i === hi ? accent : "rgba(20,26,30,.6)"} fontWeight={i === hi ? 700 : 400}>{w}</text>
              ))}
              {/* the line */}
              <polyline points={pts} fill="none" stroke={ink} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {/* plain data points */}
              {vals.map((v, i) => i !== hi && (
                <circle key={i} cx={px(i)} cy={py(v)} r="2.6" fill={paper} stroke={ink} strokeWidth="1.4" />
              ))}
              {/* the highlighted point */}
              <line x1={px(hi)} y1={py(vals[hi])} x2={px(hi)} y2={Y1} stroke={accent} strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={px(hi)} cy={py(vals[hi])} r="5" fill={accent} />
              <circle cx={px(hi)} cy={py(vals[hi])} r="10" fill="none" stroke={accent} strokeWidth="1" opacity=".5" />
              {/* annotation */}
              <g>
                <line x1={px(hi) + 12} y1={py(vals[hi]) - 6} x2={px(hi) + 34} y2={py(vals[hi]) - 28} stroke={accent} strokeWidth="1" />
                <text x={px(hi) + 38} y={py(vals[hi]) - 32} fontFamily={mono} fontSize="9.5" fontWeight="700" fill={accent}>-22% at W5</text>
                <text x={px(hi) + 38} y={py(vals[hi]) - 20} fontFamily={body} fontSize="9.5" fill="rgba(20,26,30,.75)">button below the fold</text>
              </g>
              {/* y-axis title */}
              <text x="14" y="108" fontFamily={mono} fontSize="8.5" fill="rgba(20,26,30,.55)" transform="rotate(-90 14 108)" textAnchor="middle" letterSpacing="1">SIGNUPS / WEEK</text>
            </svg>
          </div>

          {/* plain-language takeaway */}
          <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${line}`, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ flex: "0 0 auto", width: 3, alignSelf: "stretch", background: accent }} />
            <p style={{ margin: 0, fontSize: "clamp(12px,1vw,14px)", lineHeight: 1.45 }}>
              <b>Signups fell 22% the week we pushed the button below the fold.</b> We moved it back on W6 and recovered by W8. One number, one scale, one reason you can act on.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

window.PageData = PageData;
