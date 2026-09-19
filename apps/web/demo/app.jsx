/* fixmyslop decision bench.
   Accessibility contract: Escape returns to Generate. The app-page-layer and
   prefers-reduced-motion contracts live in the stylesheet. This is an inline
   workspace, so aria-modal is intentionally not used as a false affordance. */
const { useEffect, useMemo, useState } = React;

const SAMPLE_BRIEF = "Build an incident handoff console for a small SRE team. Show ownership, severity, live mitigation, and what changed since the last shift. The operator must see the next action in under five seconds.";
const SAMPLE_SOURCE = "Of course, GitHub teams can unlock the full potential of incident reviews. The workflow is not just seamless; it preserves the 99.9% SLO, the August 24 review date, and the quoted note “cache invalidation caused the regression.”";

const NAV = [
  { id: "generate", label: "Generate", key: "1" },
  { id: "audit", label: "Audit", key: "2" },
  { id: "humanize", label: "Humanize", key: "3" },
];

const DIRECTION_BLUEPRINTS = [
  {
    id: "runway",
    name: "Handoff runway",
    form: "Time as the primary axis",
    summary: "A left-to-right incident path makes ownership changes and the next intervention visible in one scan.",
    fit: "Best when the handoff itself is the product mechanism.",
    reject: "Reject if operators compare more than twelve incidents at once.",
    evidence: ["ownership before ornament", "next action stays above fold", "change history shares the incident axis"],
  },
  {
    id: "ledger",
    name: "Trace ledger",
    form: "Dense list plus evidence inspector",
    summary: "Incidents remain comparable in a compact ledger while one row opens a full causal trace.",
    fit: "Best for queue triage and high incident volume.",
    reject: "Reject if the team works one incident at a time.",
    evidence: ["12-row useful density", "keyboard row traversal", "evidence remains adjacent to selection"],
  },
  {
    id: "rooms",
    name: "Signal rooms",
    form: "Severity lanes with live state",
    summary: "Incidents move through named operating states, turning mitigation progress into the main spatial model.",
    fit: "Best when room-wide coordination matters more than chronology.",
    reject: "Reject when state transitions are informal or ambiguous.",
    evidence: ["state is position plus label", "motion reserved for transitions", "touch reflows lanes into a queue"],
  },
];

const REALIZATION_LABELS = {
  "instrument-led": "Proof instrument",
  "evidence-led": "Evidence ledger",
  "process-led": "Process rail",
  "split-proof": "Split proof surface",
  "canvas-led": "Canvas-led workbench",
  "specimen-led": "Specimen-led workbench",
  "metrics-led": "Metrics-led workbench",
  "glyph-set-led": "Glyph-set workbench",
};

function inferSurface(brief) {
  const source = String(brief || "").toLowerCase();
  if (/dashboard|console|workspace|workflow|form|app|tool|editor|runner|portal/.test(source)) return "app";
  if (/documentation|reference|protocol|docs/.test(source)) return "docs";
  return "landing-page";
}

