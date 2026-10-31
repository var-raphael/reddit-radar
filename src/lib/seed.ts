import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";

// If the database has no companies yet and a seed file exists, load it.
// Keeps the demo populated after a fresh clone or an ephemeral-disk restart.
export function seedIfEmpty(db: DatabaseSync) {
  const file = process.env.SEED_FILE ?? "./seed/seed.json";
  if (!fs.existsSync(file)) return;
  const n = (db.prepare("SELECT count(*) AS c FROM companies").get() as { c: number }).c;
  if (n > 0) return;

  const seed = JSON.parse(fs.readFileSync(file, "utf8"));
  const addCompany = db.prepare("INSERT INTO companies (name) VALUES (?)");
  const addKw = db.prepare("INSERT OR IGNORE INTO keywords (company_id, term, kind) VALUES (?, ?, ?)");
  const addSub = db.prepare("INSERT OR IGNORE INTO subreddits (company_id, name) VALUES (?, ?)");
  const addPost = db.prepare(`INSERT OR IGNORE INTO posts
    (company_id, reddit_id, subreddit, title, body, author, url, score, created_utc, matched_term,
     relevant, category, sentiment, urgency, reason, classified_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`);

  db.exec("BEGIN");
  try {
    for (const c of seed.companies ?? []) {
      const id = Number(addCompany.run(c.name).lastInsertRowid);
      for (const k of c.keywords ?? []) addKw.run(id, k.term, k.kind);
      for (const s of c.subreddits ?? []) addSub.run(id, s);
      for (const p of c.posts ?? []) {
        addPost.run(id, p.reddit_id, p.subreddit, p.title, p.body, p.author, p.url, p.score, p.created_utc,
          p.matched_term, p.relevant, p.category, p.sentiment, p.urgency, p.reason, p.classified_at);
      }
    }
    db.exec("COMMIT");
    console.log(`Seeded database from ${file}`);
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
