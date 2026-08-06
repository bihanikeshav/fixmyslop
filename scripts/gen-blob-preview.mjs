#!/usr/bin/env node
// Deterministic genome -> low-fidelity "blob" preview / direction chooser.
// A pure projection of the genome (no LLM, no render): real layout proportions,
// real palette (incl. gradient grounds + ink-tinted text), and the REAL
// display/body typeface — fetched at correct weight from the same sources the
// MCP render uses (Google Fonts / Fontshare), embedded self-contained.
// Features: click-to-select, Desktop/Mobile shape toggle, equalized heights,
// section archetypes (hero/cards/stats/canvas/quote/faq/logos/pricing/cta/nav/footer).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VAL = resolve(ROOT, 'data/tmp/luna-val');
const EMBED = resolve(ROOT, 'data/fonts-cache/embed');
mkdirSync(EMBED, { recursive: true });

const kebab = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

/* ---------- color helpers ---------- */
const hx = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const cb = (n) => Math.max(0, Math.min(255, Math.round(n)));
const hexA = (hex, a) => { const [r, g, b] = hx(hex); return `rgba(${r},${g},${b},${a})`; };
const mix = (h1, h2, t) => { const a = hx(h1), b = hx(h2); return '#' + [0, 1, 2].map((i) => cb(a[i] + (b[i] - a[i]) * t).toString(16).padStart(2, '0')).join(''); };
const lum = (hex) => { const [r, g, b] = hx(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const onColor = (hex) => (lum(hex) > 0.6 ? '#0c0b09' : '#ffffff');

/* ---------- real micro-copy (generic wireframe labels) ---------- */
const LBL = {
  brand: 'Lumen',
  nav: ['Product', 'Pricing', 'Docs'],
  navCta: 'Start free',
  heroCtas: ['Get started', 'How it works'],
  cards: ['Fast setup', 'Live traces', 'Full context', 'One dashboard', 'Smart alerts', 'Deep insights'],
  cta: 'Start building',
};

/* ---------- fonts: same sources the MCP render uses, correct weight, embedded ---------- */
const FONTSHARE = new Set(['Cantique', 'Ranade', 'Gambetta', 'Technor', 'Khand', 'Sentient', 'Clash Display', 'Clash Grotesk', 'General Sans', 'Switzer', 'Satoshi', 'Zodiak', 'Melodrama']);
const stackFor = (family, kind) => `'${family}', ${kind === 'disp' ? 'Georgia, serif' : 'system-ui, sans-serif'}`;

async function fetchFontUrl(family, weight) {
  const url = FONTSHARE.has(family)
    ? `https://api.fontshare.com/v2/css?f[]=${kebab(family)}@${weight}&display=swap`
    : `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=swap`;
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)];
  const pick = blocks.find((b) => b[1] === 'latin')?.[2] || blocks[0]?.[2] || css;
  const m = pick.match(/url\(["']?([^)"']+\.(?:woff2|woff|ttf))["']?\)/i);
  let u = m ? m[1] : null;
  if (u && u.startsWith('//')) u = 'https:' + u;
  return u;
}
const face = (family, weight, fmt, buf) => {
  const mime = fmt === 'truetype' ? 'font/ttf' : `font/${fmt}`;
  return `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;font-display:swap;src:url(data:${mime};base64,${buf.toString('base64')}) format("${fmt}");}`;
};
async function embedFace(family, weight) {
  const cacheFile = resolve(EMBED, `${kebab(family)}-${weight}.woff2`);
  if (existsSync(cacheFile)) return face(family, weight, 'woff2', readFileSync(cacheFile));
  try {
    const fontUrl = await fetchFontUrl(family, weight);
    if (fontUrl) {
      const buf = Buffer.from(await (await fetch(fontUrl, { headers: { 'User-Agent': UA } })).arrayBuffer());
      writeFileSync(cacheFile, buf);
      return face(family, weight, 'woff2', buf);
    }
  } catch { /* fall through to local */ }
  const ttf = resolve(ROOT, 'data/fonts-cache', kebab(family) + '.ttf');
  if (existsSync(ttf)) {
    console.warn(`  · ${family} ${weight}: MCP source unavailable → local ${kebab(family)}.ttf`);
    return face(family, weight, 'truetype', readFileSync(ttf));
  }
  console.warn(`  ! ${family} ${weight}: no source — system fallback`);
  return '';
}
async function buildFaceCss(families) {
  const parts = [];
  for (const fam of [...new Set(families)]) for (const w of [400, 700]) parts.push(await embedFace(fam, w));
  return parts.join('');
}

