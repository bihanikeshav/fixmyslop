/**
 * Deterministic "style fingerprint" extraction — no LLM.
 *
 * Everything here comes straight from the CSSOM / DOM of the rendered page, so it
 * is reproducible and auditable. Captures the visual tells of AI-slop design:
 * gradients (incl. the purple one), gradient text, glassmorphism, rounded corners,
 * shadows, accent palette, hero typography, CSS keyframe animations, and which
 * animation libraries are loaded.
 *
 * Genuinely out of reach here (needs a vision model): holistic aesthetic judgment.
 */

import type { Page } from "playwright";

export interface StyleFingerprint {
  gradients: Array<{ kind: string; colors: string[] }>;
  aiPurpleGradient: boolean;
  gradientText: boolean;
  glassmorphism: boolean; // backdrop-filter: blur
  pillButtons: boolean;
  avgCornerRadiusPx: number;
  shadowUsage: number; // count of elements with a box-shadow
  accentColors: string[];
  heroFontSizePx: number;
  uppercaseHeadings: boolean;
  tightHeroTracking: boolean;
  keyframeAnimations: Array<{ name: string; props: string[] }>;
  animationLibraries: string[];
}

export async function extractStyle(page: Page): Promise<StyleFingerprint> {
  return page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("*")).slice(0, 4000) as HTMLElement[];

    const toHex = (c: string): string | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a] = m[1]!.split(",").map((x) => parseFloat(x));
      if (a !== undefined && a < 0.1) return null;
      return "#" + [r, g, b].map((v) => Math.round(v!).toString(16).padStart(2, "0")).join("");
    };
    const hueSatLum = (r: number, g: number, b: number) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d) {
        if (mx === r) h = ((g - b) / d) % 6;
        else if (mx === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
      }
      h = (h * 60 + 360) % 360;
      const l = (mx + mn) / 510;
      const s = d === 0 ? 0 : d / (255 - Math.abs(mx + mn - 255));
      return { h, s, l };
    };
    const isNeutral = (c: string): boolean => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return true;
      const [r, g, b] = m[1]!.split(",").map((x) => parseFloat(x));
      const { s, l } = hueSatLum(r!, g!, b!);
      return s < 0.18 || l < 0.08 || l > 0.95;
    };

    const gradients: Array<{ kind: string; colors: string[] }> = [];
    const accent = new Map<string, number>();
    let aiPurple = false, gradientText = false, glass = false, shadowUsage = 0, uppercaseHeadings = false;
    const radii: number[] = [];
    let pill = false;

    for (const el of els) {
      const cs = getComputedStyle(el);

      const bg = cs.backgroundImage;
      if (bg && bg.includes("gradient")) {
        const kind = bg.match(/(\w+-gradient)/)?.[1] ?? "gradient";
        const colors = Array.from(bg.matchAll(/rgba?\([^)]+\)/g)).map((x) => x[0]);
        if (colors.length) {
          gradients.push({ kind, colors: colors.map((c) => toHex(c) ?? c).filter(Boolean) as string[] });
          for (const c of colors) {
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (m) {
              const [r, g, b] = m[1]!.split(",").map((x) => parseFloat(x));
              const { h, s } = hueSatLum(r!, g!, b!);
              if (h >= 250 && h <= 295 && s > 0.25) aiPurple = true;
            }
          }
        }
      }

      if ((cs.webkitBackgroundClip === "text" || (cs as any).backgroundClip === "text") &&
          (cs.color === "rgba(0, 0, 0, 0)" || cs.color === "transparent")) gradientText = true;

      if ((cs.backdropFilter && cs.backdropFilter.includes("blur")) ||
          ((cs as any).webkitBackdropFilter || "").includes("blur")) glass = true;

      if (cs.boxShadow && cs.boxShadow !== "none") shadowUsage++;

      const tag = el.tagName.toLowerCase();
      const looksButton = tag === "button" || el.getAttribute("role") === "button" ||
        /\bbtn\b|button/i.test(el.className || "");
      if (looksButton) {
        const r = parseFloat(cs.borderTopLeftRadius) || 0;
        radii.push(r);
        if (r >= 100) pill = true;
      }

      for (const c of [cs.backgroundColor, cs.color, cs.borderTopColor]) {
        if (c && !isNeutral(c)) {
          const hex = toHex(c);
          if (hex) accent.set(hex, (accent.get(hex) ?? 0) + 1);
        }
      }

      if ((tag === "h1" || tag === "h2") && cs.textTransform === "uppercase") uppercaseHeadings = true;
    }

    // Hero typography
    const h1s = Array.from(document.querySelectorAll("h1")) as HTMLElement[];
    let heroFontSizePx = 0, tightHeroTracking = false;
    for (const h of h1s) {
      const cs = getComputedStyle(h);
      const size = parseFloat(cs.fontSize) || 0;
      if (size > heroFontSizePx) {
        heroFontSizePx = size;
        tightHeroTracking = (parseFloat(cs.letterSpacing) || 0) < -0.3;
      }
    }

    // CSS @keyframes (same-origin/inline sheets only; cross-origin throw -> skipped)
    const keyframeAnimations: Array<{ name: string; props: string[] }> = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList | undefined;
      try { rules = sheet.cssRules; } catch { continue; }
      if (!rules) continue;
      for (const rule of Array.from(rules)) {
        if (rule.constructor.name === "CSSKeyframesRule" || (rule as any).type === 7) {
          const kf = rule as CSSKeyframesRule;
          const props = new Set<string>();
          for (const frame of Array.from(kf.cssRules)) {
            const st = (frame as CSSKeyframeRule).style;
            for (let i = 0; i < st.length; i++) props.add(st[i]!);
          }
          keyframeAnimations.push({ name: kf.name, props: Array.from(props).slice(0, 6) });
        }
      }
    }

    // Animation libraries (script srcs + globals + attributes)
    const libs = new Set<string>();
    const scripts = Array.from(document.querySelectorAll("script[src]")).map((s) => (s as HTMLScriptElement).src);
    const srcBlob = scripts.join(" ").toLowerCase();
    const w = window as any;
    if (srcBlob.includes("framer-motion") || w.FramerMotion || document.querySelector("[data-framer-name]")) libs.add("framer-motion");
    if (srcBlob.includes("gsap") || w.gsap || w.TweenMax) libs.add("gsap");
    if (srcBlob.includes("aos") || document.querySelector("[data-aos]")) libs.add("aos");
    if (srcBlob.includes("lenis") || w.Lenis || document.querySelector(".lenis")) libs.add("lenis");
    if (srcBlob.includes("locomotive")) libs.add("locomotive-scroll");
    if (srcBlob.includes("swiper")) libs.add("swiper");

    const accentColors = Array.from(accent.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
    // Average only "card" radii; pill radii (>=100) are captured by `pillButtons`
    // and would otherwise skew the mean toward 9999.
    const cardRadii = radii.filter((r) => r < 100);
    const avgCornerRadiusPx = cardRadii.length
      ? Math.round(cardRadii.reduce((a, b) => a + b, 0) / cardRadii.length)
      : 0;

    return {
      gradients: gradients.slice(0, 8),
      aiPurpleGradient: aiPurple,
      gradientText, glassmorphism: glass, pillButtons: pill,
      avgCornerRadiusPx, shadowUsage,
      accentColors, heroFontSizePx, uppercaseHeadings, tightHeroTracking,
      keyframeAnimations: keyframeAnimations.slice(0, 10),
      animationLibraries: Array.from(libs),
    };
  });
}
