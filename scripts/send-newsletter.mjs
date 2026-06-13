// Sends the morning edition as an email via Buttondown. Runs in the daily
// GitHub Action *after* the edition is built, and ONLY on the schedule (never on
// pushes), so subscribers get exactly one email a morning.
//
// Degrades gracefully: with no BUTTONDOWN_API_KEY it just logs and exits 0, so
// the pipeline is happy whether or not the newsletter is wired up yet.

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "./lib/pages.mjs";

// --- Config: set TIP_URL to your Buy Me a Coffee / Ko-fi page (or leave "") ---
const TIP_URL = process.env.TIP_URL || ""; // e.g. https://www.buymeacoffee.com/brightandearly

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const prettyDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

function emailHtml(edition) {
  const order = edition.sections || [];
  const bySection = new Map(order.map((s) => [s, []]));
  for (const story of edition.stories) {
    const key = bySection.has(story.section) ? story.section : order[0];
    (bySection.get(key) || []).push(story);
  }

  const blocks = [];
  for (const [section, stories] of bySection) {
    if (!stories.length) continue;
    blocks.push(
      `<h2 style="font:700 13px/1 -apple-system,Segoe UI,Roboto,sans-serif;text-transform:uppercase;letter-spacing:.14em;color:#b4541f;border-bottom:2px solid #cfc7b4;padding-bottom:6px;margin:28px 0 14px;">${section}</h2>`
    );
    for (const s of stories) {
      const link = `${SITE}/s/${s.id}.html`;
      blocks.push(
        `<div style="margin:0 0 18px;">` +
          (s.image
            ? `<a href="${link}"><img src="${s.image}" width="100%" style="max-width:540px;border-radius:4px;display:block;margin-bottom:8px;" alt="" /></a>`
            : "") +
          `<a href="${link}" style="font:700 19px/1.25 Georgia,serif;color:#20201c;text-decoration:none;">${s.headline}</a>` +
          `<p style="font:400 15px/1.5 Georgia,serif;color:#585348;margin:6px 0 4px;">${s.summary || ""}</p>` +
          `<a href="${s.url}" style="font:700 11px/1 -apple-system,sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#b4541f;text-decoration:none;">${s.source} · read full story →</a>` +
        `</div>`
      );
    }
  }

  const tip = TIP_URL
    ? `<p style="text-align:center;margin:28px 0;"><a href="${TIP_URL}" style="display:inline-block;background:#b4541f;color:#fff;font:700 14px/1 -apple-system,sans-serif;text-decoration:none;padding:11px 18px;border-radius:999px;">☕ Buy me a coffee</a></p>`
    : "";

  return (
    `<div style="max-width:580px;margin:0 auto;padding:0 16px;background:#f4f1ea;">` +
    `<div style="text-align:center;padding:24px 0 8px;border-bottom:3px double #cfc7b4;">` +
      `<div style="font:800 30px/1 Georgia,serif;font-variant:small-caps;letter-spacing:-.02em;color:#20201c;">Bright &amp; Early</div>` +
      `<div style="font:italic 14px/1 Georgia,serif;color:#585348;margin-top:4px;">Yesterday's good news, bright and early</div>` +
      `<div style="font:700 11px/1 -apple-system,sans-serif;text-transform:uppercase;letter-spacing:.16em;color:#585348;margin-top:10px;">${prettyDate(edition.date)} · Morning Edition</div>` +
    `</div>` +
    blocks.join("\n") +
    `<p style="text-align:center;font:italic 15px/1.5 Georgia,serif;color:#585348;margin:30px 0 8px;">— that's all the good news for today —</p>` +
    tip +
    `<p style="text-align:center;font:400 12px/1.5 -apple-system,sans-serif;color:#a39c8b;margin:18px 0 30px;">You're reading Bright &amp; Early · <a href="${SITE}" style="color:#a39c8b;">brightandearly.news</a></p>` +
    `</div>`
  );
}

async function main() {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) {
    console.log("  (no BUTTONDOWN_API_KEY — skipping newsletter send)");
    return;
  }

  const edition = JSON.parse(await readFile(join(ROOT, "public", "data", "latest.json"), "utf8"));
  if (!edition.stories?.length) {
    console.log("  (empty edition — skipping newsletter send)");
    return;
  }

  const subject = `🌅 Bright & Early — ${prettyDate(edition.date)}`;
  const res = await fetch("https://api.buttondown.email/v1/emails", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ subject, body: emailHtml(edition), status: "about_to_send" }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Buttondown ${res.status}: ${detail.slice(0, 300)}`);
  }
  console.log(`  📧 Sent the morning newsletter: "${subject}"`);
}

main().catch((err) => {
  console.error("Newsletter send failed:", err.message);
  process.exit(1);
});
