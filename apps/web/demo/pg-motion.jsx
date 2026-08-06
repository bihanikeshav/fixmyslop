/* Page · Motion — a motion-quality bench. Four markers run the SAME trip in sync,
   each under a different easing/physics: linear (dead), ease-out (polite), a damped
   spring that overshoots and settles (alive), and a bounce (playful). Each marker
   drags a VELOCITY TRAIL (long when fast, gone at rest) so acceleration is visible,
   and beside it the easing curve is plotted with a dot riding it in sync. On open
   the instrument powers on: the curves draw themselves, then the markers run.
   Movement rides transform/opacity only. Slop motion is linear and eternal. */
const { useState: useStateMo, useEffect: useEffectMo } = React;

function PageMotion({ onBack }) {
  const bg = "#111316", bone = "#E9E4D8", amber = "#F0A93B", grid = "#2A2D31";
  const dim = "#8A857A", dimAmber = "#7A5A2E", danger = "#D9622E";
  const mono = "'Martian Mono', monospace", display = "'Big Shoulders Display', sans-serif";
  const glow = "0 0 6px rgba(240,169,59,.55), 0 0 22px rgba(240,169,59,.28)";
  const dglow = "drop-shadow(0 0 2px rgba(240,169,59,.65))";
  const DUR = 3200, DELAY = 900;   // loop length; markers begin after the power-on

  const [reduce, setReduce] = useStateMo(false);
  useEffectMo(() => {
    const m = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!m) return;
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener ? m.addEventListener("change", on) : m.addListener(on);
    return () => { m.removeEventListener ? m.removeEventListener("change", on) : m.removeListener(on); };
  }, []);

  // --- easing functions: progress(0..1) as a function of normalized time(0..1) ---
  const cubicBezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = (t) => ((ax * t + bx) * t + cx) * t;
    const fy = (t) => ((ay * t + by) * t + cy) * t;
    const dfx = (t) => (3 * ax * t + 2 * bx) * t + cx;
    return (x) => {
      let t = x;
      for (let i = 0; i < 8; i++) { const e = fx(t) - x; if (Math.abs(e) < 1e-5) break; const d = dfx(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
      return fy(Math.max(0, Math.min(1, t)));
    };
  };
  const linear = (t) => t;
  const easeOut = cubicBezier(0, 0, 0.2, 1);
  const spring = (t) => 1 - Math.exp(-6 * t) * Math.cos(9 * t);
  const bounceOut = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d; return n * t * t + 0.984375;
  };

  // graph geometry (fixed px so plotted curve and its riding dot line up exactly)
  const GW = 128, GH = 76, PAD = 8, INW = GW - PAD * 2;
  const Y0 = 64, Y1 = 18, PH = Y0 - Y1;
  const gx = (t) => PAD + t * INW;
  const gy = (v) => Y0 - v * PH;
  const TARGET = 82;
  const N = 64;       // dense samples so the piecewise-linear tween reads as a true curve
  const SMAX = 2.6;   // speed that maps to a full-length trail

  // three synced tracks per lane: marker translateX, velocity-trail scaleX, graph-dot transform
  const keyframesFor = (fn, id) => {
    let trip = "", plot = "", trail = "", prev = fn(0);
    for (let i = 0; i <= N; i++) {
      const t = i / N, v = fn(t), kf = (t * 72).toFixed(2);
      const speed = i === 0 ? Math.abs((fn(1 / N) - fn(0)) * N) : Math.abs((v - prev) * N);
      const sX = Math.max(0, Math.min(1, speed / SMAX));
      trip += `${kf}%{transform:translateX(${(v * TARGET).toFixed(2)}%)}`;
      plot += `${kf}%{transform:translate(${(gx(t) - 3).toFixed(2)}px,${(gy(v) - 3).toFixed(2)}px)}`;
      trail += `${kf}%{transform:translate(-100%,-50%) scaleX(${sX.toFixed(3)})}`;
      prev = v;
    }
    const vE = fn(1);
    trip += `100%{transform:translateX(${(vE * TARGET).toFixed(2)}%)}`;
    plot += `100%{transform:translate(${(gx(1) - 3).toFixed(2)}px,${(gy(vE) - 3).toFixed(2)}px)}`;
    trail += `100%{transform:translate(-100%,-50%) scaleX(0)}`;
    return `@keyframes mo_trip_${id}{${trip}}@keyframes mo_plot_${id}{${plot}}@keyframes mo_trail_${id}{${trail}}`;
  };

  const lanes = [
    { id: "lin", name: "linear", verdict: "dead", vc: danger, fn: linear, spec: "cubic-bezier(0, 0, 1, 1)", ms: "1580 ms · constant velocity", note: "no accel · no brake · the robot tell" },
    { id: "out", name: "ease-out", verdict: "polite", vc: bone, fn: easeOut, spec: "cubic-bezier(0, 0, .2, 1)", ms: "1580 ms · decelerates in", note: "brakes on arrival · safe, a little flat" },
    { id: "spr", name: "spring", verdict: "alive", vc: amber, fn: spring, spec: "spring · k 210 · c 18 · m 1", ms: "overshoot 1.12 · settles ~2.1 s", note: "accelerates, passes the line, settles back", hero: true },
    { id: "bnc", name: "bounce", verdict: "playful", vc: amber, fn: bounceOut, spec: "cubic bounce · 4 contacts", ms: "900 ms · gravity + restitution", note: "drops onto the line and rebounds" },
  ];

  const staticCSS =
    `.pg-motion button:focus-visible{outline:2px solid ${amber};outline-offset:2px;}` +
    // power-on
    `.mo-face{animation:mo-boot .6s cubic-bezier(.22,1,.36,1) both;}` +
    `@keyframes mo-boot{from{opacity:0;transform:scale(.986);}to{opacity:1;transform:none;}}` +
    `.mo-lane{animation:mo-lanein .5s cubic-bezier(.22,1,.36,1) both;}` +
    `@keyframes mo-lanein{from{opacity:0;transform:translateX(-10px);}to{opacity:1;transform:none;}}` +
    `.mo-curve{stroke-dasharray:100;stroke-dashoffset:100;animation:mo-draw .85s cubic-bezier(.7,0,.2,1) both;}` +
    `@keyframes mo-draw{to{stroke-dashoffset:0;}}` +
    // marker fades in at the start of a run and out at rest, so the loop never teleports
    `@keyframes mo_fade{0%{opacity:0}5%{opacity:1}88%{opacity:1}100%{opacity:0}}` +
    `@media (prefers-reduced-motion: reduce){.mo-face,.mo-lane{animation:none;opacity:1;transform:none;}.mo-curve{animation:none;stroke-dashoffset:0;}}`;
  const css = staticCSS + lanes.map((l) => keyframesFor(l.fn, l.id)).join("");

  const cols = "minmax(150px,182px) minmax(0,1fr) 128px";
  const gap = "clamp(14px,2vw,30px)";
  const curvePts = (fn) => Array.from({ length: N + 1 }, (_, i) => { const t = i / N; return `${gx(t).toFixed(1)},${gy(fn(t)).toFixed(1)}`; }).join(" ");

  return (
    <div className="pg-motion" style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", background: bg, color: bone, fontFamily: mono, display: "flex", flexDirection: "column" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* instrument header rail */}
      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "12px clamp(20px,4vw,44px)", borderBottom: `1px solid ${grid}` }}>
        <BackTab theme={{ ink: bone, line: grid, mono, radius: 3 }} onClick={onBack} />
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".24em", textTransform: "uppercase", color: dim }}>
          antidote / motion <span style={{ color: amber }}>· ch1</span>
        </span>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 1180, width: "100%", margin: "0 auto", padding: "clamp(12px,2vh,26px) clamp(20px,4vw,44px)", boxSizing: "border-box" }}>
        <h1 className="mo-face" style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(24px,3.6vh,42px)", lineHeight: 1.06, letterSpacing: "0", margin: 0, maxWidth: "24ch" }}>
          Good motion has <span style={{ color: amber, textShadow: glow }}>physics</span>. Slop is linear and eternal.
        </h1>

        {/* the instrument face */}
        <div className="scanlines mo-face" style={{
          position: "relative", overflow: "hidden", marginTop: "clamp(12px,2vh,24px)", animationDelay: ".08s",
          border: `1px solid ${grid}`, borderRadius: 8, padding: "clamp(12px,2vw,24px) clamp(16px,2.4vw,30px)", backgroundColor: bg,
          backgroundImage: `repeating-linear-gradient(0deg, ${grid} 0 1px, transparent 1px 44px), repeating-linear-gradient(90deg, ${grid} 0 1px, transparent 1px 44px)`,
        }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, background: "repeating-linear-gradient(0deg, rgba(233,228,216,.035) 0 1px, transparent 1px 3px)" }} />

          <div style={{ position: "relative", zIndex: 2 }}>
            {/* column header row */}
            <div style={{ display: "grid", gridTemplateColumns: cols, gap, alignItems: "baseline", paddingBottom: 9, borderBottom: `1px solid ${grid}` }}>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: dim }}>curve / verdict</span>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: dim, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span>same trip · trail = speed · in sync</span>
                <span style={{ color: dimAmber }}>{reduce ? "reduced-motion · frozen" : `loop ${DUR} ms`}</span>
              </span>
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: dim }}>curve · v ÷ t</span>
            </div>

            {/* four lanes */}
            {lanes.map((l, i) => (
              <div key={l.id} className="mo-lane" style={{ display: "grid", gridTemplateColumns: cols, gap, alignItems: "center", minHeight: "clamp(60px,8.4vh,82px)", borderTop: i ? `1px solid ${grid}` : "none", animationDelay: `${(0.16 + i * 0.09).toFixed(2)}s` }}>
                {/* label + verdict + technical spec */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: display, fontWeight: 700, fontSize: "clamp(19px,2.4vh,26px)", color: l.hero ? amber : bone, textShadow: l.hero ? glow : "none" }}>{l.name}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: l.vc, textShadow: l.vc === amber ? glow : "none" }}>{l.verdict}</span>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: ".02em", color: dim, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.spec}</div>
                  <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: ".02em", color: dimAmber, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.ms}</div>
                </div>

                {/* travel track */}
                <div style={{ position: "relative", height: 40, minWidth: 0 }} aria-hidden>
                  <div style={{ position: "absolute", left: `${TARGET}%`, right: 0, top: 8, bottom: 8, background: "rgba(240,169,59,.05)" }} />
                  <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: grid }} />
                  <div style={{ position: "absolute", left: 0, top: "50%", width: 1, height: 14, background: grid, transform: "translateY(-50%)" }} />
                  <div style={{ position: "absolute", left: 0, bottom: -1, fontFamily: mono, fontSize: 8.5, letterSpacing: ".1em", color: dim }}>0</div>
                  <div style={{ position: "absolute", left: `${TARGET}%`, top: "50%", height: 20, width: 1, backgroundImage: `repeating-linear-gradient(0deg, ${amber} 0 3px, transparent 3px 6px)`, transform: "translate(-0.5px,-50%)" }} />
                  <div style={{ position: "absolute", left: `${TARGET}%`, top: -1, transform: "translateX(-50%)", fontFamily: mono, fontSize: 8.5, letterSpacing: ".1em", textTransform: "uppercase", color: amber, whiteSpace: "nowrap" }}>target</div>
                  <div style={{ position: "absolute", right: 0, bottom: -1, fontFamily: mono, fontSize: 8.5, letterSpacing: ".08em", textTransform: "uppercase", color: dimAmber }}>overshoot</div>

                  {/* moving marker: a full-width wrapper translateX-driven; carries the trail + dot */}
                  <div style={{
                    position: "absolute", left: 0, top: "50%", width: "100%", height: 0,
                    transform: reduce ? `translateX(${(l.fn(1) * TARGET).toFixed(2)}%)` : undefined,
                    animation: reduce ? "none" : `mo_trip_${l.id} ${DUR}ms linear ${DELAY}ms infinite, mo_fade ${DUR}ms linear ${DELAY}ms infinite`,
                    willChange: "transform, opacity",
                  }}>
                    {/* velocity trail — length tracks instantaneous speed */}
                    <div style={{
                      position: "absolute", left: 0, top: 0, width: 50, height: 3, borderRadius: 2,
                      background: `linear-gradient(to left, ${amber}, rgba(240,169,59,0))`, transformOrigin: "right center",
                      transform: reduce ? "translate(-100%,-50%) scaleX(0)" : undefined,
                      animation: reduce ? "none" : `mo_trail_${l.id} ${DUR}ms linear ${DELAY}ms infinite`, willChange: "transform",
                    }} />
                    <div style={{ position: "absolute", left: 0, top: 0, width: 12, height: 12, borderRadius: "50%", background: amber, boxShadow: glow, transform: "translate(-50%,-50%)" }} />
                  </div>
                </div>

                {/* the easing curve, plotted, with a dot riding it in sync */}
                <div style={{ position: "relative", width: GW, height: GH }} aria-hidden>
                  <svg viewBox={`0 0 ${GW} ${GH}`} width={GW} height={GH} style={{ position: "absolute", inset: 0, display: "block", border: `1px solid ${grid}`, borderRadius: 3, background: "rgba(240,169,59,.03)" }}>
                    <line x1={PAD} y1={Y1} x2={GW - PAD} y2={Y1} stroke={dimAmber} strokeWidth="1" strokeDasharray="2 3" />
                    <line x1={PAD} y1={Y0} x2={GW - PAD} y2={Y0} stroke={grid} strokeWidth="1" />
                    <text x={PAD} y={Y1 - 3} fill={dim} style={{ fontFamily: mono, fontSize: 7, letterSpacing: ".06em" }}>1.0</text>
                    <text x={PAD} y={Y0 + 8} fill={dim} style={{ fontFamily: mono, fontSize: 7, letterSpacing: ".06em" }}>0</text>
                    <text x={GW - PAD} y={Y0 + 8} fill={dim} textAnchor="end" style={{ fontFamily: mono, fontSize: 7, letterSpacing: ".06em" }}>t</text>
                    <polyline className="mo-curve" pathLength="100" points={curvePts(l.fn)} fill="none" stroke={amber} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" style={{ filter: dglow, animationDelay: `${(0.42 + i * 0.09).toFixed(2)}s` }} />
                  </svg>
                  <div style={{
                    position: "absolute", top: 0, left: 0, width: 6, height: 6, borderRadius: "50%", background: bone, boxShadow: glow,
                    transform: reduce ? `translate(${(gx(1) - 3).toFixed(2)}px,${(gy(l.fn(1)) - 3).toFixed(2)}px)` : undefined,
                    animation: reduce ? "none" : `mo_plot_${l.id} ${DUR}ms linear ${DELAY}ms infinite`, willChange: "transform",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* the argument */}
        <div className="mo-face" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 14, marginTop: "clamp(10px,1.8vh,22px)", animationDelay: ".5s", fontFamily: mono, fontSize: 12, color: dim, flexWrap: "wrap", lineHeight: 1.5 }}>
          <span>The trail is speed made visible. Real things accelerate, overshoot, and settle because they arrived.</span>
          <span style={{ width: 1, height: 13, background: grid }} />
          <span style={{ textDecoration: "line-through", textDecorationColor: dimAmber, color: dim, opacity: .8 }}>linear fade · animate-pulse · moves forever, means nothing</span>
        </div>
      </div>
    </div>
  );
}

window.PageMotion = PageMotion;
