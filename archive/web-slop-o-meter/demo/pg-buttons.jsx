/* Page · Buttons & CTAs — the AI tell is every button pill-shaped, gradient-filled and
   soft-shadowed, so all five actions read as primary and nothing has a hierarchy (this is
   where the old rounded-2xl + soft-shadow radius tell lives most visibly: the pill is the
   extreme radius). The fix: a real action hierarchy — exactly one filled primary per view,
   quieter secondary / tertiary / ghost, and a destructive style that looks like consequence;
   a considered 8px radius, not 9999 on everything; every control has designed default / hover /
   pressed / disabled states; the same destination keeps the same label. Shape and elevation are
   spent with intent, not sprayed. World: warm sandstone control-surface + a single teal signal.
   Type: Syne 800 sets the confident headline (no display gimmick), Public Sans carries UI + body,
   Martian Mono handles labels and specs. Layout runs on an 8px grid with two balanced columns. */
const { useState: useStateBt } = React;

const FDISP_bt = "'Nippo', sans-serif";   // geometric technical display (Fontshare), used with restraint
const FUI_bt   = "'Public Sans', sans-serif";
const FMONO_bt = "'Martian Mono', monospace";

const C_bt = {
  ground: "#E7E1D3", surface: "#F5F1E8", card: "#FBF9F3",
  ink: "#1B1E23", sub: "#6E6857", faint: "#928B78", line: "#D6CFBE",
  teal: "#0E7C6B", tealHi: "#0A5F52", tealLo: "#083F37",
  danger: "#B23A2B",
};

// The five real controls, in descending emphasis, plus one disabled state.
const SET_bt = [
  { kind: "primary",   label: "Save changes",     role: "Primary",     note: "One per view" },
  { kind: "secondary", label: "Preview",          role: "Secondary",   note: "Outline" },
  { kind: "tertiary",  label: "Rename",           role: "Tertiary",    note: "Low emphasis" },
  { kind: "ghost",     label: "Cancel",           role: "Ghost",       note: "Text only" },
  { kind: "danger",    label: "Delete workspace", role: "Destructive", note: "Consequence" },
];

// The slop: five actions, one look. Pill (radius 9999) + gradient + soft shadow, ×5.
const SLOP_bt = ["Save", "Cancel", "Export", "Share", "Delete"];

function Btn_bt({ kind, label, disabled, magnet, onFire, report }) {
  const wired = disabled ? { disabled: true } : {
    onMouseEnter: () => report(kind, "hover"),
    onMouseLeave: () => report(null, "idle"),
    onMouseDown:  () => report(kind, "pressed"),
    onMouseUp:    () => report(kind, "hover"),
    onFocus:      () => report(kind, "focus"),
    onBlur:       () => report(null, "idle"),
    onClick:      onFire,
  };
  const cls = "btpg-btn btpg-" + kind + (magnet ? " btpg-magnet" : "");
  return <button className={cls} {...wired}>{label}</button>;
}

