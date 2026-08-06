/* Layer 0 — first-order slop. Total gradient/glass/pill. "Tired of AI slop?" + liberate. */
const { useState: useStateSlop } = React;

const slopViolet = "#6366f1", slopIndigo = "#4f46e5";

function SlopMarquee({ reverse, speed, items }) {
  return (
    <div style={{ overflow: "hidden", whiteSpace: "nowrap", maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)" }}>
      <div style={{ display: "inline-flex", gap: 14, paddingRight: 14, animation: `${reverse ? "marqueeRev" : "marquee"} ${speed}s linear infinite` }}>
        {[...items, ...items].map((f, i) => (
          <span key={i} style={{ fontFamily: f.css, fontSize: 24, color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9999, padding: "5px 16px", background: "rgba(255,255,255,.04)", flex: "0 0 auto" }}>{f.name}</span>
        ))}
      </div>
    </div>
  );
}

function SlopLayer({ onLiberate, onSkip }) {
  const fonts = window.SLOP.SLOP_FONTS;
  const half = Math.ceil(fonts.length / 2);
  const gradText = {
    background: "linear-gradient(110deg,#ff397d,#a775eb 45%,#22d3ee)",
    WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", color: "#fff", fontFamily: "'Inter', sans-serif", background: "radial-gradient(1200px 620px at 50% -8%, #1e1d4d 0%, #0f172a 56%), #0f172a", position: "relative", display: "flex", flexDirection: "column" }}>
      {/* glass nav */}
      <nav style={{ flex: "0 0 auto", position: "relative", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 40px", background: "rgba(15,23,42,.5)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 18 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: "#c8175a" }}>
            <span style={{ width: 11, height: 11, borderRadius: 2, background: "#fff" }} />
          </span>
          fixmyslop
        </div>
        <div style={{ display: "flex", gap: 22, alignItems: "center", fontSize: 14, color: "rgba(255,255,255,.7)" }}>
          <span>Features</span><span>Pricing</span><span>Docs</span>
          <span onClick={onSkip} style={{ cursor: "pointer", color: "rgba(255,255,255,.92)", borderBottom: "1px solid rgba(255,255,255,.35)", paddingBottom: 1 }}>Skip intro →</span>
          <button style={{ background: `linear-gradient(135deg,${slopIndigo},#a775eb)`, color: "#fff", borderRadius: 9999, padding: "9px 20px", fontWeight: 600, boxShadow: "0 8px 24px -6px rgba(99,102,241,.7)" }}>Get started →</button>
        </div>
      </nav>

      {/* font wall behind — framing the hero, top and bottom */}
      <div style={{ position: "absolute", top: 62, left: 0, right: 0, bottom: 0, zIndex: 1, opacity: .3, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "clamp(16px,5vh,60px) 0", pointerEvents: "none" }}>
        <SlopMarquee items={fonts.slice(0, half)} speed={36} />
        <SlopMarquee items={fonts.slice(half)} speed={44} reverse />
      </div>

      {/* hero + liberate, one centered stack that always fits */}
      <div style={{ flex: "1 1 auto", minHeight: 0, position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "clamp(10px,2.2vh,22px)", padding: "clamp(10px,2vh,24px) 24px" }}>
        <div className="slop-pulse" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#c7d2fe", border: "1px solid rgba(167,139,250,.4)", borderRadius: 9999, padding: "7px 16px", background: "rgba(99,102,241,.12)" }}>✨ AI-powered · now in beta</div>
        <h1 style={{ fontSize: "clamp(34px, min(6.2vw,8.4vh), 82px)", lineHeight: 1.0, fontWeight: 800, letterSpacing: "-.03em", margin: 0 }}>
          Tired of <span style={gradText}>AI slop?</span><br />
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontStyle: "italic" }}>It's just the Tailwind defaults.</span>
        </h1>
        <p style={{ fontSize: "clamp(14px,1.4vw,18px)", lineHeight: 1.55, color: "rgba(255,255,255,.68)", maxWidth: 560, margin: 0 }}>
          The indigo gradient. The glass nav. The pill buttons. Inter for everything.
          You've seen this site a thousand times.
        </p>
      </div>

      {/* liberate — bottom-anchored so it lines up with Layer 1's circle (continuous click target) */}
      <div style={{ flex: "0 0 auto", position: "relative", zIndex: 10, display: "grid", placeItems: "center", padding: "0 24px clamp(16px,3vh,40px)" }}>
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <span className="pulse-ring" style={{ position: "absolute", width: 208, height: 208, borderRadius: "50%", border: "2px solid rgba(255,255,255,.5)", pointerEvents: "none" }} />
          <LiberateButton label="press here to get liberated" center="Liberate" sub="break the defaults"
            onPress={onLiberate} ring="#0f172a" fill="#fff" fg="#0f172a" />
        </div>
      </div>
    </div>
  );
}

window.SlopLayer = SlopLayer;
