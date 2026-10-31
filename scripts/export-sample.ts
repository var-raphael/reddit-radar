import fs from "node:fs";
import { getDb } from "../src/lib/db";
import { ensureSample } from "../src/lib/evalset";
import { listCompanies } from "../src/lib/keywords";

function main() {
  const c = listCompanies()[0];
  ensureSample(c.id);
  const rows = getDb()
    .prepare(`SELECT p.id, p.subreddit, p.title, substr(p.body, 1, 2000) AS body
              FROM eval_labels e JOIN posts p ON p.id = e.post_id ORDER BY e.seq`)
    .all();
  fs.mkdirSync("eval", { recursive: true });
  fs.writeFileSync("eval/to-label.json", JSON.stringify({ company: c.name, posts: rows }, null, 1));
  console.log(`Wrote eval/to-label.json with ${rows.length} posts`);
}
main();
