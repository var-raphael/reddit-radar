import { classifyPending } from "../src/lib/classifier";
import { getDb } from "../src/lib/db";

const arg = process.argv.find((a) => a.startsWith("--limit="));
const limit = arg ? Number(arg.split("=")[1]) : undefined;

if (process.argv.includes("--retry-failed")) {
  const n = getDb()
    .prepare("UPDATE posts SET classify_attempts = 0, next_attempt_at = NULL WHERE relevant IS NULL")
    .run().changes;
  console.log(`Reset ${n} unclassified posts for another try`);
}

classifyPending({ limit })
  .then((s) => { console.log("Classification done:", s); })
  .catch((e) => { console.error("Classification failed:", e.message); process.exit(1); });
