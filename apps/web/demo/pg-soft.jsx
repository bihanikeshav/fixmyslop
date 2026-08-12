/* Page · One Radius — thesis proved by restraint: a flat field of hard-edged cells, exactly ONE earns the radius + shadow. */
const { useState: useStateSo } = React;

function PageSoft({ onBack }) {
  // --- flat, matte token system; violet is the only live accent, spent on the one raised cell ---
  const bg = "#E7E4EF", ink = "#241C34", grape = "#4A3B6B", sub = "#8B84A0";
  const surface = "#F6F5FB", accent = "#7C5CFF", line = "#D5CFE3";
  const flatFill = "#E9E6F0";               // the field: legible, matte, clearly not lifted
  const dotOff = "#C5BED6";
  const mono = "'Martian Mono', monospace", face = "'Hanken Grotesk', sans-serif";

  // The one radius — spent only on the cell that lifts. Everything else is a hard 0.
  const R_so = 18;
  // The one shadow — a single value, present on exactly one surface at any moment.
  const shadow_so = "0 22px 46px -22px rgba(36,28,52,.46)";

  // A real product rule: one thing in progress at a time. The active cell is the one that lifts.
  const tasks_so = [
    { t: "Review pull request #482", m: "20 min" },
    { t: "Draft the launch email", m: "35 min" },
    { t: "Fix the onboarding empty state", m: "45 min" },
    { t: "Sync with design on icons", m: "15 min" },
    { t: "Outline Q3 roadmap notes", m: "30 min" },
    { t: "Reply to the billing thread", m: "10 min" },
  ];
  const [active_so, setActive_so] = useStateSo(2);

  const css_so = `
    .so2-root, .so2-root *{ box-sizing:border-box; }
    .so2-tile{ transition:transform .24s cubic-bezier(.2,.75,.3,1), background .16s ease, border-color .16s ease; }
    .so2-tile:focus-visible{ outline:2.5px solid ${accent}; outline-offset:3px; }
    .so2-flat:hover{ background:#F1EEF8; border-color:#C4BBDA; }
    .so2-flat:active{ transform:translateY(1px); }
    @media (prefers-reduced-motion: reduce){ .so2-tile{ transition:none !important; } }
    @media (max-width:1180px){ .so2-main{ grid-template-columns:1fr; gap:24px; } .so2-argue{ justify-content:flex-start; } }
    @media (max-width:560px){ .so2-field{ grid-template-columns:1fr; } }
  `;

  // The single eyebrow. Everything else below is sentence / Title case.
  const eyebrow_so = { fontFamily: mono, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: sub };
  // Field status reads as quiet metadata, not a second eyebrow.
  const meta_so = { fontFamily: mono, fontSize: 11, letterSpacing: ".01em", color: sub };

  return (
    <div className="so2-root" style={{
      height: "100vh", overflow: "hidden", boxSizing: "border-box",
      background: bg, color: ink, fontFamily: face,
      padding: "clamp(18px,2.4vh,26px) clamp(20px,4vw,44px) clamp(20px,2.6vh,28px)",
      display: "flex", flexDirection: "column",
    }}>
      <style>{css_so}</style>

      {/* header — the one eyebrow lives here, as a running page tag */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: "0 0 auto" }}>
        <BackTab theme={{ ink, line: "#CFC9DC", mono, radius: 0 }} onClick={onBack} />
        <span style={eyebrow_so}>Antidote · Elevation</span>
      </div>

      {/* the composition is centered as one block; the field sets the height, so nothing floats in a void */}
      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="so2-main" style={{
          width: "100%", maxHeight: "100%",
          display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.28fr)",
          gap: "clamp(28px,4vw,60px)", alignItems: "stretch",
        }}>
          {/* --- the argument: thesis centered against the full-height field --- */}
          <div className="so2-argue" style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {/* Emphasis by scale, not colour: "once." is the single enlarged word — the one lifted element in the type,
                mirroring the one raised card. Violet is never spent here. */}
            <h1 style={{ margin: 0, color: ink }}>
              <span style={{
                display: "block", fontFamily: face, fontWeight: 600,
                fontSize: "clamp(22px,2.3vw,30px)", letterSpacing: "-.01em", lineHeight: 1.05, color: grape,
              }}>
                Elevation, used
              </span>
              <span style={{
                display: "block", fontFamily: face, fontWeight: 800,
                fontSize: "clamp(50px,6.2vw,86px)", letterSpacing: "-.04em", lineHeight: .9, color: ink,
                marginTop: 4,
              }}>
                once.
              </span>
            </h1>

            <p style={{
              fontSize: "clamp(15px,1.1vw,17px)", lineHeight: 1.62, color: grape,
              margin: "clamp(16px,2.2vh,24px) 0 0", maxWidth: 430,
            }}>
              A shadow on every card is depth spent until it stops meaning anything. Here the field stays flat and
              hard&#8209;edged; only the task you are working on lifts &mdash; so the one lift actually carries
              information.
            </p>

            {/* stat row — the thesis, aligned on a clean baseline */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "clamp(18px,2vw,30px)", margin: "clamp(20px,3vh,32px) 0 0" }}>
              {[["1", "Radius"], ["1", "Shadow"], ["1", "Accent"]].map(([n, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: ink }}>{n}</span>
                  <span style={{ fontFamily: face, fontWeight: 600, fontSize: 13, color: grape }}>{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* --- the field: identical flat cells, exactly one raised --- */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "clamp(12px,1.8vh,18px)" }}>
              <span style={{ fontFamily: face, fontWeight: 700, fontSize: 18, color: ink }}>Today</span>
              <span style={meta_so}>One in progress</span>
            </div>

            <div className="so2-field" style={{
              display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "clamp(10px,1.1vw,14px)",
            }}>
              {tasks_so.map((task, i) => {
                const isOn = i === active_so;
                return (
                  <button
                    key={task.t}
                    className={"so2-tile " + (isOn ? "so2-rise" : "so2-flat")}
                    onClick={() => setActive_so(i)}
                    aria-pressed={isOn}
                    style={{
                      textAlign: "left", cursor: "pointer", padding: "clamp(14px,1.4vw,18px)",
                      minHeight: "clamp(120px,18.5vh,168px)",
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                      background: isOn ? surface : flatFill,
                      border: `1px solid ${isOn ? "#E4DFF1" : line}`,
                      borderRadius: isOn ? R_so : 0,
                      boxShadow: isOn ? shadow_so : "none",
                      transform: isOn ? "translateY(-6px)" : "translateY(0)",
                      color: ink,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: face, fontWeight: 600, fontSize: 12.5, color: isOn ? accent : sub }}>
                        {isOn ? "In progress" : "Up next"}
                      </span>
                      <span aria-hidden="true" style={{ width: 9, height: 9, background: isOn ? accent : dotOff }} />
                    </div>
                    <div>
                      <div style={{ fontFamily: face, fontWeight: 600, fontSize: "clamp(15px,1.15vw,17px)", lineHeight: 1.2, color: ink }}>
                        {task.t}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 11, color: sub, marginTop: 8 }}>{task.m}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p style={{ fontSize: "clamp(13px,1vw,14px)", lineHeight: 1.55, color: grape, margin: "clamp(12px,1.8vh,18px) 0 0", maxWidth: 560 }}>
              One task runs at a time. Pick another and the focus moves &mdash; it takes the single radius and shadow,
              and the last card lies flat again.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageSoft = PageSoft;
