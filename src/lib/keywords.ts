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
