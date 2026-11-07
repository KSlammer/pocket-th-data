---
name: pocket-th-data
description: Map of the Pocket TH data repo (KSlammer/pocket-th-data) — card build + Thai translation pipeline, news, tournament meta, real-card prices, Limitless fallback, GitHub workflows, output formats and recipes. Use before changing scripts, translations, workflows or data formats here. The website (KSlammer/TCG-Pocket-TH) has its own skills: pocket-th (owner rules, past mistakes) and pocket-th-code.
---

# pocket-th-data: pipeline map and recipes

Public (AGPL) repo that builds everything the Pocket TH site shows except the site itself. Pushing to `main` is a release. The website pins a commit of this repo (`config.dataRef`) and syncs every 6 h, or right away with `npm run sync-data -- <sha>` in the web repo. Prices are not pinned: they live on the force-pushed `prices` branch, which the site reads live.

**Owner's rules that matter here:**
- Pokémon, card and attack names stay in English.
- Never scrape a site whose terms forbid it (SASOM is link-only).
- A set is published only with its images.
- Never commit secrets.
- Keep the work free: OpenRouter free models, and no paid APIs unless the owner adds a key.

## Scripts (`scripts/`)

| Script | Does | Inputs → outputs |
|---|---|---|
| `build.mjs` | Builds the site's card data. Card text is matched as a **template**: numbers → `{n}`, `[ X ]` → `[X]`, then numbers are put back in order. `--check` (in `npm test`) fails on untranslated text or a `{n}` mismatch. | npm `pokemon-tcg-pocket-cards` v5 + `extra/*.json` + `i18n/th.json` + `i18n/auto.json` + `upcoming.json` → `data/cards.json`, `data/og.json`, `i18n/missing.json` |
| `translate.mjs` | Machine-translates whatever is in `missing.json` in batches with glossary examples. Every key it writes is added to `auto.json` (the site shows an "AI" badge). | `scripts/llm.mjs` |
| `llm.mjs` | One JSON-returning chat call. `OPENROUTER_API_KEY` uses free models picked at run time (pin with var `OPENROUTER_MODEL="a,b"`; about 50 req/day). `ANTHROPIC_API_KEY` uses Claude (paid). Neither → returns null and callers skip. | |
| `review.mjs` | Report only: AI entries awaiting review, plus glossary / energy-mark / `{n}` / English-name checks over all text | `npm run review` |
| `news.mjs` | Headlines from Google News RSS (EN + TH) and r/PTCGP. Resolves Google redirect links, takes the article's `og:image`, translates titles to Thai, keeps 80 items / 30 days. | → `data/news.json` |
| `meta.mjs` | Limitless TCG API (game POCKET). Covers 14 days, events with ≥32 players, current format only. Per-event summaries are cached in `meta-cache.json`. One request every 6.5 s, at most 20 new events per run. | → `data/meta.json` |
| `prices.mjs` | All EN/JP sets from tcgcsv (TCGplayer cat 3/85), Cardmarket sealed (EUR), FX from frankfurter, Thai set names from TCGdex, the TCG Thailand market (3 passes plus yesterday's fallback), and eBay graded data when keys are set | → `out/prices/**` → `prices` branch |
| `graded.mjs` | eBay Browse API asking prices for PSA/BGS/CGC/TAG/SGC, parsed from listing titles. Needs `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`; skipped without them (**never run live yet**). | called by prices.mjs |
| `limitless.mjs` | For a released `upcoming.json` set the npm package lacks: card text from pocket.limitlesstcg.com → `extra/<set>.json`. Text only, no images, `deckBuilderNr: null`. **Translated ahead of time but never published.** Deleted once the package has the set. | |

## Translations (`i18n/`)

- `th.json`: `{ names: {English name: Thai}, text: {English template: Thai template} }`. 1-space JSON with a trailing newline. Templates keep `{n}` count/order and `[X]` energy marks. Names quoted inside text stay English. The glossary is in the README (อภิธานศัพท์).
- `auto.json`: keys written by the machine and not yet reviewed. **Reviewing = fix in th.json, then remove the key here.**
- `missing.json`: written by build, read by translate.

House style already used across reviewed text:
- "เพิ่มขึ้น +{n}" for +damage;
- "ดูการ์ดที่สุ่ม…" for looking at a random card;
- "ดู" (look), not "เปิด" (reveal);
- avoid status words (สับสน, นอนหลับ…) as attack names.

## Workflows (`.github/workflows/`)

| Workflow | When | Steps |
|---|---|---|
| `update.yml` | Every 6 h (:17), on push to `scripts/**`, or by dispatch | `npm ci` → latest card package → limitless fallback → build → translate if anything is missing → build → news → meta → commit. If `npm test` passes, push `main`; else force-push branch `auto-update` and fail (usually a partial free-model translation; the next run retries). |
| `prices.yml` | Daily 20:37 UTC, on push to the price scripts | Tests → `prices.mjs` (eBay env) → `out/` force-pushed as a single commit to branch `prices` |
| `check.yml` | Every push / PR | `npm test` and a rebuild must leave `data/` unchanged (commit th.json and data/ together) |

## Output formats

- `data/cards.json`: the card shape is documented in the web repo's pocket-th-code skill.
- `data/meta.json`: `{source, sourceUrl, updated, format, from, to, tournaments, players, decks[{name, players, share, cards[[name,freq≥0.5]], sample}], matchups[[a,b,w,l,t]]}`. Sample lists only include cards with a deck id (`nr`).
- `data/news.json`: `{items[{title, th?, link, url?, date, source, kind, img?}]}`.
- `prices` branch, under `prices/`:
  - `index.json`: `{updated, fx{THB,EUR,JPY}, sets{en,jp}[{id,name,code,date,cards,sealed}], th[], market{th,jp,en}[{file,name,date,items}], graded?{en,jp}}`;
  - `en|jp/<groupId>.json`: `{name, cards[[id,name,number,rarity,[[sub,market,low]]]], sealed[[id,name,prices,cm?]]}`;
  - `sealed/<lang>.json` and `sealed/market-<lang>.json`;
  - `market/<lang>/<n>.json`: items `[id,name,en,number,rarity,THB,stock,sealed,img]`;
  - `graded/<lang>.json`.

## Recipes

- **Run locally:** `npm ci --ignore-scripts && npm run build && npm test`. Most external hosts are blocked in the cloud sandbox. Try a script against live sources from GitHub Actions on the `probe` branch (add `permissions: contents: write` and commit raw output to inspect it).
- **Fix a translation:**
  1. Edit `i18n/th.json` and drop the key from `auto.json`.
  2. Run `npm run build && npm test`.
  3. Commit th.json + auto.json + data/ together and push main.
  4. Sync the web repo.
- **Announce an upcoming set:** add `{code, name, date (UTC ISO), highlight, source}` to `upcoming.json`. It drops off by itself when the package ships the set.
- **New data field for the site:** add it to the `cards.map` in build.mjs (compact drops null/false/''). Rebuild, commit, then sync the web repo.
- **New price source:**
  1. Check its terms and robots.txt first.
  2. Catch errors per request, so one failure never drops another source's data.
  3. Add a pure parsing function with a test in `test/prices.test.mjs`.
  4. Push; the price workflow runs on push.
- **New script that commits:** add it to `update.yml` with `|| echo "…; keeping previous"` so one failing source can't block the card update.

## Tests (`npm test`)

| Test | Covers |
|---|---|
| `build --check` | Untranslated text, `{n}` mismatch |
| `translate` | Fake-client run: valid answers kept, a dropped `{n}` retried then reported; glossary examples |
| `news` | RSS/Atom parsing, official detection, merge/dedupe, og:image |
| `meta` | Event summary, cross-event combine |
| `prices` | Card vs sealed split, name norm, set codes, release dates, Nuxt payload, Thai sealed detection |
| `limitless` | Card page parser |
| `graded` | Grade parsing, card matching, summary |
