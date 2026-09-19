/* Page · Considered Gradient — one gradient, three stops, used once. Everything else flat. */
function PageGradient({ onBack }) {
  const ink = "#06101A", light = "#E9F1F8";
  const grad = "linear-gradient(158deg, #06243F 0%, #1454FF 54%, #00E5D1 100%)";
  const mono = "'Martian Mono', monospace", display = "'Unbounded', sans-serif", body = "'Hanken Grotesk', sans-serif";
  const stops = [["#06243F", "0%", "12%"], ["#1454FF", "54%", "54%"], ["#00E5D1", "100%", "92%"]];

  return (
    <div style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", background: ink, color: light, fontFamily: body, display: "grid", gridTemplateColumns: "1fr 0.82fr", position: "relative" }}>
      {/* left: flat, all type */}
      <div style={{ padding: "24px 40px 40px", display: "flex", flexDirection: "column" }}>
        <div style={{ alignSelf: "flex-start" }}><BackTab theme={{ ink: light, line: "rgba(255,255,255,.28)", mono }} onClick={onBack} /></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 540 }}>
          <div style={{ fontFamily: mono, fontSize: 12, letterSpacing: ".04em", opacity: .65 }}>Antidote · gradient</div>
          <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(40px,4.6vw,72px)", lineHeight: 1.0, letterSpacing: "-.02em", margin: "16px 0 0" }}>
            One gradient.<br />Used <span style={{ color: "#00E5D1" }}>once.</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, marginTop: 24, color: "rgba(233,241,248,.82)" }}>
            The slop isn't gradients. It's the same indigo-to-violet wash poured over every heading, button and card. So we picked three deliberate stops, named them, and spent the whole budget in a single place. Nothing else on this page is gradiated.
          </p>
          <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.14)" }}>
            {stops.map(([hex, pos]) => (
              <div key={hex} style={{ background: ink, padding: "16px" }}>
                <div style={{ width: 22, height: 22, background: hex, marginBottom: 12 }} />
                <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600 }}>{hex}</div>
                <div style={{ fontFamily: mono, fontSize: 10.5, opacity: .55, marginTop: 3 }}>stop {pos}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: mono, fontSize: 11, opacity: .5, marginTop: 24, letterSpacing: ".04em" }}>158° · deep cobalt → electric → cyan · the only gradient in the room</div>
        </div>
      </div>

      {/* right: the one gradient, annotated */}
      <div style={{ position: "relative", background: grad }}>
        {stops.map(([hex, pos, top], i) => (
          <div key={i} style={{ position: "absolute", left: 0, top: top, display: "flex", alignItems: "center", gap: 0 }}>
            <span style={{ width: 64, height: 1, background: "rgba(255,255,255,.6)" }} />
            <span style={{ background: "rgba(7,16,26,.78)", color: light, fontFamily: mono, fontSize: 11, letterSpacing: ".06em", padding: "6px 11px", border: "1px solid rgba(255,255,255,.25)", whiteSpace: "nowrap" }}>{hex} · {pos}</span>
          </div>
        ))}
        <div style={{ position: "absolute", right: 24, bottom: 24, writingMode: "vertical-rl", fontFamily: mono, fontSize: 11, letterSpacing: ".02em", color: "rgba(255,255,255,.8)" }}>The subject, not the wallpaper</div>
      </div>
    </div>
  );
}

window.PageGradient = PageGradient;
