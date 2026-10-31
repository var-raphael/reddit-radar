import { collectAll } from "../src/lib/collector";

const t0 = Date.now();
collectAll({ full: process.argv.includes("--full") })
  .then(({ rows, errors }) => {
    console.table(rows);
    const total = rows.reduce((n, r) => n + r.added, 0);
    console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s. ${total} new posts added.`);
    if (errors.length) {
      console.error("Errors:\n" + errors.join("\n"));
      process.exit(1);
    }
  })
  .catch((e) => {
    console.error("Collection failed:", e.message);
    process.exit(1);
  });