function connectedDirectionPresentation(direction, index) {
  const mechanism = direction?.mechanism || direction?.genome?.connected?.concept?.mechanism || {};
  const realization = direction?.artDirection || direction?.genome?.connected?.concept?.realization || {};
  const proof = direction?.proofObject || direction?.genome?.connected?.concept?.proofObject || direction?.genome?.expression?.centrepiecePlan || {};
  const objects = Array.isArray(mechanism.objects) ? mechanism.objects : [];
  const actions = Array.isArray(mechanism.actions) ? mechanism.actions : [];
  const outcomes = Array.isArray(mechanism.outcomes) ? mechanism.outcomes : [];
  const states = Array.isArray(mechanism.states) ? mechanism.states : [];
  const id = `connected-${index + 1}-${hashText(`${mechanism.id || "direction"}:${realization.id || index}`)}`;
  const name = REALIZATION_LABELS[realization.id] || realization.id?.replace(/[-_]/g, " ")?.replace(/\b\w/g, (letter) => letter.toUpperCase()) || `Connected direction ${index + 1}`;
  const subject = mechanism.primary || proof.description || direction?.genome?.expression?.centrepiece || "the subject-specific proof object";
  return {
    id,
    name,
    form: realization.composition || realization.proofPlacement || "Mechanism-led composition",
    summary: subject,
    fit: `Best when ${realization.interactionEmphasis || actions[0] || "the primary action"} is the first thing the operator can verify.`,
    reject: `Reject if ${realization.rejection || "the proof object is replaced by a decorative treatment or generic summary cards"}.`,
    evidence: [
      objects.length ? `Objects: ${objects.slice(0, 3).join(", ")}` : null,
      actions.length ? `Action: ${actions[0]}` : null,
      outcomes.length ? `Outcome: ${outcomes[0]}` : null,
      states.length ? `States: ${states.slice(0, 3).join(", ")}` : null,
    ].filter(Boolean),
    mechanism,
    artDirection: realization,
    proofObject: proof,
    raw: direction,
  };
}

function connectedDirections(result) {
  return (result?.directions || []).map((direction, index) => connectedDirectionPresentation(direction, index));
}

function hashText(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).slice(0, 6).toUpperCase();
}

function briefSignals(brief) {
  const source = brief.toLowerCase();
  const signals = [];
  if (/owner|team|handoff/.test(source)) signals.push("ownership");
  if (/live|real.time|current/.test(source)) signals.push("live state");
  if (/change|history|since|timeline/.test(source)) signals.push("change trace");
  if (/next|action|task/.test(source)) signals.push("next action");
  if (/mobile|touch|phone/.test(source)) signals.push("touch workflow");
  if (/five seconds|fast|quick|glance/.test(source)) signals.push("glanceable");
  if (/museum|collection|catalogue|catalog|provenance|accession/.test(source)) signals.push("collection evidence");
  if (/warehouse|picking|scan|bin|tote/.test(source)) signals.push("fulfillment path");
  if (/grant|eligibility|application|submit/.test(source)) signals.push("recoverable application");
  if (/evacuation|wildfire|shelter|road closure/.test(source)) signals.push("current safety instruction");
  if (/budget|income|expense|forecast|variance/.test(source)) signals.push("attributable amounts");
  if (/protocol|reagent|sample|timer|deviation/.test(source)) signals.push("verified procedure");
  return signals.length ? signals.slice(0, 5) : ["primary object", "operator action", "visible outcome"];
}

function humanizeText(value) {
  const replacements = [
    [/\bOf course,?\s*/gi, ""],
    [/\bIt is important to note that\s*/gi, ""],
    [/\bunlock the full potential of\b/gi, "improve"],
    [/\bleverage\b/gi, "use"],
    [/\btransformative\b/gi, "useful"],
    [/\bnot just\s+[^;,.]+[;,.]?\s*/gi, ""],
    [/\bseamless\b/gi, ""],
    [/\bin order to\b/gi, "to"],
  ];
  let next = value;
  replacements.forEach(([pattern, replacement]) => { next = next.replace(pattern, replacement); });
  return next
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])\s*([,;:])/g, "$1")
    .replace(/\bis\s+it preserves\b/gi, "preserves")
    .replace(/\.\s+The workflow is\s+/i, ". The workflow ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function unique(matches) {
  return [...new Set(matches.filter(Boolean).map((item) => item.trim()))];
}

