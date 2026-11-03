import type { getDb } from "./db";

type Db = ReturnType<typeof getDb>;

export const MAX_ATTEMPTS = Number(process.env.CLASSIFY_MAX_ATTEMPTS ?? 3);
const BACKOFF_HOURS = [1, 6, 24];

// Permanent: the model answered but the answer was unusable, or the request itself was rejected.
// Everything else (rate limits, outages, a bad key, network trouble) is transient and never counted.
export function isPermanentFailure(message: string): boolean {
  return /^(No JSON|Invalid JSON|Output is not|Missing reason|'relevant' must|Bad (category|sentiment|urgency))|LLM API 4(00|22)/.test(message);
}

export function recordFailure(db: Db, id: number, message: string): "transient" | "retry" | "dead" {
  const now = Math.floor(Date.now() / 1000);
  const err = message.slice(0, 300);
  if (!isPermanentFailure(message)) {
    db.prepare("UPDATE posts SET classify_error = ?, next_attempt_at = ? WHERE id = ?").run(err, now + 900, id);
    return "transient";
  }
  const row = db.prepare("SELECT classify_attempts AS a FROM posts WHERE id = ?").get(id) as { a: number };
  const attempts = row.a + 1;
  const waitH = BACKOFF_HOURS[Math.min(attempts - 1, BACKOFF_HOURS.length - 1)];
  db.prepare("UPDATE posts SET classify_attempts = ?, classify_error = ?, next_attempt_at = ? WHERE id = ?")
    .run(attempts, err, now + waitH * 3600, id);
  return attempts >= MAX_ATTEMPTS ? "dead" : "retry";
}
