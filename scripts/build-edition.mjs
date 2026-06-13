// goodvibe — daily edition builder.
//
// Pipeline:  fetch (4 sources) -> local prefilter -> Claude curation -> write JSON
//
// Designed to degrade gracefully:
//   - Sources without an API key are skipped (GDELT + RSS need none).
//   - Without ANTHROPIC_API_KEY, it falls back to the local sentiment ranking.
// So `npm run build` produces an edition even with zero configuration.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { yesterdayWindow, isoDate, truncate, clean } from "./lib/util.mjs";
import { prefilter } from "./lib/prefilter.mjs";
import { SECTIONS } from "./lib/curate.mjs";

import { fetchGuardian } from "./sources/guardian.mjs";
import { fetchGnews } from "./sources/gnews.mjs";
import { fetchGdelt } from "./sources/gdelt.mjs";
import { fetchRss } from "./sources/rss.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "public", "data");

async function main() {
  const now = new Date();
  const window = yesterdayWindow(now);
  console.log(`\n📰 Building goodvibe edition for ${isoDate(now)} (window since ${window.fromISO})\n`);

  // 1. Fetch from all sources in parallel; never let one failure sink the build.
  const sinceMs = window.fromDate.getTime();
  const results = await Promise.allSettled([
    fetchGuardian(window),
    fetchGnews(window),
    fetchGdelt(),
    fetchRss({ sinceMs }),
  ]);

  const all = [];
  for (const r of results) {
    if (r.status !== "fulfilled") {
      console.warn("  ! a source threw:", r.reason?.message || r.reason);
      continue;
    }
    const { source, items, skipped } = r.value;
    if (skipped) console.log(`  - ${source}: skipped (${skipped})`);
    else console.log(`  ✓ ${source}: ${items.length} stories`);
    all.push(...items);
  }
  console.log(`\n  Total fetched: ${all.length}`);

  // 2. Local prefilter: drop obvious negatives, dedupe, rough positivity sort.
  const candidates = prefilter(all, { limit: 70 });
  console.log(`  After prefilter: ${candidates.length} candidates`);

  // 3. Curate. Claude if we have a key; otherwise the local ranking.
  let stories;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { curate } = await import("./lib/curate.mjs");
      stories = await curate(candidates);
      console.log(`  ✨ Claude curated ${stories.length} stories`);
    } catch (err) {
      console.warn(`  ! curation failed (${err.message}); falling back to local ranking`);
      stories = localEdition(candidates);
    }
  } else {
    console.log("  (no ANTHROPIC_API_KEY — using local sentiment ranking)");
    stories = localEdition(candidates);
  }

  // 4. Assemble and write the edition.
  const edition = {
    date: isoDate(now),
    generatedAt: now.toISOString(),
    masthead: "goodvibe",
    tagline: "Only the good news, every morning.",
    sections: SECTIONS,
    storyCount: stories.length,
    stories,
  };

  await mkdir(join(DATA_DIR, "editions"), { recursive: true });
  await writeFile(join(DATA_DIR, "latest.json"), JSON.stringify(edition, null, 2));
  await writeFile(join(DATA_DIR, "editions", `${edition.date}.json`), JSON.stringify(edition, null, 2));

  console.log(`\n✅ Wrote edition with ${stories.length} stories to public/data/latest.json\n`);
}

// Fallback edition built purely from the local prefilter scores.
function localEdition(candidates) {
  return candidates.slice(0, 16).map((c) => ({
    headline: c.title,
    summary: c.description ? truncate(clean(c.description), 200) : "",
    section: "World",
    positivity: Math.min(1, 0.5 + c._score * 0.1),
    url: c.url,
    image: c.image,
    source: c.source,
    publishedAt: c.publishedAt,
  }));
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
