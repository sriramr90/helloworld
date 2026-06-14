// Web-search sourcing — replaces the RSS/GDELT/GNews feeds. For each topical
// section we ask Claude (via OpenRouter's web plugin, which uses Anthropic's
// native search) for yesterday's genuinely heart-warming stories, each with a
// specific article URL and a publish date. We DON'T trust the date filter to the
// model alone — the build verifies each story against the article's own
// published-time meta before it can make the edition. This step just casts the net.

import { makeId, clean } from "../lib/util.mjs";
import { parseJson } from "../lib/curate.mjs";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5"; // an Anthropic model → native search

// One search per topical section. "Global Wins" is NOT searched — it's the
// front page, filled later by promoting the warmest stories from these pools.
const TOPICS = [
  { section: "Fair Play & Triumphs", brief: "uplifting sport — incredible comebacks, sportsmanship between rivals, underdogs defying the odds, athletes giving back to their communities" },
  { section: "Future Proof", brief: "human ingenuity solving real problems — medical milestones and new treatments, clean-energy and engineering advances, science and space breakthroughs" },
  { section: "Kind Humans", brief: "grassroots kindness and community — local heroes, random acts of kindness, neighbours helping neighbours, towns and families lifted up" },
  { section: "Earth Restored", brief: "conservation and wildlife wins — endangered species recovering, reforestation, oceans and habitats protected, successful clean-ups" },
];

const SYSTEM = `You are a news scout for "Bright & Early", a morning newspaper of genuinely HEART-WARMING news. Use web search to find real, specific, recently-published stories that would make a tired person SMILE over their coffee — not merely "good for the world", but a real little lift of warmth or delight.

Rules:
- Return ONLY real stories you actually found in the search results.
- Each story's url MUST be a specific article you found, copied VERBATIM from the search results — never a homepage, section page, or a URL you guessed or shortened.
- date is the article's publish date in YYYY-MM-DD.
- summary is one warm, human sentence (~25 words) leading with the people and the feeling.
- Skip press releases, round-ups/listicles, dry statistics, and anything dark or only superficially positive.

Respond with ONLY a JSON object, no prose and no markdown fences:
{"stories":[{"headline":"...","summary":"...","url":"https://...","date":"YYYY-MM-DD"}]}`;

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "web";
  }
}

async function searchTopic(topic, dates, { key, model }) {
  const list = dates.join(" or ");
  const phrase =
    dates.length > 1
      ? `published in the last 48 hours — on ${list}`
      : `published on ${dates[0]} (yesterday)`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/sriramr90/bright-and-early",
        "X-Title": "Bright & Early",
      },
      body: JSON.stringify({
        model,
        plugins: [{ id: "web", max_results: 8 }],
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Find up to 8 ${topic.brief} stories ${phrase}. Only include stories actually published on one of those dates (${list}). Copy each url exactly from the search results.`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenRouter ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = parseJson(content);
    return (parsed.stories || [])
      .map((s) => {
        const url = (s.url || "").trim();
        if (!/^https?:\/\//i.test(url)) return null;
        return {
          id: makeId(url),
          title: clean(s.headline || ""),
          description: clean(s.summary || ""),
          url,
          source: hostOf(url),
          publishedAt: s.date || null, // model's claim; verified later against the page
          section: topic.section,
        };
      })
      .filter((s) => s && s.title);
  } finally {
    clearTimeout(timer);
  }
}

/** Run all topical searches in parallel; return a de-duplicated candidate list.
 *  `dates` is the allowed window (e.g. [yesterday, day-before]) — newest first. */
export async function searchTopics(dates) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");
  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  // Retry each topic up to 3 times — the model occasionally returns prose or
  // truncated JSON that fails to parse; a retry usually yields clean JSON, so a
  // single flaky response no longer wipes out an entire section.
  const withRetry = async (t) => {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await searchTopic(t, dates, { key, model });
      } catch (err) {
        lastErr = err;
        console.warn(`  ↻ ${t.section}: attempt ${attempt} failed (${err?.message || err})`);
      }
    }
    throw lastErr;
  };

  const results = await Promise.allSettled(TOPICS.map((t) => withRetry(t)));

  const seen = new Set();
  const candidates = [];
  results.forEach((r, i) => {
    if (r.status !== "fulfilled") {
      console.warn(`  ! ${TOPICS[i].section}: search failed (${r.reason?.message || r.reason})`);
      return;
    }
    const fresh = r.value.filter((c) => !seen.has(c.id) && seen.add(c.id));
    console.log(`  ✓ ${TOPICS[i].section}: ${fresh.length} stories`);
    candidates.push(...fresh);
  });
  return candidates;
}
