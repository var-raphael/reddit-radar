import { collectAll } from "../src/lib/collector";

collectAll()
  .then((rows) => {
    console.table(rows);
    const total = rows.reduce((n, r) => n + r.added, 0);
    console.log(`Done. ${total} new posts added.`);
  })
  .catch((e) => {
    console.error("Collection failed:", e.message);
    process.exit(1);
  });
