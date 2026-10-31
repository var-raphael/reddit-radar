import { getDb } from "./db";
import { listCompanies, listKeywords } from "./keywords";
import { listSubreddits } from "./subreddits";
import { matchPost } from "./matcher";
import { arcticShift } from "./sources/arcticShift";
import type { NormalizedPost, PostSource } from "./sources/types";
import { log } from "./log";

const OVERLAP_SEC = 3600; // re-check the last hour in case the archive indexed late

// Returns how many rows were NEW. Existing rows are never touched, so
// dismissed/handled status and classifications survive re-runs.
export function insertPosts(
  companyId: number,
  matchedTerm: string,
  posts: NormalizedPost[]
): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO posts
      (company_id, reddit_id, subreddit, title, body, author, url, score, created_utc, matched_term)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (company_id, reddit_id) DO NOTHING
  `);
  let inserted = 0;
  db.exec("BEGIN");
  try {
    for (const p of posts) {
      const r = stmt.run(
        companyId, p.reddit_id, p.subreddit, p.title, p.body,
        p.author, p.url, p.score, p.created_utc, matchedTerm
      );
      inserted += Number(r.changes);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return inserted;
}

function getBookmark(companyId: number, sub: string): number | null {
  const row = getDb()
    .prepare("SELECT newest_utc FROM sync_state WHERE company_id = ? AND subreddit = ?")
    .get(companyId, sub) as { newest_utc: number } | undefined;
  return row ? row.newest_utc : null;
}

function setBookmark(companyId: number, sub: string, utc: number) {
  getDb()
    .prepare(`INSERT INTO sync_state (company_id, subreddit, newest_utc) VALUES (?, ?, ?)
              ON CONFLICT (company_id, subreddit) DO UPDATE SET newest_utc = excluded.newest_utc`)
    .run(companyId, sub, utc);
}

export type CollectRow = {
  company: string; subreddit: string; fetched: number; matched: number; added: number; ms: number;
};

export async function collectAll(
  opts: { source?: PostSource; sinceDays?: number; concurrency?: number; full?: boolean } = {}
): Promise<{ rows: CollectRow[]; errors: string[] }> {
  const source = opts.source ?? arcticShift;
  const windowStart = Math.floor(Date.now() / 1000) - (opts.sinceDays ?? 30) * 86400;
  const concurrency = opts.concurrency ?? Number(process.env.COLLECT_CONCURRENCY ?? 3);

  const jobs: { c: { id: number; name: string }; kws: ReturnType<typeof listKeywords>; sub: string }[] = [];
  for (const c of listCompanies()) {
    const kws = listKeywords(c.id);
    for (const sub of listSubreddits(c.id)) jobs.push({ c, kws, sub });
  }

  const t0 = Date.now();
  log("info", "collect", "starting", { source: source.name, subreddits: jobs.length, concurrency, full: !!opts.full });

  const rows: CollectRow[] = [];
  const errors: string[] = [];
  let next = 0;

  async function worker() {
    while (next < jobs.length) {
      const { c, kws, sub } = jobs[next++];
      const t = Date.now();
      try {
        const mark = opts.full ? null : getBookmark(c.id, sub);
        const since = mark ? Math.max(windowStart, mark - OVERLAP_SEC) : windowStart;
        const posts = await source.fetchSubreddit(sub, since);
        let matched = 0;
        let added = 0;
        for (const p of posts) {
          const hit = matchPost(p, kws);
          if (!hit) continue;
          matched++;
          added += insertPosts(c.id, hit.term, [p]);
        }
        if (posts.length) {
          const newest = Math.max(...posts.map((p) => p.created_utc));
          setBookmark(c.id, sub, Math.max(newest, mark ?? 0));
        }
        const ms = Date.now() - t;
        rows.push({ company: c.name, subreddit: sub, fetched: posts.length, matched, added, ms });
        log("info", "collect", "subreddit done", { company: c.name, subreddit: sub, fetched: posts.length, matched, added, ms });
      } catch (e: any) {
        errors.push(`r/${sub}: ${e.message}`);
        log("error", "collect", "subreddit failed", { company: c.name, subreddit: sub, error: e.message });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  log(errors.length ? "warn" : "info", "collect", "finished", {
    ms: Date.now() - t0,
    added: rows.reduce((n, r) => n + r.added, 0),
    failed_subreddits: errors.length,
  });
  return { rows, errors };
}