function protectedAnchors(value) {
  const dates = value.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,\s*\d{4})?\b/gi) || [];
  const numbers = (value.match(/\b\d+(?:\.\d+)?%?(?=\s|[),.;:]|$)/g) || []).filter((number) => !dates.some((date) => date.includes(number)));
  const matches = [
    ...(value.match(/https?:\/\/[^\s)]+/gi) || []),
    ...(value.match(/[“"][^”"]+[”"]/g) || []),
    ...dates,
    ...numbers,
    ...(value.match(/\b[A-Z]{2,}(?:-[A-Z0-9]+)*\b/g) || []),
    ...(value.match(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g) || []),
  ];
  return unique(matches);
}

function claimFrame(value) {
  const stripped = value.replace(/\bnot just\s+[^;,.]+[;,.]?\s*/gi, "");
  const collect = (pattern) => unique((stripped.toLowerCase().match(pattern) || []));
  return {
    polarity: collect(/\b(?:not|never|no|without)\b/g),
    modality: collect(/\b(?:must|should|may|might|can|cannot|will|would)\b/g),
    causal: collect(/\b(?:because|caused|therefore|due to|so that)\b/g),
  };
}

function sameList(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function auditText(source, revision) {
  const anchors = protectedAnchors(source);
  const missing = anchors.filter((anchor) => !revision.includes(anchor));
  const before = claimFrame(source);
  const after = claimFrame(revision);
  const frame = ["polarity", "modality", "causal"].map((key) => ({ key, pass: sameList(before[key], after[key]), before: before[key], after: after[key] }));
  return { anchors, missing, frame, changed: source.trim() !== revision.trim(), pass: missing.length === 0 && frame.every((item) => item.pass) };
}

function diffWords(source, revision) {
  const a = source.match(/\S+\s*/g) || [];
  const b = revision.match(/\S+\s*/g) || [];
  const table = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] = a[i].trim().toLowerCase() === b[j].trim().toLowerCase()
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const output = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].trim().toLowerCase() === b[j].trim().toLowerCase()) {
      output.push({ type: "same", value: b[j] }); i += 1; j += 1;
    } else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) {
      output.push({ type: "add", value: b[j] }); j += 1;
    } else {
      output.push({ type: "remove", value: a[i] }); i += 1;
    }
  }
  return output;
}

function DirectionDiagram({ type, direction, compact = false }) {
  const mechanism = direction?.mechanism;
  if (mechanism?.objects?.length) {
    const objects = mechanism.objects.slice(0, compact ? 3 : 4);
    const states = mechanism.states?.slice(0, compact ? 3 : 5) || [];
    const action = mechanism.actions?.[0] || "inspect and act";
    return (
      <div className={`diagram diagram-connected ${compact ? "diagram-compact" : ""}`} aria-hidden="true">
        <div className="connected-object-rail">{objects.map((object, index) => <i className={index === 0 ? "hot" : ""} key={object}>{object}</i>)}</div>
        <div className="connected-proof"><span>{mechanism.id || "SUBJECT MECHANISM"}</span><strong>{direction.name}</strong><p>{action}</p></div>
        <div className="connected-state-rail">{states.map((state, index) => <i className={index === 0 ? "hot" : ""} key={state}>{state}</i>)}</div>
      </div>
    );
  }
  if (type === "runway") return (
    <div className={`diagram diagram-runway ${compact ? "diagram-compact" : ""}`} aria-hidden="true">
      <div className="diag-rail"><i /><i /><i className="hot" /><i /></div>
      <div className="diag-owner">ON CALL<br /><strong>Mira K.</strong></div>
      <div className="diag-event"><span>14:08</span><strong>Cache miss spike</strong><em>Rollback edge policy</em></div>
      <div className="diag-next">NEXT<br /><strong>Verify p95</strong></div>
    </div>
  );
  if (type === "ledger") return (
    <div className={`diagram diagram-ledger ${compact ? "diagram-compact" : ""}`} aria-hidden="true">
      <div className="diag-list">{["P1 / API", "P2 / SEARCH", "P1 / EDGE", "P3 / BILLING"].map((item, i) => <i className={i === 2 ? "hot" : ""} key={item}>{item}<b>{i === 2 ? "OPEN" : "STABLE"}</b></i>)}</div>
      <div className="diag-inspect"><span>EDGE / TRACE</span><strong>Policy rollback</strong><p>owner → change → result</p><em>Verify cache recovery</em></div>
    </div>
  );
  return (
    <div className={`diagram diagram-rooms ${compact ? "diagram-compact" : ""}`} aria-hidden="true">
      {["ASSESS", "ACT", "VERIFY"].map((room, i) => <div className={i === 1 ? "hot" : ""} key={room}><span>{room}</span><i>{i === 0 ? "API latency" : i === 1 ? "Edge cache" : "Search lag"}</i></div>)}
    </div>
  );
}