function PageButtons({ onBack }) {
  const [inspect, setInspect] = useStateBt({ kind: null, state: "idle" });
  const [toast, setToast]     = useStateBt(null); // { msg, danger }

  const report = (kind, state) => setInspect({ kind, state });
  const fire = (msg, danger) => setToast({ msg, danger: !!danger });

  const roleOf = { primary: "Primary", secondary: "Secondary", tertiary: "Tertiary", ghost: "Ghost", danger: "Destructive" };
  const inspLabel = inspect.kind ? roleOf[inspect.kind] : "none";

  const css = `
    .btpg-root, .btpg-root *{ box-sizing:border-box; }
    .btpg-btn{
      font-family:${FUI_bt}; font-weight:700; font-size:14px; line-height:1;
      padding:11px 18px; border-radius:8px; border:1.5px solid transparent;
      cursor:pointer; color:${C_bt.ink}; white-space:nowrap;
      transition:background .14s ease, color .14s ease, border-color .14s ease, transform .1s ease, box-shadow .14s ease;
    }
    .btpg-btn:focus-visible{ outline:2.5px solid ${C_bt.teal}; outline-offset:2px; }
    .btpg-btn:disabled{ cursor:not-allowed; }

    /* Primary — the one filled control; earns its weight by contrast, not by joining a gradient chorus */
    .btpg-primary{ background:${C_bt.teal}; color:${C_bt.card}; box-shadow:0 1px 0 rgba(8,63,55,.18); }
    .btpg-primary:hover{ background:${C_bt.tealHi}; transform:translateY(-1px); box-shadow:0 8px 18px -8px rgba(14,124,107,.75); }
    .btpg-primary:active{ background:${C_bt.tealLo}; transform:translateY(1px); box-shadow:inset 0 2px 5px rgba(0,0,0,.28); }
    .btpg-primary:disabled{ background:#CDC6B4; color:#8E8674; box-shadow:none; transform:none; }

    /* Magnet — the single in-context primary. Static emphasis only: extra scale, the teal fill,
       terminal position and one clean grounded shadow make the eye land here first. No motion. */
    .btpg-magnet{ font-size:15px; padding:14px 26px; box-shadow:0 6px 16px -8px rgba(8,63,55,.5); }
    .btpg-magnet:hover{ transform:translateY(-1px); box-shadow:0 10px 22px -10px rgba(8,63,55,.62); }

    /* Secondary — ink outline */
    .btpg-secondary{ background:transparent; color:${C_bt.ink}; border-color:${C_bt.ink}; }
    .btpg-secondary:hover{ background:rgba(27,30,35,.06); }
    .btpg-secondary:active{ background:rgba(27,30,35,.12); transform:translateY(1px); }

    /* Tertiary — quiet tonal fill */
    .btpg-tertiary{ background:#E6DFCC; color:#3A3730; }
    .btpg-tertiary:hover{ background:#DAD2BC; }
    .btpg-tertiary:active{ background:#CDC4AB; transform:translateY(1px); }

    /* Ghost — text only */
    .btpg-ghost{ background:transparent; color:${C_bt.sub}; }
    .btpg-ghost:hover{ background:rgba(27,30,35,.05); color:${C_bt.ink}; }
    .btpg-ghost:active{ transform:translateY(1px); }

    /* Destructive — reads as consequence: outlined danger that fills red on intent */
    .btpg-danger{ background:transparent; color:${C_bt.danger}; border-color:rgba(178,58,43,.55); }
    .btpg-danger:hover{ background:${C_bt.danger}; color:${C_bt.card}; border-color:${C_bt.danger}; }
    .btpg-danger:active{ background:#8F2E20; border-color:#8F2E20; transform:translateY(1px); }

    /* The slop specimen — identical for all five: pill + gradient + soft shadow, no real states */
    .btpg-slop{
      font-family:${FUI_bt}; font-weight:600; font-size:13px; color:#fff; border:none;
      border-radius:9999px; padding:10px 20px; cursor:pointer;
      background:linear-gradient(135deg, #8B5CF6 0%, #4F86F7 100%);
      box-shadow:0 10px 22px -6px rgba(96,90,240,.55);
      transition:filter .14s ease;
    }
    .btpg-slop:hover{ filter:brightness(1.05); }

    @media (prefers-reduced-motion: reduce){
      .btpg-btn, .btpg-slop{ transition:none !important; }
      .btpg-btn:hover, .btpg-btn:active{ transform:none !important; }
    }
    @media (max-width:1080px){ .btpg-main{ grid-template-columns:1fr !important; } }
  `;

  const eyebrow = { fontFamily: FMONO_bt, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: C_bt.faint };
  const spec = { fontFamily: FMONO_bt, fontSize: 11, letterSpacing: ".01em", color: C_bt.sub };

  return (
    <div className="btpg-root" style={{
      height: "100vh", overflow: "hidden", boxSizing: "border-box",
      background: C_bt.ground, color: C_bt.ink, fontFamily: FUI_bt,
      padding: "24px clamp(24px,4vw,48px)",
      display: "flex", flexDirection: "column", position: "relative",
    }}>
      <style>{css}</style>

      {/* header — 40px band on the grid */}
      <div style={{ flex: "0 0 auto", height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <BackTab theme={{ ink: C_bt.ink, line: C_bt.line, mono: FMONO_bt, radius: 8 }} onClick={onBack} />
        <span style={eyebrow}>Antidote · Buttons &amp; CTAs</span>
      </div>

      {/* body */}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center" }}>
        <div className="btpg-main" style={{
          width: "100%", display: "grid", gridTemplateColumns: "minmax(0,0.86fr) minmax(0,1.14fr)",
          gap: "clamp(32px,4.5vw,64px)", alignItems: "start",
        }}>
          {/* ---- LEFT · the thesis + the slop specimen ---- */}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0 }}>
              <span style={{ display: "block", fontFamily: FDISP_bt, fontWeight: 700, fontSize: "clamp(48px,5.6vw,76px)", lineHeight: .9, letterSpacing: "-.03em" }}>
                <span style={{ color: C_bt.teal }}>One</span> primary.
              </span>
              <span style={{ display: "block", fontFamily: FUI_bt, fontWeight: 700, fontSize: "clamp(20px,2.2vw,28px)", lineHeight: 1.1, letterSpacing: "-.01em", color: C_bt.sub, marginTop: 16 }}>
                The rest step back.
              </span>
            </h1>

            <p style={{ fontFamily: FUI_bt, fontSize: 15, lineHeight: 1.6, color: C_bt.sub, margin: "24px 0 0", maxWidth: 440 }}>
              When every button is a pill with a gradient and a soft shadow, they all read as the main
              action, so the page has no hierarchy. Give each control a job: one filled primary,
              a quieter secondary and tertiary, a plain ghost, and a destructive style that looks like
              consequence. Shape and elevation get spent with intent, not sprayed.
            </p>

            {/* the tell */}
            <div style={{ marginTop: 32, padding: "16px 24px 24px", background: C_bt.surface, border: `1px solid ${C_bt.line}`, borderRadius: 10, maxWidth: 480 }}>
              <div style={{ ...eyebrow, color: C_bt.danger, marginBottom: 16 }}>The tell &middot; five actions, one look</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SLOP_bt.map((l) => <button key={l} className="btpg-slop">{l}</button>)}
              </div>
              <div style={{ ...spec, marginTop: 16, textDecoration: "line-through", textDecorationColor: "rgba(178,58,43,.6)", color: C_bt.faint }}>
                border-radius: 9999 &middot; gradient fill &middot; soft shadow &middot; &times;5
              </div>
            </div>
          </div>

          {/* ---- RIGHT · the fix, shown as a real control set + in-context dialog ---- */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
                <span style={{ fontFamily: FDISP_bt, fontWeight: 700, fontSize: 20, letterSpacing: "-.01em" }}>The set</span>
                <span style={spec}>One system &middot; five weights</span>
              </div>

              {/* the five roles + disabled, each a live control with real states — fixed 3×2 grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                {SET_bt.map((b) => (
                  <div key={b.kind} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                    <Btn_bt
                      kind={b.kind} label={b.label} report={report}
                      onFire={() => fire(b.kind === "danger" ? "Delete confirmed. This is a demo." : b.kind === "primary" ? "Changes saved" : `${b.label} ran (demo)`, b.kind === "danger")}
                    />
                    <div>
                      <div style={{ fontFamily: FUI_bt, fontWeight: 700, fontSize: 12.5, color: C_bt.ink }}>{b.role}</div>
                      <div style={{ fontFamily: FMONO_bt, fontSize: 10, letterSpacing: ".02em", color: C_bt.faint, marginTop: 2 }}>{b.note}</div>
                    </div>
                  </div>
                ))}
                {/* the disabled state, made visible */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                  <Btn_bt kind="primary" label="Save changes" disabled report={report} />
                  <div>
                    <div style={{ fontFamily: FUI_bt, fontWeight: 700, fontSize: 12.5, color: C_bt.ink }}>Disabled</div>
                    <div style={{ fontFamily: FMONO_bt, fontSize: 10, letterSpacing: ".02em", color: C_bt.faint, marginTop: 2 }}>Nothing to save</div>
                  </div>
                </div>
              </div>
            </div>

            {/* in-context: the dialog — the aha, one primary is obviously the focal point */}
            <div style={{ background: C_bt.card, border: `1px solid ${C_bt.line}`, borderRadius: 12, boxShadow: "0 24px 48px -28px rgba(27,30,35,.45)", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C_bt.line}` }}>
                <div style={{ fontFamily: FUI_bt, fontWeight: 700, fontSize: 15, color: C_bt.ink }}>Workspace settings</div>
                <div style={{ fontFamily: FUI_bt, fontSize: 13, color: C_bt.sub, marginTop: 4 }}>Acme Design &middot; renaming the workspace URL</div>
              </div>
              <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FMONO_bt, fontSize: 11, color: C_bt.faint, maxWidth: 220 }}>One primary per view. Your eye finds it first.</span>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <Btn_bt kind="ghost" label="Cancel" report={report} onFire={() => fire("Changes discarded")} />
                  <Btn_bt kind="primary" label="Save changes" magnet report={report} onFire={() => fire("Changes saved")} />
                </div>
              </div>
            </div>

            {/* live inspector — states made interactive via React */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontFamily: FMONO_bt, fontSize: 11, color: C_bt.sub }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: inspect.kind ? C_bt.teal : C_bt.line }} />
                Inspecting: <b style={{ color: C_bt.ink, fontWeight: 700 }}>{inspLabel}</b> &middot; {inspect.state}
              </span>
              <span style={{ width: 1, height: 12, background: C_bt.line }} />
              <span>Radius 8px, considered</span>
              <span style={{ width: 1, height: 12, background: C_bt.line }} />
              <span>Same destination, same label</span>
            </div>
          </div>
        </div>
      </div>

      {/* toast — proves label consistency (Save changes → "Changes saved") */}
      {toast && (
        <div
          role="status"
          style={{
            position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)",
            background: toast.danger ? C_bt.danger : C_bt.ink, color: C_bt.card,
            fontFamily: FUI_bt, fontWeight: 600, fontSize: 13.5, padding: "11px 18px", borderRadius: 8,
            boxShadow: "0 16px 34px -14px rgba(0,0,0,.5)", display: "flex", alignItems: "center", gap: 16,
          }}
        >
          <span>{toast.msg}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,.72)", fontFamily: FMONO_bt, fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer", padding: 0 }}
          >Dismiss</button>
        </div>
      )}
    </div>
  );
}

window.PageButtons = PageButtons;
