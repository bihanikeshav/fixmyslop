/**
 * Synthetic saturation signal — "what the AI defaults to".
 *
 * The purest measure of AI slop: ask models to design landing pages many times
 * and record which fonts they reach for. This is a SEPARATE signal from the
 * deterministic crawl; it necessarily uses an LLM (that's the thing being measured).
 *
 * This module is pure logic + a thin fetch client. Runnable via sample-synthetic.ts,
 * which skips gracefully when no API key is set. The parser is unit-tested.
 */

import { slugify } from "../sources/gfonts.js";

export interface FontChoice {
  headingFont: string;
  bodyFont: string;
  palette: string[];
}

export const SAMPLE_PRODUCTS: readonly string[] = [
  "a project management SaaS for remote teams",
  "an AI note-taking app",
  "a fintech budgeting tool",
  "a developer API monitoring dashboard",
  "a meal-planning mobile app",
  "a B2B sales CRM",
  "a personal portfolio for a designer",
  "an e-commerce store for handmade goods",
  "a meditation and wellness app",
  "a no-code website builder",
];

export function buildPrompt(product: string): string {
  return [
    `You are designing a landing page for ${product}.`,
    `Pick the typography and colors you would actually use.`,
    `Respond with ONLY a JSON object, no prose:`,
    `{"headingFont": "<google font for the hero/H1>", "bodyFont": "<google font for body>", "palette": ["#rrggbb", "#rrggbb", "#rrggbb"]}`,
  ].join("\n");
}

/** Extract the JSON choice from a model response (tolerates code fences / prose). */
export function parseChoice(text: string): FontChoice | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const heading = typeof o.headingFont === "string" ? o.headingFont.trim() : "";
  const body = typeof o.bodyFont === "string" ? o.bodyFont.trim() : "";
  if (!heading || !body) return null;
  const palette = Array.isArray(o.palette)
    ? o.palette.filter((c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c))
    : [];
  return { headingFont: heading, bodyFont: body, palette };
}

/** Map a free-text font name to an index font id. */
export function choiceToFontIds(choice: FontChoice): { headingId: string; bodyId: string } {
  return { headingId: slugify(choice.headingFont), bodyId: slugify(choice.bodyFont) };
}

export interface LlmConfig {
  apiKey: string;
  model: string;
}

/** Minimal Anthropic Messages call via fetch — no SDK dependency. */
export async function callAnthropic(prompt: string, cfg: LlmConfig): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  return data.content.map((c) => c.text ?? "").join("");
}

export function resolveLlmConfig(env: NodeJS.ProcessEnv): LlmConfig | null {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: env.SYNTHETIC_MODEL ?? "claude-haiku-4-5-20251001" };
}
