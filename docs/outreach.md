# Bright & Early — Outreach Playbook

How to grow the audience without getting flagged as spam. Channels, etiquette,
ready-to-use copy, and the tools that generate daily content.

---

## Daily tools

- **Reddit picks:** `node scripts/reddit-picker.mjs [YYYY-MM-DD]` → per-story
  subreddit matches, titles, source + `/s/` links, best-bets ranked.
- **X post:** generated each morning and sent to Telegram (once
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets are set). Preview locally
  with `node scripts/x-post.mjs`.

---

## Reddit

### Account (set up once)
- **Username:** personal-style (e.g. `u/sram8295`) — NOT a brand name like
  "BrightAndEarlyNews" (auto-flagged as marketing).
- **Display name:** `Bright & Early ☀️` (safe to brand; doesn't change handle).
- **Bio (transparent — Reddit rewards disclosing affiliation):**
  > ☀️ I run brightandearly.news — a morning paper of genuinely good news from
  > the day before. Here for the wholesome stuff. Happy to share a story when it fits.
- **Avatar:** `public/icons/icon-512.png` · **Banner:** `public/social/banner-x-1500x500.png`
- **Links:** brightandearly.news · x.com/brightearlynews

### The rules that keep you un-banned
1. **Warm up first.** Most good-news subs gate on karma + account age. Spend
   2–3 days genuinely commenting/upvoting before posting any links (~50+ karma).
2. **9:1 rule.** ~9 non-self-promo posts/comments for every 1 link to your own thing.
3. **1–3 link posts/day, spaced out.** Blasting many at once = spam filter.
4. **Match each sub's title rules.** Some require the article's real title and ban
   editorializing. Use the SOURCE link for strict news subs; `/s/` link elsewhere.
5. **Never** use alt accounts to upvote your posts (vote manipulation = sitewide ban).

### Subreddit map (also encoded in reddit-picker.mjs)
| Section | Primary subs |
|---|---|
| Global Wins | r/UpliftingNews, r/GoodNews |
| Fair Play & Triumphs | r/UpliftingNews, r/sports |
| Future Proof | r/UpliftingNews, r/Futurology, r/technology, r/science* |
| Kind Humans | r/HumansBeingBros, r/MadeMeSmile, r/UpliftingNews |
| Earth Restored | r/UpliftingNews, r/conservation, r/environment, r/marineconservation |

\* r/science is strict (peer-reviewed, specific title rules) — read rules first.

### Warm-up comment starters (make them specific to the post)
1. "This is the kind of thing I wish made the front page more often."
2. "Genuinely made me smile on a rough morning — the detail about [X] got me."
3. "We underrate how much stories like this matter for someone's day. Saving it."
4. "Sending this to my mum, she'll love it."
5. "Comeback stories like this give me real hope. From near-gone to thriving."

---

## X / Twitter (@brightearlynews)

- **Cadence:** one post each morning (the daily tool drafts it). Consistency wins.
- **Engagement:** reply to doom-y trending topics with a hopeful counter-story;
  quote-tweet your own `/s/` story pages (rich previews via OG tags).
- **Hashtags:** #GoodNews #Positivity (sparingly). Tag nothing spammy.
- **Pinned post:** use the launch post below.

---

## Launch copy

### Show HN (news.ycombinator.com — submit "Show HN")
**Title:**
> Show HN: Bright & Early – a morning paper of only yesterday's good news

**URL:** https://brightandearly.news

**First comment (post immediately after submitting):**
> Hi HN — Bright & Early is a daily "newspaper" that shows only genuinely
> positive news from the day before. The idea: a two-minute morning read that
> makes you smile, then you close it and get on with your day — no doomscroll,
> no ads, no engagement traps.
>
> How it works: each morning a build job runs a handful of topical web searches
> (via Claude) for heart-warming stories published the previous day, verifies
> each against the article's own publish date, dedupes against recent editions,
> and lays them out as a flip-through paper across five sections. It's a static,
> zero-dependency PWA on GitHub Pages — no backend, no tracking cookies
> (privacy-friendly analytics only).
>
> I built it because my news habit was quietly making me miserable, and the
> "good news" sites I found were either thin or saccharine. I tried to hold the
> bar at: "would this actually make a tired person smile over their coffee?"
>
> It's free and ad-free. I'd love feedback on the curation quality and the
> reading experience — and pointers to genuinely uplifting stories I'm missing.

### Product Hunt
- **Name:** Bright & Early
- **Tagline (≤60 chars):** Yesterday's good news, bright and early
- **Description:**
  > A daily morning paper of only genuinely positive news. Read it in two
  > minutes, smile, and get on with your day — no ads, no doomscroll, no tracking.
- **Topics:** News, Productivity, Web App, Mental Health
- **Maker's first comment:**
  > Hey Product Hunt 👋 I made Bright & Early because doomscrolling was wrecking my
  > mornings. It's a little paper of only the previous day's good news — comebacks,
  > kindness, conservation wins, breakthroughs — laid out like a flip-through
  > newspaper. Free, ad-free, installable. Would love your feedback, and your
  > favourite good-news story this week!

### X / pinned launch post
> ☀️ I made Bright & Early — a morning paper of only *yesterday's good news*.
>
> A two-minute read. Real stories: comebacks, kindness, breakthroughs.
> No ads. No doomscroll.
>
> Read it, smile, get on with your day → brightandearly.news

### r/SideProject / r/InternetIsBeautiful (after some karma)
**Title:**
> I built a morning newspaper that only shows yesterday's *good* news

Lead the body with the personal "why," then the link. r/InternetIsBeautiful is
strict — read rules; it must be genuinely novel/beautiful (the flip-through
newspaper UI qualifies).

---

## Suggested launch order
1. **Warm up Reddit** (2–3 days) + post daily picks to topical subs.
2. **X**: daily posts from day one; pin the launch post.
3. **Show HN**: pick a weekday morning (US time); reply fast to every comment.
4. **Product Hunt**: schedule for a 12:01am PT launch; rally early upvotes.
5. **r/SideProject / r/InternetIsBeautiful**: once the account has standing.
