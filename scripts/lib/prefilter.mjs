// Cheap, local first pass: drop obvious negatives, dedupe, and score a rough
// positivity signal. This trims the candidate pool before the (paid) Claude
// curation step — the "local pre-filter" half of the hybrid approach. It also
// doubles as the standalone ranker when no ANTHROPIC_API_KEY is configured.

// Hard blocklist — if a headline is about these, it's not a "good vibe".
const NEGATIVE = [
  "kill", "killed", "dead", "death", "dies", "died", "murder", "shooting", "shot",
  "war", "attack", "terror", "bomb", "rape", "assault", "abuse", "stabbing",
  "crash", "wildfire", "flood disaster", "earthquake kills", "massacre", "genocide",
  "famine", "outbreak", "pandemic deaths", "suicide", "overdose", "scandal",
  "fraud", "lawsuit", "convicted", "arrested", "shutdown", "layoffs", "recession fears",
  "collapse", "crisis deepens", "death toll", "fatal", "hostage", "kidnap",
];

// Soft positive lexicon — rough sentiment lift for ranking.
const POSITIVE = [
  "rescue", "rescued", "breakthrough", "cure", "recovery", "recovered", "restored",
  "thriving", "celebrate", "celebration", "milestone", "record", "first", "saved",
  "hope", "hopeful", "kindness", "generous", "donated", "volunteer", "reunited",
  "conservation", "protected", "revived", "boost", "wins", "award", "success",
  "community", "heartwarming", "uplifting", "comeback", "healed", "inspiring",
];

export function prefilter(items, { limit = 70 } = {}) {
  const seenUrls = new Set();
  const seenTitles = new Set();
  const kept = [];

  for (const it of items) {
    if (!it.title || !it.url) continue;
    const urlKey = it.url.split("?")[0];
    // Normalised title signature: strip punctuation/case/extra spaces so the
    // same headline syndicated across outlets collapses to one candidate.
    const titleKey = it.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 70);
    if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) continue;

    const hay = `${it.title} ${it.description}`.toLowerCase();
    if (NEGATIVE.some((w) => hay.includes(w))) continue;

    seenUrls.add(urlKey);
    seenTitles.add(titleKey);
    kept.push({ ...it, _score: sentimentScore(hay) });
  }

  kept.sort((a, b) => b._score - a._score);
  return kept.slice(0, limit);
}

function sentimentScore(hay) {
  let score = 0;
  for (const w of POSITIVE) if (hay.includes(w)) score += 1;
  return score;
}
