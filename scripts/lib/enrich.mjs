// Lever B — give the summaries real substance. For each story the editor chose,
// fetch the article page once and pull (a) the og:image if we don't have one and
// (b) the article's body text, so the summary can carry a SPECIFIC, smile-worthy
// detail (a name, a number, a vivid fact) instead of just the thin RSS blurb.

import { fetchText, clean, isoDay } from "./util.mjs";

const IMG_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
];

function extractImage(head) {
  for (const re of IMG_PATTERNS) {
    const m = head.match(re);
    if (m && m[1]) {
      const u = m[1].trim().replace(/&amp;/gi, "&");
      if (/^https?:\/\//i.test(u)) return u;
    }
  }
  return null;
}

// The article's OWN published date — the authoritative signal for "is this from
// yesterday?". We check the standard meta tags and JSON-LD, in priority order.
const DATE_PATTERNS = [
  /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
  /"datePublished"\s*:\s*"([^"]+)"/i,
  /<meta[^>]+(?:name|itemprop)=["'](?:pubdate|publishdate|publish-date|date|dc\.date|dc\.date\.issued)["'][^>]+content=["']([^"']+)["']/i,
  /<time[^>]+datetime=["']([^"']+)["'][^>]*>/i,
];

function extractPubDate(head) {
  for (const re of DATE_PATTERNS) {
    const m = head.match(re);
    if (m && m[1]) {
      const day = isoDay(m[1].trim());
      if (day) return day;
    }
  }
  return null;
}

// Light readability: prefer the <article> region, then pull substantial <p>
// text. Crude but enough to hand the model real facts to write from.
function extractText(html, max = 1500) {
  const art = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const region = art ? art[1] : html;
  const paras = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(region))) {
    const t = clean(m[1]);
    if (t.length > 40) paras.push(t);
    if (paras.join(" ").length > max) break;
  }
  return paras.join(" ").slice(0, max);
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

/** Fetch each story's page once: fill a missing image + attach `_text`. */
export async function enrichArticles(stories, { concurrency = 6 } = {}) {
  await mapLimit(stories, concurrency, async (s) => {
    if (!s.url) return;
    try {
      const html = await fetchText(s.url, { timeoutMs: 12000, headers: { accept: "text/html,*/*" } });
      if (!html) return;
      const head = html.slice(0, 60000);
      if (!s.image) {
        const img = extractImage(head);
        if (img) s.image = img;
      }
      const day = extractPubDate(head);
      if (day) s._pubdate = day;
      const text = extractText(html);
      if (text && text.length > 200) s._text = text;
    } catch {
      /* leave the story as-is on any failure */
    }
  });
  return {
    withText: stories.filter((s) => s._text).length,
    withImage: stories.filter((s) => s.image).length,
    withDate: stories.filter((s) => s._pubdate).length,
    total: stories.length,
  };
}
