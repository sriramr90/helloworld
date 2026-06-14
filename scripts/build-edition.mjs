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

import { writeFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { easternDateStr, isoDay, makeId } from "./lib/util.mjs";
import { SECTIONS, curate, resummarize } from "./lib/curate.mjs";
import { enrichArticles } from "./lib/enrich.mjs";
import { writeSite, writeArchiveIndex } from "./lib/pages.mjs";
import { searchTopics } from "./sources/websearch.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "public", "data");

// ── Cross-edition dedup ──────────────────────────────────────────────────────
// A big story (a cancer trial, a championship) gets covered for several days by
// different outlets — different URLs, near-identical gist. We don't want the same
// story to reappear morning after morning, so we drop any candidate that closely
// matches a headline already published in the previous few editions.
// Aggressive cross-edition dedup: look far back and match loosely, so a story
// can't resurface in a different outlet's wording days later.
const DEDUP_LOOKBACK_DAYS = 30;
const DEDUP_THRESHOLD = 0.4;
// A 48-hour sourcing window by default, widening further only if a day can't
// reach the minimum. MIN_STORIES is the "full edition" floor we aim for.
const BASE_WINDOW_DAYS = Math.max(1, parseInt(process.env.EDITION_DAYS || "2", 10));
const MAX_WINDOW_DAYS = 5;
const MIN_STORIES = Math.max(1, parseInt(process.env.MIN_STORIES || "8", 10));
const STOP = new Set(
  ("a an the of to in on for and or with from as at by is are was were be been new "
    + "after over into out up down off than then this that it its his her their our your "
    + "first new now has have had will can could would amid against more most just").split(" ")
);
const sig = (title) =>
  new Set(
    String(title || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / new Set([...a, ...b]).size;
};

// Stories published in the editions of the `days` mornings before `beforeDate`.
async function recentlyPublished(beforeDate, days) {
  const dir = join(DATA_DIR, "editions");
  const lo = new Date(`${beforeDate}T12:00:00Z`);
  lo.setUTCDate(lo.getUTCDate() - days);
  const loStr = lo.toISOString().slice(0, 10);
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    const d = f.slice(0, 10);
    if (d >= beforeDate || d < loStr) continue; // only the window strictly before
    try {
      const ed = JSON.parse(await readFile(join(dir, f), "utf8"));
      for (const s of ed.stories || []) out.push({ url: s.url, sig: sig(s.headline) });
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

// Drop candidates whose URL or headline closely matches a recently-run story.
function dropRecentDuplicates(candidates, prior) {
  const priorUrls = new Set(prior.map((p) => p.url));
  return candidates.filter((c) => {
    if (priorUrls.has(c.url)) return false;
    const cs = sig(c.title || c.headline); // raw candidates use .title, curated use .headline
    return !prior.some((p) => jaccard(cs, p.sig) >= DEDUP_THRESHOLD);
  });
}

// The N-day sourcing window ending the day before `pubDate` (newest first).
function windowDates(pubDate, n) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = new Date(`${pubDate}T12:00:00Z`);
    t.setUTCDate(t.getUTCDate() - i);
    out.push(t.toISOString().slice(0, 10));
  }
  return out;
}

async function main() {
  const now = new Date();
  // EDITION_DATE=YYYY-MM-DD backfills a specific publication day; otherwise we
  // build this morning's edition. Either way we source the window before it.
  const override = process.env.EDITION_DATE;
  const dateStr = override || easternDateStr(now, 0); // publication / edition day

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("✗ OPENROUTER_API_KEY is required — web search is the only source. Set it in .env or the GitHub secret.");
    process.exit(1);
  }

  // Gather over a 48h window, widening a day at a time until the edition reaches
  // MIN_STORIES (or we hit the max window). Aggressive cross-edition dedup means
  // each extra day contributes genuinely new stories, never recent repeats.
  const prior = await recentlyPublished(dateStr, DEDUP_LOOKBACK_DAYS);
  let stories = [];
  for (let win = BASE_WINDOW_DAYS; win <= MAX_WINDOW_DAYS; win++) {
    const allowed = windowDates(dateStr, win);
    console.log(`\n📰 Building Bright & Early for ${dateStr} — stories published ${allowed.join(" or ")} (US Eastern)\n`);

    // 1. Search each topical section across the window.
    let candidates = await searchTopics(allowed);
    console.log(`\n  Found ${candidates.length} candidate stories`);

    // 2. Enrich each page once: og:image + body text + the article's OWN
    //    published date (trusted over the model's claim).
    const enr = await enrichArticles(candidates);
    console.log(`  🖼  ${enr.withImage}/${enr.total} illustrated · ${enr.withText}/${enr.total} with text · ${enr.withDate}/${enr.total} date-verified`);

    // 3. Keep only stories whose resolved publish date falls in the window.
    const before = candidates.length;
    candidates = candidates.filter((c) => {
      const day = c._pubdate || isoDay(c.publishedAt);
      if (day) c.publishedAt = day;
      return day && allowed.includes(day);
    });
    console.log(`  📅 ${candidates.length}/${before} in window (dropped ${before - candidates.length} off-window/undated)`);

    // 3b. Aggressive cross-edition dedup: drop anything close to a story already
    //     run in the last month, so widening never reintroduces a repeat.
    const preDedup = candidates.length;
    candidates = dropRecentDuplicates(candidates, prior);
    if (preDedup - candidates.length > 0) {
      console.log(`  🧹 Deduped ${preDedup - candidates.length} already-published story(ies)`);
    }

    // 4. Curate into sections + promote the warmest to the Global Wins front page.
    stories = await curate(candidates);

    // 4b. Second dedup pass on the FINAL rewritten headlines — curate can reword
    //     a story close to one already published, which the pre-curate pass misses.
    const postCurate = stories.length;
    stories = dropRecentDuplicates(stories, prior);
    if (postCurate - stories.length > 0) {
      console.log(`  🧹 Deduped ${postCurate - stories.length} more after rewrite`);
    }
    console.log(`  ✨ Curated ${stories.length} stories into the edition`);

    if (stories.length >= MIN_STORIES) break;
    if (win < MAX_WINDOW_DAYS) {
      console.log(`  ↔ Only ${stories.length}/${MIN_STORIES} stories — widening to a ${win + 1}-day window.`);
    } else {
      console.warn(`  ! ${stories.length} stories at the ${MAX_WINDOW_DAYS}-day max (below the ${MIN_STORIES} target).`);
    }
  }

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

  // Never replace a good edition with an empty one. On a quiet/thin morning
  // (or flaky searches) keep yesterday's paper live rather than blanking the
  // site — the reader sees the last good edition until the next run succeeds.
  if (!withIds.length) {
    console.warn("  ! Built 0 stories — keeping the previous edition live (latest.json untouched).");
    await writeArchiveIndex(join(ROOT, "public"));
    return;
  }

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
