import type { FetchResult, NormalizedPost, PostSource } from "./types";
import { log } from "../log";

const BASE = "https://arctic-shift.photon-reddit.com/api/posts/search";
const UA = process.env.REDDIT_USER_AGENT ?? "reddit-radar/0.1 (take-home demo)";
const PAGE_SIZE = 100;
const MAX_PAGES = 15; // per subreddit per run; a bigger backlog continues on the next run
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const delay = () => Number(process.env.SOURCE_PAGE_DELAY_MS ?? 1000);

async function getJson(url: string, attempt = 0): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON body */ }
  const err = json?.error ?? (!res.ok ? `HTTP ${res.status}` : null);
  if (err) {
    const retryable = /timeout|slow down|429|HTTP 5\d\d/i.test(String(err));
    if (retryable && attempt < 4) {
      const wait = 2000 * 2 ** attempt;
      log("warn", "source", "archive error, retrying", { error: String(err), attempt: attempt + 1, wait_ms: wait });
      await sleep(wait);
      return getJson(url, attempt + 1);
    }
    log("error", "source", "archive request failed", { error: String(err), status: res.status });
    throw new Error(`Arctic Shift error: ${err}`);
  }
  return json;
}

export function normalizeArcticPost(d: any): NormalizedPost | null {
  if (!d?.id || !d.title) return null;
  const raw = String(d.selftext ?? "");
  const gone = raw === "[removed]" || raw === "[deleted]";
  return {
    reddit_id: String(d.id),
    subreddit: String(d.subreddit ?? ""),
    title: String(d.title),
    body: gone ? "" : raw.slice(0, 3000),
    author: String(d.author ?? ""),
    url: `https://www.reddit.com/comments/${d.id}/`,
    score: Number(d.score ?? 0),
    created_utc: Number(d.created_utc ?? 0),
  };
}

export const arcticShift: PostSource = {
  name: "arctic-shift",
  async fetchSubreddit(subreddit, sinceUtc): Promise<FetchResult> {
    const seen = new Set<string>();
    const posts: NormalizedPost[] = [];
    let after = sinceUtc;
    let lastUtc: number | null = null;
    let reachedEnd = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ subreddit, sort: "asc", limit: String(PAGE_SIZE), after: String(after) });
      const json = await getJson(`${BASE}?${params}`);
      const rows: any[] = json?.data ?? [];
      log("debug", "source", "page fetched", { subreddit, page: page + 1, rows: rows.length });
      if (rows.length === 0) { reachedEnd = true; break; }

      const times = rows.map((r) => Number(r.created_utc));
      if (times[0] > times[times.length - 1]) {
        throw new Error("Archive did not return posts oldest-first; refusing to move the bookmark");
      }
      const newest = Math.max(...times);
      if (lastUtc !== null && newest <= lastUtc) { reachedEnd = true; break; } // nothing new past the overlap

      for (const d of rows) {
        const p = normalizeArcticPost(d);
        if (p && !seen.has(p.reddit_id)) { seen.add(p.reddit_id); posts.push(p); }
      }
      lastUtc = newest;
      // re-read the last second so posts sharing a timestamp are never skipped
      after = newest - 1 > after ? newest - 1 : newest;
      await sleep(delay());
    }
    return { posts, reachedEnd, lastUtc };
  },
};
