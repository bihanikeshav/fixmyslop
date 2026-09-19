const boot = async () => {
  const [{ createEngine }, { connectedExploreDirections, connectedStyleGenome }] = await Promise.all([
    import("./apps/engine/engine.mjs"),
    import("./apps/engine/connected.mjs"),
  ]);
  const dataBase = new URL("./apps/engine/data/", import.meta.url);
  const [corpus, brands, fonts] = await Promise.all(
    ["corpus.json", "brands.json", "fonts.json"].map(async (file) => {
      const response = await fetch(new URL(file, dataBase));
      if (!response.ok) throw new Error(`engine data failed: ${file}`);
      return response.json();
    }),
  );
  const engine = createEngine({ corpus, brands, fonts });
  const runtime = {
    mode: "connected-local-v2",
    ready: window.FIXMYSLOP_BROWSER?.ready,
    explore(input, options = {}) { return connectedExploreDirections(engine, input, options); },
    genome(input, options = {}) { return connectedStyleGenome(engine, input, options); },
  };
  window.FIXMYSLOP_BROWSER = runtime;
  return runtime;
};

// Paint the acceptance instrument immediately; the 5–8 MB connected corpus is
// a progressive enhancement and must not be a blank-screen prerequisite.
window.FIXMYSLOP_BROWSER = { mode: "loading" };
window.FIXMYSLOP_BROWSER.ready = boot().catch((error) => {
  console.error("Connected browser engine unavailable", error);
  const fallback = { mode: "fixed-acceptance-demo", error: String(error?.message || error) };
  window.FIXMYSLOP_BROWSER = { ...fallback, ready: Promise.resolve(fallback) };
  return fallback;
});

await import("./app.js");
