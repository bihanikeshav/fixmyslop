/* Page · Color — gradient-led. One considered gradient, three named stops, used
   once, and a small honest read-out that explains the colour: each stop in OKLCH,
   plotted so you see the gradient climb in lightness and peak in chroma. The
   numbers are real output from our own colour engine. One viewport. */
const { useState: useStateCl } = React;

const C_cl = { ink: "#06101A", deep: "#040A12", light: "#E9F1F8", mut: "rgba(233,241,248,.72)", line: "rgba(255,255,255,.14)" };
const FD_cl = "'Unbounded', sans-serif";
const FB_cl = "'Hanken Grotesk', sans-serif";
const FM_cl = "'Martian Mono', monospace";
const GRAD_cl = "linear-gradient(158deg, #06243F 0%, #1454FF 54%, #00E5D1 100%)";

// each stop, with OKLCH read from our colour engine
const STOPS_cl = [
  { hex: "#06243F", pos: "0%", L: 0.255, C: 0.062, H: 250 },
  { hex: "#1454FF", pos: "54%", L: 0.534, C: 0.259, H: 264 },
  { hex: "#00E5D1", pos: "100%", L: 0.828, C: 0.147, H: 184 },
];

// map OKLCH L (0..1) and C (0..~0.28) into the little plot box
const PLOTW_cl = 150, PLOTH_cl = 118, PX0 = 26, PX1 = 138, PY0 = 12, PY1 = 96, CMAX = 0.28;
const px_cl = (c) => PX0 + (c / CMAX) * (PX1 - PX0);
const py_cl = (l) => PY1 - l * (PY1 - PY0);

