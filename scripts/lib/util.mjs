// Small shared helpers for the build pipeline. No external dependencies —
// Node 20+ provides global fetch, AbortController, and crypto.

/** Fetch JSON with a timeout. Returns null on any failure (caller decides). */
export async function fetchJson(url, { timeoutMs = 15000, headers = {} } = {}) {
  const res = await fetchWithTimeout(url, { timeoutMs, headers });
  if (!res || !res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Fetch text (used for RSS/XML). Returns null on any failure. */
export async function fetchText(url, { timeoutMs = 15000, headers = {} } = {}) {
  const res = await fetchWithTimeout(url, { timeoutMs, headers });
  if (!res || !res.ok) return null;
  try {
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, { timeoutMs, headers }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "bright-and-early/0.1 (+https://github.com/sriramr90/bright-and-early)", ...headers },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** YYYY-MM-DD for a Date in UTC. */
export function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** "Yesterday" relative to now, as {fromISO, toISO, fromDate, toDate}. */
export function yesterdayWindow(now = new Date()) {
  const to = new Date(now);
  const from = new Date(now.getTime() - 36 * 60 * 60 * 1000); // last 36h, generous
  return { fromISO: isoDate(from), toISO: isoDate(to), fromDate: from, toDate: to };
}

/** Calendar date in US Eastern (the edition's timezone), shifted by offsetDays. */
export function easternDateStr(d = new Date(), offsetDays = 0) {
  const ymd = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
  const base = new Date(`${ymd}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

/** Allowed publish dates for an edition. Default: yesterday only (US Eastern).
 *  EDITION_DAYS=2 widens to yesterday + the day before — a thin-news safety valve. */
export function editionDates(now = new Date()) {
  const days = Math.max(1, parseInt(process.env.EDITION_DAYS || "1", 10));
  const dates = [];
  for (let i = 1; i <= days; i++) dates.push(easternDateStr(now, -i));
  return dates;
}

/** Normalize any date-ish value to a YYYY-MM-DD string (UTC day), or null. */
export function isoDay(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
}

/** Stable-ish id from a url/title so the front-end and curator can agree. */
export function makeId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return "s" + (h >>> 0).toString(36);
}

/** Strip HTML tags, decode common entities, and collapse whitespace. */
export function clean(text = "") {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|hellip|mdash|ndash|rsquo|lsquo|rdquo|ldquo);/gi, (_, e) => ENTITIES[e.toLowerCase()] || " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

/** Truncate to n chars on a word boundary. */
export function truncate(text = "", n = 280) {
  if (text.length <= n) return text;
  return text.slice(0, n).replace(/\s+\S*$/, "") + "…";
}