/* ---------- section vocabulary ---------- */
function blocksFor(sec, C) {
  const key = `${sec.role} ${sec.composition || ''}`.toLowerCase();
  const has = (...k) => k.some((x) => key.includes(x));
  if (has('nav')) return { kind: 'nav' };
  if (has('cta') && !has('nav')) return { kind: 'cta' };
  if (has('footer')) return { kind: 'footer' };
  if (has('testimonial', 'quote', 'review', 'social-proof', 'voice', 'story-quote')) return { kind: 'quote' };
  if (has('faq', 'accordion', 'question')) return { kind: 'faq', n: 4 };
  if (has('logo', 'trusted', 'clients', 'press', 'logo-strip', 'logo-cloud')) return { kind: 'logos', n: 5 };
  if (has('stat', 'proof', 'metric', 'kpi', 'number')) return { kind: 'stat-row', cols: 4 };
  if (has('pricing', 'plans', 'tier')) return { kind: 'cards', n: 3, tall: true };
  if (has('diagram', 'full-bleed', 'gallery', 'showcase', 'system-map', 'canvas', 'visual', 'media', 'screenshot')) return { kind: 'canvas' };
  if (has('feature', 'annotation', 'step', 'grid', 'flow', 'band', 'explain', 'list', 'content', 'how')) return { kind: 'cards', n: 3 };
  if (has('hero', 'intro', 'marquee', 'thesis', 'premise', 'headline', 'lede')) {
    return { kind: 'hero', split: sec.focalPoint === 'left' || key.includes('split') || key.includes('marquee') };
  }
  return { kind: 'stack' };
}

const bar = (w, h, c, r = 4) => `<div class="bar" style="width:${w};height:${h}px;background:${c};border-radius:${r}px"></div>`;

