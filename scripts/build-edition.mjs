// Bright & Early — daily edition builder.
//
// Pipeline:  web search (4 topical) -> enrich pages -> strict "yesterday" filter
//            -> curate/promote -> deepen summaries -> write JSON + share pages
//
// Sourcing is Claude web search via OpenRouter's web plugin (Anthropic-native
// search), so every candidate is a specific, dated article. That lets us keep
// ONLY stories actually published yesterday (US Eastern), verified against each
// article's own published-time meta — not the model's say-so. Requires
// OPENROUTER_API_KEY; without it there's nothing to source from.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { easternDateStr, editionDates, isoDay, makeId } from "./lib/util.mjs";
import { SECTIONS, curate, resummarize } from "./lib/curate.mjs";
import { enrichArticles } from "./lib/enrich.mjs";
import { writeSite, writeArchiveIndex } from "./lib/pages.mjs";
import { searchTopics } from "./sources/websearch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "public", "data");

async function main() {
  const now = new Date();
  // EDITION_DATE=YYYY-MM-DD backfills a specific publication day; like the daily
  // flow, it sources YESTERDAY's news (the day before the edition date).
  const override = process.env.EDITION_DATE;
  const prevDay = (d) => {
    const t = new Date(`${d}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() - 1);
    return t.toISOString().slice(0, 10);
  };
  const dateStr = override || easternDateStr(now, 0); // publication day (this morning, ET)
  const allowed = override ? [prevDay(override)] : editionDates(now); // [yesterday] — or wider via EDITION_DAYS
  console.log(`\n📰 Building Bright & Early for ${dateStr} — only stories published ${allowed.join(" or ")} (US Eastern)\n`);

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("✗ OPENROUTER_API_KEY is required — web search is the only source. Set it in .env or the GitHub secret.");
    process.exit(1);
  }

  // 1. Search each topical section for yesterday's heart-warming stories.
  let candidates = await searchTopics(allowed[0]);
  console.log(`\n  Found ${candidates.length} candidate stories`);

  // 2. Fetch each candidate's page once: og:image + body text + the article's
  //    OWN published date (which we trust over the model's claim).
  const enr = await enrichArticles(candidates);
  console.log(`  🖼  ${enr.withImage}/${enr.total} illustrated · ${enr.withText}/${enr.total} with text · ${enr.withDate}/${enr.total} date-verified`);

  // 3. Strict filter: keep only stories whose resolved publish date is allowed.
  //    Prefer the article's own date; fall back to the model's claim if absent.
  //    Requiring a real published-date naturally rejects homepages and bad URLs.
  const before = candidates.length;
  candidates = candidates.filter((c) => {
    const day = c._pubdate || isoDay(c.publishedAt);
    if (day) c.publishedAt = day;
    return day && allowed.includes(day);
  });
  console.log(`  📅 ${candidates.length}/${before} published ${allowed.join(" or ")} (dropped ${before - candidates.length} off-day/undated)`);

  if (!candidates.length) {
    console.warn("  ! Nothing matched the date window. If this keeps happening, widen with EDITION_DAYS=2.");
  }

  // 4. Curate: the editor selects, files into sections, and promotes the warmest
  //    stories to the Global Wins front page. Body text is carried forward.
  let stories = await curate(candidates);
  console.log(`  ✨ Curated ${stories.length} stories into the edition`);

  // 5. Stable ids, then deepen each chosen summary from its real article text.
  stories = stories.map((s) => ({ id: makeId(s.url), ...s }));
  try {
    stories = await resummarize(stories);
    console.log(`  ✍️  Summaries deepened from article text`);
  } catch (err) {
    console.warn(`  ! re-summarization failed (${err.message}); keeping first-pass summaries`);
  }

  // 6. Assemble + write (drop the transient body text / pubdate scratch fields).
  const withIds = stories.map(({ _text, _pubdate, ...s }) => s);
  const edition = {
    date: dateStr,
    generatedAt: now.toISOString(),
    masthead: "Bright & Early",
    tagline: "Yesterday's good news, bright and early.",
    sections: SECTIONS,
    storyCount: withIds.length,
    stories: withIds,
  };

  await mkdir(join(DATA_DIR, "editions"), { recursive: true });
  await writeFile(join(DATA_DIR, "latest.json"), JSON.stringify(edition, null, 2));
  await writeFile(join(DATA_DIR, "editions", `${edition.date}.json`), JSON.stringify(edition, null, 2));

  // 7. Generate shareable per-story pages (Open Graph tags) + sitemap.
  const pageCount = await writeSite(edition, join(ROOT, "public"));
  console.log(`  🔗 Wrote ${pageCount} shareable story pages + sitemap.xml`);

  // Refresh the archive index so the new edition is browsable from the front-end.
  const archived = await writeArchiveIndex(join(ROOT, "public"));
  console.log(`  🗓  Archive index: ${archived} editions`);

  console.log(`\n✅ Wrote edition with ${withIds.length} stories to public/data/latest.json\n`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
