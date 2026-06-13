// Bright & Early front-end: lay the edition out as a flip-through newspaper —
// one topic per page, swipe (or arrow) between pages, columns within each page,
// a shareable link per story, and a "Back Page" with the newsletter + tip jar.

// ─── Config: fill these in to switch features on ────────────────────────────
const NEWSLETTER_USERNAME = ""; // your Buttondown username → enables email signup
const TIP_URL = ""; // e.g. https://www.buymeacoffee.com/brightandearly → enables tip jar
const SOCIAL = { x: "", instagram: "" }; // handles (no @) → show social links
// ────────────────────────────────────────────────────────────────────────────

// Rounded line icons for each section tab (inline SVG — no icon library).
const SECTION_ICONS = {
  "Global Wins": `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="10" r="6"/><path d="M3 10h12"/><ellipse cx="9" cy="10" rx="2.6" ry="6"/><path d="M16 2.5l.6 1.5 1.5.6-1.5.6L16 7l-.6-1.5L13.9 5l1.5-.6z"/></svg>`,
  "Fair Play & Triumphs": `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8v3.2a4 4 0 0 1-8 0z"/><path d="M6 5.4H4.3A1.7 1.7 0 0 0 6 7.1"/><path d="M14 5.4h1.7A1.7 1.7 0 0 1 14 7.1"/><path d="M10 11.4v2.2"/><path d="M7.6 16h4.8l-.7-2.4H8.3z"/></svg>`,
  "Future Proof": `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5c2.2 1.5 3.3 3.8 3.3 6.4 0 1.1-.2 2.1-.6 3H7.3c-.4-.9-.6-1.9-.6-3C6.7 6.3 7.8 4 10 2.5z"/><circle cx="10" cy="8" r="1.2"/><path d="M7.3 12.4 5.7 14m6.9-1.6L14.3 14"/><path d="M8.6 14.5c0 1 .5 2 1.4 2.5.9-.5 1.4-1.5 1.4-2.5"/></svg>`,
  "Kind Humans": `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7.3" r="2.1"/><circle cx="13" cy="7.3" r="2.1"/><path d="M3.6 14.5c0-2.1 1.5-3.4 3.4-3.4s3.4 1.3 3.4 3.4"/><path d="M11.6 11.4c.45-.2.9-.3 1.4-.3 1.9 0 3.4 1.3 3.4 3.4"/></svg>`,
  "Earth Restored": `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16.5V10"/><path d="M10 11C10 8.5 8 6.5 5.3 6.5 5.3 9 7.3 11 10 11z"/><path d="M10 11.5c0-2.5 2-4.5 4.7-4.5 0 2.5-2 4.5-4.7 4.5z"/></svg>`,
};

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

// --- Sharing -----------------------------------------------------------------

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("toast--show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("toast--show"), 1800);
}

function shareStory(story) {
  const url = `${location.origin}/s/${story.id}.html`;
  const data = { title: story.headline, text: story.summary || "", url };
  if (navigator.share) navigator.share(data).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast("Link copied ✓"));
  else window.open(url, "_blank", "noopener");
}

// --- Story + page elements ---------------------------------------------------

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

  const share = document.createElement("button");
  share.className = "story__share";
  share.type = "button";
  share.setAttribute("aria-label", "Share this story");
  share.textContent = "Share";
  share.addEventListener("click", () => shareStory(story));
  foot.appendChild(share);

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

function backPageEl(index, total) {
  const page = document.createElement("section");
  page.className = "page page--back";
  page.dataset.index = index;

  const newsletter = NEWSLETTER_USERNAME
    ? `<form class="signup" action="https://buttondown.com/api/emails/embed-subscribe/${NEWSLETTER_USERNAME}" method="post" target="_blank">
         <input class="signup__input" type="email" name="email" placeholder="you@example.com" required />
         <button class="signup__btn" type="submit">Subscribe</button>
       </form>
       <p class="back__fine">One short edition each morning. No spam, unsubscribe anytime.</p>`
    : `<p class="back__soon">📮 Daily email edition — coming soon.</p>`;

  const tip = TIP_URL
    ? `<a class="tipjar" href="${TIP_URL}" target="_blank" rel="noopener">☕ Buy me a coffee</a>
       <p class="back__fine">Bright &amp; Early is free and ad-free. If it brightened your morning, you can chip in.</p>`
    : "";

  const socials = [];
  if (SOCIAL.x) socials.push(`<a href="https://x.com/${SOCIAL.x}" target="_blank" rel="noopener">X / Twitter</a>`);
  if (SOCIAL.instagram) socials.push(`<a href="https://instagram.com/${SOCIAL.instagram}" target="_blank" rel="noopener">Instagram</a>`);
  const social = socials.length ? `<div class="back__social">${socials.join("<span>·</span>")}</div>` : "";

  page.innerHTML = `
    <div class="page__inner back__inner">
      <div class="back__mark">— 30 —</div>
      <h2 class="back__title">That's all the good news for today.</h2>
      <p class="back__lede">Close the paper, smile, and get on with your day. We'll have a fresh edition for you tomorrow morning.</p>
      <div class="back__block">
        <h3 class="back__h">Get tomorrow's edition in your inbox</h3>
        ${newsletter}
      </div>
      ${tip ? `<div class="back__block">${tip}</div>` : ""}
      ${social}
      <p class="back__colophon">Bright &amp; Early · assembled fresh each morning from open news sources, curated for stories that lift the day.</p>
    </div>`;
  return page;
}

// --- Render ------------------------------------------------------------------

function render(edition) {
  document.getElementById("edition-date").textContent = fmtDate(edition.date);

  const order = edition.sections || [];
  const groups = new Map(order.map((s) => [s, []]));
  for (const story of edition.stories) {
    const key = groups.has(story.section) ? story.section : order[0] || "World";
    (groups.get(key) || groups.set(key, []).get(key)).push(story);
  }
  const sections = [...groups].filter(([, st]) => st.length);
  const total = sections.length + 1; // +1 for the back page

  const pager = document.getElementById("pager");
  const tabs = document.getElementById("tabs");
  pager.innerHTML = "";
  tabs.innerHTML = "";

  sections.forEach(([section, stories], i) => {
    pager.appendChild(pageEl(section, stories, i, total));
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.innerHTML = (SECTION_ICONS[section] || "") + `<span>${section}</span>`;
    tab.addEventListener("click", () => goToPage(i));
    tabs.appendChild(tab);
  });

  // The Back Page: end-mark, newsletter, tip jar.
  pager.appendChild(backPageEl(sections.length, total));
  const backTab = document.createElement("button");
  backTab.className = "tab tab--back";
  backTab.textContent = "✦";
  backTab.title = "The Back Page";
  backTab.addEventListener("click", () => goToPage(sections.length));
  tabs.appendChild(backTab);

  setupNavigation(total);
}

// --- Navigation --------------------------------------------------------------

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

  const prog = document.getElementById("progress");
  if (prog) prog.style.width = `${((i + 1) / pageNodes.length) * 100}%`;

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

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) setActive(Number(e.target.dataset.index));
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
