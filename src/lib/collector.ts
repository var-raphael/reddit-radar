import { getDb } from "./db";
import { listCompanies, listKeywords } from "./keywords";
import { listSubreddits } from "./subreddits";
import { matchPost } from "./matcher";
import { arcticShift } from "./sources/arcticShift";
import type { NormalizedPost, PostSource } from "./sources/types";

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

export async function collectAll(opts: { source?: PostSource; sinceDays?: number } = {}) {
  const source = opts.source ?? arcticShift;
  const sinceUtc = Math.floor(Date.now() / 1000) - (opts.sinceDays ?? 30) * 86400;
  const summary: { company: string; subreddit: string; fetched: number; matched: number; added: number }[] = [];

  for (const c of listCompanies()) {
    const keywords = listKeywords(c.id);
    for (const sub of listSubreddits(c.id)) {
      const posts = await source.fetchSubreddit(sub, sinceUtc);
      let matched = 0;
      let added = 0;
      for (const p of posts) {
        const hit = matchPost(p, keywords);
        if (!hit) continue;
        matched++;
        added += insertPosts(c.id, hit.term, [p]);
      }
      summary.push({ company: c.name, subreddit: sub, fetched: posts.length, matched, added });
    }
  }
  return summary;
}
