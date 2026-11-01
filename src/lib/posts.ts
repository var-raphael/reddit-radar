import { getDb } from "./db";

export type FeedPost = {
  id: number; subreddit: string; title: string; body: string; url: string;
  score: number; created_utc: number; category: string; sentiment: string;
  urgency: number; reason: string; status: string;
};

export type FeedFilter = {
  companyId: number; category?: string; minUrgency?: number;
  status: "new" | "handled"; sort?: "urgent" | "new"; limit?: number;
};

function where(f: FeedFilter) {
  // Only kept posts, and only new/handled. Dismissed posts are never selectable.
  const w = ["company_id = ?", "relevant = 1", "status = ?"];
  const p: (string | number)[] = [f.companyId, f.status];
  if (f.category) { w.push("category = ?"); p.push(f.category); }
  if (f.minUrgency) { w.push("urgency >= ?"); p.push(f.minUrgency); }
  return { sql: w.join(" AND "), params: p };
}

export function listFeed(f: FeedFilter): FeedPost[] {
  const { sql, params } = where(f);
  const order = f.sort === "new" ? "created_utc DESC" : "urgency DESC, created_utc DESC";
  return getDb()
    .prepare(`SELECT id, subreddit, title, substr(body, 1, 400) AS body, url, score,
                     created_utc, category, sentiment, urgency, reason, status
              FROM posts WHERE ${sql} ORDER BY ${order} LIMIT ?`)
    .all(...params, f.limit ?? 100) as unknown as FeedPost[];
}

export function countFeed(f: FeedFilter): number {
  const { sql, params } = where(f);
  return (getDb().prepare(`SELECT count(*) AS c FROM posts WHERE ${sql}`).get(...params) as { c: number }).c;
}

// A dismissed post can never change status again.
export function setStatus(id: number, status: "new" | "handled" | "dismissed"): number {
  const r = getDb()
    .prepare("UPDATE posts SET status = ? WHERE id = ? AND status != 'dismissed'")
    .run(status, id);
  return Number(r.changes);
}