function renderBlock(b, C, F) {
  const btn = (label, kind) => kind === 'primary'
    ? `<div class="btn" style="background:${C.accent};color:${C.onAccent};font-family:${F.body.stack};border-radius:${C.radBtn}px">${label}</div>`
    : `<div class="btn ghost" style="border:1.5px solid ${C.hair2};color:${C.headline};font-family:${F.body.stack};border-radius:${C.radBtn}px">${label}</div>`;
  const cardEl = (i, tall) => `<div class="card" style="background:${C.surface};border-radius:${C.radCard}px;box-shadow:${C.shadow};min-height:${tall ? 128 : 82}px">
      <div class="icon" style="background:${C.iconBg};border-radius:${Math.min(C.radBtn, 7)}px"><i style="background:${C.accent}"></i></div>
      <div class="ctitle" style="font-family:${F.body.stack};color:${C.headline}">${LBL.cards[i % LBL.cards.length]}</div>
      ${bar('92%', 6, C.text, 3)}${bar(`${70 + (i % 3) * 8}%`, 6, C.text, 3)}
      ${tall ? `<div class="btn soft" style="background:${C.accentSoft};color:${C.accent};font-family:${F.body.stack};border-radius:${C.radBtn}px;margin-top:auto">Choose</div>` : ''}
    </div>`;

  switch (b.kind) {
    case 'nav':
      return `<div class="rowsplit">
        <div class="grp"><div class="wordmark" style="background:${C.ink};border-radius:6px"></div><span class="brand" style="font-family:${F.disp.stack};color:${C.headline}">${LBL.brand}</span></div>
        <div class="grp navlinks" style="font-family:${F.body.stack};color:${C.textStrong}">
          ${LBL.nav.map((x) => `<span>${x}</span>`).join('')}
          <span class="navcta" style="background:${C.accent};color:${C.onAccent};border-radius:${C.radBtn}px">${LBL.navCta}</span>
        </div></div>`;
    case 'stack':
      return `<div class="stack">${bar('62%', 15, C.headline, 5)}${bar('88%', 8, C.text, 3)}${bar('72%', 8, C.text, 3)}</div>`;
    case 'cta':
      return `<div class="hero ctr">
        ${bar('64%', 18, C.headline, 5)}${bar('44%', 18, C.headline, 5)}
        <div class="sub" style="font-family:${F.body.stack};color:${C.textStrong}">Ship your first trace in minutes.</div>
        <div class="ctas">${btn(LBL.cta, 'primary')}</div></div>`;
    case 'footer':
      return `<div class="rowsplit" style="align-items:flex-start">
        <div class="grp" style="flex-direction:column;align-items:flex-start;gap:6px"><div class="wordmark" style="background:${C.ink};border-radius:6px"></div>${bar('90px', 7, C.text, 3)}</div>
        <div class="grp" style="gap:22px">${[0, 1, 2].map(() => `<div class="stack" style="gap:6px">${bar('44px', 7, C.text, 3)}${bar('34px', 6, C.text, 3)}${bar('40px', 6, C.text, 3)}</div>`).join('')}</div></div>`;
    case 'stat-row':
      return `<div class="statrow">${Array.from({ length: b.cols }, (_, i) =>
        `<div class="stat"><div class="num" style="font-family:${F.disp.stack};color:${C.accent}">${['412ms', '84k', '31%', '9.9k'][i % 4]}</div>${bar('58%', 7, C.text, 3)}</div>`).join('')}</div>`;
    case 'cards':
      return `<div class="cards">${Array.from({ length: b.n }, (_, i) => cardEl(i, b.tall)).join('')}</div>`;
    case 'canvas':
      return `<div class="canvas" style="background:${mix(C.surface, C.ground, 0.25)};border-radius:${C.radCard}px;box-shadow:${C.shadow};border:1px solid ${C.hair}">
                <div class="node" style="background:${C.accent}"></div><div class="node" style="background:${C.accent2 || C.accent}"></div>
                <div class="edge" style="background:${C.text}"></div><div class="node sm" style="background:${C.ground};border:1px solid ${C.hair2}"></div>
                <div class="spark"><span style="background:${C.accent}"></span><span style="background:${C.accent}"></span><span style="background:${C.accent}"></span><span style="background:${C.accent}"></span></div></div>`;
    case 'quote':
      return `<div class="quote">
        <div class="qmark" style="color:${C.accent}">&ldquo;</div>
        <div class="qtext" style="font-family:${F.disp.stack};color:${C.headline}">A real sentence, set in the display face.</div>
        <div class="qby"><div class="avatar" style="background:${C.surface};border-color:${C.hair2}"></div>${bar('80px', 8, C.text, 4)}</div></div>`;
    case 'faq':
      return `<div class="faq">${Array.from({ length: b.n }, () =>
        `<div class="faqrow" style="border-color:${C.hair}">${bar('58%', 10, C.headline, 4)}<div class="plus" style="color:${C.text}">+</div></div>`).join('')}</div>`;
    case 'logos':
      return `<div class="logos">${Array.from({ length: b.n }, () =>
        `<div class="logo" style="background:${C.surface};border:1px solid ${C.hair2}"></div>`).join('')}</div>`;
    case 'hero': {
      const spec = `<div class="specchip" style="border-color:${C.hair2}">
          <span style="font-family:${F.disp.stack};font-size:26px;color:${C.headline};line-height:1">Aa</span>
          <span style="font-family:${F.body.stack};font-size:15px;color:${C.text};line-height:1">Aa</span></div>`;
      const words = `<div class="hl" style="font-family:${F.disp.stack};color:${C.headline}">Design<br>with intent.</div>`;
      const body = `<div class="sub" style="font-family:${F.body.stack};color:${C.textStrong}">One clear premise, set in the actual typeface — not a grey bar.</div>`;
      const ctas = `<div class="ctas">${btn(LBL.heroCtas[0], 'primary')}${btn(LBL.heroCtas[1], 'ghost')}</div>`;
      const eyebrow = bar('120px', 8, C.accent, 4);
      if (b.split) {
        return `<div class="hero split"><div class="hcol">${eyebrow}${words}${body}${ctas}</div>
          <div class="hcol vis"><div class="canvas mini" style="background:${mix(C.surface, C.ground, 0.25)};border-radius:${C.radCard}px;border:1px solid ${C.hair}">${spec}</div></div></div>`;
      }
      return `<div class="hero ctr">${eyebrow}${words}${body}${ctas}${spec}</div>`;
    }
    default: return '';
  }
}

