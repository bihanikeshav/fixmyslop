// Grounded contrast audit — run in the page via Playwright browser_evaluate:
//   browser_evaluate( () => { <paste this body> } )
// Walks visible text elements, computes each one's color vs its EFFECTIVE background
// (first non-transparent ancestor bg), and reports WCAG failures. Large text (>=24px,
// or >=18.66px bold) needs 3:1; everything else 4.5:1. Returns the worst offenders.
() => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const ratio = (a, b) => {
    const la = lum(a.r, a.g, a.b), lb = lum(b.r, b.g, b.b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const effBg = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 }; // assume white page default
  };
  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.1) continue;
    const fg = parse(cs.color); if (!fg || fg.a < 0.5) continue;
    const bg = effBg(el);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bg);
    if (r < need) {
      out.push({
        ratio: +r.toFixed(2), need, px: +px.toFixed(1),
        tag: el.tagName.toLowerCase(),
        text: el.textContent.trim().slice(0, 40),
        color: cs.color, bg: `rgb(${bg.r},${bg.g},${bg.b})`,
      });
    }
  }
  out.sort((a, b) => a.ratio - b.ratio);
  return { textEls: document.body.querySelectorAll("*").length, failures: out.length, worst: out.slice(0, 12) };
}
