// The Guardian — high-quality global journalism. We pull from "The Upside",
// the Guardian's own constructive/positive-news series, which is already
// curated for hopeful stories. Requires GUARDIAN_API_KEY (free).
import { fetchJson, clean, truncate, makeId } from "../lib/util.mjs";

export async function fetchGuardian({ fromISO, toISO }) {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return { source: "guardian", skipped: "no GUARDIAN_API_KEY", items: [] };

  const url =
    "https://content.guardianapis.com/search?" +
    new URLSearchParams({
      tag: "world/series/the-upside",
      "from-date": fromISO,
      "to-date": toISO,
      "order-by": "newest",
      "show-fields": "trailText,thumbnail,byline",
      "page-size": "30",
      "api-key": key,
    });

  const data = await fetchJson(url);
  const results = data?.response?.results ?? [];
  const items = results.map((r) => ({
    id: makeId(r.webUrl),
    title: clean(r.webTitle),
    description: truncate(clean(r.fields?.trailText || ""), 280),
    url: r.webUrl,
    image: r.fields?.thumbnail || null,
    source: "The Guardian",
    publishedAt: r.webPublicationDate || null,
  }));
  return { source: "guardian", items };
}
