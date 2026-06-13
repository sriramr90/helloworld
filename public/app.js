// Bright & Early front-end: lay the edition out as a flip-through newspaper —
// one topic per page, swipe (or arrow) between pages, columns within each page.
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

function storyEl(story, { lead = false } = {}) {
  const article = document.createElement("article");
  article.className = "story" + (lead ? " story--lead" : "");

  if (story.image) {
    const fig = document.createElement("div");
    fig.className = "story__media";
    const img = document.createElement("img");
    img.className = "story__img";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = story.image;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onerror = () => fig.remove();
    fig.appendChild(img);
    article.appendChild(fig);
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

  const foot = document.createElement("div");
  foot.className = "story__foot";
  const src = document.createElement("span");
  src.className = "story__source";
  src.textContent = story.source || "";
  foot.appendChild(src);
  const more = document.createElement("a");
  more.className = "story__more";
  more.href = story.url;
  more.target = "_blank";
  more.rel = "noopener";
  more.textContent = "Read full story →";
  foot.appendChild(more);
  article.appendChild(foot);

  return article;
}

function pageEl(section, stories, index, total) {
  const page = document.createElement("section");
  page.className = "page";
  page.dataset.index = index;

  const inner = document.createElement("div");
  inner.className = "page__inner";

  const head = document.createElement("div");
  head.className = "page__head";
  head.innerHTML =
    `<span class="page__section">${section}</span>` +
    `<span class="page__num">Page ${index + 1} of ${total}</span>`;
  inner.appendChild(head);

  const [first, ...rest] = stories;
  if (first) inner.appendChild(storyEl(first, { lead: true }));

  if (rest.length) {
    const wrap = document.createElement("div");
    wrap.className = "stories";
    rest.forEach((s) => wrap.appendChild(storyEl(s)));
    inner.appendChild(wrap);
  }

  page.appendChild(inner);
  return page;
}

function render(edition) {
  document.getElementById("edition-date").textContent = fmtDate(edition.date);

  // Group stories by section, preserving the edition's declared section order,
  // and keep only the topics that actually have stories.
  const order = edition.sections || [];
  const groups = new Map(order.map((s) => [s, []]));
  for (const story of edition.stories) {
    const key = groups.has(story.section) ? story.section : order[0] || "World";
    (groups.get(key) || groups.set(key, []).get(key)).push(story);
  }
  const pages = [...groups].filter(([, st]) => st.length);

  const pager = document.getElementById("pager");
  const tabs = document.getElementById("tabs");
  pager.innerHTML = "";
  tabs.innerHTML = "";

  pages.forEach(([section, stories], i) => {
    pager.appendChild(pageEl(section, stories, i, pages.length));

    const tab = document.createElement("button");
    tab.className = "tab";
    tab.textContent = section;
    tab.addEventListener("click", () => goToPage(i));
    tabs.appendChild(tab);
  });

  setupNavigation(pages.length);
}

// --- Navigation: tabs, prev/next, keyboard, and active-page tracking ---

let pageNodes = [];
let current = 0;

function goToPage(i) {
  const target = pageNodes[i];
  if (target) target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
}

function setActive(i) {
  current = i;
  const tabs = [...document.querySelectorAll(".tab")];
  tabs.forEach((t, idx) => t.classList.toggle("tab--active", idx === i));
  if (tabs[i]) tabs[i].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

  const status = document.getElementById("page-status");
  if (status) status.textContent = `${i + 1} / ${pageNodes.length}`;
  document.getElementById("prev").disabled = i === 0;
  document.getElementById("next").disabled = i === pageNodes.length - 1;
}

function setupNavigation(count) {
  const pager = document.getElementById("pager");
  pageNodes = [...pager.querySelectorAll(".page")];

  document.getElementById("prev").onclick = () => goToPage(Math.max(0, current - 1));
  document.getElementById("next").onclick = () => goToPage(Math.min(count - 1, current + 1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goToPage(Math.min(count - 1, current + 1));
    else if (e.key === "ArrowLeft") goToPage(Math.max(0, current - 1));
  });

  // Track which page is in view to light up the right tab + counter.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          setActive(Number(e.target.dataset.index));
        }
      }
    },
    { root: pager, threshold: [0.5, 0.75] }
  );
  pageNodes.forEach((p) => io.observe(p));

  setActive(0);
}

(async () => {
  const edition = await loadEdition();
  if (edition && edition.stories?.length) render(edition);
  else
    document.getElementById("pager").innerHTML =
      '<p class="loading">No edition yet — check back after the morning press run.</p>';

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }
})();
