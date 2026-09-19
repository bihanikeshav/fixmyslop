/* Page · Text humanizer. An editorial workbench, not a marketing feature grid.
   The signature interaction is a three-state proof: source, revision, and the
   safety audit that decides whether the revision is allowed to leave the page. */
function PageText({ onBack }) {
  const [view, setView] = React.useState("revision");
  const proof = window.TEXTSLOP_SUMMARY;

  const paper = "#F1EEE5", ink = "#17191F", mute = "#626664";
  const accent = "#8C5858", line = "rgba(23,25,31,.18)", wash = "#E7E3D8";
  const serif = "'Newsreader', Georgia, serif";
  const sans = "'Hanken Grotesk', system-ui, sans-serif";
  const mono = "'Martian Mono', ui-monospace, monospace";

  const views = {
    source: {
      label: "Source / 36 words",
      body: (
        <p>
          <mark>Of course</mark>, this <mark>isn’t just</mark> another writing tool. It is a
          <mark> transformative, seamless solution</mark> designed to <mark>empower teams to
          unlock the full potential</mark> of clear communication while keeping names,
          numbers, dates, links, and quoted text intact.
        </p>
      ),
      note: "The voice is buried under a greeting, negative framing, and a promotional cluster.",
    },
    revision: {
      label: "Revision / 17 words",
      body: (
        <p>
          This writing tool helps teams communicate clearly. It keeps names, numbers,
          dates, links, and quoted text intact.
        </p>
      ),
      note: "The claim stays. The stock scaffolding goes.",
    },
    audit: {
      label: "Safety audit / pass",
      body: (
        <dl className="tx-audit-list">
          <div><dt>Protected</dt><dd>names · numbers · dates · links · quotations</dd></div>
          <div><dt>Claim frame</dt><dd>actor · polarity · modality · causal order</dd></div>
          <div><dt>Voice</dt><dd>register inferred; contextual signals left alone</dd></div>
          <div><dt>Decision</dt><dd><strong>release revision</strong></dd></div>
        </dl>
      ),
      note: "If drift survives the repair pass, the source is returned unchanged.",
    },
  };

  const active = views[view];
  const stages = ["protect", "read register", "scan", "revise", "rescan", "release or revert"];

  return (
    <div className="tx-scope" style={{ height: "100%", overflowY: "auto", background: paper, color: ink, fontFamily: sans }}>
      <style>{`
        .tx-scope, .tx-scope * { box-sizing: border-box; }
        .tx-scope ::selection { background: ${accent}; color: white; }
        .tx-scope :focus-visible { outline: 2px solid ${accent}; outline-offset: 3px; }
        .tx-shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; }
        .tx-top { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:15px clamp(18px,3vw,42px); border-bottom:1px solid ${line}; }
        .tx-top-meta { font: 500 11.5px/1.4 ${mono}; color:${mute}; text-align:right; }
        .tx-top-meta strong { display:block; color:${ink}; font-weight:600; }
        .tx-main { width:min(1320px,100%); margin:auto; padding:clamp(30px,5vw,72px) clamp(18px,4vw,56px) clamp(34px,5vw,70px); display:grid; grid-template-columns:minmax(250px,.72fr) minmax(430px,1.28fr); gap:clamp(34px,7vw,110px); align-items:center; }
        .tx-intro h1 { margin:0; max-width:7.6ch; font:400 clamp(58px,6.7vw,80px)/.88 ${serif}; letter-spacing:-.045em; }
        .tx-intro h1 span { color:${accent}; }
        .tx-intro p { max-width:38ch; margin:28px 0 0; font-size:16px; line-height:1.55; color:${mute}; }
        .tx-rule { width:72px; height:2px; background:${accent}; margin-top:32px; }

        .tx-workbench { position:relative; isolation:isolate; border:1.5px solid ${ink}; background:${paper}; min-width:0; }
        .tx-workbench::before { content:""; position:absolute; inset:8px -8px -8px 8px; z-index:-1; background:${wash}; }
        .tx-tabs { display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1.5px solid ${ink}; }
        .tx-tab { appearance:none; min-height:44px; border:0; border-right:1px solid ${line}; background:transparent; color:${mute}; cursor:pointer; padding:13px 10px; font:500 11.5px/1 ${mono}; }
        .tx-tab:last-child { border-right:0; }
        .tx-tab:hover { color:${ink}; background:${wash}; }
        .tx-tab[aria-pressed="true"] { background:${accent}; color:white; }
        .tx-tab[aria-pressed="true"]:hover { background:${accent}; color:white; }
        .tx-tab:disabled { cursor:not-allowed; color:${mute}; background:${wash}; opacity:.58; }
        .tx-paper { min-height:320px; padding:clamp(24px,4vw,54px); display:flex; flex-direction:column; justify-content:space-between; background-image:linear-gradient(${line} 1px,transparent 1px); background-size:100% 31px; }
        .tx-paper-head { display:flex; justify-content:space-between; gap:16px; align-items:baseline; font:500 11.5px/1.4 ${mono}; color:${mute}; }
        .tx-status { color:${accent}; }
        .tx-copy { margin:clamp(28px,5vh,52px) 0; }
        .tx-copy p { margin:0; max-width:24ch; font:400 clamp(22px,2.7vw,42px)/1.18 ${serif}; letter-spacing:-.018em; }
        .tx-copy mark { color:${ink}; background:linear-gradient(transparent 58%,rgba(49,87,232,.20) 58%); }
        .tx-note { margin:0; max-width:54ch; color:${mute}; font-size:11.5px; line-height:1.5; }
        .tx-audit-list { margin:0; display:grid; gap:0; border-top:1px solid ${line}; }
        .tx-audit-list > div { display:grid; grid-template-columns:110px 1fr; gap:18px; padding:12px 0; border-bottom:1px solid ${line}; }
        .tx-audit-list dt { font:500 11.5px/1.4 ${mono}; color:${mute}; }
        .tx-audit-list dd { margin:0; font-size:16px; line-height:1.4; }
        .tx-audit-list strong { color:${accent}; font-weight:600; }

        .tx-ledger { border-top:1.5px solid ${ink}; display:grid; grid-template-columns:1.35fr .65fr; }
        .tx-pipeline, .tx-proof { padding:clamp(22px,3vw,38px) clamp(18px,4vw,56px); }
        .tx-pipeline { border-right:1.5px solid ${ink}; }
        .tx-label { font:500 11.5px/1.4 ${mono}; color:${mute}; margin-bottom:16px; }
        .tx-stages { display:grid; grid-template-columns:repeat(6,1fr); gap:0; }
        .tx-stage { position:relative; padding:18px 12px 0 0; border-top:1px solid ${line}; font:500 11.5px/1.35 ${mono}; color:${ink}; }
        .tx-stage::before { content:""; position:absolute; top:-4px; left:0; width:7px; height:7px; background:${accent}; }
        .tx-stage + .tx-stage { padding-left:14px; }
        .tx-proof table { width:100%; border-collapse:collapse; font:500 11.5px/1.45 ${mono}; }
        .tx-proof th, .tx-proof td { padding:5px 0; border-bottom:1px solid ${line}; text-align:left; }
        .tx-proof th { color:${mute}; font-weight:400; }
        .tx-proof td:last-child { text-align:right; color:${accent}; }
        .tx-footnote { margin:10px 0 0; color:${mute}; font-size:11.5px; line-height:1.45; }

        @media (max-width: 900px) {
          .tx-main { grid-template-columns:1fr; align-items:start; }
          .tx-intro h1 { max-width:10ch; font-size:clamp(58px,12vw,80px); }
          .tx-ledger { grid-template-columns:1fr; }
          .tx-pipeline { border-right:0; border-bottom:1.5px solid ${ink}; }
        }
        @media (max-width: 600px) {
          .tx-top-meta { display:none; }
          .tx-main { padding-top:34px; gap:30px; }
          .tx-workbench::before { inset:5px -5px -5px 5px; }
          .tx-paper { min-height:360px; }
          .tx-paper-head { align-items:flex-start; flex-direction:column; }
          .tx-copy p { font-size:clamp(22px,7vw,30.5px); }
          .tx-audit-list > div { grid-template-columns:1fr; gap:4px; }
          .tx-stages { grid-template-columns:repeat(2,1fr); row-gap:18px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .tx-scope *, .tx-scope *::before { scroll-behavior:auto !important; transition:none !important; animation:none !important; }
        }
      `}</style>

      <div className="tx-shell">
        <header className="tx-top">
          <BackTab theme={{ ink, line: ink, mono }} onClick={onBack} />
          <div className="tx-top-meta"><span>09 / language system</span><strong>Text humanizer</strong></div>
        </header>

        <main className="tx-main">
          <section className="tx-intro">
            <h1>Keep the voice.<br /><span>Cut the tells.</span></h1>
            <p>The humanizer removes stock AI phrasing without sanding every writer into the same voice. Claims are checked before a revision is released.</p>
            <div className="tx-rule" aria-hidden="true" />
          </section>

          <section className="tx-workbench" aria-label="Interactive humanizer proof">
            <div className="tx-tabs" role="group" aria-label="Text states">
              {Object.keys(views).map((key) => (
                <button key={key} type="button" className="tx-tab"
                  aria-pressed={view === key} onClick={() => setView(key)}>{key}</button>
              ))}
            </div>
            <div className="tx-paper" aria-live="polite">
              <div className="tx-paper-head"><span>{active.label}</span><span className="tx-status">humanizer v{proof.version}</span></div>
              <div className="tx-copy" key={view}>{active.body}</div>
              <p className="tx-note">{active.note}</p>
            </div>
          </section>
        </main>

        <footer className="tx-ledger">
          <section className="tx-pipeline">
            <div className="tx-label">Decision path</div>
            <div className="tx-stages">
              {stages.map((stage, i) => <div className="tx-stage" key={stage}>{String(i + 1).padStart(2, "0")}<br />{stage}</div>)}
            </div>
          </section>
          <section className="tx-proof">
            <div className="tx-label">Benchmark ledger</div>
            <table>
              <tbody>
                <tr><th>owned fixtures</th><td>{proof.ownedFixtures}</td></tr>
                <tr><th>intervention cases</th><td>{proof.interventionCases}</td></tr>
                <tr><th>claim mutations</th><td>{proof.claimMutations}</td></tr>
                <tr><th>identity baseline</th><td>{proof.identityBaseline ? "included" : "missing"}</td></tr>
              </tbody>
            </table>
            <p className="tx-footnote">Coverage, not a victory lap. The suite measures useful edits and restraint separately.</p>
          </section>
        </footer>
      </div>
    </div>
  );
}

window.PageText = PageText;
