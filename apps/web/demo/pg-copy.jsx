/* Page · Copy & voice — the eighth tell, built as a proofreader's spread. The
   page is itself a specimen of set text: a sans headline states the fix, a serif
   lead opens on a large Gambetta drop-cap, a serif pull-quote carries the house
   rule, and a small caption explains the two voices. On the right, three
   machine->human pairs, ranked large-to-small: the struck grey Hanken is the
   machine, the Gambetta rewrite answers behind a green kept-bar. The single
   signature is the green highlighter swipe, used once on the headline payoff.
   One orchestrated load: the columns fade and rise on an 80ms stagger, the swipe
   wipes in after the serif settles. One viewport, no scroll, no italics for
   stress, no em-dashes. */
function PageCopy({ onBack }) {
  const paper = "#EAE7DF", ink = "#1B1813", mute = "#7C7568", accent = "#1F6E4C";
  const swipe = "rgba(31,110,76,.30)", line = "rgba(27,24,19,.14)";
  const sans = "'Hanken Grotesk', system-ui, sans-serif";
  const serif = "'Gambetta', Georgia, serif";      // the human voice

  const tag = { fontFamily: sans, fontSize: "clamp(10px,.8vw,11.5px)", fontWeight: 600, color: mute, letterSpacing: ".14em", textTransform: "uppercase" };
  const slop = (sz) => ({ fontFamily: sans, fontSize: sz, fontWeight: 400, lineHeight: 1.3, color: mute, textDecoration: "line-through", textDecorationColor: "rgba(124,117,104,.5)", textDecorationThickness: "1.5px" });
  const human = (sz) => ({ fontFamily: serif, fontSize: sz, fontWeight: 500, lineHeight: 1.14, color: ink, letterSpacing: "-.01em" });
  const KeptBar = ({ w = 6 }) => <span style={{ flex: "none", width: w, alignSelf: "stretch", background: accent, borderRadius: 2 }} aria-hidden="true" />;

  // one before/after pair, ranked by size
  const Pair = ({ label, before, after, sz, delay, gap = "clamp(10px,1.2vw,14px)" }) => (
    <div className="cp-in" style={{ animationDelay: delay }}>
      <div style={{ ...tag, marginBottom: "clamp(6px,.9vh,9px)" }}>{label}</div>
      <div style={slop(sz.b)}>{before}</div>
      <div style={{ display: "flex", gap, marginTop: "clamp(8px,1.2vh,13px)" }}>
        <KeptBar w={sz.bar} />
        <div style={human(sz.h)}>{after}</div>
      </div>
    </div>
  );

  return (
    <div className="cpy-scope" style={{ height: "100vh", overflow: "hidden", boxSizing: "border-box", background: paper, color: ink, fontFamily: sans, display: "flex", flexDirection: "column" }}>
      <style>{`
        .cpy-scope, .cpy-scope * { box-sizing: border-box; }
        .cpy-scope :focus-visible { outline: 2.5px solid ${accent}; outline-offset: 3px; }

        .cpy-swipe {
          background-image: linear-gradient(${swipe}, ${swipe});
          background-repeat: no-repeat;
          background-size: 0% .32em;
          background-position: 0 82%;
          -webkit-box-decoration-break: clone; box-decoration-break: clone;
          padding: 0 .05em .02em;
          animation: cp-wipe .52s cubic-bezier(.22,1,.36,1) .66s forwards;
        }
        .cp-dropcap {
          float: left; font-family: ${serif}; font-weight: 600; color: ${ink};
          font-size: clamp(52px,6vw,82px); line-height: .72;
          margin: .05em .12em -.02em 0; letter-spacing: -.02em;
        }
        .cp-in { opacity: 0; animation: cp-rise .5s cubic-bezier(.22,1,.36,1) both; }
        @keyframes cp-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes cp-wipe { from { background-size: 0% .32em; } to { background-size: 100% .32em; } }

        .cpy-main { display: grid; grid-template-columns: 1.02fr 1.05fr; gap: clamp(30px,5vw,84px); }
        @media (max-width: 900px) { .cpy-main { grid-template-columns: 1fr; gap: 24px; } .cp-dropcap { font-size: 60px; } }
        @media (prefers-reduced-motion: reduce) {
          .cpy-scope *, .cp-in { animation: none !important; transition: none !important; opacity: 1 !important; }
          .cpy-swipe { background-size: 100% .32em !important; }
        }
      `}</style>

      {/* masthead */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, padding: "16px clamp(18px,4vw,44px)" }}>
        <BackTab theme={{ ink, line: ink, mono: sans }} onClick={onBack} />
        <div style={{ textAlign: "right", lineHeight: 1.25 }}>
          <div style={{ fontSize: "clamp(11px,.9vw,12.5px)", fontWeight: 400, color: mute }}>The eighth tell</div>
          <div style={{ fontSize: "clamp(14px,1.1vw,16px)", fontWeight: 600, color: ink }}>Copy &amp; voice</div>
        </div>
      </div>

      {/* main */}
      <div className="cpy-main" style={{ flex: 1, minHeight: 0, alignItems: "center", width: "100%", maxWidth: 1240, margin: "0 auto", padding: "2px clamp(18px,4vw,44px) clamp(18px,4vh,34px)" }}>

        {/* left — the page as a specimen of set text */}
        <div className="cp-in" style={{ animationDelay: "0s", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: "clamp(10px,1.6vh,18px)" }}>
            <span style={{ fontFamily: sans, fontWeight: 800, color: accent, fontSize: "clamp(26px,2.8vw,38px)", lineHeight: .8, letterSpacing: "-.03em" }}>08</span>
            <span style={{ ...tag, letterSpacing: ".16em" }}>The verbal tell</span>
          </div>

          <h1 style={{ margin: 0, fontFamily: sans, fontWeight: 800, fontSize: "clamp(30px, min(3.9vw,5vh), 50px)", lineHeight: .98, letterSpacing: "-.025em", color: ink }}>
            The other tells you spot.<br />
            <span className="cpy-swipe">This one you read.</span>
          </h1>

          {/* lead — serif, opened by a serif drop-cap */}
          <p style={{ margin: "clamp(16px,2.4vh,26px) 0 0", maxWidth: "26em", fontFamily: serif, fontSize: "clamp(14px,1.18vw,17px)", fontWeight: 400, lineHeight: 1.5, color: "rgba(27,24,19,.86)" }}>
            <span className="cp-dropcap">R</span>ead a line of machine copy and you can feel it reaching. It wants to sound important, so it borrows the big words, powerful and seamless and next-generation, and by the last line you still cannot tell what it does. Good copy runs the other way. It names the thing in front of you, then says what happens when you click. Shorter, most of the time. Clearer, every time. It takes you for someone with work to do.
          </p>

          {/* pull-quote — the house rule */}
          <div style={{ margin: "clamp(16px,2.4vh,26px) 0 0", display: "flex", gap: "clamp(12px,1.3vw,18px)", alignItems: "stretch" }}>
            <span style={{ flex: "none", width: 2, background: line }} aria-hidden="true" />
            <p style={{ margin: 0, fontFamily: serif, fontStyle: "italic", fontWeight: 500, fontSize: "clamp(19px,1.9vw,27px)", lineHeight: 1.12, letterSpacing: "-.01em", color: ink, maxWidth: "15em" }}>
              Vague is cheap to write and impossible to act on.
            </p>
          </div>

          {/* caption — the two voices, explained */}
          <div style={{ marginTop: "clamp(16px,2.4vh,26px)", maxWidth: "30em" }}>
            <div style={{ ...tag, marginBottom: 5 }}>On the type</div>
            <p style={{ margin: 0, fontFamily: sans, fontSize: "clamp(11.5px,.92vw,13px)", lineHeight: 1.45, color: "rgba(27,24,19,.55)" }}>
              The rewrites are set in Gambetta, a serif that reads like a person talking. The struck grey is the machine, kept on the page only to show what we cut.
            </p>
          </div>
        </div>

        {/* right — the proof, ranked large to small */}
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(18px,2.8vh,32px)", minWidth: 0 }}>

          <div className="cp-in" style={{ animationDelay: ".06s", display: "flex", alignItems: "center", gap: 14, borderBottom: `1px solid ${line}`, paddingBottom: "clamp(8px,1.2vh,12px)" }}>
            <span style={{ ...tag }}>Machine</span>
            <span aria-hidden="true" style={{ color: mute }}>&rarr;</span>
            <span style={{ ...tag, color: accent }}>Human</span>
          </div>

          <Pair label="Hero headline" delay=".13s"
            before="Unlock the power of your workflow with AI-driven productivity, reimagined."
            after="Turn a folder of notes into a doc you can send."
            sz={{ b: "clamp(12.5px,1vw,14.5px)", h: "clamp(22px,2.4vw,32px)", bar: 7 }} />

          <Pair label="Feature blurb" delay=".21s"
            before="Supercharge team synergy with best-in-class, next-generation collaboration."
            after="Everyone works on one page. You watch the edits land."
            sz={{ b: "clamp(12px,.96vw,14px)", h: "clamp(17px,1.75vw,23px)", bar: 6 }} />

          <div style={{ borderTop: `1px solid ${line}`, paddingTop: "clamp(14px,2.2vh,24px)" }}>
            <Pair label="Error message" delay=".29s"
              before="Oops! Something went wrong. Please try again later."
              after="That didn’t save. You’re offline. It saves itself the moment you reconnect."
              sz={{ b: "clamp(11.5px,.9vw,13px)", h: "clamp(14.5px,1.3vw,18px)", bar: 5 }} />
          </div>

        </div>
      </div>
    </div>
  );
}

window.PageCopy = PageCopy;
