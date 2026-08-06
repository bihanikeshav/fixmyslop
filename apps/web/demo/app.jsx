/* App — slop → second-order trap → index hub → routed antidote pages. */
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "liberation": "circle"
}/*EDITMODE-END*/;

const PAGE_COMPONENTS = { surfaces: PageGlass, color: PageColor, imagery: PageImagery, controls: PageControls, compose: PageCompose, type: PageType, copy: PageCopy, motion: PageMotion };

/* Per-page entrance reveals — each ENACTS that page's argument, and every one is
   DISTINCT: no two pages share a transition. `o` = open. Transform / opacity /
   clip-path only (compositor-friendly). Directions/shapes are all different. */
const REVEAL = {
  // Surfaces (glass) — rises up from the bottom, like a pane settling into frame.
  surfaces: (o) => {
    const c = o ? "inset(0 0 0 0)" : "inset(100% 0 0 0)";
    return { clipPath: c, WebkitClipPath: c, transition: "clip-path .85s cubic-bezier(.7,0,.16,1), -webkit-clip-path .85s cubic-bezier(.7,0,.16,1)" };
  },
  // Color — a single diagonal sweep paints the page in, along the gradient's axis.
  color: (o) => {
    const c = o ? "polygon(0 0, 135% 0, 100% 100%, 0 100%)" : "polygon(0 0, 0 0, 0 100%, 0 100%)";
    return { clipPath: c, WebkitClipPath: c, transition: "clip-path 1.05s cubic-bezier(.72,0,.16,1), -webkit-clip-path 1.05s cubic-bezier(.72,0,.16,1)" };
  },
  // Imagery — wipes in from the right, uncovering the two frames.
  imagery: (o) => {
    const c = o ? "inset(0 0 0 0)" : "inset(0 0 0 100%)";
    return { clipPath: c, WebkitClipPath: c, transition: "clip-path .8s cubic-bezier(.72,0,.18,1), -webkit-clip-path .8s cubic-bezier(.72,0,.18,1)" };
  },
  // Controls — a firm scale-in that settles, like a control releasing after a press.
  controls: (o) => ({
    opacity: o ? 1 : 0, transform: o ? "scale(1)" : "scale(.965)",
    transition: "transform .55s cubic-bezier(.2,1.2,.3,1), opacity .4s ease",
  }),
  // Composition — a calm editorial cross-fade, the spread easing back into place.
  compose: (o) => ({
    opacity: o ? 1 : 0, transform: o ? "scale(1)" : "scale(1.035)",
    transition: "transform 1.1s cubic-bezier(.22,1,.36,1), opacity .8s ease",
  }),
  // Type — the page parts from the centre like a curtain drawing back.
  type: (o) => {
    const c = o ? "inset(0 0 0 0)" : "inset(0 50% 0 50%)";
    return { clipPath: c, WebkitClipPath: c, transition: "clip-path 1s cubic-bezier(.78,0,.18,1), -webkit-clip-path 1s cubic-bezier(.78,0,.18,1)" };
  },
  // Copy — a left-to-right wipe, the way you read a line.
  copy: (o) => {
    const c = o ? "inset(0 0 0 0)" : "inset(0 100% 0 0)";
    return { clipPath: c, WebkitClipPath: c, transition: "clip-path .8s cubic-bezier(.75,0,.2,1), -webkit-clip-path .8s cubic-bezier(.75,0,.2,1)" };
  },
  // Motion — one reading sweeps the page open, top to bottom.
  motion: (o) => {
    const c = o ? "inset(0 0 0% 0)" : "inset(0 0 100% 0)";
    return { clipPath: c, WebkitClipPath: c, transition: "clip-path .95s cubic-bezier(.7,0,.14,1), -webkit-clip-path .95s cubic-bezier(.7,0,.14,1)" };
  },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [stage, setStage] = useState(0); // 0 slop · 1 trap · 2 index
  const [origin, setOrigin] = useState({ x: 0.5, y: 0.5 });
  const [pageKey, setPageKey] = useState(null);
  const [pageOpen, setPageOpen] = useState(false);
  const [pageOrigin, setPageOrigin] = useState({ x: 0.5, y: 0.5 });
  const peel = t.liberation === "peel";

  // Hide the fixed "jump to the engine" button while an antidote page is open —
  // those pages own their bottom corners, and the page's own back-tab navigates.
  useEffect(() => { document.documentElement.dataset.page = pageKey ? "1" : ""; }, [pageKey]);

  const setOrg = (e, set) => {
    if (e && typeof e.clientX === "number") set({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    else set({ x: 0.5, y: 0.46 });
  };

  const liberate = (e) => { setOrg(e, setOrigin); setStage((s) => Math.min(2, s + 1)); };
  const resetAll = () => { setPageOpen(false); setTimeout(() => setPageKey(null), 700); setStage(0); };

  const openPage = (key, e) => {
    setOrg(e, setPageOrigin);
    setPageKey(key);
    requestAnimationFrame(() => requestAnimationFrame(() => setPageOpen(true)));
  };
  const closePage = () => { setPageOpen(false); setTimeout(() => setPageKey(null), 1150); };

  const base = { position: "fixed", inset: 0, overflow: "auto", WebkitOverflowScrolling: "touch" };
  const wipe = "clip-path 1.1s cubic-bezier(.65,0,.2,1), -webkit-clip-path 1.1s cubic-bezier(.65,0,.2,1)";

  const layerStyle = (i) => {
    const active = i === stage && !pageKey;
    if (peel) {
      const peeled = stage > i;
      return { ...base, zIndex: 1 + (2 - i), pointerEvents: active ? "auto" : "none", transformOrigin: "50% 0%", transformStyle: "preserve-3d",
        transform: peeled ? "perspective(1700px) rotateX(36deg) translateY(-74%) scale(.9)" : "none", opacity: peeled ? 0 : 1,
        transition: "transform 1.1s cubic-bezier(.7,0,.3,1), opacity 1s ease", boxShadow: peeled ? "0 60px 120px rgba(0,0,0,.5)" : "none" };
    }
    const open = stage >= i;
    const clip = i === 0 ? "none" : `circle(${open ? 150 : 0}% at ${origin.x * 100}% ${origin.y * 100}%)`;
    return { ...base, zIndex: 1 + i, pointerEvents: active ? "auto" : "none", clipPath: clip, WebkitClipPath: clip, transition: wipe };
  };

  const ActivePage = pageKey ? PAGE_COMPONENTS[pageKey] : null;
  const revealStyle = pageKey ? (REVEAL[pageKey] || REVEAL.surfaces)(pageOpen) : null;

  return (
    <React.Fragment>
      <div style={layerStyle(0)}><SlopLayer onLiberate={liberate} /></div>
      <div style={layerStyle(1)}><SecondOrderLayer onLiberate={liberate} /></div>
      <div style={layerStyle(2)}><IndexLayer onRoute={openPage} onReset={resetAll} active={stage === 2 && !pageKey} /></div>

      {ActivePage && (
        <div style={{ ...base, zIndex: 10, pointerEvents: pageOpen ? "auto" : "none", willChange: "transform, clip-path, filter, opacity", ...revealStyle }}>
          <ActivePage onBack={closePage} />
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="Liberation reveal" />
        <TweakRadio label="Style" value={t.liberation}
          options={[{ value: "circle", label: "Circle wipe" }, { value: "peel", label: "Peel off" }]}
          onChange={(v) => setTweak("liberation", v)} />

        <TweakSection label="Jump to" />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["Slop", 0], ["Trap", 1], ["Index", 2]].map(([l, s]) => (
            <TweakButton key={l} label={l} onClick={() => { setPageOpen(false); setTimeout(() => setPageKey(null), 50); setOrigin({ x: .5, y: .46 }); setStage(s); }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {window.SLOP.PAGES.map((p) => (
            <TweakButton key={p.key} label={p.key} onClick={() => { setStage(2); openPage(p.key, null); }} />
          ))}
        </div>
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