function PageColor({ onBack }) {
  const [pressed_cl, setPressed_cl] = useStateCl(false);

  const css = `
    .clpg-root, .clpg-root *{ box-sizing:border-box; }
    .clpg-in{ animation: cl-rise .5s cubic-bezier(.22,1,.36,1) both; }
    .clpg-in.d1{ animation-delay:.07s; } .clpg-in.d2{ animation-delay:.14s; } .clpg-in.d3{ animation-delay:.21s; }
    @keyframes cl-rise{ from{ opacity:0; transform:translateY(12px);} to{ opacity:1; transform:none; } }
    .clpg-grad{ animation: cl-wipe .9s cubic-bezier(.72,0,.16,1) .1s both; }
    @keyframes cl-wipe{ from{ clip-path:inset(0 0 100% 0); } to{ clip-path:inset(0 0 0% 0); } }
    .clpg-btn{ transition: transform .12s, box-shadow .16s, filter .16s; }
    .clpg-btn:hover{ transform:translateY(-1px); filter:brightness(1.05); }
    .clpg-btn:active{ transform:translateY(1px); }
    @media (prefers-reduced-motion: reduce){ .clpg-in,.clpg-grad{ animation:none; } }
    @media (max-width:900px){ .clpg-root{ grid-template-columns:1fr !important; } }
  `;

  const eyebrow = { fontFamily: FM_cl, fontSize: 12, letterSpacing: ".04em", color: C_cl.mut };

  return (
    <div className="clpg-root" style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box",
      background: C_cl.ink, color: C_cl.light, fontFamily: FB_cl, display: "grid", gridTemplateColumns: "1fr 0.82fr", position: "relative" }}>
      <style>{css}</style>

      {/* LEFT — the thesis, the stops, and the OKLCH read-out */}
      <div style={{ padding: "24px clamp(24px,3vw,42px) clamp(20px,3vh,36px)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ alignSelf: "flex-start" }}><BackTab theme={{ ink: C_cl.light, line: "rgba(255,255,255,.28)", mono: FM_cl }} onClick={onBack} /></div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 560 }}>
          <div className="clpg-in" style={eyebrow}>Antidote · Color</div>
          <h1 className="clpg-in d1" style={{ fontFamily: FD_cl, fontWeight: 800, fontSize: "clamp(38px,4.4vw,68px)", lineHeight: 1.0, letterSpacing: "-.02em", margin: "14px 0 0" }}>
            One gradient.<br />Used <span style={{ color: "#00E5D1" }}>once.</span>
          </h1>
          <p className="clpg-in d1" style={{ fontSize: "clamp(14px,1.05vw,16.5px)", lineHeight: 1.5, marginTop: 18, color: C_cl.mut, maxWidth: 460 }}>
            The slop is the same wash on every heading, button and card. So we pick three deliberate stops, name them, and spend the whole colour budget in one place.
          </p>

          {/* the three stops + the OKLCH plot, side by side */}
          <div className="clpg-in d2" style={{ marginTop: "clamp(18px,3vh,30px)", display: "grid", gridTemplateColumns: "1fr auto", gap: "clamp(20px,3vw,40px)", alignItems: "center" }}>
            {/* stop list with OKLCH numbers */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
              {STOPS_cl.map((s) => (
                <div key={s.hex} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 26, height: 26, background: s.hex, flex: "0 0 auto", border: "1px solid rgba(255,255,255,.18)" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: FM_cl, fontSize: 12, fontWeight: 600 }}>{s.hex} <span style={{ opacity: .5, fontWeight: 400 }}>· {s.pos}</span></div>
                    <div style={{ fontFamily: FM_cl, fontSize: 10.5, color: C_cl.mut, marginTop: 2 }}>L {s.L.toFixed(2)} · C {s.C.toFixed(2)} · H {s.H}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* the read-out: the gradient's path through lightness x chroma */}
            <div style={{ flex: "0 0 auto" }}>
              <svg width={PLOTW_cl} height={PLOTH_cl} viewBox={`0 0 ${PLOTW_cl} ${PLOTH_cl}`} role="img" aria-label="The three stops plotted in OKLCH lightness against chroma">
                <rect x={PX0} y={PY0} width={PX1 - PX0} height={PY1 - PY0} fill="none" stroke={C_cl.line} />
                {[0.25, 0.5, 0.75].map((f) => (
                  <line key={f} x1={PX0} x2={PX1} y1={PY1 - f * (PY1 - PY0)} y2={PY1 - f * (PY1 - PY0)} stroke={C_cl.line} strokeOpacity=".5" />
                ))}
                <path d={`M ${px_cl(STOPS_cl[0].C)} ${py_cl(STOPS_cl[0].L)} L ${px_cl(STOPS_cl[1].C)} ${py_cl(STOPS_cl[1].L)} L ${px_cl(STOPS_cl[2].C)} ${py_cl(STOPS_cl[2].L)}`}
                  fill="none" stroke="rgba(233,241,248,.45)" strokeWidth="1.5" strokeDasharray="3 3" />
                {STOPS_cl.map((s) => (
                  <circle key={s.hex} cx={px_cl(s.C)} cy={py_cl(s.L)} r="5" fill={s.hex} stroke="rgba(255,255,255,.5)" strokeWidth="1" />
                ))}
                <text x={PX0 - 4} y={PY0 + 8} fill={C_cl.mut} fontFamily={FM_cl} fontSize="8.5" textAnchor="end">L</text>
                <text x={PX1} y={PY1 + 10} fill={C_cl.mut} fontFamily={FM_cl} fontSize="8.5" textAnchor="end">C</text>
              </svg>
              <div style={{ fontFamily: FM_cl, fontSize: 9.5, color: C_cl.mut, marginTop: 4, letterSpacing: ".02em" }}>lightness × chroma · source: our colour engine</div>
            </div>
          </div>

          {/* the accent, used once, on one control — the system in use */}
          <div className="clpg-in d3" style={{ marginTop: "clamp(16px,2.6vh,26px)", display: "flex", alignItems: "center", gap: 16 }}>
            <button className="clpg-btn" onClick={() => setPressed_cl(true)}
              style={{ fontFamily: FB_cl, fontWeight: 700, fontSize: 14.5, color: C_cl.ink, background: "#00E5D1",
                border: "none", padding: "12px 22px", cursor: "pointer", boxShadow: "0 8px 22px -10px rgba(0,229,209,.7)" }}>
              {pressed_cl ? "That is the whole budget" : "One accent, one button"}
            </button>
            <span style={{ fontFamily: FM_cl, fontSize: 11, color: C_cl.mut }}>the cyan stop, spent once</span>
          </div>
        </div>
      </div>

      {/* RIGHT — the one gradient, annotated */}
      <div className="clpg-grad" style={{ position: "relative", background: GRAD_cl }}>
        {STOPS_cl.map((s, i) => {
          const top = ["12%", "54%", "88%"][i];
          return (
            <div key={s.hex} style={{ position: "absolute", left: 0, top, display: "flex", alignItems: "center" }}>
              <span style={{ width: 60, height: 1, background: "rgba(255,255,255,.6)" }} />
              <span style={{ background: "rgba(4,10,18,.78)", color: C_cl.light, fontFamily: FM_cl, fontSize: 11, letterSpacing: ".04em", padding: "6px 11px", border: "1px solid rgba(255,255,255,.25)", whiteSpace: "nowrap" }}>{s.hex} · {s.pos}</span>
            </div>
          );
        })}
        <div style={{ position: "absolute", right: 22, bottom: 22, writingMode: "vertical-rl", fontFamily: FM_cl, fontSize: 11, letterSpacing: ".02em", color: "rgba(255,255,255,.85)" }}>The subject, not the wallpaper</div>
      </div>
    </div>
  );
}

window.PageColor = PageColor;
