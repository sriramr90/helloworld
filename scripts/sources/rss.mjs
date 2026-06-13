// Curated positive-news RSS feeds — these outlets are already upbeat, so they
// need little filtering. No API key required. Minimal hand-rolled RSS parsing
// keeps the project dependency-light (fine for well-formed feeds).
import { fetchText, clean, truncate, makeId } from "../lib/util.mjs";

const FEEDS = [
  // Dedicated positive-news outlets
  { name: "Good News Network", url: "https://www.goodnewsnetwork.org/feed/" },
  { name: "Positive News", url: "https://www.positive.news/feed/" },
  { name: "Reasons to be Cheerful", url: "https://reasonstobecheerful.world/feed/" },
  { name: "Good Good Good", url: "https://www.goodgoodgood.co/articles/rss.xml" },
  { name: "The Optimist Daily", url: "https://www.optimistdaily.com/feed/" },
  { name: "Nice News", url: "https://nicenews.com/feed/" },
  { name: "Upworthy", url: "https://www.upworthy.com/rss" },
  // Solutions / constructive journalism (broader — leans on the LLM filter)
  { name: "The Guardian (The Upside)", url: "https://www.theguardian.com/world/series/the-upside/rss" },
  { name: "Fix The News", url: "https://fixthenews.com/feed" },
  { name: "Squirrel News", url: "https://squirrel-news.net/feed/" },
];

export async function fetchRss({ sinceMs }) {
  // Fetch all feeds in parallel; one slow/dead feed never blocks the others.
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const xml = await fetchText(feed.url);
      if (!xml) return [];
      const items = [];
      for (const item of parseItems(xml)) {
        const published = item.pubDate ? Date.parse(item.pubDate) : NaN;
        if (Number.isFinite(published) && published < sinceMs) continue; // older than window
        if (!item.title || !item.link) continue;
        items.push({
          id: makeId(item.link),
          title: clean(item.title),
          description: truncate(clean(item.description || ""), 280),
          url: item.link,
          image: item.image || null,
          source: feed.name,
          publishedAt: item.pubDate || null,
        });
      }
      return items;
    })
  );

  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return { source: "rss", items: all };
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/item>/i)[0];
    items.push({
      title: tag(block, "title"),
      link: tag(block, "link"),
      description: tag(block, "description"),
      pubDate: tag(block, "pubDate"),
      image: attr(block, /<media:content[^>]*url="([^"]+)"/i) || attr(block, /<enclosure[^>]*url="([^"]+)"/i),
    });
  }
  return items;
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function attr(block, re) {
  const m = block.match(re);
  return m ? m[1] : null;
}