function card(genome, idx) {
  const c = genome.color, t = genome.type, L = genome.layout;
  const dark = lum(c.ground) < 0.4;
  const C = {
    ground: c.ground, surface: c.surface, ink: c.ink, accent: c.accent, accent2: c.accent2,
    headline: c.ink,
    onAccent: onColor(c.accent),
    text: hexA(c.ink, dark ? 0.5 : 0.34),        // placeholder text-run bars
    textStrong: hexA(c.ink, dark ? 0.82 : 0.66), // real running sentences — must stay legible
    hair: hexA(c.ink, dark ? 0.12 : 0.08),
    hair2: hexA(c.ink, dark ? 0.28 : 0.18),
    iconBg: hexA(c.accent, 0.15),
    accentSoft: hexA(c.accent, 0.16),
    pageBg: `linear-gradient(162deg, ${c.ground} 0%, ${mix(c.ground, c.surface, 0.55)} 100%)`,
    radCard: Math.round(L.material?.radii?.md ?? genome.material?.radii?.md ?? 10),
    radBtn: Math.round(L.material?.radii?.sm ?? genome.material?.radii?.sm ?? 6),
    shadow: genome.material?.shadow?.css || '0 1px 3px rgba(0,0,0,.08)',
  };
  const F = { disp: { stack: stackFor(t.display.family, 'disp') }, body: { stack: stackFor(t.body.family, 'body') } };

  const secs = L.sectionGrammar || [];
  const totalH = secs.reduce((s, x) => s + (x.heightShare || 0.1), 0) || 1;
  const CANVAS_H = 620;
  const bands = secs.map((sec) => {
    const h = Math.max(34, (sec.heightShare / totalH) * CANVAS_H);
    const single = sec.singleViewport;
    return `<div class="band ${single ? 'single' : ''}" style="min-height:${h}px">
        ${single ? `<span class="tag">1 viewport</span>` : ''}
        ${renderBlock(blocksFor(sec, C), C, F)}
      </div>`;
  }).join('');

  return `<div class="wire" data-idx="${idx}" onclick="pick(${idx})">
    <div class="badge">✓</div>
    <div class="head">
      <div class="idx">${idx}</div>
      <div class="meta"><b>${L.family}</b><span>${t.display.family} · ${t.body.family}</span></div>
      <div class="hspec" title="${t.display.family} / ${t.body.family}">
        <span style="font-family:${F.disp.stack}">Aa</span><span style="font-family:${F.body.stack}">Aa</span>
      </div>
      <div class="swatches">
        ${['ground', 'surface', 'ink', 'accent', 'accent2'].map((k) => c[k] ? `<i style="background:${c[k]}" title="${k} ${c[k]}"></i>` : '').join('')}
      </div>
    </div>
    <div class="page" style="background:${C.pageBg}">${bands}</div>
    <div class="foot"><span>${L.pageKind}</span><span>${c.mood} · ${c.energy}</span></div>
  </div>`;
}

const genomes = [0, 1, 2, 3].map((i) => JSON.parse(readFileSync(resolve(VAL, `genome-${i}.json`), 'utf8')));
const cards = genomes.map(card).join('\n');

