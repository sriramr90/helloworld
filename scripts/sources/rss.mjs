// Curated positive-news RSS feeds — these outlets are already upbeat, so they
// need little filtering. No API key required. Minimal hand-rolled RSS parsing
// keeps the project dependency-light (fine for well-formed feeds).
import { fetchText, clean, truncate, makeId } from "../lib/util.mjs";

const FEEDS = [
  { name: "Good News Network", url: "https://www.goodnewsnetwork.org/feed/" },
  { name: "Positive News", url: "https://www.positive.news/feed/" },
  { name: "Reasons to be Cheerful", url: "https://reasonstobecheerful.world/feed/" },
];

export async function fetchRss({ sinceMs }) {
  const all = [];
  for (const feed of FEEDS) {
    const xml = await fetchText(feed.url);
    if (!xml) continue;
    for (const item of parseItems(xml)) {
      const published = item.pubDate ? Date.parse(item.pubDate) : NaN;
      if (Number.isFinite(published) && published < sinceMs) continue; // older than window
      if (!item.title || !item.link) continue;
      all.push({
        id: makeId(item.link),
        title: clean(item.title),
        description: truncate(clean(item.description || ""), 280),
        url: item.link,
        image: item.image || null,
        source: feed.name,
        publishedAt: item.pubDate || null,
      });
    }
  }
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
