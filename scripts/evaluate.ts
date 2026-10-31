import fs from "node:fs";
import { getDb } from "../src/lib/db";
import { getProvider } from "../src/lib/llm";
import { buildMessages, parseClassification } from "../src/lib/classifier";
import { listKeywords } from "../src/lib/keywords";

type Row = {
  post_id: number; company_id: number; subreddit: string; title: string; body: string;
  human_relevant: number; human_category: string | null; human_urgency: number | null;
  model_relevant: number | null; model_category: string | null; model_urgency: number | null;
  model_reason: string | null; prompt_tokens: number | null; completion_tokens: number | null;
};

const SELECT = `SELECT e.post_id, p.company_id, p.subreddit, p.title, p.body,
  e.human_relevant, e.human_category, e.human_urgency,
  e.model_relevant, e.model_category, e.model_urgency, e.model_reason,
  e.prompt_tokens, e.completion_tokens
  FROM eval_labels e JOIN posts p ON p.id = e.post_id`;

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "n/a");
const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + "…" : s).replace(/\s+/g, " ");

async function main() {
  const db = getDb();
  if (process.argv.includes("--rerun")) {
    db.exec(`UPDATE eval_labels SET model_relevant=NULL, model_category=NULL, model_sentiment=NULL,
             model_urgency=NULL, model_reason=NULL, model_name=NULL, prompt_tokens=NULL, completion_tokens=NULL`);
  }
  const c = db.prepare("SELECT count(*) AS total, sum(human_relevant IS NOT NULL) AS done FROM eval_labels").get() as any;
  if (!c.total || c.done < c.total) {
    console.error(`Label every post first (${c.done ?? 0}/${c.total}). Open /label in the app.`);
    process.exit(1);
  }

  const provider = getProvider();
  const todo = db.prepare(`${SELECT} WHERE e.model_relevant IS NULL`).all() as unknown as Row[];
  console.log(`Running ${todo.length} posts through ${provider.name}...`);
  const ctxCache = new Map<number, any>();
  const upd = db.prepare(`UPDATE eval_labels SET model_relevant=?, model_category=?, model_sentiment=?,
    model_urgency=?, model_reason=?, model_name=?, prompt_tokens=?, completion_tokens=? WHERE post_id=?`);

  for (const r of todo) {
    if (!ctxCache.has(r.company_id)) {
      const name = (db.prepare("SELECT name FROM companies WHERE id=?").get(r.company_id) as any).name;
      const k = listKeywords(r.company_id);
      ctxCache.set(r.company_id, {
        company: name,
        brandTerms: k.filter((x) => x.kind === "brand" || x.kind === "alias").map((x) => x.term),
        competitors: k.filter((x) => x.kind === "competitor").map((x) => x.term),
        topics: k.filter((x) => x.kind === "topic").map((x) => x.term),
      });
    }
    const messages = buildMessages({ ...ctxCache.get(r.company_id), post: r });
    let pt = 0, ct = 0, done = false;
    for (let attempt = 0; attempt < 2 && !done; attempt++) {
      try {
        const { content, usage } = await provider.complete(messages);
        pt += usage?.prompt_tokens ?? 0; ct += usage?.completion_tokens ?? 0;
        const p = parseClassification(content);
        if (p.relevant) upd.run(1, p.category, p.sentiment, p.urgency, p.reason, provider.name, pt, ct, r.post_id);
        else upd.run(0, null, null, null, p.reason, provider.name, pt, ct, r.post_id);
        done = true;
      } catch (e: any) {
        if (attempt === 1) console.error(`post ${r.post_id} failed: ${e.message}`);
      }
    }
  }

  const rows = db.prepare(`${SELECT}`).all() as unknown as Row[];
  const scored = rows.filter((r) => r.model_relevant !== null);
  const failed = rows.length - scored.length;

  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of scored) {
    const h = r.human_relevant === 1, m = r.model_relevant === 1;
    if (h && m) tp++; else if (!h && m) fp++; else if (h && !m) fn++; else tn++;
  }
  const both = scored.filter((r) => r.human_relevant === 1 && r.model_relevant === 1);
  const catOk = both.filter((r) => r.human_category === r.model_category).length;
  const urgDiffs = both.map((r) => Math.abs((r.human_urgency ?? 0) - (r.model_urgency ?? 0)));
  const urgExact = urgDiffs.filter((d) => d === 0).length;
  const urgWithin1 = urgDiffs.filter((d) => d <= 1).length;
  const mae = urgDiffs.length ? (urgDiffs.reduce((a, b) => a + b, 0) / urgDiffs.length).toFixed(2) : "n/a";
  const tokIn = rows.reduce((n, r) => n + (r.prompt_tokens ?? 0), 0);
  const tokOut = rows.reduce((n, r) => n + (r.completion_tokens ?? 0), 0);
  const nTok = rows.filter((r) => r.prompt_tokens !== null).length || 1;

  const out: string[] = [];
  out.push(`# Evaluation report`);
  out.push(`Model: ${provider.name} | Date: ${new Date().toISOString().slice(0, 10)} | Posts: ${rows.length} (${failed} failed to parse)`);
  out.push(`Sample: random, capped per subreddit, answer key drafted by Claude and reviewed by me. Not a population estimate.\n`);
  out.push(`## Filter (relevant vs not)`);
  out.push(`| | Model kept | Model dropped |\n|---|---|---|\n| Human kept | ${tp} | ${fn} |\n| Human dropped | ${fp} | ${tn} |\n`);
  out.push(`Accuracy ${pct(tp + tn, scored.length)} | Precision ${pct(tp, tp + fp)} (kept posts that are truly relevant) | Recall ${pct(tp, tp + fn)} (relevant posts the model kept)\n`);
  out.push(`## Labels on posts both kept (n=${both.length})`);
  out.push(`Category agreement ${pct(catOk, both.length)} | Urgency exact ${pct(urgExact, both.length)}, within 1: ${pct(urgWithin1, both.length)}, mean abs error ${mae}\n`);
  out.push(`## Tokens (all ${nTok} posts)`);
  out.push(`Input ${tokIn}, output ${tokOut} | Per post: ${(tokIn / nTok).toFixed(0)} in, ${(tokOut / nTok).toFixed(0)} out | Per 1,000 posts: ${((tokIn / nTok) * 1000 / 1e6).toFixed(3)}M in, ${((tokOut / nTok) * 1000 / 1e6).toFixed(3)}M out\n`);

  out.push(`## Where the filter disagreed with me`);
  for (const r of scored.filter((r) => (r.human_relevant === 1) !== (r.model_relevant === 1))) {
    out.push(`- [${r.human_relevant === 1 ? "I kept, model dropped" : "I dropped, model kept"}] r/${r.subreddit}: ${short(r.title)}\n  model said: ${short(r.model_reason ?? "", 160)}`);
  }
  out.push(`\n## Where the category disagreed`);
  for (const r of both.filter((r) => r.human_category !== r.model_category)) {
    out.push(`- r/${r.subreddit}: ${short(r.title)} (me: ${r.human_category}, model: ${r.model_category})`);
  }

  const text = out.join("\n");
  console.log("\n" + text);
  const file = `eval/report-${provider.name.replace(/[^a-z0-9.-]+/gi, "_")}.md`;
  fs.mkdirSync("eval", { recursive: true });
  fs.writeFileSync(file, text + "\n");
  console.log(`\nSaved ${file}`);
}
main().catch((e) => { console.error("Evaluation failed:", e.message); process.exit(1); });
