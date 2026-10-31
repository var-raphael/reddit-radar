import { getDb } from "./db";

export type Kind = "brand" | "alias" | "competitor" | "topic";
export type Keyword = { id: number; term: string; kind: Kind };

export function ensureCompany(name: string): number {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO companies (name) VALUES (?)").run(name);
  const row = db
    .prepare("SELECT id FROM companies WHERE name = ?")
    .get(name) as { id: number };
  return row.id;
}

export function addKeyword(companyId: number, term: string, kind: Kind) {
  getDb()
    .prepare("INSERT OR IGNORE INTO keywords (company_id, term, kind) VALUES (?, ?, ?)")
    .run(companyId, term.trim(), kind);
}

export function listKeywords(companyId: number): Keyword[] {
  return getDb()
    .prepare("SELECT id, term, kind FROM keywords WHERE company_id = ? ORDER BY id")
    .all(companyId) as unknown as Keyword[];
}

export function listCompanies(): { id: number; name: string }[] {
  return getDb()
    .prepare("SELECT id, name FROM companies ORDER BY name")
    .all() as unknown as { id: number; name: string }[];
}

export function removeKeyword(companyId: number, keywordId: number) {
  getDb().prepare("DELETE FROM keywords WHERE id = ? AND company_id = ?").run(keywordId, companyId);
}

// New keywords may match posts we already skipped, so force a full rescan next run.
export function resetBookmarks(companyId: number) {
  getDb().prepare("DELETE FROM sync_state WHERE company_id = ?").run(companyId);
}

export function countPosts(companyId: number): number {
  return (getDb().prepare("SELECT count(*) AS c FROM posts WHERE company_id = ?").get(companyId) as { c: number }).c;
}

// Removes a company and everything that belongs to it, atomically.
export function deleteCompany(companyId: number) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    try {
      db.prepare("DELETE FROM eval_labels WHERE post_id IN (SELECT id FROM posts WHERE company_id = ?)").run(companyId);
    } catch { /* that table only exists once an evaluation sample was made */ }
    for (const t of ["posts", "keywords", "subreddits", "sync_state"]) {
      db.prepare(`DELETE FROM ${t} WHERE company_id = ?`).run(companyId);
    }
    db.prepare("DELETE FROM companies WHERE id = ?").run(companyId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
