// Static site extras: a shareable HTML page per story (with Open Graph / Twitter
// tags so links look rich when texted or posted), plus a sitemap. These are what
// make Bright & Early findable on Google and turn every reader into a distributor
// — each share links back to a branded page, not just the raw source article.

import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const SITE = "https://brightandearly.news";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const prettyDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

function storyPage(story, edition) {
  const url = `${SITE}/s/${story.id}.html`;
  const title = `${esc(story.headline)} — Bright & Early`;
  const desc = esc(story.summary || "Genuinely positive news, every morning.");
  const img = story.image ? esc(story.image) : `${SITE}/icons/icon-512.png`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${url}" />
    <meta name="theme-color" content="#f4f1ea" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Bright & Early" />
    <meta property="og:title" content="${esc(story.headline)}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(story.headline)}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${img}" />

    <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="storypage">
    <article class="reader">
      <a class="reader__brand" href="/">Bright &amp; Early</a>
      <div class="reader__kicker">${esc(story.section)} · ${esc(prettyDate(edition.date))}</div>
      <h1 class="reader__headline">${esc(story.headline)}</h1>
      ${story.image ? `<img class="reader__img" src="${esc(story.image)}" alt="" referrerpolicy="no-referrer" />` : ""}
      <p class="reader__summary">${esc(story.summary || "")}</p>
      <div class="reader__actions">
        <a class="reader__cta" href="${esc(story.url)}" target="_blank" rel="noopener">Read the full story at ${esc(story.source || "the source")} →</a>
        <a class="reader__back" href="/">← More good news from Bright &amp; Early</a>
      </div>
    </article>
    <!-- Cloudflare Web Analytics (cookieless, privacy-friendly) -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "10151da66b064971ae05d8decb16b063"}'></script>
  </body>
</html>
`;
}

/** Writes /s/<id>.html for every story and a sitemap.xml. Returns page count. */
export async function writeSite(edition, publicDir) {
  // Keep every day's pages (they're committed to the repo by the daily archive
  // step) so old share links never 404. Same-id pages are simply overwritten.
  const dir = join(publicDir, "s");
  await mkdir(dir, { recursive: true });

  await Promise.all(
    edition.stories.map((s) => writeFile(join(dir, `${s.id}.html`), storyPage(s, edition)))
  );

  const urls = [
    `${SITE}/`,
    ...edition.stories.map((s) => `${SITE}/s/${s.id}.html`),
  ];
  const sitemap =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc><lastmod>${edition.date}</lastmod></url>`).join("\n") +
    `\n</urlset>\n`;
  await writeFile(join(publicDir, "sitemap.xml"), sitemap);

  return edition.stories.length;
}

/** Rebuild data/archive.json by scanning every saved edition. This is the index
 *  the front-end's Archive panel reads to let readers browse past mornings. */
export async function writeArchiveIndex(publicDir) {
  const dir = join(publicDir, "data", "editions");
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch {
    return 0; // no editions yet
  }

  const editions = [];
  for (const f of files) {
    try {
      const ed = JSON.parse(await readFile(join(dir, f), "utf8"));
      if (!ed.stories?.length) continue; // skip empty editions
      const lead =
        ed.stories.find((s) => s.section === "Global Wins") || ed.stories[0];
      editions.push({
        date: ed.date,
        storyCount: ed.storyCount ?? ed.stories.length,
        lead: lead?.headline || "",
      });
    } catch {
      /* skip an unreadable edition file */
    }
  }

  editions.sort((a, b) => b.date.localeCompare(a.date)); // newest first
  await writeFile(
    join(publicDir, "data", "archive.json"),
    JSON.stringify({ count: editions.length, editions }, null, 2)
  );
  return editions.length;
}
