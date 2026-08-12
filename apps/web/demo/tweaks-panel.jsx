/* tweaks-panel.jsx — DEPLOY STUB.
 *
 * The original is the claude.ai/design host's live "Tweaks" dev panel. It only
 * becomes visible when the design host posts `__activate_edit_mode`; on a plain
 * static deploy (our Cloudflare Pages site) that message never arrives, so the
 * real panel renders null anyway. This stub reproduces exactly that behavior —
 * a working `useTweaks` (so component state + defaults are unchanged) and
 * null-rendering panel/controls — keeping the Slop-o-meter demo byte-identical
 * in what the user sees, without importing ~350 lines of host-only tooling.
 * (Original lives in the claude.ai/design "AI Slop Font" project.)
 */
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    try { window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits })); } catch (e) {}
  }, []);
  return [values, setTweak];
}

// The panel is host-activated only; with no host it stays hidden. Match that.
function TweaksPanel() { return null; }
function TweakSection() { return null; }
function TweakRow() { return null; }
function TweakSlider() { return null; }
function TweakToggle() { return null; }
function TweakRadio() { return null; }
function TweakSelect() { return null; }
function TweakText() { return null; }
function TweakNumber() { return null; }
function TweakColor() { return null; }
function TweakButton() { return null; }

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});
