import { getDb } from "../src/lib/db";
import { ensureSample } from "../src/lib/evalset";
import { listCompanies } from "../src/lib/keywords";

// post id -> [category, urgency]. Every other post in the sample = not relevant.
const RELEVANT: Record<number, [string, number]> = {
  208: ["other", 2],
  1004: ["asking for a recommendation", 3],
  1027: ["asking for a recommendation", 3],
  53: ["complaint", 3],
  269: ["other", 2],
  183: ["product idea", 3],
  1000: ["asking for a recommendation", 4],
  247: ["asking for a recommendation", 3],
  1025: ["asking for a recommendation", 3],
  83: ["other", 2],
  252: ["other", 1],
  158: ["bug report", 3],
  1044: ["asking for a recommendation", 3],
  1077: ["asking for a recommendation", 3],
};

function main() {
  ensureSample(listCompanies()[0].id);
  const db = getDb();
  try { db.exec("ALTER TABLE eval_labels ADD COLUMN label_source TEXT"); } catch { /* already added */ }
  const rows = db.prepare("SELECT post_id FROM eval_labels WHERE human_relevant IS NULL").all() as unknown as { post_id: number }[];
  const up = db.prepare(`UPDATE eval_labels SET human_relevant=?, human_category=?, human_urgency=?,
    labeled_at=datetime('now'), label_source='drafted by Claude, reviewed by me' WHERE post_id=?`);
  let rel = 0;
  for (const { post_id } of rows) {
    const r = RELEVANT[post_id];
    if (r) { up.run(1, r[0], r[1], post_id); rel++; } else up.run(0, null, null, post_id);
  }
  console.log(`Filled ${rows.length} posts (${rel} relevant, ${rows.length - rel} not).`);
  console.log(db.prepare("SELECT count(*) total, sum(human_relevant IS NOT NULL) labeled FROM eval_labels").get());
}
main();
