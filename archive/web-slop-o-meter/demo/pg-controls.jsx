/* Page · Controls — a control-blueprint specimen sheet, not a settings dialog.
   The primary is drawn large and dimensioned like a part on a spec drawing; the
   same action then steps down an emphasis ladder so you SEE the rest recede; field,
   toggle and an icon lesson are pinned as annotated specimens. Hover feedback is edge,
   colour and weight only, never a box that appears. World: sandstone drawing board
   + one teal signal. One viewport. */
const { useState: useStateCo } = React;

const FD_co = "'Nippo', sans-serif";
const FB_co = "'Public Sans', sans-serif";
const FM_co = "'Martian Mono', monospace";

const C_co = {
  ground: "#E4DDCC", board: "#EFE9DB", card: "#FBF9F3",
  ink: "#1B1E23", sub: "#6E6857", faint: "#9A927E", line: "#CFC7B3", rule: "#BEB59E",
  teal: "#0E7C6B", tealHi: "#0A5F52", tealLo: "#083F37", danger: "#B23A2B",
};

// every good icon is drawn on the same 24 grid at one stroke weight; sw is only
// bumped to DEMONSTRATE the wrong thing (two libraries) in the avoid row.
function Icon_co({ name, sw = 1.5, size = 20 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "search") return (<svg {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>);
  if (name === "bell") return (<svg {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>);
  if (name === "lock") return (<svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>);
  if (name === "user") return (<svg {...p}><circle cx="12" cy="8.5" r="3.6" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>);
  if (name === "link") return (<svg {...p}><path d="M9.5 14.5l5-5" /><path d="M8 12l-2 2a3.2 3.2 0 0 0 4.5 4.5l2-2" /><path d="M16 12l2-2a3.2 3.2 0 0 0-4.5-4.5l-2 2" /></svg>);
  if (name === "trash") return (<svg {...p}><path d="M5 7h14" /><path d="M8 7V5h8v2" /><path d="M6.5 7l.8 12h9.4l.8-12" /></svg>);
  if (name === "star") return (<svg {...p}><path d="M12 4l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L4.8 9.2l5-.6z" /></svg>);
  return null;
}

// a mono annotation with the blueprint voice
function Note_co({ children, style }) {
  return <span style={{ fontFamily: FM_co, fontSize: 10, letterSpacing: ".04em", color: C_co.sub, ...style }}>{children}</span>;
}

// the emphasis ladder — same action, five weights, visibly receding
const LADDER_co = [
  { role: "Primary", cls: "co-primary", w: 700, big: true },
  { role: "Secondary", cls: "co-secondary", w: 600 },
  { role: "Tertiary", cls: "co-tertiary", w: 600 },
  { role: "Ghost", cls: "co-ghost", w: 600 },
  { role: "Destructive", cls: "co-danger", w: 700 },
];

const GOOD_ICONS_co = ["search", "bell", "user", "lock", "link"];

function PageControls({ onBack }) {
  const [name_co, setName_co] = useStateCo("Northbound");
  const [on_co, setOn_co] = useStateCo(true);

  const css = `
    .copg-root, .copg-root *{ box-sizing:border-box; }
    .copg-root{ height:100vh; overflow:hidden; box-sizing:border-box;
      background:
        linear-gradient(${C_co.line}55 1px, transparent 1px) 0 0/100% 26px,
        linear-gradient(90deg, ${C_co.line}55 1px, transparent 1px) 0 0/26px 100%,
        ${C_co.ground};
      color:${C_co.ink}; font-family:${FB_co};
      padding:20px clamp(22px,4vw,46px); display:flex; flex-direction:column; }

    /* buttons — edge/colour/weight feedback, never a box that appears */
    .co-btn{ font-family:${FB_co}; font-weight:700; line-height:1; border:1.5px solid transparent;
      border-radius:8px; cursor:pointer; color:${C_co.ink}; white-space:nowrap;
      transition:background .14s, color .14s, border-color .14s, transform .1s, box-shadow .16s; }
    .co-primary{ background:${C_co.teal}; color:#fff; box-shadow:0 2px 0 ${C_co.tealLo}; }
    .co-primary:hover{ background:${C_co.tealHi}; transform:translateY(-1px); box-shadow:0 6px 0 ${C_co.tealLo}; }
    .co-primary:active{ background:${C_co.tealLo}; transform:translateY(2px); box-shadow:0 0 0 ${C_co.tealLo}; }
    .co-secondary{ background:transparent; color:${C_co.ink}; border-color:${C_co.rule}; }
    .co-secondary:hover{ border-color:${C_co.ink}; }
    .co-tertiary{ background:transparent; color:${C_co.sub}; border-color:${C_co.line}; }
    .co-tertiary:hover{ color:${C_co.ink}; border-color:${C_co.rule}; }
    .co-ghost{ background:transparent; color:${C_co.sub}; text-underline-offset:3px; }
    .co-ghost:hover{ color:${C_co.ink}; text-decoration:underline; }
    .co-danger{ background:transparent; color:${C_co.danger}; border-color:transparent; text-underline-offset:3px; }
    .co-danger:hover{ text-decoration:underline; }

    .copg-field{ font-family:${FB_co}; font-size:14px; color:${C_co.ink}; background:${C_co.card};
      border:1.5px solid ${C_co.rule}; border-radius:8px; padding:10px 12px; width:100%;
      transition:border-color .14s, box-shadow .14s; }
    .copg-field:focus{ outline:none; border-color:${C_co.teal}; box-shadow:0 0 0 3px ${C_co.teal}22; }

    .co-sw{ width:46px; height:26px; border-radius:99px; border:none; cursor:pointer; position:relative; transition:background .18s; flex:0 0 auto; }
    .co-sw .k{ position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.3); transition:transform .2s cubic-bezier(.2,.9,.3,1); }

    .co-slop{ font-family:${FB_co}; font-weight:600; font-size:12px; color:#fff; border:none; border-radius:9999px;
      padding:7px 15px; background:linear-gradient(135deg,#8B5CF6,#4F86F7); box-shadow:0 8px 18px -6px rgba(96,90,240,.55); }

    /* the struck "avoid" specimens in the icon lesson */
    .co-x{ position:relative; color:${C_co.faint}; }
    .co-x::after{ content:""; position:absolute; left:-3px; right:-3px; top:50%; height:1.5px; background:${C_co.danger}; opacity:.6; transform:rotate(-9deg); }

    /* corner brackets for the drawing */
    .co-brk{ position:absolute; width:14px; height:14px; border:2px solid ${C_co.rule}; }
    /* internal entrance — the figures settle in, staggered */
    .co-plate > div{ animation: co-rise .55s cubic-bezier(.22,1,.36,1) both; }
    .co-plate > div:nth-of-type(2){ animation-delay:.09s; }
    .co-plate > div:nth-of-type(3){ animation-delay:.18s; }
    @keyframes co-rise{ from{ opacity:0; transform:translateY(12px); } to{ opacity:1; transform:none; } }
    @media (prefers-reduced-motion: reduce){ .co-btn,.co-sw .k{ transition:none !important; } .co-plate > div{ animation:none !important; } }
    @media (max-width:1120px){ .co-plate{ grid-template-columns:1fr !important; } .co-hero{ min-height:230px; } }
  `;

  return (
    <div className="copg-root">
      <style>{css}</style>

      {/* header */}
      <div style={{ flex: "0 0 auto", height: 40, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BackTab theme={{ ink: C_co.ink, line: C_co.rule, mono: FM_co, radius: 8 }} onClick={onBack} />
        <Note_co style={{ fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: C_co.faint }}>Antidote · Controls · sheet 01</Note_co>
      </div>

      {/* title band + the tell */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, margin: "clamp(6px,1.4vh,16px) 0 clamp(8px,1.4vh,14px)" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: FD_co, fontWeight: 700, fontSize: "clamp(38px,5vw,68px)", lineHeight: .9, letterSpacing: "-.02em" }}>
            <span style={{ color: C_co.teal }}>One</span> leads.
          </h1>
          <div style={{ fontFamily: FB_co, fontWeight: 700, fontSize: "clamp(15px,1.5vw,20px)", color: C_co.sub, marginTop: 8 }}>
            Buttons, fields, toggles, icons. Four recede.
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          <Note_co style={{ color: C_co.danger, display: "block", marginBottom: 8, letterSpacing: ".14em", textTransform: "uppercase" }}>the tell · five actions, one look</Note_co>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {["Save", "Cancel", "Export", "Delete"].map((l) => <span key={l} className="co-slop">{l}</span>)}
          </div>
          <Note_co style={{ display: "block", marginTop: 8, color: C_co.faint, textDecoration: "line-through", textDecorationColor: "rgba(178,58,43,.5)" }}>border-radius: 9999 · gradient · ×5</Note_co>
        </div>
      </div>

      {/* the drawing */}
      <div className="co-plate" style={{ flex: "1 1 auto", minHeight: 0, position: "relative",
        border: `1.5px solid ${C_co.rule}`, background: `${C_co.board}cc`,
        display: "grid", gridTemplateColumns: "1.35fr 1fr", gridTemplateRows: "1.12fr .88fr" }}>

        {/* corner brackets */}
        <span className="co-brk" style={{ top: -2, left: -2, borderRight: "none", borderBottom: "none" }} />
        <span className="co-brk" style={{ top: -2, right: -2, borderLeft: "none", borderBottom: "none" }} />
        <span className="co-brk" style={{ bottom: -2, left: -2, borderRight: "none", borderTop: "none" }} />
        <span className="co-brk" style={{ bottom: -2, right: -2, borderLeft: "none", borderTop: "none" }} />

        {/* HERO — the primary, dimensioned like a part */}
        <div className="co-hero" style={{ position: "relative", borderRight: `1px solid ${C_co.line}`, borderBottom: `1px solid ${C_co.line}`, display: "grid", placeItems: "center", padding: "clamp(14px,2vw,30px)" }}>
          <Note_co style={{ position: "absolute", top: 12, left: 14, letterSpacing: ".14em", textTransform: "uppercase", color: C_co.faint }}>fig. 1 · the primary</Note_co>

          {/* left vertical dimension: the hit target */}
          <div style={{ position: "absolute", left: 14, top: "34%", bottom: "34%", display: "flex", flexDirection: "column", alignItems: "center", color: C_co.rule }}>
            <span style={{ width: 6, height: 1, background: C_co.rule }} />
            <span style={{ flex: 1, width: 1, background: C_co.rule }} />
            <Note_co style={{ color: C_co.sub, writingMode: "vertical-rl", transform: "rotate(180deg)", margin: "4px 0" }}>44px hit</Note_co>
            <span style={{ flex: 1, width: 1, background: C_co.rule }} />
            <span style={{ width: 6, height: 1, background: C_co.rule }} />
          </div>

          <div style={{ position: "relative" }}>
            {/* width dimension above */}
            <div style={{ position: "absolute", left: 0, right: 0, top: -22, display: "flex", alignItems: "center", gap: 6, color: C_co.rule }}>
              <span style={{ width: 6, height: 1, background: C_co.rule }} /><span style={{ flex: 1, height: 1, background: C_co.rule }} />
              <Note_co style={{ color: C_co.sub }}>one fill · #0E7C6B</Note_co>
              <span style={{ flex: 1, height: 1, background: C_co.rule }} /><span style={{ width: 6, height: 1, background: C_co.rule }} />
            </div>
            <button className="co-btn co-primary" style={{ fontSize: "clamp(18px,2vw,26px)", padding: "clamp(14px,1.6vw,20px) clamp(26px,3vw,42px)" }}>Save changes</button>
            {/* radius note */}
            <Note_co style={{ position: "absolute", top: -8, right: -92, color: C_co.sub }}>radius 8px</Note_co>
            <span style={{ position: "absolute", top: -2, right: -2, width: 16, height: 16, borderTop: `1px solid ${C_co.rule}`, borderRight: `1px solid ${C_co.rule}` }} />
            {/* contrast note below */}
            <Note_co style={{ position: "absolute", left: "50%", bottom: -26, transform: "translateX(-50%)", whiteSpace: "nowrap", color: C_co.sub }}>white on teal · AA 4.6:1 · border 1.5 · one elevation</Note_co>
          </div>

          {/* live states, read out — with the two motion timings pinned in place */}
          <div style={{ position: "absolute", bottom: 12, left: 14, right: 14, display: "flex", gap: 14, alignItems: "flex-end", justifyContent: "center" }}>
            {[["default", ""], ["hover", "140ms"], ["pressed", "100ms"], ["disabled", ""]].map(([s, t]) => (
              <span key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <span style={{ width: 34, height: 12, borderRadius: 3,
                  background: s === "disabled" ? "#CDC6B4" : s === "pressed" ? C_co.tealLo : s === "hover" ? C_co.tealHi : C_co.teal,
                  transform: s === "hover" ? "translateY(-1px)" : s === "pressed" ? "translateY(1px)" : "none",
                  opacity: s === "disabled" ? .8 : 1 }} />
                <Note_co style={{ fontSize: 8.5, color: C_co.faint }}>{s}</Note_co>
                {t ? <Note_co style={{ fontSize: 8, color: C_co.teal }}>{t}</Note_co> : null}
              </span>
            ))}
          </div>
        </div>

        {/* LADDER — the same action, five weights, receding */}
        <div style={{ position: "relative", borderBottom: `1px solid ${C_co.line}`, padding: "clamp(14px,1.6vw,24px) clamp(16px,2vw,28px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "clamp(6px,1vh,11px)" }}>
          <Note_co style={{ position: "absolute", top: 12, left: 14, letterSpacing: ".14em", textTransform: "uppercase", color: C_co.faint }}>fig. 2 · emphasis, descending</Note_co>
          {LADDER_co.map((b, i) => (
            <div key={b.role} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Note_co style={{ width: 16, color: C_co.faint, textAlign: "right" }}>{i + 1}</Note_co>
              <button className={"co-btn " + b.cls} style={{ fontWeight: b.w, fontSize: b.big ? 15 : 13, padding: b.big ? "10px 18px" : "7px 13px" }}>Save changes</button>
              <span style={{ flex: 1, height: 1, background: `${C_co.line}` }} />
              <Note_co style={{ color: i === 0 ? C_co.teal : C_co.faint, fontWeight: i === 0 ? 700 : 400 }}>{b.role}</Note_co>
            </div>
          ))}
          <Note_co style={{ marginTop: 4, color: C_co.sub }}>one filled primary · four step back · body text AAA on sandstone</Note_co>
        </div>

        {/* BOTTOM STRIP — field, toggle, and the icon lesson */}
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr 1fr 1.7fr" }}>
          {/* field */}
          <div style={{ position: "relative", borderRight: `1px solid ${C_co.line}`, padding: "clamp(12px,1.5vw,20px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
            <Note_co style={{ letterSpacing: ".14em", textTransform: "uppercase", color: C_co.faint }}>fig. 3 · field</Note_co>
            <label style={{ display: "block" }}>
              <Note_co style={{ display: "block", marginBottom: 6, color: C_co.ink }}>Project name</Note_co>
              <input className="copg-field" value={name_co} onChange={(e) => setName_co(e.target.value)} />
            </label>
            <Note_co style={{ color: C_co.sub }}>radius 8 · border 1.5 · focus ring 3px teal</Note_co>
          </div>
          {/* toggle */}
          <div style={{ position: "relative", borderRight: `1px solid ${C_co.line}`, padding: "clamp(12px,1.5vw,20px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
            <Note_co style={{ letterSpacing: ".14em", textTransform: "uppercase", color: C_co.faint }}>fig. 4 · toggle</Note_co>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ color: C_co.sub, display: "grid" }}><Icon_co name="lock" /></span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Private</span>
              </span>
              <button role="switch" aria-checked={on_co} onClick={() => setOn_co(!on_co)} className="co-sw" style={{ background: on_co ? C_co.teal : "#C4BCA6" }}>
                <span className="k" style={{ transform: on_co ? "translateX(20px)" : "translateX(0)" }} />
              </button>
            </div>
            <Note_co style={{ color: C_co.sub }}>{on_co ? "on · 44px target · 8px spacing" : "off · 44px target · 8px spacing"}</Note_co>
          </div>

          {/* ICON LESSON — one grid, one weight, one metaphor; then the four tells */}
          <div style={{ position: "relative", padding: "clamp(11px,1.4vw,18px) clamp(12px,1.6vw,20px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "clamp(6px,1vh,10px)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <Note_co style={{ letterSpacing: ".14em", textTransform: "uppercase", color: C_co.faint }}>fig. 5 · icons</Note_co>
              <Note_co style={{ color: C_co.sub }}>24px grid · 1.5 stroke · 2px radius · one metaphor each</Note_co>
            </div>

            {/* GOOD: one coherent set */}
            <div style={{ display: "flex", alignItems: "center", gap: "clamp(14px,2vw,26px)" }}>
              <Note_co style={{ color: C_co.teal, width: 40, flex: "0 0 auto" }}>keep</Note_co>
              {GOOD_ICONS_co.map((n) => (
                <span key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: C_co.ink }}>
                  <Icon_co name={n} sw={1.5} size={22} />
                  <Note_co style={{ fontSize: 8, color: C_co.faint }}>{n}</Note_co>
                </span>
              ))}
            </div>

            <span style={{ height: 1, background: C_co.line, margin: "1px 0" }} />

            {/* AVOID: the four tells, each struck */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "clamp(12px,1.8vw,22px)" }}>
              <Note_co style={{ color: C_co.danger, width: 40, flex: "0 0 auto", letterSpacing: ".08em", textTransform: "uppercase" }}>tell</Note_co>

              {/* two libraries: same glyph, two stroke weights */}
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span className="co-x" style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Icon_co name="bell" sw={2.6} size={20} /><Icon_co name="bell" sw={1} size={20} />
                </span>
                <Note_co style={{ fontSize: 8, color: C_co.faint, textAlign: "center" }}>two weights</Note_co>
              </span>

              {/* emoji used as icons */}
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span className="co-x" style={{ fontSize: 18, lineHeight: 1, filter: "grayscale(1)", opacity: .8 }}>&#128276;&#128100;</span>
                <Note_co style={{ fontSize: 8, color: C_co.faint, textAlign: "center" }}>emoji</Note_co>
              </span>

              {/* decoration parked above a heading */}
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span className="co-x" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, color: C_co.faint }}>
                  <Icon_co name="star" sw={1.5} size={13} />
                  <span style={{ width: 30, height: 4, borderRadius: 2, background: C_co.line }} />
                </span>
                <Note_co style={{ fontSize: 8, color: C_co.faint, textAlign: "center" }}>decor per heading</Note_co>
              </span>

              {/* metaphor that does not match its label */}
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span className="co-x" style={{ display: "flex", alignItems: "center", gap: 4, color: C_co.faint }}>
                  <Icon_co name="trash" sw={1.5} size={20} />
                  <Note_co style={{ fontSize: 9, color: C_co.faint }}>"Save"</Note_co>
                </span>
                <Note_co style={{ fontSize: 8, color: C_co.faint, textAlign: "center" }}>wrong metaphor</Note_co>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageControls = PageControls;
