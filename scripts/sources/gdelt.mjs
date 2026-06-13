// GDELT — fully open global news index, no API key required. We query the
// Doc 2.0 API for recent English articles weighted toward positive themes.
import { fetchJson, clean, makeId } from "../lib/util.mjs";

const POSITIVE_QUERY =
  "(breakthrough OR rescued OR restored OR recovery OR celebrate OR " +
  'milestone OR "good news" OR conservation OR thriving) sourcelang:english';

export async function fetchGdelt() {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?" +
    new URLSearchParams({
      query: POSITIVE_QUERY,
      mode: "artlist",
      format: "json",
      timespan: "36h",
      maxrecords: "60",
      sort: "hybridrel",
    });

  const data = await fetchJson(url, { timeoutMs: 20000 });
  const articles = data?.articles ?? [];
  const items = articles.map((a) => ({
    id: makeId(a.url),
    title: clean(a.title || ""),
    description: "", // GDELT artlist has no summary; curator works from title + source
    url: a.url,
    image: a.socialimage || null,
    source: a.domain || "GDELT",
    publishedAt: a.seendate || null,
  }));
  return { source: "gdelt", items };
}
