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
  "Global Wins",
  "Fair Play & Triumphs",
  "Future Proof",
  "Kind Humans",
  "Earth Restored",
];

// What belongs on each page — keeps the model filing accurately despite the
// evocative (non-literal) section names.
const SECTION_GUIDE = `- Global Wins — THE FRONT PAGE. Put the 4–5 most significant and widely-relevant uplifting stories of the day here, pulled from ANY domain (a major medical breakthrough, a big environmental win, a landmark act of generosity, a historic milestone). These are the day's headline stories — so a story that runs on the front page does NOT also appear in its topical section below.
- Fair Play & Triumphs — sport as uplift: incredible comebacks, sportsmanship between rivals, underdogs defying the odds, athletes giving back to their communities, fan-driven good.
- Future Proof — human ingenuity solving real problems: medical milestones and new treatments, clean-energy and engineering advances, science and space breakthroughs.
- Kind Humans — grassroots kindness and community: local heroes, random acts of kindness, neighbours helping neighbours, towns and families lifted up.
- Earth Restored — conservation and wildlife wins: endangered species recovering, reforestation, oceans and habitats protected, successful clean-ups.`;

const SYSTEM = `You are the editor of "Bright & Early", a beloved morning newspaper that prints ONLY genuinely positive, uplifting news. Your readers open it with their coffee to start the day feeling hopeful.

Your standards are high and specific:
- Select only stories that are truly heartening — a breakthrough, a rescue, an act of kindness, a recovery, a milestone, real progress. "Not negative" is NOT enough; the story must actively lift the reader.
- Reject anything dark, tragic, fear-driven, politically inflammatory, or only superficially positive (e.g. a stock going up, a celebrity feud framed as "winning").
- Reject clickbait and stories where the headline alone can't be trusted to be positive.
- For each selected story write: a warm, human one-line summary (max ~30 words) and a clean, dignified headline (no ALL CAPS, no clickbait).
- File each story into exactly one of these sections, using the EXACT section name shown:
${SECTION_GUIDE}
- Aim for about 4–5 stories per section (one strong lead plus a few more), max 6. Fill Global Wins first with the day's biggest stories, then distribute the rest across the topical sections.
- NO DUPLICATES — this is critical. Never select the same story twice, and never select two stories about the same underlying event, even if they come from different outlets or have different headlines (e.g. several sites covering the same rescue, discovery, or announcement). Pick the single best version and drop the rest. Each candidate id may appear at most once, in exactly one section.
- Quality over quantity: NEVER pad a section with a weak story just to reach 5. Three excellent stories beat five mediocre ones.
- Order matters: within each section, put the single most uplifting / most visually compelling story first — it becomes that page's lead.

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
      max_tokens: 16000,
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

  // Safety net: even with the no-duplicates instruction, never let the same
  // candidate (by id or by url) appear twice in the finished edition.
  const seenIds = new Set();
  const seenUrls = new Set();

  // Join the editor's picks back to the original candidate metadata (url, image…).
  return (parsed.stories || [])
    .map((pick) => {
      const original = byId.get(pick.id);
      if (!original) return null;
      if (seenIds.has(pick.id) || seenUrls.has(original.url)) return null;
      seenIds.add(pick.id);
      seenUrls.add(original.url);
      return {
        headline: pick.headline || original.title,
        summary: pick.summary || original.description,
        section: SECTIONS.includes(pick.section) ? pick.section : SECTIONS[0],
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

// Tolerant JSON extraction: strip markdown fences, take the outermost {...},
// and—if that still fails (e.g. the model's array got truncated mid-stream)—
// salvage every complete story object we can find so a near-miss isn't a total
// loss that drops us back to the local ranking.
function parseJson(text) {
  const t = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  const core = start !== -1 && end !== -1 ? t.slice(start, end + 1) : t;

  try {
    return JSON.parse(core);
  } catch {
    // Salvage: story objects are flat (no nested braces), so grab each one.
    const stories = [];
    const re = /\{[^{}]*\}/g;
    let m;
    while ((m = re.exec(t))) {
      try {
        const obj = JSON.parse(m[0]);
        if (obj && obj.id) stories.push(obj);
      } catch {
        /* skip a partial/garbled object */
      }
    }
    if (stories.length) return { stories };
    throw new Error("could not parse model JSON");
  }
}
