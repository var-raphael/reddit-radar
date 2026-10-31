import fs from "node:fs";
import { getDb } from "../src/lib/db";

const db = getDb();
const companies = (db.prepare("SELECT id, name FROM companies ORDER BY id").all() as any[]).map((c) => ({
  name: c.name,
  keywords: db.prepare("SELECT term, kind FROM keywords WHERE company_id = ? ORDER BY id").all(c.id),
  subreddits: (db.prepare("SELECT name FROM subreddits WHERE company_id = ? ORDER BY id").all(c.id) as any[]).map((r) => r.name),
  // classified posts only; user actions (handled/dismissed) are deliberately not exported
  posts: db.prepare(`SELECT reddit_id, subreddit, title, substr(body, 1, 1500) AS body, author, url, score,
      created_utc, matched_term, relevant, category, sentiment, urgency, reason, classified_at
      FROM posts WHERE company_id = ? AND relevant IS NOT NULL ORDER BY created_utc DESC`).all(c.id),
}));
fs.mkdirSync("seed", { recursive: true });
fs.writeFileSync("seed/seed.json", JSON.stringify({ exportedAt: new Date().toISOString(), companies }));
for (const c of companies) console.log(`${c.name}: ${c.keywords.length} keywords, ${c.subreddits.length} subreddits, ${c.posts.length} posts`);
console.log("Wrote seed/seed.json");