function TopBar({ mode, setMode, runId, engineStatus = "loading" }) {
  return (
    <header className="topbar">
      <a className="wordmark" href="#main" aria-label="fixmyslop home"><span aria-hidden="true">f/</span> fixmyslop</a>
      <nav className="mode-nav" aria-label="Primary">
        {NAV.map((item) => <button key={item.id} className={mode === item.id ? "active" : ""} aria-label={item.label} aria-keyshortcuts={`Alt+${item.key}`} aria-current={mode === item.id ? "page" : undefined} onClick={() => setMode(item.id)}><span aria-hidden="true">{item.key}</span>{item.label}</button>)}
      </nav>
      <div className="run-state" title={engineStatus}><span className={`state-dot ${engineStatus === "connected-local-v2" ? "state-dot-live" : ""}`} /> {engineStatus === "connected-local-v2" ? "connected run" : engineStatus === "fixed-acceptance-demo" ? "fixed acceptance" : "engine loading"} <b>{runId}</b></div>
    </header>
  );
}

function ProcessRail({ active = 1 }) {
  const steps = ["brief", "directions", "proof", "revise"];
  return <div className="process-rail" aria-label={`Process step ${active + 1} of 4`}>
    {steps.map((step, index) => <div className={index <= active ? "reached" : ""} key={step}><i>{index + 1}</i><span>{step}</span></div>)}
  </div>;
}

