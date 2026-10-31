import type { DatabaseSync as DB } from "node:sqlite";
import { seedIfEmpty } from "./seed";
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DB_PATH ?? "./data/radar.db";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS keywords (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  term TEXT NOT NULL COLLATE NOCASE,
  kind TEXT NOT NULL CHECK (kind IN ('brand','alias','competitor','topic')),
  UNIQUE (company_id, term)
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  reddit_id TEXT NOT NULL,
  subreddit TEXT,
  title TEXT NOT NULL,
  body TEXT,
  author TEXT,
  url TEXT,
  score INTEGER,
  created_utc INTEGER,
  matched_term TEXT,
  collected_at TEXT NOT NULL DEFAULT (datetime('now')),
  relevant INTEGER,            -- NULL = unclassified, 0 = dropped, 1 = kept
  category TEXT CHECK (category IN
    ('complaint','bug report','product idea','praise','asking for a recommendation','other')),
  sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  urgency INTEGER CHECK (urgency BETWEEN 1 AND 5),
  reason TEXT,
  classified_at TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','handled','dismissed')),
  UNIQUE (company_id, reddit_id)
);
CREATE TABLE IF NOT EXISTS subreddits (id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), name TEXT NOT NULL COLLATE NOCASE, UNIQUE (company_id, name));
CREATE TABLE IF NOT EXISTS sync_state (company_id INTEGER NOT NULL REFERENCES companies(id), subreddit TEXT NOT NULL COLLATE NOCASE, newest_utc INTEGER NOT NULL, PRIMARY KEY (company_id, subreddit));
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts (company_id, relevant, status);
`;

let db: DB | null = null;

export function getDb(): DB {
  if (db) return db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  seedIfEmpty(db);
  return db;
}
