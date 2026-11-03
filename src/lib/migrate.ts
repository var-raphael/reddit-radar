import type { DatabaseSync } from "node:sqlite";

// Adds columns introduced after the first version. Safe to run on every start.
export function migrate(db: DatabaseSync) {
  for (const col of [
    "classify_attempts INTEGER NOT NULL DEFAULT 0",
    "classify_error TEXT",
    "next_attempt_at INTEGER",
  ]) {
    try { db.exec(`ALTER TABLE posts ADD COLUMN ${col}`); } catch { /* column already exists */ }
  }
}