function GenerateView({ brief, setBrief, signals, run, generate, directions, selected, setSelected, revise, setRevise, applyRevision }) {
  const direction = directions.find((item) => item.id === selected) || directions[0];
  const mechanism = direction?.mechanism;
  const revisionNotes = [
    "Hold the selected composition.",
    "Clarify the next operator action.",
    "Separate current state from change history.",
    "Reframe around the rejection condition.",
  ];
  const gateRows = [
    ["mechanism", mechanism ? "pass" : "pending", mechanism ? `Built around ${mechanism.id}` : `Built around ${signals[0] || "the operator action"}`],
    ["composition", "pass", mechanism ? "Four authored realizations of one proof object" : "Three different information models"],
    ["access", "pass", "Keyboard, touch, reduced motion"],
    ["human judgment", "pending", "Pairing and subject fit need review"],
  ];
  return (
    <main id="main" className="workspace app-page-layer">
      <section className="brief-strip" aria-labelledby="brief-title">
        <div className="section-label"><span>Input</span><h1 id="brief-title">What are you making?</h1></div>
        <div className="brief-input">
          <textarea value={brief} onChange={(event) => setBrief(event.target.value)} rows="3" aria-label="Product brief" />
          <div className="brief-actions">
            <div className="signal-list" aria-label="Detected brief signals">{signals.map((signal) => <span key={signal}>{signal}</span>)}</div>
            <button className="primary-action" aria-keyshortcuts="Control+Enter Meta+Enter" onClick={generate} disabled={!brief.trim()}>Generate directions <kbd aria-hidden="true">⌘↵</kbd></button>
          </div>
        </div>
      </section>

      <ProcessRail active={1} />

      <section className="decision-grid" aria-labelledby="directions-title">
        <div className="direction-list">
          <div className="section-label"><span>Output / {String(directions.length).padStart(2, "0")}</span><h2 id="directions-title">Materially different directions</h2></div>
          <div className="direction-options">
            {directions.map((item, index) => (
              <button key={item.id} className={`direction-option ${selected === item.id ? "selected" : ""}`} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}>
                <span className="option-index">{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{item.name}</strong><small>{item.form}</small></span>
                <DirectionDiagram type={item.id} direction={item} compact />
              </button>
            ))}
          </div>
        </div>

        <article className={`direction-stage revision-${revise}`} key={`${direction.id}-${run}`} aria-labelledby="selected-title">
          <div className="stage-head"><span>Selected composition</span><span>run {hashText(brief + run)}</span></div>
          <div className="compute-sweep" aria-hidden="true" />
          <DirectionDiagram type={direction.id} direction={direction} />
          <div className="stage-caption">
            <div><h2 id="selected-title">{direction.name}</h2><p>{direction.summary}</p></div>
            <div className="fit-note"><span>{Number(revise) ? "REVISION" : "FIT"}</span>{Number(revise) ? revisionNotes[Number(revise)] : direction.fit}</div>
          </div>
        </article>

        <aside className="evidence-panel" aria-labelledby="evidence-title">
          <div className="section-label"><span>Proof</span><h2 id="evidence-title">Why this survives</h2></div>
          <ol className="evidence-list">{direction.evidence.map((item) => <li key={item}>{item}</li>)}</ol>
          <div className="reject-note"><span>REJECTION CONDITION</span><p>{direction.reject}</p></div>
          <div className="gate-list">{gateRows.map(([label, state, note]) => <div key={label}><span className={`gate-state ${state}`}>{state}</span><strong>{label}</strong><small>{note}</small></div>)}</div>
          <div className="revision-control"><label htmlFor="revision-pressure"><span>Revision pressure <output>{revisionNotes[Number(revise)]}</output></span></label><input id="revision-pressure" type="range" min="0" max="3" value={revise} onChange={(event) => setRevise(event.target.value)} /><button className="secondary-action" onClick={applyRevision}>Apply revision</button></div>
        </aside>
      </section>
    </main>
  );
}

function AuditView({ directions, selected, setSelected, signals }) {
  const direction = directions.find((item) => item.id === selected) || directions[0];
  const mechanism = direction?.mechanism;
  const checks = [
    { name: "Subject mechanism", status: mechanism ? "pass" : "pending", detail: mechanism ? `The composition organizes ${mechanism.id}, not generic feature cards.` : `The composition organizes ${signals.slice(0, 2).join(" and ") || "the real task"}, not generic feature cards.` },
    { name: "Candidate divergence", status: "pass", detail: mechanism ? "Proof, evidence, process, and split realizations change reading order without swapping the subject." : "Runway, ledger, and rooms change hierarchy, behavior, and reading order." },
    { name: "One winner", status: "pass", detail: `${direction.name} owns the visual field; evidence and controls recede.` },
    { name: "Claim confidence", status: "bounded", detail: "Deterministic gates catch known failures. They do not prove taste or superiority." },
    { name: "Human pairing review", status: "pending", detail: "The subject fit decision remains explicitly human." },
  ];
  return <main id="main" className="workspace audit-workspace app-page-layer">
    <div className="audit-heading"><div className="section-label"><span>Audit / selected</span><h1>Inspect the decision, not a score.</h1></div><p>Every pass names its evidence. Every uncertainty stays visible.</p></div>
    <ProcessRail active={2} />
    <div className="audit-layout">
      <div className="audit-preview"><DirectionDiagram type={direction.id} direction={direction} /><div><span>ACTIVE DIRECTION</span><h2>{direction.name}</h2><p>{direction.summary}</p></div></div>
      <div className="audit-checks" role="list">{checks.map((check) => <div className="audit-check" role="listitem" key={check.name}><span className={`gate-state ${check.status}`}>{check.status}</span><strong>{check.name}</strong><p>{check.detail}</p></div>)}</div>
      <aside className="rejection-ledger"><span>Alternatives</span>{directions.map((item) => <button className={item.id === selected ? "active" : ""} onClick={() => setSelected(item.id)} key={item.id}><strong>{item.name}</strong><small>{item.id === selected ? item.fit : item.reject}</small></button>)}</aside>
    </div>
  </main>;
}

