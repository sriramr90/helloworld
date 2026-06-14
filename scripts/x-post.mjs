// Composes a ready-to-paste X (Twitter) post from the morning's edition and
// (optionally) sends it to you on Telegram so you can post it by hand. Runs in
// the daily GitHub Action on the schedule, after the edition is built.
//
// Delivery: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID to receive it on Telegram;
// with no env it just prints the post (handy for local previews / testing).

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "./lib/pages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX = 280;
const HANDLE = "@brightearlynews";

const prettyDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });

// Build a single post under the 280-char limit. We lead with 1–2 of the warmest
// headlines as teasers, then the link. Headlines are trimmed to fit, never the link.
export function buildPost(edition) {
  const order = edition.sections || [];
  // Prefer Global Wins (front-page) stories, then fall back to edition order.
  const ranked = [...edition.stories].sort((a, b) => {
    const ga = a.section === order[0] ? 0 : 1;
    const gb = b.section === order[0] ? 0 : 1;
    return ga - gb || (b.positivity || 0) - (a.positivity || 0);
  });

  const link = `${SITE}`;
  const head = `🌅 Good news from ${prettyDate(edition.date)} —`;
  const tail = `${edition.storyCount} stories to start your day with a smile:\n${link}\n\n#GoodNews #Positivity ${HANDLE}`;

  // Fit as many teaser headlines as the budget allows (each on its own • line).
  const budget = MAX - head.length - tail.length - 4; // padding for newlines
  const teasers = [];
  let used = 0;
  for (const s of ranked) {
    let h = s.headline.replace(/\s+/g, " ").trim();
    const line = `\n• ${h}`;
    if (used + line.length > budget) {
      // Try a trimmed version of this headline if at least one teaser exists.
      if (teasers.length) break;
      h = h.slice(0, Math.max(0, budget - 4)).replace(/\s+\S*$/, "") + "…";
    }
    const finalLine = `\n• ${h}`;
    if (used + finalLine.length > budget && teasers.length) break;
    teasers.push(h);
    used += finalLine.length;
    if (teasers.length >= 2) break;
  }

  const post = `${head}${teasers.map((t) => `\n• ${t}`).join("")}\n\n${tail}`;
  return post.length <= MAX ? post : post.slice(0, MAX - 1) + "…";
}

async function sendTelegram(post, edition) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log("  (no TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID — printing post only)\n");
    console.log(post);
    return;
  }
  // Send the post wrapped in a code block: on mobile Telegram, tapping it copies
  // the exact text. Inside ```...``` only backslash and backtick need escaping.
  const fenced = "```\n" + post.replace(/\\/g, "\\\\").replace(/`/g, "\\`") + "\n```";
  const text = `🐦 *X post for ${prettyDate(edition.date)}* \\(${post.length}/280 — tap to copy\\):\n\n${fenced}`;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "MarkdownV2",
      link_preview_options: { is_disabled: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram ${res.status}: ${detail.slice(0, 300)}`);
  }
  console.log(`  🐦 Sent today's X post to Telegram (${post.length}/280 chars)`);
}

async function main() {
  const edition = JSON.parse(await readFile(join(ROOT, "public", "data", "latest.json"), "utf8"));
  if (!edition.stories?.length) {
    console.log("  (empty edition — skipping X post)");
    return;
  }
  await sendTelegram(buildPost(edition), edition);
}

main().catch((err) => {
  console.error("X post failed:", err.message);
  process.exit(1);
});
