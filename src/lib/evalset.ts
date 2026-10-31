import { getDb } from "./db";

export const CATEGORIES = [
  "complaint", "bug report", "product idea", "praise",
  "asking for a recommendation", "other",
];
const CAP_PER_SUBREDDIT = 9;

function init() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS eval_labels (
    post_id INTEGER PRIMARY KEY REFERENCES posts(id),
    seq INTEGER NOT NULL,
    human_relevant INTEGER,
    human_category TEXT,
    human_urgency INTEGER,
    labeled_at TEXT,
    model_relevant INTEGER,
    model_category TEXT,
    model_sentiment TEXT,
    model_urgency INTEGER,
    model_reason TEXT,
    model_name TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER
  )`);
}

// Freezes a stratified random sample the first time it is called.
export function ensureSample(companyId: number) {
  init();
  const db = getDb();
  const n = (db.prepare("SELECT count(*) AS c FROM eval_labels").get() as { c: number }).c;
  if (n > 0) return;
  const subs = db
    .prepare("SELECT DISTINCT subreddit FROM posts WHERE company_id = ?")
    .all(companyId) as unknown as { subreddit: string }[];
  const ids: number[] = [];
  for (const { subreddit } of subs) {
    const rows = db
      .prepare("SELECT id FROM posts WHERE company_id = ? AND subreddit = ? ORDER BY RANDOM() LIMIT ?")
      .all(companyId, subreddit, CAP_PER_SUBREDDIT) as unknown as { id: number }[];
    ids.push(...rows.map((r) => r.id));
  }
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const ins = db.prepare("INSERT INTO eval_labels (post_id, seq) VALUES (?, ?)");
  db.exec("BEGIN");
  ids.forEach((id, i) => ins.run(id, i));
  db.exec("COMMIT");
}

export function nextToLabel() {
  return (getDb()
    .prepare(`SELECT p.id, p.subreddit, p.title, p.body, p.url, p.created_utc
              FROM eval_labels e JOIN posts p ON p.id = e.post_id
              WHERE e.human_relevant IS NULL ORDER BY e.seq LIMIT 1`)
    .get() as any) ?? null;
}

export function progress() {
  const r = getDb()
    .prepare("SELECT count(*) AS total, sum(human_relevant IS NOT NULL) AS done FROM eval_labels")
    .get() as { total: number; done: number | null };
  return { total: r.total, done: r.done ?? 0 };
}

export function saveLabel(postId: number, relevant: unknown, category: unknown, urgency: unknown): string | null {
  if (typeof relevant !== "boolean") return "relevant must be true or false";
  let cat: string | null = null;
  let urg: number | null = null;
  if (relevant) {
    if (typeof category !== "string" || !CATEGORIES.includes(category)) return "Pick a category";
    if (!Number.isInteger(urgency) || (urgency as number) < 1 || (urgency as number) > 5) return "Pick an urgency 1-5";
    cat = category;
    urg = urgency as number;
  }
  const r = getDb()
    .prepare(`UPDATE eval_labels SET human_relevant = ?, human_category = ?, human_urgency = ?,
              labeled_at = datetime('now') WHERE post_id = ?`)
    .run(relevant ? 1 : 0, cat, urg, postId);
  return Number(r.changes) ? null : "Post is not in the sample";
}

export function undoLast() {
  getDb().exec(`UPDATE eval_labels SET human_relevant = NULL, human_category = NULL,
    human_urgency = NULL, labeled_at = NULL
    WHERE post_id = (SELECT post_id FROM eval_labels WHERE human_relevant IS NOT NULL ORDER BY seq DESC LIMIT 1)`);
}