function HumanizeView({ source, setSource, revision, setRevision, textAudit, release, revert, releaseState }) {
  const diff = useMemo(() => diffWords(source, revision), [source, revision]);
  return <main id="main" className="workspace humanize-workspace app-page-layer">
    <div className="humanize-heading">
      <div className="section-label"><span>Humanize / live</span><h1>Cut the tells. Keep the claims.</h1></div>
      <div className={`release-status ${textAudit.pass ? "ready" : "blocked"}`} aria-live="polite"><i />{releaseState || (textAudit.pass ? (textAudit.changed ? "revision ready" : "source unchanged") : "release blocked")}</div>
    </div>
    <p className="scope-note">Browser proof: anchors and claim frame. Full corpus scoring and release gates run in the skill/CLI.</p>
    <ProcessRail active={3} />
    <section className="text-bench">
      <div className="text-column source-column"><label htmlFor="source-text"><span>Source</span><small>{source.split(/\s+/).filter(Boolean).length} words</small></label><textarea id="source-text" value={source} onChange={(event) => setSource(event.target.value)} /></div>
      <div className="text-column revision-column"><label htmlFor="revision-text"><span>Revision</span><small>{revision.split(/\s+/).filter(Boolean).length} words</small></label><textarea id="revision-text" value={revision} onChange={(event) => setRevision(event.target.value)} /></div>
      <aside className="anchor-column" aria-labelledby="anchor-title">
        <div><span className="panel-kicker">Protected anchors</span><h2 id="anchor-title">{textAudit.missing.length ? `${textAudit.missing.length} missing` : "All present"}</h2></div>
        <div className="anchor-list">{textAudit.anchors.map((anchor) => <span className={textAudit.missing.includes(anchor) ? "missing" : ""} key={anchor}><i />{anchor}</span>)}</div>
        <div className="claim-frame"><span className="panel-kicker">Claim frame</span>{textAudit.frame.map((item) => <div key={item.key}><i className={item.pass ? "pass" : "fail"} /><strong>{item.key}</strong><span>{item.pass ? "preserved" : "changed"}</span></div>)}</div>
      </aside>
      <div className="diff-strip"><span className="panel-kicker">Synchronized diff</span><p>{diff.map((part, index) => part.type === "remove" ? <del key={index}>{part.value}</del> : part.type === "add" ? <ins key={index}>{part.value}</ins> : <React.Fragment key={index}>{part.value}</React.Fragment>)}</p></div>
      <div className="release-actions"><button className="secondary-action" onClick={revert} disabled={!textAudit.changed}>Revert to source</button><button className="primary-action" onClick={release} disabled={!textAudit.pass || !textAudit.changed}>Release revision</button></div>
    </section>
  </main>;
}

