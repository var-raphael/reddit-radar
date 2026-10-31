import { classifyPending } from "../src/lib/classifier";

const arg = process.argv.find((a) => a.startsWith("--limit="));
const limit = arg ? Number(arg.split("=")[1]) : undefined;

classifyPending({ limit })
  .then((s) => { console.log("Classification done:", s); })
  .catch((e) => { console.error("Classification failed:", e.message); process.exit(1); });
