import { getDb } from "./db";

export function addSubreddit(companyId: number, name: string) {
  const clean = name.trim().replace(/^\/?r\//i, "");
  if (!clean) return;
  getDb()
    .prepare("INSERT OR IGNORE INTO subreddits (company_id, name) VALUES (?, ?)")
    .run(companyId, clean);
}

export function listSubreddits(companyId: number): string[] {
  const rows = getDb()
    .prepare("SELECT name FROM subreddits WHERE company_id = ? ORDER BY id")
    .all(companyId) as unknown as { name: string }[];
  return rows.map((r) => r.name);
}

export function removeSubreddit(companyId: number, name: string) {
  getDb().prepare("DELETE FROM subreddits WHERE company_id = ? AND name = ?").run(companyId, name);
}