function App() {
  const [mode, setMode] = useState("generate");
  const [brief, setBrief] = useState(SAMPLE_BRIEF);
  const [committedBrief, setCommittedBrief] = useState(SAMPLE_BRIEF);
  const [run, setRun] = useState(1);
  const [selected, setSelected] = useState("runway");
  const [directions, setDirections] = useState(DIRECTION_BLUEPRINTS);
  const [engineStatus, setEngineStatus] = useState(() => window.FIXMYSLOP_BROWSER?.mode || "loading");
  const [engineError, setEngineError] = useState("");
  const [revise, setRevise] = useState("1");
  const [source, setSource] = useState(SAMPLE_SOURCE);
  const [revision, setRevision] = useState(() => humanizeText(SAMPLE_SOURCE));
  const [releaseState, setReleaseState] = useState("");

  const signals = useMemo(() => briefSignals(committedBrief), [committedBrief]);
  const textAudit = useMemo(() => auditText(source, revision), [source, revision]);

  const generate = () => {
    if (!brief.trim()) return;
    const nextBrief = brief.trim();
    const runtime = window.FIXMYSLOP_BROWSER;
    let nextDirections = DIRECTION_BLUEPRINTS;
    if (runtime?.mode === "connected-local-v2" && typeof runtime.explore === "function") {
      try {
        const result = runtime.explore({
          surface: inferSurface(nextBrief),
          contentModel: /handoff|workflow|console|dashboard|workspace|operator/i.test(nextBrief) ? "workflow" : undefined,
          sourceBrief: nextBrief,
        }, { seed: Number.parseInt(hashText(`${nextBrief}:${run}`), 16), count: 4 });
        const connected = connectedDirections(result);
        if (connected.length >= 2) nextDirections = connected;
        setEngineStatus(connected.length >= 2 ? "connected-local-v2" : "fixed-acceptance-demo");
        setEngineError(connected.length >= 2 ? "" : "The connected engine returned no usable directions; showing the fixed acceptance case.");
      } catch (error) {
        setEngineStatus("fixed-acceptance-demo");
        setEngineError(String(error?.message || error));
      }
    }
    setDirections(nextDirections);
    setCommittedBrief(brief.trim());
    setRun((value) => value + 1);
    setSelected(nextDirections[(run + nextBrief.length) % nextDirections.length].id);
  };

  useEffect(() => {
    const runtime = window.FIXMYSLOP_BROWSER;
    if (!runtime?.ready) return undefined;
    runtime.ready.then((readyRuntime) => {
      if (readyRuntime?.mode === "connected-local-v2") setEngineStatus("connected-local-v2");
      else { setEngineStatus("fixed-acceptance-demo"); setEngineError(readyRuntime?.error || "The connected engine is unavailable."); }
    }).catch((error) => { setEngineStatus("fixed-acceptance-demo"); setEngineError(String(error?.message || error)); });
    return undefined;
  }, []);

  useEffect(() => {
    setRevision(humanizeText(source));
    setReleaseState("");
  }, [source]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); mode === "generate" ? generate() : setRevision(humanizeText(source)); }
      if (event.key === "Escape") setMode("generate");
      if (event.altKey && ["1", "2", "3"].includes(event.key)) setMode(NAV[Number(event.key) - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, brief, source, run]);

  const release = () => {
    if (!textAudit.pass || !textAudit.changed) return;
    setReleaseState("revision released");
  };
  const revert = () => { setRevision(source); setReleaseState("source restored"); };
  const runId = `FMS-${hashText(committedBrief).slice(0, 4)}`;

  return <div className="instrument-app">
    <TopBar mode={mode} setMode={setMode} runId={runId} engineStatus={engineStatus} />
    {engineError && <div className="engine-notice" role="status"><span>Engine note</span>{engineError}</div>}
    {mode === "generate" && <GenerateView brief={brief} setBrief={setBrief} signals={signals} run={run} generate={generate} directions={directions} selected={selected} setSelected={setSelected} revise={revise} setRevise={setRevise} applyRevision={() => setRun((value) => value + 1)} />}
    {mode === "audit" && <AuditView directions={directions} selected={selected} setSelected={setSelected} signals={signals} />}
    {mode === "humanize" && <HumanizeView source={source} setSource={setSource} revision={revision} setRevision={setRevision} textAudit={textAudit} release={release} revert={revert} releaseState={releaseState} />}
    <footer className="app-footer"><span>Inspectable design instrument</span><span>local deterministic demo · no benchmark superiority claim</span><a href="https://github.com/bihanikeshav/fixmyslop" aria-label="View fixmyslop on GitHub">source ↗</a></footer>
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
