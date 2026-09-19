/* Page · Surfaces — faked depth, two ways. Glass and neumorphism both pretend a
   surface is a material. Each panel shows the honest version and marks what the
   slop does. Gradient moved to the Color page; this is only the material effects. */
const { useState: useStateSu } = React;

const C_su = {
  ink: "#14181C", paper: "#EEF0F1", card: "#FBFCFC",
  sub: "#616870", faint: "#9AA0A6", line: "#D7DBDD",
  cyan: "#0A7A85", danger: "#B23A2B",
};
const FD_su = "'Unbounded', sans-serif";
const FB_su = "'Hanken Grotesk', sans-serif";
const FM_su = "'Martian Mono', monospace";

function PageSurfaces({ onBack }) {
  const eyebrow = { fontFamily: FM_su, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: C_su.faint };
  const tag = (bad) => ({ fontFamily: FM_su, fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: bad ? C_su.danger : C_su.cyan, marginBottom: 8 });
  const why = { fontFamily: "'Instrument Serif', serif", fontSize: "clamp(14px,1.25vw,18px)", lineHeight: 1.3, color: C_su.ink };

  const css = `
    .supg-root, .supg-root *{ box-sizing:border-box; }
    .supg-col{ animation: su-rise .55s cubic-bezier(.22,1,.36,1) both; }
    .supg-col.d2{ animation-delay:.09s; }
    @keyframes su-rise{ from{ opacity:0; transform:translateY(12px);} to{ opacity:1; transform:none; } }
    .supg-neu{ background:${C_su.paper}; box-shadow:6px 6px 13px #cbced0, -6px -6px 13px #ffffff; color:#9aa0a6; border:none; }
    .supg-real{ background:${C_su.ink}; color:${C_su.card}; border:1.5px solid ${C_su.ink}; }
    @media (prefers-reduced-motion: reduce){ .supg-col{ animation:none; } }
    @media (max-width:900px){ .supg-grid{ grid-template-columns:1fr !important; overflow:auto !important; } }
  `;

  return (
    <div className="supg-root" style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box",
      background: C_su.paper, color: C_su.ink, fontFamily: FB_su, padding: "22px clamp(22px,3.6vw,46px)", display: "flex", flexDirection: "column" }}>
      <style>{css}</style>

      {/* header */}
      <div style={{ flex: "0 0 auto", height: 42, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackTab theme={{ ink: C_su.ink, line: C_su.line, mono: FM_su }} onClick={onBack} />
        <span style={eyebrow}>Antidote · Surfaces</span>
      </div>

      {/* thesis */}
      <div style={{ flex: "0 0 auto", marginTop: "clamp(8px,1.6vh,18px)", maxWidth: 860 }}>
        <h1 style={{ margin: 0, fontFamily: FD_su, fontWeight: 800, fontSize: "clamp(30px,4vw,54px)", lineHeight: 1.0, letterSpacing: "-.01em" }}>
          Faked depth, <span style={{ color: C_su.cyan }}>two ways.</span>
        </h1>
        <p style={{ margin: "clamp(6px,1.2vh,12px) 0 0", fontSize: "clamp(13px,1.05vw,15px)", lineHeight: 1.5, color: C_su.sub, maxWidth: 640 }}>
          Glass and neumorphism both dress a surface up as a material. Each is fine with a reason and dead without one.
        </p>
      </div>

      {/* two panels */}
      <div className="supg-grid" style={{ flex: "1 1 auto", minHeight: 0, marginTop: "clamp(14px,2.2vh,24px)",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(18px,2vw,30px)" }}>

        {/* ---- GLASS ---- */}
        <div className="supg-col" style={{ minWidth: 0, display: "flex", flexDirection: "column",
          border: `1px solid ${C_su.line}`, borderRadius: 12, background: C_su.card, padding: "clamp(16px,1.6vw,24px)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: FM_su, fontSize: 11, color: C_su.cyan, fontWeight: 600 }}>01</span>
            <span style={{ fontFamily: FD_su, fontWeight: 700, fontSize: "clamp(18px,1.7vw,24px)", letterSpacing: "-.01em" }}>Glass</span>
          </div>

          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14, padding: "clamp(10px,1.6vh,18px) 0" }}>
            {/* the honest version: frost over live text = depth */}
            <div>
              <div style={tag(false)}>with a view</div>
              <div style={{ position: "relative", height: "clamp(120px,20vh,180px)", borderRadius: 10, overflow: "hidden", border: `1px solid ${C_su.line}`, background: C_su.card }}>
                <div aria-hidden style={{ position: "absolute", inset: 0, padding: 12, fontSize: 9.5, lineHeight: 1.5, color: "#2a2f35", columnCount: 2, columnGap: 16 }}>
                  Frosted glass is a relationship between two layers, the pane in front and whatever sits behind it. The blur lowers the contrast of the page underneath without erasing it, so a panel can float and the words stay present, a depth you feel a moment before you read.
                </div>
                <div style={{ position: "absolute", inset: "18px", borderRadius: 10,
                  background: "rgba(251,252,252,.34)", border: "1px solid rgba(255,255,255,.72)",
                  backdropFilter: "blur(14px) saturate(170%)", WebkitBackdropFilter: "blur(14px) saturate(170%)",
                  boxShadow: "0 30px 60px -30px rgba(17,22,38,.5), inset 0 1.5px 0 rgba(255,255,255,1)" }} />
              </div>
            </div>
            <div style={{ fontFamily: FM_su, fontSize: 10, color: C_su.faint }}>
              <span style={{ color: C_su.danger }}>the slop</span> floats the same panel over a flat fill, where the frost has nothing to reveal and composites to grey.
            </div>
          </div>

          <div style={{ flex: "0 0 auto", borderTop: `1px solid ${C_su.line}`, paddingTop: 12, ...why }}>
            Frost earns its blur only over something worth seeing through.
          </div>
        </div>

        {/* ---- NEUMORPHISM ---- */}
        <div className="supg-col d2" style={{ minWidth: 0, display: "flex", flexDirection: "column",
          border: `1px solid ${C_su.line}`, borderRadius: 12, background: C_su.card, padding: "clamp(16px,1.6vw,24px)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: FM_su, fontSize: 11, color: C_su.cyan, fontWeight: 600 }}>02</span>
            <span style={{ fontFamily: FD_su, fontWeight: 700, fontSize: "clamp(18px,1.7vw,24px)", letterSpacing: "-.01em" }}>Neumorphism</span>
          </div>

          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 18, padding: "clamp(10px,1.6vh,18px) 0" }}>
            {/* the tell: soft extruded, no edge */}
            <div>
              <div style={tag(true)}>the tell · soft extrusion</div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <button className="supg-neu" style={{ fontFamily: FB_su, fontWeight: 700, fontSize: 14, borderRadius: 14, padding: "14px 22px", cursor: "default" }}>Save</button>
                <button className="supg-neu" style={{ width: 46, height: 46, borderRadius: "50%", cursor: "default" }} aria-hidden />
                <span style={{ fontFamily: FM_su, fontSize: 10, color: C_su.faint }}>no real edge · contrast lost</span>
              </div>
            </div>
            {/* the fix: a flat honest control */}
            <div>
              <div style={tag(false)}>the fix · a real edge</div>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <button className="supg-real" style={{ fontFamily: FB_su, fontWeight: 700, fontSize: 14, borderRadius: 8, padding: "12px 20px", cursor: "default" }}>Save</button>
                <span style={{ fontFamily: FM_su, fontSize: 10, color: C_su.sub }}>AA contrast · one clear edge</span>
              </div>
            </div>
          </div>

          <div style={{ flex: "0 0 auto", borderTop: `1px solid ${C_su.line}`, paddingTop: 12, ...why }}>
            A control needs a real edge. Fake extrusion trades contrast for a mood.
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageSurfaces = PageSurfaces;
