/* Page · Spacing. The golden ratio, drawn as a measured proportion chart: a Fibonacci
   square tiling (1,1,2,3,5,8,13,21,34) with a logarithmic spiral, annotated in numbers.
   Every square is a Fibonacci number times the 8px base unit, so the proportion system
   and the spacing grid are the same numbers. No mysticism, just arithmetic. */
const { useState: useStateSp, useEffect: useEffectSp } = React;

function PageSpace({ onBack }) {
  const BG_sp   = "#EDEFF1";              // cool drafting paper
  const BOARD_sp= "#F6F7F9";             // the artboard stock
  const INK_sp  = "#14171C";             // graphite
  const TEAL_sp = "#0E8C86";             // the one accent: measured / on ratio
  const TEALHI_sp = "#14B7AC";
  const GREY_sp = "#69707A";
  const LINE_sp = "rgba(20,23,28,.16)";  // hairline rules
  const GRID_sp = "rgba(20,23,28,.07)";  // 8px substrate
  const SQ_sp   = "rgba(20,23,28,.34)";  // square edges

  const mono_sp  = "'Martian Mono', monospace";
  const serif_sp = "'Gambetta', serif";
  const body_sp  = "'Hanken Grotesk', sans-serif";

  const [lit_sp, setLit_sp] = useStateSp(false);
  useEffectSp(() => { const t = setTimeout(() => setLit_sp(true), 120); return () => clearTimeout(t); }, []);

  // Fibonacci tiling in pixel coords. 1 unit = 8px, so every side is a Fibonacci
  // number times the 8px base unit. The whole board is 440 x 272 (= 55 x 34 units).
  const squares_sp = [
    { x: 0,   y: 0,   s: 272 }, // 34
    { x: 272, y: 0,   s: 168 }, // 21
    { x: 336, y: 168, s: 104 }, // 13
    { x: 272, y: 208, s: 64  }, // 8
    { x: 272, y: 168, s: 40  }, // 5
    { x: 312, y: 168, s: 24  }, // 3
    { x: 320, y: 192, s: 16  }, // 2
    { x: 312, y: 200, s: 8   }, // 1
    { x: 312, y: 192, s: 8   }, // 1
  ];

  // labels placed only where the square has room to carry numbers
  const labels_sp = [
    { cx: 136, cy: 136, px: "272 px", mul: "34 × 8", rat: "÷ 168 = 1.619", big: true },
    { cx: 356, cy: 84,  px: "168 px", mul: "21 × 8", rat: "÷ 104 = 1.615" },
    { cx: 388, cy: 220, px: "104",    mul: "13 × 8" },
    { cx: 304, cy: 240, px: "64",     mul: "8 × 8" },
    { cx: 292, cy: 188, px: "40" },
  ];

  // one continuous quarter-arc spiral through every square, largest to smallest
  const spiral_sp =
    "M0 272" +
    "A272 272 0 0 1 272 0" +
    "A168 168 0 0 1 440 168" +
    "A104 104 0 0 1 336 272" +
    "A64 64 0 0 1 272 208" +
    "A40 40 0 0 1 312 168" +
    "A24 24 0 0 1 336 192" +
    "A16 16 0 0 1 320 208" +
    "A8 8 0 0 1 312 200";

  // consecutive Fibonacci ratios walking toward phi
  const ratios_sp = [
    ["13 ÷ 8", "1.625"],
    ["21 ÷ 13", "1.615"],
    ["34 ÷ 21", "1.619"],
    ["55 ÷ 34", "1.618"],
  ];

  return (
    <div className="sp-root" style={{
      height: "100vh", overflow: "hidden", boxSizing: "border-box",
      background: BG_sp, color: INK_sp, fontFamily: body_sp,
      display: "grid", gridTemplateRows: "auto 1fr", position: "relative",
    }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .sp-root, .sp-root * { box-sizing: border-box; }
        .sp-root *:focus-visible { outline: 2px solid ${TEAL_sp}; outline-offset: 3px; }
        .sp-reveal { opacity: 0; transform: translateY(6px); transition: opacity .5s ease, transform .5s ease; }
        .sp-reveal.on { opacity: 1; transform: none; }
        .sp-spiral { stroke-dasharray: 1150; stroke-dashoffset: 1150; transition: stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1) .15s; }
        .sp-spiral.on { stroke-dashoffset: 0; }
        @media (max-width: 960px) {
          .sp-grid { grid-template-columns: 1fr !important; align-content: start !important; }
          .sp-graph { order: -1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-root * { transition: none !important; }
          .sp-reveal { opacity: 1; transform: none; }
          .sp-spiral { stroke-dashoffset: 0; }
        }
      ` }} />

      {/* top bar */}
      <div style={{ padding: "24px 40px 0" }}>
        <BackTab theme={{ ink: INK_sp, line: LINE_sp, mono: mono_sp }} onClick={onBack} />
      </div>

      {/* body: left argument column + the technical spiral graph, vertically centered */}
      <div className="sp-grid" style={{
        display: "grid", gridTemplateColumns: "minmax(0,440px) minmax(0,1fr)",
        alignItems: "center", gap: 56, padding: "0 40px", minHeight: 0,
      }}>
        {/* left · the argument */}
        <div>
          <div style={{ fontFamily: mono_sp, fontSize: 11, letterSpacing: ".14em", color: TEAL_sp }}>
            Antidote 07 &nbsp;&middot;&nbsp; proportion
          </div>

          <h1 style={{
            fontFamily: serif_sp, fontWeight: 500, fontSize: "clamp(32px,3.6vw,50px)",
            lineHeight: 1.04, letterSpacing: "-.015em", margin: "16px 0 0",
          }}>
            The golden ratio is<br />just <span style={{ color: TEAL_sp }}>arithmetic.</span>
          </h1>

          <p style={{
            fontFamily: body_sp, fontSize: 17, fontWeight: 600, lineHeight: 1.5,
            color: INK_sp, margin: "16px 0 0",
          }}>
            Draw the Fibonacci squares, divide any side by the one before it, and the answer walks straight to 1.618.
          </p>

          <p style={{ fontFamily: body_sp, fontSize: 14, lineHeight: 1.6, color: "#3b4048", margin: "16px 0 0" }}>
            Slop treats phi as a mystic overlay stamped onto a logo. It is not a vibe, it is a measured
            sequence: 1, 1, 2, 3, 5, 8, 13, 21, 34. Each square on the right is a Fibonacci number times an
            8&#8209;pixel base unit, so the proportion system and the spacing grid resolve to the same numbers.
          </p>

          <div style={{ height: 1, background: LINE_sp, margin: "24px 0" }} />

          <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: mono_sp, fontSize: 12, color: INK_sp, letterSpacing: ".02em" }}>
              &phi; = 1.6180339887
            </span>
            <span style={{ fontFamily: mono_sp, fontSize: 11, color: GREY_sp, letterSpacing: ".02em" }}>
              rectangle 440 &divide; 272
            </span>
          </div>
        </div>

        {/* right · the technical proportion graph (signature) */}
        <div className="sp-graph" style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: mono_sp, fontSize: 11, letterSpacing: ".06em", color: INK_sp }}>
              Fibonacci tiling &middot; logarithmic spiral
            </span>
            <span style={{ fontFamily: mono_sp, fontSize: 10.5, letterSpacing: ".04em", color: GREY_sp }}>
              1 unit = 8 px
            </span>
          </div>

          <div className={"sp-reveal" + (lit_sp ? " on" : "")} style={{
            background: BOARD_sp, border: `1.5px solid ${LINE_sp}`, padding: "20px 24px",
          }}>
            <svg viewBox="0 0 512 316" width="100%" style={{ display: "block", maxHeight: "46vh" }}
                 role="img" aria-label="Fibonacci square tiling from 8 to 272 pixels with a logarithmic spiral; consecutive side ratios converge to the golden ratio 1.618.">
              <defs>
                <pattern id="sp-g8" width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M8 0H0V8" fill="none" stroke={GRID_sp} strokeWidth="1" />
                </pattern>
              </defs>

              {/* width dimension rule (top) */}
              <g stroke={GREY_sp} strokeWidth="1">
                <line x1="8" y1="16" x2="448" y2="16" />
                <line x1="8" y1="12" x2="8" y2="20" />
                <line x1="448" y1="12" x2="448" y2="20" />
              </g>
              <text x="228" y="12" textAnchor="middle" fontFamily={mono_sp} fontSize="10" fill={GREY_sp}>440 px = 55 units</text>
              <text x="8" y="27" fontFamily={mono_sp} fontSize="9" fill={GREY_sp}>0,0</text>

              {/* height dimension rule (right) */}
              <g stroke={GREY_sp} strokeWidth="1">
                <line x1="472" y1="32" x2="472" y2="304" />
                <line x1="468" y1="32" x2="476" y2="32" />
                <line x1="468" y1="304" x2="476" y2="304" />
              </g>
              <text x="486" y="168" textAnchor="middle" fontFamily={mono_sp} fontSize="10" fill={GREY_sp}
                    transform="rotate(-90 486 168)">272 px = 34 units</text>

              {/* the artboard */}
              <g transform="translate(8,32)">
                <rect x="0" y="0" width="440" height="272" fill="url(#sp-g8)" />

                {/* Fibonacci squares, edges on the 8px grid */}
                {squares_sp.map((q, i) => (
                  <rect key={i} x={q.x} y={q.y} width={q.s} height={q.s} fill="none" stroke={SQ_sp} strokeWidth="1" />
                ))}

                {/* golden cut: the tall square's edge is the width divided by phi */}
                <line x1="272" y1="0" x2="272" y2="272" stroke={TEAL_sp} strokeWidth="1.5" strokeDasharray="3 3" />

                {/* the logarithmic spiral through every square */}
                <path className={"sp-spiral" + (lit_sp ? " on" : "")} d={spiral_sp}
                      fill="none" stroke={TEAL_sp} strokeWidth="2" strokeLinecap="round" />
                <circle cx="314" cy="198" r="3" fill={TEALHI_sp} />

                {/* numeric labels inside the squares */}
                {labels_sp.map((l, i) => (
                  <text key={i} x={l.cx} y={l.cy} textAnchor="middle" fontFamily={mono_sp}
                        style={{ paintOrder: "stroke", stroke: BOARD_sp, strokeWidth: 3, strokeLinejoin: "round" }}>
                    <tspan x={l.cx} fontSize={l.big ? 15 : 12} fontWeight="600" fill={INK_sp}>{l.px}</tspan>
                    {l.mul && <tspan x={l.cx} dy="14" fontSize="10" fill={GREY_sp}>{l.mul}</tspan>}
                    {l.rat && <tspan x={l.cx} dy="13" fontSize="10" fill={TEAL_sp}>{l.rat}</tspan>}
                  </text>
                ))}
              </g>
            </svg>
          </div>

          {/* the ratio ledger: consecutive Fibonacci ratios converging to phi */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: mono_sp, fontSize: 10.5, letterSpacing: ".08em", color: GREY_sp, whiteSpace: "nowrap" }}>
              Consecutive ratios &rarr; &phi;
            </span>
            <div style={{ display: "flex", gap: 1, background: LINE_sp, border: `1px solid ${LINE_sp}` }}>
              {ratios_sp.map(([f, v], i) => (
                <div key={i} style={{ background: BOARD_sp, padding: "8px 12px", minWidth: 76 }}>
                  <div style={{ fontFamily: mono_sp, fontSize: 10, color: GREY_sp }}>{f}</div>
                  <div style={{ fontFamily: mono_sp, fontSize: 13, fontWeight: 600, color: i === ratios_sp.length - 1 ? TEAL_sp : INK_sp, marginTop: 3 }}>{v}</div>
                </div>
              ))}
              <div style={{ background: TEAL_sp, padding: "8px 12px", minWidth: 76, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontFamily: mono_sp, fontSize: 10, color: "rgba(255,255,255,.75)" }}>limit</div>
                <div style={{ fontFamily: mono_sp, fontSize: 13, fontWeight: 600, color: "#FFFFFF", marginTop: 3 }}>&phi; 1.618</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageSpace = PageSpace;
