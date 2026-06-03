/**
 * OpenAI (GPT-5.5) synthetic-signal client.
 *
 * The Anthropic models (Opus/Sonnet/Haiku) are sampled via harness subagents;
 * GPT-5.5 isn't available that way, so it's sampled through the OpenAI API. Same
 * iterative prompt + ranked output, so results merge with the subagent data.
 *
 * Key-ready: reads OPENAI_API_KEY; the sampler skips cleanly when it's absent.
 */

export interface RankedFont {
  rank: number;
  font: string;
}

export interface OpenAiConfig {
  apiKey: string;
  model: string;
}

export function resolveOpenAiConfig(env: NodeJS.ProcessEnv): OpenAiConfig | null {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return { apiKey, model: env.OPENAI_MODEL ?? "gpt-5.5" };
}

export function buildRankedPrompt(vibeDescription: string): string {
  return (
    `You are the design brain choosing the main HERO HEADING font for a landing page for: ${vibeDescription}. Use only real Google Fonts.\n\n` +
    `Run this loop internally: name the Google Font you'd instinctively reach for FIRST, then imagine "too overused, give another" and name the next, until you have 20 DISTINCT real Google Fonts ranked 1 (first instinct) to 20 (deep cut).\n\n` +
    `Respond with ONLY a JSON array, no prose: [{"rank":1,"font":"Name"}, ... 20 items]`
  );
}

/** Parse a ranked-list response (array of {rank,font} OR array of strings). */
export function parseRankedList(text: string): RankedFont[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: RankedFont[] = [];
  arr.forEach((el, i) => {
    if (typeof el === "string" && el.trim()) {
      out.push({ rank: i + 1, font: el.trim() });
    } else if (el && typeof el === "object") {
      const o = el as Record<string, unknown>;
      const font = typeof o.font === "string" ? o.font.trim() : "";
      const rank = typeof o.rank === "number" ? o.rank : i + 1;
      if (font) out.push({ rank, font });
    }
  });
  return out.sort((a, b) => a.rank - b.rank);
}

/** Minimal OpenAI Chat Completions call via fetch — no SDK dependency. */
export async function callOpenAI(prompt: string, cfg: OpenAiConfig): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content ?? "";
}