// Neutral white-grey shell so the engine-generated cards are the focus.
// (The engine's own color path only yields light-olive grounds + mono/novelty
// faces — not the crisp neutral UI wanted here — so the chrome is fixed neutral.)
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;
const T = {
  bg: '#f5f6f8', panel: '#ffffff', ink: '#1a1c20',
  muted: '#697079', hair: '#e6e8ec', chip: '#eef0f3',
  accent: '#3b5bdb', onAccent: '#ffffff',
  disp: SANS, body: SANS, radL: 16, radM: 10,
};

console.log('fetching real-weight fonts from Google Fonts / Fontshare…');
const faceCss = await buildFaceCss(genomes.flatMap((g) => [g.type.display.family, g.type.body.family]));

const html = `<!doctype html><meta charset="utf-8"><title>Direction preview — blobs</title>
<style>${faceCss}</style>
<style>
  :root{color-scheme:dark;
    --bg:${T.bg};--panel:${T.panel};--ink:${T.ink};--muted:${T.muted};--hair:${T.hair};--chip:${T.chip};
    --accent:${T.accent};--onAccent:${T.onAccent};--disp:${T.disp};--body:${T.body};--radL:${T.radL}px;--radM:${T.radM}px;--sv:#78aaff}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);font-family:var(--body);padding:30px 26px 46px;color:var(--ink)}
  .masthead{display:flex;align-items:flex-start;gap:13px;margin:0 auto 20px;max-width:1240px}
  .mark{width:30px;height:30px;border-radius:var(--radM);background:var(--accent);color:var(--onAccent);display:flex;align-items:center;justify-content:center;font-family:var(--disp);font-weight:700;font-size:17px;flex:0 0 auto;margin-top:2px}
  h1{font-family:var(--disp);font-size:22px;font-weight:700;margin:0 0 5px;letter-spacing:-.01em;line-height:1.05}
  .lede{font-size:12.5px;color:var(--muted);margin:0;max-width:820px;line-height:1.5}
  .toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:1240px;margin:0 auto 18px;flex-wrap:wrap}
  .seg{display:inline-flex;background:var(--panel);border:1px solid var(--hair);border-radius:var(--radM);padding:3px}
  .seg button{background:transparent;border:0;color:var(--muted);font:inherit;font-family:var(--body);font-size:12px;padding:6px 16px;border-radius:calc(var(--radM) - 3px);cursor:pointer}
  .seg button.on{background:var(--accent);color:var(--onAccent);font-weight:600}
  .selinfo{font-size:12px;color:var(--muted)}
  .selinfo b{color:var(--accent)}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;max-width:1240px;margin:0 auto;align-items:stretch}
  .grid.mobile{grid-template-columns:repeat(4,minmax(0,320px));max-width:none;justify-content:center}
  .wire{background:var(--panel);border:1px solid var(--hair);border-radius:var(--radL);overflow:hidden;display:flex;flex-direction:column;height:100%;position:relative;cursor:pointer;transition:transform .12s,outline-color .12s}
  .wire:hover{transform:translateY(-2px)}
  .wire.selected{outline:2px solid var(--accent);outline-offset:1px}
  .badge{position:absolute;top:9px;right:9px;width:20px;height:20px;border-radius:50%;background:var(--accent);color:var(--onAccent);font-size:12px;font-weight:800;display:none;align-items:center;justify-content:center;z-index:6}
  .wire.selected .badge{display:flex}
  .head{display:flex;align-items:center;gap:9px;padding:11px 12px 10px}
  .idx{width:20px;height:20px;border-radius:6px;background:var(--chip);color:var(--muted);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
  .meta{display:flex;flex-direction:column;min-width:0;flex:1}
  .meta b{font-size:11.5px;color:var(--ink);font-family:var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .meta span{font-size:9.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .hspec{display:flex;align-items:baseline;gap:7px;flex:0 0 auto;padding:2px 8px;background:var(--chip);border:1px solid var(--hair);border-radius:7px;line-height:1}
  .hspec span:first-child{font-size:19px;color:var(--ink)}
  .hspec span:last-child{font-size:13px;color:var(--muted)}
  .swatches{display:flex;gap:3px;flex:0 0 auto}
  .swatches i{width:12px;height:12px;border-radius:3px;border:1px solid var(--hair)}
  .page{overflow:hidden;flex:1}
  .band{position:relative;padding:11px 14px;display:flex;flex-direction:column;justify-content:center;gap:7px;border-bottom:1px solid rgba(128,128,128,.08)}
  .band.single{outline:1.5px solid rgba(120,170,255,.5);outline-offset:-1.5px}
  .tag{position:absolute;top:5px;right:6px;font-size:7.5px;letter-spacing:.03em;color:var(--sv);background:rgba(120,170,255,.12);padding:1px 5px;border-radius:20px;z-index:2}
  .bar{flex:0 0 auto}
  .rowsplit{display:flex;justify-content:space-between;align-items:center;width:100%;gap:12px}
  .grp{display:flex;align-items:center;gap:9px}
  .wordmark{width:24px;height:24px;flex:0 0 auto}
  .brand{font-size:15px;font-weight:700;letter-spacing:-.01em}
  .navlinks{font-size:11px;font-weight:500;gap:14px}
  .navlinks .navcta{font-size:10.5px;font-weight:600;padding:5px 11px}
  .stack{display:flex;flex-direction:column;gap:7px;width:100%}
  .btn{display:inline-flex;align-items:center;justify-content:center;height:32px;padding:0 15px;font-size:11px;font-weight:600;white-space:nowrap}
  .btn.ghost{background:transparent}
  .btn.soft{height:24px;font-size:10px;width:100%}
  .statrow{display:flex;justify-content:space-between;gap:10px;width:100%}
  .stat{display:flex;flex-direction:column;align-items:center;gap:6px;flex:1}
  .stat .num{font-size:22px;font-weight:700}
  .cards{display:flex;gap:10px;width:100%}
  .card{flex:1;padding:12px;display:flex;flex-direction:column;gap:7px}
  .card .icon{width:26px;height:26px;display:flex;align-items:center;justify-content:center;margin-bottom:2px}
  .card .icon i{width:11px;height:11px;border-radius:3px;display:block}
  .card .ctitle{font-size:12px;font-weight:600;line-height:1.1;margin-bottom:1px}
  .canvas{width:100%;height:100%;min-height:96px;position:relative;overflow:hidden}
  .canvas .node{position:absolute;width:36px;height:36px;border-radius:10px;top:20%;left:22%}
  .canvas .node.sm{width:22px;height:22px;top:56%;left:66%}
  .canvas .node:nth-child(2){top:50%;left:54%}
  .canvas .edge{position:absolute;height:2px;width:34%;top:38%;left:31%;transform:rotate(24deg);opacity:.5}
  .canvas .spark{position:absolute;bottom:14px;left:16px;display:flex;align-items:flex-end;gap:5px;height:34px}
  .canvas .spark span{width:7px;border-radius:2px;opacity:.85}
  .canvas .spark span:nth-child(1){height:40%}.canvas .spark span:nth-child(2){height:70%}.canvas .spark span:nth-child(3){height:52%}.canvas .spark span:nth-child(4){height:90%}
  .canvas.mini{min-height:130px;display:flex;align-items:center;justify-content:center}
  .quote{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;width:100%;padding:4px 6px}
  .quote .qmark{font-size:40px;line-height:.5;font-family:Georgia,serif}
  .quote .qtext{font-size:16px;line-height:1.3;max-width:280px}
  .quote .qby{display:flex;align-items:center;gap:8px;margin-top:2px}
  .quote .avatar{width:24px;height:24px;border-radius:50%;border:1px solid;flex:0 0 auto}
  .faq{display:flex;flex-direction:column;width:100%}
  .faqrow{display:flex;justify-content:space-between;align-items:center;padding:10px 2px;border-bottom:1px solid}
  .faqrow .plus{font-size:16px;font-weight:600;line-height:1}
  .logos{display:flex;gap:12px;width:100%;justify-content:space-between;align-items:center;flex-wrap:wrap}
  .logos .logo{flex:1;min-width:44px;height:24px;border-radius:6px}
  .hero{display:flex;flex-direction:column;gap:11px;width:100%;height:100%;justify-content:center}
  .hero.ctr{align-items:center;text-align:center}
  .hero.split{flex-direction:row;align-items:center;gap:16px}
  .hero.split .hcol{flex:1;display:flex;flex-direction:column;gap:11px}
  .hero.split .hcol.vis{align-items:stretch}
  .hl{font-size:32px;line-height:1;font-weight:700;letter-spacing:-.015em}
  .sub{font-size:11.5px;line-height:1.4;max-width:250px}
  .hero.ctr .sub{margin:0 auto}
  .ctas{display:flex;gap:9px}
  .hero.ctr .ctas{justify-content:center}
  .specchip{display:inline-flex;align-items:baseline;gap:10px;padding:5px 11px;border:1px solid;border-radius:9px;width:max-content}
  .hero.ctr .specchip{margin:3px auto 0}
  .foot{display:flex;justify-content:space-between;padding:8px 12px 10px;font-size:9px;color:var(--muted);text-transform:capitalize}
  .grid.mobile .cards{flex-direction:column}
  .grid.mobile .hero.split{flex-direction:column;align-items:stretch}
  .grid.mobile .statrow{flex-wrap:wrap;justify-content:center}
  .grid.mobile .statrow .stat{flex:0 0 44%}
  .grid.mobile .logos .logo{flex:0 0 44%}
  .grid.mobile .navlinks span:not(.navcta){display:none}
  .legend{display:flex;gap:16px;margin:24px auto 0;max-width:1240px;font-size:11px;color:var(--muted);flex-wrap:wrap}
  .legend i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}
</style>
<div class="masthead">
  <div class="mark">L</div>
  <div>
    <h1>Pick a direction — same prompt, four genomes</h1>
    <p class="lede">Low-fidelity preview generated straight from the genome (no render): real layout proportions, real palette, real typeface (nav / titles / headline in the genome's actual fonts). Blue outline = section pinned to one viewport. Click a card to choose the one to full-render. <b>Every card is generated by our engine; the shell stays neutral so they read clearly.</b></p>
  </div>
</div>
<div class="toolbar">
  <div class="seg"><button id="btnD" class="on" onclick="setShape('d')">Desktop</button><button id="btnM" onclick="setShape('m')">Mobile</button></div>
  <div id="selinfo" class="selinfo">No direction selected</div>
</div>
<div class="grid" id="grid">${cards}</div>
<div class="legend">
  <span><i style="background:#888"></i>text / heading</span>
  <span><i style="background:#b5522f"></i>accent (per-genome)</span>
  <span><i style="background:#555;border:1px solid #777"></i>surface / card</span>
  <span><i style="background:transparent;outline:1.5px solid var(--sv)"></i>single-viewport section</span>
  <span>Aa = live display + body font</span>
</div>
<script>
  var grid = document.getElementById('grid');
  function setShape(s){
    grid.classList.toggle('mobile', s === 'm');
    document.getElementById('btnD').classList.toggle('on', s === 'd');
    document.getElementById('btnM').classList.toggle('on', s === 'm');
  }
  function pick(i){
    var ws = document.querySelectorAll('.wire');
    for (var k = 0; k < ws.length; k++) ws[k].classList.toggle('selected', +ws[k].dataset.idx === i);
    document.getElementById('selinfo').innerHTML = 'Direction <b>' + i + '</b> selected — this is the one we\\'d full-render';
  }
</script>`;

writeFileSync(resolve(VAL, 'blobs.html'), html);
console.log('wrote', resolve(VAL, 'blobs.html'), `(${(html.length / 1024 / 1024).toFixed(2)} MB)`);
