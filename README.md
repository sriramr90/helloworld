# Bright & Early

**Yesterday's good news, bright and early.**

Bright & Early is a daily *morning-newspaper* PWA. The world is full of exhausting,
negative news — Bright & Early is the opposite: a short, finished edition of genuinely
**positive** stories from around the world that you read with your coffee and
then close, feeling a little better about things.

It's built as a thin, end-to-end vertical slice:

```
GitHub Actions (daily cron)
  → fetch yesterday's stories from 4 open sources
  → local prefilter (drop negatives, dedupe, rank)
  → Claude curation (keep only genuinely uplifting; write warm summaries)
  → write public/data/latest.json
  → deploy to GitHub Pages
PWA  → loads the latest edition, installable, readable offline
```

No backend server, no API keys in the browser, free hosting.

## Sources (hybrid, degrade gracefully)

| Source | Needs a key? | Notes |
| --- | --- | --- |
| **GDELT** | No | Open global news index |
| **Positive-news RSS** | No | Good News Network, Positive News, Reasons to be Cheerful |
| **The Guardian** | `GUARDIAN_API_KEY` | Pulls "The Upside", the Guardian's positive series |
| **GNews** | `GNEWS_API_KEY` | Broad aggregation, positive-weighted query |

Any source without its key is **skipped** — so the build runs out of the box on
just GDELT + RSS, and gets richer as you add keys.

## Curation

The "is this genuinely uplifting?" judgment is a **hybrid**: a cheap local
prefilter removes obvious negatives and dedupes, then an **LLM** (via
[OpenRouter](https://openrouter.ai)) reads the survivors and selects the best,
writing a warm one-line summary and a clean headline for each, filed into
sections. OpenRouter is OpenAI-compatible and can route to any model — Claude,
GPT, Llama, etc. — set `OPENROUTER_MODEL` to your pick (default
`openai/gpt-4o-mini`).

- **With `OPENROUTER_API_KEY`** → LLM curates (recommended).
- **Without it** → falls back to the local sentiment ranking, so `npm run build`
  still produces an edition with zero configuration.

## Run it locally

```bash
npm install
cp .env.example .env   # fill in any keys you have (all optional)
npm run build          # fetch + curate → public/data/latest.json
npm run serve          # preview at http://localhost:8080
```

## Deploy (GitHub Pages)

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions** — add the keys you have
   (all optional): secrets `OPENROUTER_API_KEY`, `GUARDIAN_API_KEY`,
   `GNEWS_API_KEY`, and optionally a repository *variable* `OPENROUTER_MODEL`
   to choose the model.
3. The [`Daily edition`](.github/workflows/daily-edition.yml) workflow then runs
   every morning (and on each push), rebuilds the edition, and publishes it.
   Trigger it by hand any time from the **Actions** tab.

## Layout

```
public/                 the PWA (static site served by Pages)
  index.html  styles.css  app.js
  manifest.webmanifest  service-worker.js  icons/
  data/latest.json      the current edition (generated; a seed is committed)
scripts/
  build-edition.mjs     the daily pipeline orchestrator
  sources/              one small adapter per news source
  lib/                  prefilter, Claude curation, shared utils
  serve.mjs             tiny local static server
.github/workflows/      daily build + Pages deploy
```

## Roadmap (next slices)

- Per-edition archive browsing (past mornings)
- Story images and richer section layouts
- Share / "send a friend a good morning" links
- Push a "your morning edition is ready" notification
