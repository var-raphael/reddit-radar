import type { NormalizedPost, PostSource } from "./types";
import { log } from "../log";

const BASE = "https://arctic-shift.photon-reddit.com/api/posts/search";
const UA = process.env.REDDIT_USER_AGENT ?? "reddit-radar/0.1 (take-home demo)";
const MAX_PAGES = 15; // 15 x 100 = at most 1,500 posts per subreddit per run
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  async fetchSubreddit(subreddit, sinceUtc) {
    const out: NormalizedPost[] = [];
    let before: number | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({ subreddit, sort: "desc", limit: "100" });
      if (before) params.set("before", String(before));
      const json = await getJson(`${BASE}?${params}`);
      const rows: any[] = json?.data ?? [];
      log("debug", "source", "page fetched", { subreddit, page: page + 1, rows: rows.length });
      if (rows.length === 0) break;
      let oldest = Infinity;
      for (const d of rows) {
        oldest = Math.min(oldest, Number(d.created_utc));
        if (Number(d.created_utc) < sinceUtc) continue;
        const p = normalizeArcticPost(d);
        if (p) out.push(p);
      }
      if (oldest <= sinceUtc) break; // reached the start of our window
      before = oldest;               // duplicates at the boundary are harmless (dedup)
      await sleep(1000);
    }
    return out;
  },
};
