# Reddit Radar

A small social-listening tool. Give it a company (name, aliases, competitors, topics) and a list of subreddits. It collects matching Reddit posts, uses an LLM to drop the off-topic ones, labels the rest (category, sentiment, urgency 1-5, one-line reason), and shows them in a feed you can filter and work through.

Demo company: **Notion**. Design decisions, evaluation results, cost and known limits are in [DECISIONS.md](DECISIONS.md).

## What it does

1. **Keywords**: add companies, brand names, aliases, competitors, topic phrases and subreddits (the Keywords page).
2. **Collect**: a re-runnable job fetches recent posts, matches your keywords as whole words, and stores each post once (keyed by Reddit post ID, so running it twice never duplicates).
3. **Filter and classify**: an LLM decides whether each match is really relevant, then labels kept posts with category, sentiment, urgency and a reason. Every reply is validated; bad replies are sent back once for repair, and otherwise the post stays unclassified and is retried on the next run.
4. **Feed**: kept posts, most urgent first, filterable by category and urgency. Mark posts handled or dismiss them. A dismissed post never comes back, even if collected again.

## Quick start

Requires Node 22.13 or newer (SQLite is built in, nothing to compile; developed on Node 26).

    git clone https://github.com/var-raphael/reddit-radar
    cd reddit-radar
    npm install
    cp .env.example .env
    npm run dev

Open http://localhost:3000.

The database is created on first start and **pre-loaded from `seed/seed.json`**: about 1,100 real Notion-related posts, already classified. So the feed is populated immediately and you can explore without any keys. To run new collection and classification, add an LLM key (below).

## Configuration (`.env`)

| Variable | What it is |
|---|---|
| `LLM_API_KEY` | Key for your LLM provider. Needed only for classifying new posts. |
| `LLM_PROVIDER` | `openai-compatible` (default) or `anthropic`. |
| `LLM_MODEL` | Model name, e.g. `ministral-14b-latest`. |
| `LLM_BASE_URL` | For `openai-compatible`. Default is Mistral (`https://api.mistral.ai/v1`). Works with any OpenAI-style endpoint: OpenAI, Groq, Gemini's compatibility endpoint, Ollama, and so on. |
| `LLM_JSON_MODE` | `on` (default) or `off` if your provider rejects `response_format`. |
| `LLM_MIN_INTERVAL_MS`, `LLM_CONCURRENCY` | Request spacing and parallelism, to stay under provider rate limits. |
| `COLLECT_CONCURRENCY` | Subreddits fetched in parallel (default 3). |
| `MAX_CLASSIFY_PER_RUN` | Cap on posts classified per run, to bound cost (default 200). |
| `CRON_SECRET` | Secret for `POST /api/collect`. The endpoint is disabled until it is set. |
| `RUN_COOLDOWN_SEC` | Minimum gap between button-triggered runs (default 120). |
| `DB_PATH` | SQLite file location (default `./data/radar.db`). |

**Getting keys.** Reddit needs no key (see "Data source" below). For the LLM, create a key with any provider. The default is Mistral: create an account at console.mistral.ai, create an API key, and put it in `LLM_API_KEY`. To use Anthropic instead, set `LLM_PROVIDER=anthropic`, `LLM_MODEL=<a Claude model>` and your key. Note that some provider accounts only allow certain models; if you get a 429 on the very first request, try another model name.

## Running a collection

From the UI: press **Run now** on the Feed page. It collects, then classifies, and shows counts and timings when done. Runs never overlap, and the button has a cooldown.

From the command line:

    npm run collect            # fetch and store new posts (incremental)
    npm run collect -- --full  # ignore bookmarks and rescan the last 30 days
    npm run classify           # classify unclassified posts
    npm run classify -- --limit=50

On a schedule: set `CRON_SECRET` in `.env`, then have any scheduler call:

    curl -X POST https://<your-host>/api/collect -H "x-cron-secret: <CRON_SECRET>"

It answers immediately (`202 started`, or `409` if a run is already going) and does the work in the background. `GET /api/health` is a plain liveness check for keep-alive pings. Collection is incremental: each subreddit keeps a bookmark of the newest post seen, so repeat runs only fetch what is new.

## Data source

Reddit shut off unauthenticated `.json` access in 2026 and closed self-service API signup, so this project reads from [Arctic Shift](https://arctic-shift.photon-reddit.com), a public Reddit archive with a keyless API. The collector lists recent posts per subreddit and matches your keywords itself. The consequences:

- It only sees the subreddits you list; it cannot search all of Reddit.
- The archive is run by volunteers and can be slow or briefly unavailable. The collector retries with backoff and reports a failing subreddit without stopping the others.
- The source sits behind a small interface (`src/lib/sources/`), so an official-API or paid-provider source can be swapped in.

## Tests

    npm test

14 tests, no network, no keys, throwaway database. They cover LLM output parsing (including malformed replies), keyword matching, deduplication, the dismiss rule, and the classifier's handling of bad model output using a fake model.

## Evaluation

The filter and classifier were checked against a hand-reviewed answer key of 58 random posts. The saved report is in `eval/`, and the analysis is in DECISIONS.md. To re-run on a labeled sample: `npm run eval` (labels are made on the `/label` page and live in the local database).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app. |
| `npm run collect` / `classify` | Run the pipeline steps from the terminal. |
| `npm run seed:notion` | Add the demo Notion keywords and subreddits to an empty database. |
| `npm run seed:export` | Write the current database to `seed/seed.json`. |
| `npm run eval` | Run the evaluation and write a report to `eval/`. |
| `npm test` | Run the tests. |

## Project layout

    src/lib/db.ts          SQLite schema and connection (also loads the seed)
    src/lib/collector.ts   fetch, match, store, bookmarks
    src/lib/sources/       post sources (Arctic Shift)
    src/lib/matcher.ts     whole-word keyword matching
    src/lib/classifier.ts  prompt, strict parser, repair, batch classification
    src/lib/llm/           provider-agnostic LLM client (OpenAI-compatible, Anthropic)
    src/lib/runner.ts      collect-then-classify job with an overlap guard
    src/app/               the feed, keywords and label pages, and API routes
    scripts/               command-line entry points
    tests/                 automated tests
    eval/  seed/           evaluation reports and seed data
