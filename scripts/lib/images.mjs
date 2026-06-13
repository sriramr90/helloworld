// Image enrichment: fill in any story that lacks a picture by reading the
// article's Open Graph / Twitter-card image. We only do this for the final
// curated handful, so it's a few fast, parallel fetches. We hotlink the
// publisher's own image URL (the standard news-aggregator approach) and always
// link back to the source — we never rehost the image.

import { fetchText } from "./util.mjs";

// Match <meta property="og:image" content="..."> in either attribute order,
// plus the secure_url and twitter:image fallbacks.
const META_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
];

function extractImage(html) {
  // Only the <head> can hold the OG tags; scanning a slice keeps regex cheap.
  const head = html.slice(0, 60000);
  for (const re of META_PATTERNS) {
    const m = head.match(re);
    if (m && m[1]) {
      const url = m[1].trim().replace(/&amp;/gi, "&").replace(/&#0?38;/g, "&");
      if (/^https?:\/\/.+\.(jpe?g|png|webp|avif|gif)/i.test(url) || /^https?:\/\//i.test(url)) {
        return url;
      }
    }
  }
  return null;
}

async function ogImage(url) {
  const html = await fetchText(url, { timeoutMs: 12000, headers: { accept: "text/html,*/*" } });
  if (!html) return null;
  return extractImage(html);
}

// Run an async fn over items with a concurrency cap (no dep on a library).
async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

/** Mutates stories in place: sets `image` for any that lack one. */
export async function enrichImages(stories, { concurrency = 6 } = {}) {
  const need = stories.filter((s) => !s.image && s.url);
  await mapLimit(need, concurrency, async (s) => {
    try {
      const img = await ogImage(s.url);
      if (img) s.image = img;
    } catch {
      /* leave image null on any failure */
    }
  });
  const have = stories.filter((s) => s.image).length;
  return { have, total: stories.length };
}
