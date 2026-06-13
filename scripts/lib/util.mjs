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
      headers: { "user-agent": "goodvibe/0.1 (+https://github.com/sriramr90/goodvibe)", ...headers },
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
