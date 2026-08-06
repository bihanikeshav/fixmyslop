/* Shared chrome: wordmark, liberation button, routing circle, back tab. */
const { useMemo: useMemoC } = React;

// Compact, intentional brand lockup. theme = { ink, paper, accent, mono }
function Wordmark({ theme, tag }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
      <span style={{ width: 26, height: 26, position: "relative", flex: "0 0 auto" }}>
        <span style={{ position: "absolute", inset: 0, border: `2px solid ${theme.ink}` }} />
        <span style={{ position: "absolute", inset: 6, background: theme.accent }} />
      </span>
      <span style={{ fontFamily: theme.mono, fontWeight: 600, fontSize: 12.5, letterSpacing: ".26em", textTransform: "uppercase", color: theme.ink }}>
        Slop&#8202;\&#8202;o&#8202;\&#8202;meter
      </span>
      {tag && <span style={{ fontFamily: theme.mono, fontSize: 10.5, letterSpacing: ".18em", textTransform: "uppercase", color: theme.ink, opacity: .45, borderLeft: `1px solid ${theme.ink}33`, paddingLeft: 11 }}>{tag}</span>}
    </div>
  );
}

// The big circular liberation button — rotating ring of text + bold center.
function LiberateButton({ label, center, sub, onPress, ring, fill, fg, size = 208 }) {
  const uid = useMemoC(() => "lib" + Math.random().toString(36).slice(2, 8), []);
  const r = size / 2 - 16;
  const c = size / 2;
  const ringPath = `M ${c},${c} m -${r},0 a ${r},${r} 0 1,1 ${2 * r},0 a ${r},${r} 0 1,1 -${2 * r},0`;
  return (
    <button onClick={onPress} className="liberate-btn" style={{
      position: "relative", width: size, height: size, borderRadius: "50%",
      background: fill, color: fg, display: "grid", placeItems: "center",
      boxShadow: "0 14px 40px -10px rgba(0,0,0,.45)", transition: "transform .2s ease",
    }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", animation: "slopSpin 18s linear infinite" }} aria-hidden="true">
        <defs><path id={uid} d={ringPath} fill="none" /></defs>
        <text fill={ring} style={{ fontFamily: "'Martian Mono', monospace", fontSize: 11.5, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          <textPath href={`#${uid}`} startOffset="0">{`${label}  •  ${label}  •  `}</textPath>
        </text>
      </svg>
      <span style={{ display: "grid", placeItems: "center", textAlign: "center", lineHeight: 1 }}>
        <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 26, letterSpacing: ".01em", textTransform: "uppercase" }}>{center}</span>
        {sub && <span style={{ fontFamily: "'Martian Mono', monospace", fontSize: 9.5, letterSpacing: ".14em", opacity: .7, marginTop: 6, textTransform: "uppercase" }}>{sub}</span>}
      </span>
    </button>
  );
}

// Small routing circle that sits on a struck-through tell. Click = open the fix.
function CircleFix({ onClick, theme, size = 60 }) {
  return (
    <button className="circle-fix" onClick={onClick} style={{
      width: size, height: size, borderRadius: "50%", flex: "0 0 auto",
      border: `2px solid ${theme.ink}`, background: theme.paper, color: theme.ink,
      display: "grid", placeItems: "center", position: "relative", transition: "background .18s, color .18s, transform .18s",
    }}>
      <span style={{ fontFamily: theme.mono, fontSize: 9, letterSpacing: ".14em", position: "absolute", top: 9, textTransform: "uppercase", opacity: .6 }}>fix</span>
      <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 22, marginTop: 7 }}>&rarr;</span>
    </button>
  );
}

// Back-to-index tab, themed per page.
function BackTab({ onClick, theme, label = "Index" }) {
  return (
    <button className="back-tab" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 9, padding: "9px 16px 9px 13px",
      border: `1.5px solid ${theme.line || theme.ink}`, background: "transparent", color: theme.ink,
      fontFamily: theme.mono, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase",
      borderRadius: theme.radius || 0, transition: "background .18s, color .18s",
    }}>
      <span style={{ fontSize: 14 }}>&larr;</span>{label}
    </button>
  );
}

window.Wordmark = Wordmark;
window.LiberateButton = LiberateButton;
window.CircleFix = CircleFix;
window.BackTab = BackTab;
