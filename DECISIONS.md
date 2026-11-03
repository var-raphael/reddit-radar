# Decisions

## 1. Getting the data, and its limits

**What I use:** [Arctic Shift](https://arctic-shift.photon-reddit.com), a public archive of Reddit with a keyless API.

**Why not Reddit directly:** on 31 Oct 2026 I tested Reddit's `search.json`, `search.rss` and a subreddit `.rss` feed from my own connection, and all three returned 403. Reports I found say Reddit shut off unauthenticated JSON access in May 2026 and stopped accepting new API signups, so the usual routes (public JSON, new OAuth app) were closed to me. I did not try scraping.

**How it works:** for each subreddit I list, the collector fetches recent posts (30-day window on first run), then matches the keywords itself, whole-word and case-insensitive. Arctic Shift's own keyword search timed out when I tried it, so listing and matching locally was the reliable route. Each subreddit keeps a bookmark of the last post processed, and the scan runs oldest-first from there, so a backlog larger than one run (1,500 posts) drains over the next runs and nothing is skipped.

**Limits:**
- It only sees the subreddits I list. It cannot search all of Reddit, so conversations in subreddits I did not think of are missed.
- It is a volunteer-run archive with no uptime promise. It can be slow or briefly down; the collector retries with backoff and a failing subreddit does not stop the others.
- Posts only, not comments. The post body is cut to 3,000 characters. Removed or deleted posts have no text.
- Keyword matching is exact whole words, so misspellings and unlisted nicknames are missed.
- English only, by assumption; I did not test other languages.

**In production** I would use the official Reddit API with approved access, or a licensed data provider, and check the terms of use. The source sits behind one small interface (`src/lib/sources/`) so it can be swapped.

## 2. Filter and classifier design

**Model:** `ministral-14b-latest` through a provider-agnostic client (`src/lib/llm/`): any OpenAI-compatible endpoint, or Anthropic, is an `.env` change. I used this model because my Mistral account returned 429 on `mistral-small` and `mistral-medium`. I also tried `mistral-large-4`: it used about 1,900 output tokens per post against about 60 for the 14B model, and none of its replies parsed, so I dropped it.

**Relevance rule** (the filter): keep a post if it is about the company's product, or about choosing between tools (comparing with alternatives, switching, complaining in a way that suggests leaving, asking which tool to use). Drop people simply using or customizing a competitor's product, unrelated uses of the word, and spam. When unsure, drop. The prompt states this without named examples, so it is not tied to the demo company.

**Labels:** category (complaint, bug report, product idea, praise, asking for a recommendation, other), sentiment, urgency 1-5, and a one-line reason. I chose a 1-5 scale with one sentence per level in the prompt, because a model cannot reliably separate a 6 from a 7.

**Robustness:** every reply goes through a strict parser (valid JSON, allowed values only). A rejected reply is shown back to the model with the reason and asked to correct itself once; if it still fails, the post stays unclassified and is retried next run. In the full run, 13 of 1,133 posts (1.1%) failed validation at first, all because the model said "relevant" but left sentiment empty, and the repair step fixed all 13. Post text is treated as untrusted in the prompt.

## 3. How I know the filter and classifier are any good

**What I checked against:** 58 random posts from the collected data, taken as up to 9 per subreddit so small subreddits are represented. The answer key was **drafted by Claude (an AI assistant) and reviewed by me**. While reviewing I found and corrected one label that was wrong because the draft was made from a truncated post. The model under test (ministral-14b) is a different model from the one that drafted the key. I froze the prompt and model before running the evaluation and did not tune on these posts.

**Filter results** (n = 58, 15 relevant by my key):

| | Model kept | Model dropped |
|---|---|---|
| Relevant | 14 | 1 |
| Not relevant | 8 | 35 |

Accuracy 84.5%, precision 63.6%, recall 93.3%. On the 14 posts both of us kept: category agreement 78.6% (11 of 14), urgency exactly right 78.6%, within one point 100%, mean absolute error 0.21.

**Where it still gets it wrong:**
- **It keeps noise (8 false keeps).** Three are people advertising their own Notion templates: the model treats "Notion-related" as "about Notion", while my rule says to drop promotion without discussion. Two mention the product once in passing. Three carry a reason that claims a Notion connection I could not find in the post: a Google NotebookLM post called "a Notion-related tool", an Airtable complaint described as a comparison to Notion, and one post where I only checked the first 2,000 characters.
- **It missed one relevant post:** a job-interview post about the company, which is arguably not about the product anyway.
- **Category disagreements (3)** are all genuinely fuzzy (a how-to question labeled a bug report, a product idea labeled a recommendation request), and the same fuzziness exists in my labels.
- **Across the whole seed,** 349 of 1,133 posts were kept (31%). If precision holds near 64%, roughly a third of the feed is noise.

## 4. What 1,000 posts cost

From the evaluation run: about 730 input and 62 output tokens per post, so **0.73M input and 0.062M output tokens per 1,000 posts**. Mistral lists ministral-14b at $0.20 per million tokens for both input and output (checked October 2026; confirm on Mistral's pricing page).

- Input: 0.73 x $0.20 = $0.146
- Output: 0.062 x $0.20 = $0.012
- **About $0.16 per 1,000 posts**, plus roughly 1% for repair retries.

Collection is free (a keyless archive), and I ran on free hosting tiers. At my rate limit (one request per 1.5 s) 1,000 posts take about 25 minutes. A larger or reasoning model would cost more: the large model I tried produced about 30 times as many output tokens per post, and I did not price it. I estimate roughly two thirds of the input tokens are the same instructions repeated on every post, so prompt caching or batching several posts per request would cut cost, at some risk to accuracy that I would measure first.

## 5. What I would build next

1. **Fix the known errors:** state that a passing mention is not enough, treat template promotion as drop, and require the reason to quote the post. Then re-run the same labeled set and report it as a second run, with the caveat that I had already seen those errors.
2. **Compare models on the same labels:** a stronger model (Claude or Gemini, one `.env` change each) against the 14B model, with accuracy and cost side by side. I did not run this because I had no free API access to try them.
3. **A bigger, independent labeled set** (a few hundred posts, labeled by more than one person) so the numbers carry real confidence.
4. **A proper data source:** official Reddit API access or a licensed provider, with comment coverage and a live search.
5. **Production basics:** Postgres instead of SQLite (the free hosting tier I looked at wipes local disk on restart, so the app reloads a seed file when the database is empty), a real job scheduler with retries, authentication and per-user workspaces, and alerts.
6. **A feedback loop:** use handled/dismissed actions as labels to measure and improve the filter over time.
7. **Multi-language support:** detect each post's language and classify non-English posts properly, with keyword matching and the prompt adapted per language.

## 6. Assumptions

- Demo company is Notion. One user, no login. Posts only, English only.
- The brief's "category" values are the six listed there; urgency runs 1-5 as defined above.
- "Choosing between tools" posts about competitors count as relevant (a buying-signal view); plain usage posts about competitors do not.
- Dismissed posts are never shown again and cannot be reopened, enforced on the server.