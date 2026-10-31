import { getDb } from "./db";

export type FeedPost = {
  id: number; subreddit: string; title: string; body: string; url: string;
  score: number; created_utc: number; category: string; sentiment: string;
  urgency: number; reason: string; status: string;
};

export function listFeed(f: {
  companyId: number; category?: string; minUrgency?: number;
  status: "new" | "handled"; limit?: number;
}): FeedPost[] {
  // Only kept posts, and only new/handled. Dismissed posts are never selectable.
  const where = ["company_id = ?", "relevant = 1", "status = ?"];
  const params: (string | number)[] = [f.companyId, f.status];
  if (f.category) { where.push("category = ?"); params.push(f.category); }
  if (f.minUrgency) { where.push("urgency >= ?"); params.push(f.minUrgency); }
  params.push(f.limit ?? 200);
  return getDb()
    .prepare(`SELECT id, subreddit, title, substr(body, 1, 400) AS body, url, score,
                     created_utc, category, sentiment, urgency, reason, status
              FROM posts WHERE ${where.join(" AND ")}
              ORDER BY urgency DESC, created_utc DESC LIMIT ?`)
    .all(...params) as unknown as FeedPost[];
}

// A dismissed post can never change status again.
export function setStatus(id: number, status: "new" | "handled" | "dismissed"): number {
  const r = getDb()
    .prepare("UPDATE posts SET status = ? WHERE id = ? AND status != 'dismissed'")
    .run(status, id);
  return Number(r.changes);
}
