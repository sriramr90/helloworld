// The editorial brain: an LLM reads the prefiltered candidates and selects the
// genuinely uplifting ones, writes a warm one-line summary and a fresh headline,
// and files each into a section. This is the "curation" half of the hybrid.
//
// Provider: OpenRouter (https://openrouter.ai) — an OpenAI-compatible gateway,
// so this is a plain chat-completions call. Pick any model via OPENROUTER_MODEL
// (it can route to Claude, GPT, Llama, etc.). We ask for strict JSON in the
// prompt and parse defensively, so it works across models regardless of whether
// a given one supports a structured-output mode.
//
// If OPENROUTER_API_KEY is absent, callers fall back to the local ranking — this
// module is only invoked when a key is present.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini"; // override with OPENROUTER_MODEL

export const SECTIONS = [
  "World",
  "Science & Health",
  "Environment",
  "Community & Kindness",
  "Culture & Sport",
];

const SYSTEM = `You are the editor of "Bright & Early", a beloved morning newspaper that prints ONLY genuinely positive, uplifting news. Your readers open it with their coffee to start the day feeling hopeful.

Your standards are high and specific:
- Select only stories that are truly heartening — a breakthrough, a rescue, an act of kindness, a recovery, a milestone, real progress. "Not negative" is NOT enough; the story must actively lift the reader.
- Reject anything dark, tragic, fear-driven, politically inflammatory, or only superficially positive (e.g. a stock going up, a celebrity feud framed as "winning").
- Reject clickbait and stories where the headline alone can't be trusted to be positive.
- For each selected story write: a warm, human one-line summary (max ~30 words) and a clean, dignified headline (no ALL CAPS, no clickbait).
- File each story into exactly one of these sections: ${SECTIONS.join(", ")}.
- Quality over quantity: pick the best 10–18 stories. A short, excellent edition beats a padded one.

Respond with ONLY a JSON object, no prose and no markdown fences, in exactly this shape:
{"stories":[{"id":"<candidate id>","headline":"...","summary":"...","section":"<one of the sections>","positivity":0.0}]}
positivity is a number from 0 to 1 (how uplifting the story is). Use the exact id from each candidate you select.`;

export async function curate(candidates) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const catalogue = candidates
    .map((c) => `id: ${c.id}\ntitle: ${c.title}\nsource: ${c.source}\nblurb: ${c.description || "(none)"}`)
    .join("\n\n");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Optional attribution headers OpenRouter uses for its dashboards.
      "HTTP-Referer": "https://github.com/sriramr90/bright-and-early",
      "X-Title": "Bright & Early",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Here are today's candidate stories from across the world. Curate tomorrow morning's edition.\n\n${catalogue}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");

  const parsed = parseJson(content);
  const byId = new Map(candidates.map((c) => [c.id, c]));

  // Join the editor's picks back to the original candidate metadata (url, image…).
  return (parsed.stories || [])
    .map((pick) => {
      const original = byId.get(pick.id);
      if (!original) return null;
      return {
        headline: pick.headline || original.title,
        summary: pick.summary || original.description,
        section: SECTIONS.includes(pick.section) ? pick.section : "World",
        positivity: typeof pick.positivity === "number" ? pick.positivity : 0.5,
        url: original.url,
        image: original.image,
        source: original.source,
        publishedAt: original.publishedAt,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.positivity - a.positivity);
}

// Tolerant JSON extraction: strip markdown fences, then take the outermost
// {...} so we survive any stray prose a model might wrap around the JSON.
function parseJson(text) {
  let t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  return JSON.parse(t);
}
