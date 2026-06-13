// GDELT — fully open global news index, no API key required. We query the
// Doc 2.0 API for recent English articles weighted toward positive themes.
//
// GDELT's free endpoint rate-limits frequent callers and occasionally returns
// an empty/non-JSON response, so we retry with a short backoff and fall back to
// a wider time window before giving up. In production (one run a day) it's
// reliable; the flakiness mostly shows up under rapid repeated local builds.
import { fetchJson, clean, makeId } from "../lib/util.mjs";

const POSITIVE_QUERY =
  "(breakthrough OR rescued OR restored OR recovery OR celebrate OR " +
  'milestone OR "good news" OR conservation OR thriving) sourcelang:english';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrl({ timespan, maxrecords }) {
  return (
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query: POSITIVE_QUERY,
      mode: "artlist",
      format: "json",
      timespan,
      maxrecords,
      sort: "hybridrel",
    })
  );
}

function toItems(articles) {
  return articles.map((a) => ({
    id: makeId(a.url),
    title: clean(a.title || ""),
    description: "", // GDELT artlist has no summary; curator works from title + source
    url: a.url,
    image: a.socialimage || null,
    source: a.domain || "GDELT",
    publishedAt: a.seendate || null,
  }));
}

export async function fetchGdelt() {
  // Each attempt widens the window a little; we back off between tries so a
  // momentary rate-limit doesn't cost us the whole source.
  const attempts = [
    { timespan: "36h", maxrecords: "60" },
    { timespan: "48h", maxrecords: "75" },
    { timespan: "72h", maxrecords: "75" },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const data = await fetchJson(buildUrl(attempts[i]), { timeoutMs: 20000 });
    const articles = data?.articles ?? [];
    if (articles.length) return { source: "gdelt", items: toItems(articles) };
    if (i < attempts.length - 1) await sleep(2000 + i * 1500); // backoff before retry
  }

  return { source: "gdelt", items: [], skipped: "no articles (rate-limited or empty)" };
}
