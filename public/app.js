// goodvibe front-end: fetch the latest edition and lay it out as a newspaper.
// Network-first for the data so you always get today's paper when online, with
// the service worker falling back to the last cached edition when offline.

const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

async function loadEdition() {
  try {
    const res = await fetch("/data/latest.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("no edition");
    return await res.json();
  } catch {
    return null;
  }
}

function storyEl(story) {
  const article = document.createElement("article");
  article.className = "story";

  if (story.image) {
    const img = document.createElement("img");
    img.className = "story__img";
    img.loading = "lazy";
    img.src = story.image;
    img.alt = "";
    img.onerror = () => img.remove();
    article.appendChild(img);
  }

  const h = document.createElement("h3");
  h.className = "story__headline";
  const a = document.createElement("a");
  a.href = story.url;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = story.headline;
  h.appendChild(a);
  article.appendChild(h);

  if (story.summary) {
    const p = document.createElement("p");
    p.className = "story__summary";
    p.textContent = story.summary;
    article.appendChild(p);
  }

  const src = document.createElement("div");
  src.className = "story__source";
  src.textContent = story.source || "";
  article.appendChild(src);

  return article;
}

function render(edition) {
  document.getElementById("edition-date").textContent = fmtDate(edition.date);

  const paper = document.getElementById("paper");
  paper.innerHTML = "";

  // Group stories by section, preserving the edition's section order.
  const order = edition.sections || [];
  const groups = new Map(order.map((s) => [s, []]));
  for (const story of edition.stories) {
    const key = groups.has(story.section) ? story.section : order[0] || "World";
    (groups.get(key) || groups.set(key, []).get(key)).push(story);
  }

  let first = true;
  for (const [section, stories] of groups) {
    if (!stories.length) continue;
    const sec = document.createElement("section");
    sec.className = "section" + (first ? " section--lead" : "");
    first = false;

    const head = document.createElement("h2");
    head.className = "section__head";
    head.textContent = section;
    sec.appendChild(head);

    const wrap = document.createElement("div");
    wrap.className = "stories";
    stories.forEach((s) => wrap.appendChild(storyEl(s)));
    sec.appendChild(wrap);
    paper.appendChild(sec);
  }

  const meta = document.getElementById("colophon-meta");
  const when = new Date(edition.generatedAt);
  meta.textContent = `${edition.storyCount} stories · set ${when.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

(async () => {
  const edition = await loadEdition();
  if (edition) render(edition);
  else
    document.getElementById("paper").innerHTML =
      '<p class="loading">No edition yet — check back after the morning press run.</p>';

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
})();
