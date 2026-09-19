/* Page · Composition — the layout is literally built on the golden section. The
   whole spread is a golden rectangle, subdivided into the Fibonacci squares. The
   ONE thing that leads sits in the largest square; the image, the pull-quote and
   the focal mark each occupy the next square down, so hierarchy IS the geometry.
   The golden spiral draws itself in as the reading path, threading the blocks in
   order and tightening to the eye. Bottle-green art-magazine palette, one viewport. */
const { useState: useStateCm, useRef: useRefCm, useMemo: useMemoCm } = React;

/* The plate — an interactive halftone. A bold form full of dark dots sits in a faint
   field; the dots part around the cursor. Square viewBox, so the coral ring never crops. */
function PlateField({ deep, bone, sage, coral }) {
  const V = 360, cx = 180, cy = 180, R = 126, ringR = 136, step = 25, RI = 66;
  const base = useMemoCm(() => {
    const a = [];
    for (let y = step / 2; y < V; y += step)
      for (let x = step / 2; x < V; x += step)
        a.push({ x, y, inside: (x - cx) * (x - cx) + (y - cy) * (y - cy) < R * R });
    return a;
  }, []);
  const reduce = useMemoCm(() => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const [m, setM] = useStateCm(null);
  const svgRef = useRefCm(null), raf = useRefCm(0), pend = useRefCm(null);
  const onMove = (e) => {
    if (reduce || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    pend.current = { x: (e.clientX - r.left) / r.width * V, y: (e.clientY - r.top) / r.height * V };
    if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; setM(pend.current); });
  };
  return (
    <svg ref={svgRef} viewBox={`0 0 ${V} ${V}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      onMouseMove={onMove} onMouseLeave={() => setM(null)} style={{ display: "block", cursor: "crosshair" }}
      role="img" aria-label="Interactive halftone: a bold form in a field of dots that part around the cursor">
      <rect width={V} height={V} fill={deep} />
      <circle cx={cx} cy={cy} r={R} fill={bone} />
      <circle cx={cx} cy={cy} r={ringR} fill="none" stroke={coral} strokeWidth="2" />
      {base.map((d, i) => {
        let x = d.x, y = d.y;
        if (m) {
          const dx = x - m.x, dy = y - m.y, dist = Math.hypot(dx, dy);
          if (dist < RI) { const f = 1 - dist / RI, len = dist || 1, push = f * f * 16; x += dx / len * push; y += dy / len * push; }
        }
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={d.inside ? 3 : 1.9}
          fill={d.inside ? deep : sage} fillOpacity={d.inside ? 1 : 0.42} />;
      })}
      <rect x="16" y="330" width="9" height="9" fill={coral} />
    </svg>
  );
}

function PageCompose({ onBack }) {
  const ground = "#10241D", bone = "#ECE6D6", coral = "#F04E37", sage = "#6E7F72";
  const deep = "#0B1A14", boneDim = "#B9B49F", line = "#3A5147";
  const mono = "'Martian Mono', monospace", body = "'Public Sans', sans-serif", serif = "'Instrument Serif', serif";

  const css = `
    .pgco-root ::selection { background: ${bone}; color: ${ground}; }
    .pgco-root { height: 100vh; overflow: hidden; box-sizing: border-box; display: flex; flex-direction: column; }
    .pgco-root *, .pgco-root *::before, .pgco-root *::after { box-sizing: border-box; }

    /* the stage centres the golden canvas in whatever room is left */
    .pgco-stage { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center;
      padding: clamp(10px,2vh,22px) clamp(20px,4vw,40px); }
    /* the canvas IS a golden rectangle */
    .pgco-canvas { position: relative; aspect-ratio: 1.618 / 1; height: 100%; max-width: 100%; margin-inline: auto; }

    /* the golden geometry, drawn over the canvas 1:1 (viewBox maps exactly) */
    .pgco-geo { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; overflow: visible; }
    .pgco-geo .sq { stroke: ${sage}; stroke-opacity: .22; stroke-width: 1; fill: none; }
    .pgco-geo .spiral { stroke: ${coral}; stroke-width: 1.4; stroke-opacity: .3; fill: none; stroke-linecap: round;
      stroke-dasharray: 100; stroke-dashoffset: 100; animation: pgco-draw 1.8s cubic-bezier(.7,0,.2,1) .35s forwards; }

    /* the blocks sit inside the squares */
    .pgco-A, .pgco-B, .pgco-C, .pgco-eye { position: absolute; }
    .pgco-A { left: 0; top: 0; width: 61.8%; height: 100%; padding: clamp(10px,1.6vw,22px) clamp(16px,2vw,30px) clamp(10px,1.6vw,22px) 0;
      display: flex; flex-direction: column; justify-content: center; gap: clamp(12px,2.4vh,26px); }
    .pgco-B { left: 61.8%; top: 0; width: 38.2%; height: 61.8%; padding: clamp(6px,1vw,14px) 0 clamp(6px,1vw,14px) clamp(12px,1.6vw,22px); }
    .pgco-C { left: 61.8%; top: 61.8%; width: 38.2%; height: 38.2%; padding: clamp(10px,1.4vw,20px) 0 0 clamp(12px,1.6vw,22px);
      display: flex; flex-direction: column; justify-content: space-between; }

    .pgco-lead { display: inline-block; background: ${coral}; color: ${ground};
      font-family: ${body}; font-weight: 700; letter-spacing: -.04em; line-height: .8;
      font-size: clamp(52px, min(11vw,17vh), 150px); padding: .08em .14em .16em; margin-left: -.02em;
      animation: pgco-leadwipe .6s cubic-bezier(.2,.7,.2,1) .3s both; }
    .pgco-plate { width: 100%; height: 100%; position: relative; overflow: hidden; background: ${deep}; border: 1px solid ${sage}55;
      transition: transform .35s cubic-bezier(.2,.7,.2,1); }
    .pgco-plate:hover { transform: translateY(-4px); }
    .pgco-root :focus-visible { outline: 2px solid ${bone}; outline-offset: 3px; }

    .pgco-anim { animation: pgco-rise .6s cubic-bezier(.2,.7,.2,1) both; }
    @keyframes pgco-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes pgco-leadwipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
    @keyframes pgco-draw { to { stroke-dashoffset: 0; } }
    @keyframes pgco-dot { from { opacity: 0; transform: translate(-50%,-50%) scale(.4); } to { opacity: 1; transform: translate(-50%,-50%) scale(1); } }

    /* reading-order dots that ride the spiral */
    .pgco-rd { position: absolute; z-index: 4; width: clamp(20px,2vw,26px); height: clamp(20px,2vw,26px); border-radius: 50%;
      background: ${coral}; color: ${ground}; display: grid; place-items: center; transform: translate(-50%,-50%);
      font-family: ${mono}; font-weight: 600; font-size: clamp(10px,1vw,12px); box-shadow: 0 4px 14px -4px rgba(0,0,0,.5);
      animation: pgco-dot .4s cubic-bezier(.2,1.3,.4,1) both; }

    @media (prefers-reduced-motion: reduce) {
      .pgco-anim, .pgco-lead, .pgco-rd { animation: none !important; opacity: 1 !important; transform: translate(-50%,-50%) !important; clip-path: none !important; }
      .pgco-rd { transform: translate(-50%,-50%) !important; }
      .pgco-A, .pgco-B, .pgco-C { animation: none !important; }
      .pgco-geo .spiral { animation: none !important; stroke-dashoffset: 0 !important; }
      .pgco-plate { transition: none !important; }
    }
    @media (max-width: 820px), (max-height: 600px) {
      .pgco-root { height: auto; min-height: 100vh; overflow: visible; }
      .pgco-stage { display: block; }
      .pgco-canvas { aspect-ratio: auto; height: auto; }
      .pgco-geo { display: none; }
      .pgco-A, .pgco-B, .pgco-C { position: static; width: 100%; height: auto; padding: 14px 0; }
    }
  `;

  return (
    <div className="pgco-root" style={{ background: ground, color: bone, fontFamily: body }}>
      <style>{css}</style>

      {/* folio bar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "12px clamp(20px,4vw,40px)", borderBottom: `1px solid ${sage}55` }}>
        <BackTab theme={{ ink: bone, line: sage, mono }} onClick={onBack} />
        <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".1em", color: sage }}>Antidote / Composition · built on the golden section</span>
      </div>

      <div className="pgco-stage">
        <div className="pgco-canvas">

          {/* the golden geometry: nested squares + the spiral reading-path */}
          <svg className="pgco-geo" viewBox="0 0 1618 1000" preserveAspectRatio="none" aria-hidden="true">
            {/* Fibonacci square divisions */}
            <line className="sq" x1="1000" y1="0" x2="1000" y2="1000" />
            <line className="sq" x1="1000" y1="618" x2="1618" y2="618" />
            <line className="sq" x1="1236" y1="618" x2="1236" y2="1000" />
            <line className="sq" x1="1000" y1="764" x2="1236" y2="764" />
            <line className="sq" x1="1146" y1="618" x2="1146" y2="764" />
            {/* the golden spiral, threading the squares to the eye */}
            <path className="spiral" pathLength="100"
              d="M 0 1000 A 1000 1000 0 0 0 1000 0 A 618 618 0 0 0 1618 618 A 382 382 0 0 0 1236 1000 A 236 236 0 0 0 1000 764 A 146 146 0 0 0 1146 618" />
          </svg>

          {/* SQUARE 1 (largest) — the one thing that leads */}
          <div className="pgco-A">
            <div className="pgco-anim" style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".12em", color: sage }}>On hierarchy · field notes</div>
            <div>
              <div className="pgco-anim" style={{ fontFamily: serif, fontSize: "clamp(18px,2.4vw,34px)", lineHeight: 1.04, color: boneDim, marginBottom: 4, animationDelay: ".1s" }}>Let one thing</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: ".06em" }}>
                <span className="pgco-lead">lead</span>
                <span aria-hidden style={{ fontFamily: serif, fontSize: "clamp(28px,3.2vw,50px)", lineHeight: 1, color: sage }}>.</span>
              </div>
            </div>
            <p className="pgco-anim" style={{ fontFamily: body, fontSize: "clamp(13px,1.1vw,16px)", lineHeight: 1.6, color: bone, margin: 0, maxWidth: "30ch", animationDelay: ".5s" }}>
              Not everything needs to be the same size. Give the one thing that matters the biggest square, and let the rest take the space it earns.
            </p>
          </div>

          {/* SQUARE 2 — one image, given its own square */}
          <div className="pgco-B">
            <div className="pgco-anim pgco-plate" style={{ animationDelay: ".62s" }}>
              <PlateField deep={deep} bone={boneDim} sage={sage} coral={coral} />
            </div>
          </div>

          {/* SQUARE 3 — the pull-quote, then the eye */}
          <div className="pgco-C">
            <blockquote className="pgco-anim" style={{ fontFamily: serif, fontStyle: "italic", fontSize: "clamp(17px,1.9vw,30px)", lineHeight: 1.06, color: bone, margin: 0, letterSpacing: "-.005em", animationDelay: ".9s" }}>
              Nine things shouting is just silence.
            </blockquote>
            <div className="pgco-anim" style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: ".06em", color: sage, animationDelay: "1.1s", lineHeight: 1.6, whiteSpace: "nowrap" }}>
              the spiral is where your eye goes
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

window.PageCompose = PageCompose;
