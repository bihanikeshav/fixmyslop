/* Layer 1 — second-order slop. The "make it premium" escape: Playfair + gold on near-black.
   Looks tasteful. Still slop. */
function SecondOrderLayer({ onLiberate }) {
  const gold = "#C9AC72";        // refined champagne, not brassy mustard
  const goldDim = "#9E854E";
  const bone = "#F0E8D7";        // warm ivory
  const ink = "#100C0A";         // rich warm near-black
  const hair = `1px solid ${gold}40`;
  // metallic sheen for the headline word — top highlight → gold → shadow
  const goldText = { background: "linear-gradient(176deg,#F6E9BE 0%,#D8BD7E 40%,#B8954E 72%,#8E7038 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" };
  // layered depth: warm top light + soft centre halo + deep floor
  const bg = `radial-gradient(1100px 620px at 50% 8%, #1E1812 0%, transparent 60%), radial-gradient(900px 600px at 50% 64%, rgba(201,172,114,.06) 0%, transparent 55%), linear-gradient(180deg, #15110D 0%, #0C0907 100%)`;

  return (
    <div style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", background: bg, color: bone, fontFamily: "'Cormorant Garamond', serif", position: "relative", display: "flex", flexDirection: "column" }}>
      {/* luxe hairline nav */}
      <div style={{ flex: "0 0 auto", borderBottom: hair, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 0", position: "relative" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 22, letterSpacing: ".03em" }}>fixmyslop</span>
        <span style={{ position: "absolute", right: 40, fontFamily: "'Cormorant Garamond', serif", fontSize: 13, letterSpacing: ".34em", textTransform: "uppercase", color: gold }}>Maison</span>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", placeItems: "center", textAlign: "center", padding: "clamp(10px,2vh,28px) 24px" }}>
        <div style={{ maxWidth: 760 }}>
          <div style={{ fontSize: 13, letterSpacing: ".46em", textTransform: "uppercase", color: gold, marginBottom: "clamp(10px,2vh,24px)", opacity: .92 }}>Premium &middot; Elevated &middot; Curated</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: "clamp(40px, min(7vw,9vh), 88px)", lineHeight: 1.02, letterSpacing: "-.012em", margin: 0 }}>
            Now it's <span style={{ fontStyle: "italic", ...goldText }}>premium.</span>
          </h1>
          <div style={{ width: 78, height: 1, background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, margin: "clamp(14px,2.6vh,30px) auto" }} />
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(16px,1.7vw,22px)", lineHeight: 1.5, color: bone, opacity: .85, maxWidth: 540, margin: "0 auto" }}>
            High-contrast serif on near-black. A whisper of gold. Hairline rules.
            Doesn't it feel <em>expensive?</em>
          </p>

          {/* the callout — it's a trap */}
          <div style={{ margin: "clamp(16px,2.8vh,34px) auto 0", maxWidth: 600, border: `1px solid ${gold}66`, padding: "clamp(14px,2vh,20px) clamp(18px,2vw,26px)", background: "rgba(201,172,114,.05)" }}>
            <div style={{ fontFamily: "'Martian Mono', monospace", fontSize: 11, letterSpacing: ".18em", color: gold, marginBottom: 9, textTransform: "uppercase" }}>△ Second-order slop detected</div>
            <div style={{ fontFamily: "'Martian Mono', monospace", fontSize: 13.5, lineHeight: 1.6, color: bone }}>
              You escaped the gradients — straight into the #1 AI "premium" move: Playfair&nbsp;+&nbsp;gold on near-black. The escape is a template too. <span style={{ color: gold }}>Still slop.</span>
            </div>
          </div>
        </div>
      </div>

      {/* liberate again */}
      <div style={{ flex: "0 0 auto", display: "grid", placeItems: "center", padding: "0 24px clamp(16px,3vh,40px)" }}>
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          <span className="pulse-ring" style={{ position: "absolute", width: 208, height: 208, borderRadius: "50%", border: `2px solid ${gold}99`, pointerEvents: "none" }} />
          <LiberateButton label="this is still slop · liberate for real" center="Free me" sub="for real this time"
            onPress={onLiberate} ring={ink} fill={gold} fg={ink} />
        </div>
      </div>
    </div>
  );
}

window.SecondOrderLayer = SecondOrderLayer;
