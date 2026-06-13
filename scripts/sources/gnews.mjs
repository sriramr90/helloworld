// GNews — broad multi-source aggregation. We bias the query toward uplifting
// stories; the prefilter and curator do the rest. Requires GNEWS_API_KEY (free).
import { fetchJson, clean, truncate, makeId } from "../lib/util.mjs";

const POSITIVE_QUERY =
  '"good news" OR breakthrough OR rescue OR recovery OR milestone OR ' +
  "celebrate OR restored OR thriving OR kindness OR conservation";

export async function fetchGnews({ fromISO, toISO }) {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return { source: "gnews", skipped: "no GNEWS_API_KEY", items: [] };

  const url =
    "https://gnews.io/api/v4/search?" +
    new URLSearchParams({
      q: POSITIVE_QUERY,
      lang: "en",
      from: `${fromISO}T00:00:00Z`,
      to: `${toISO}T23:59:59Z`,
      sortby: "publishedAt",
      max: "25",
      apikey: key,
    });

  const data = await fetchJson(url);
  const articles = data?.articles ?? [];
  const items = articles.map((a) => ({
    id: makeId(a.url),
    title: clean(a.title),
    description: truncate(clean(a.description || ""), 280),
    url: a.url,
    image: a.image || null,
    source: a.source?.name || "GNews",
    publishedAt: a.publishedAt || null,
  }));
  return { source: "gnews", items };
}
