import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let dbm: any, kw: any, col: any, posts: any, cls: any, matcher: any;
let companyId = 0;

const post = (id: string, title = "Notion is slow", body = "") => ({
  reddit_id: id, subreddit: "Notion", title, body, author: "u", url: "https://x/" + id,
  score: 1, created_utc: 1700000000,
});

before(async () => {
  process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "radar-")), "t.db");
  dbm = await import("../src/lib/db");
  kw = await import("../src/lib/keywords");
  col = await import("../src/lib/collector");
  posts = await import("../src/lib/posts");
  cls = await import("../src/lib/classifier");
  matcher = await import("../src/lib/matcher");
  companyId = kw.ensureCompany("Acme");
  kw.addKeyword(companyId, "Acme", "brand");
});

// ---------- LLM output parser ----------
const good = '{"relevant":true,"category":"complaint","sentiment":"negative","urgency":4,"reason":"Unhappy user"}';

test("parser accepts a valid kept post", () => {
  const r = cls.parseClassification(good);
  assert.equal(r.relevant, true);
  assert.equal(r.category, "complaint");
  assert.equal(r.urgency, 4);
});
test("parser accepts a valid dropped post", () => {
  const r = cls.parseClassification('{"relevant":false,"category":null,"sentiment":null,"urgency":null,"reason":"Unrelated"}');
  assert.equal(r.relevant, false);
});
test("parser strips code fences and surrounding prose", () => {
  assert.equal(cls.parseClassification("```json\n" + good + "\n```").relevant, true);
  assert.equal(cls.parseClassification("Sure! Here you go: " + good + " Hope that helps").relevant, true);
});
test("parser normalizes case", () => {
  const r = cls.parseClassification(good.replace("complaint", "Complaint").replace("negative", "NEGATIVE"));
  assert.equal(r.category, "complaint");
  assert.equal(r.sentiment, "negative");
});
test("parser rejects bad output", () => {
  const bad = [
    "not json at all",
    "",
    "{broken",
    good.replace("complaint", "rant"),
    good.replace('"urgency":4', '"urgency":9'),
    good.replace('"urgency":4', '"urgency":2.5'),
    good.replace("negative", "angry"),
    good.replace('"reason":"Unhappy user"', '"reason":""'),
    '{"relevant":"yes","reason":"x"}',
    '{"category":"complaint","reason":"x"}',
  ];
  for (const b of bad) assert.throws(() => cls.parseClassification(b), undefined, `should reject: ${b}`);
});

// ---------- keyword matcher ----------
const K = (term: string, kind = "brand") => ({ id: 1, term, kind });

test("matcher is whole-word and case-insensitive", () => {
  assert.ok(matcher.matchPost({ title: "I love NOTION", body: "" }, [K("Notion")]));
  assert.equal(matcher.matchPost({ title: "Notional value of a bond", body: "" }, [K("Notion")]), null);
  assert.equal(matcher.matchPost({ title: "Promotional offer", body: "" }, [K("Notion")]), null);
});
test("matcher handles multi-word terms, dots and the body", () => {
  assert.ok(matcher.matchPost({ title: "x", body: "see notion.so for details" }, [K("notion.so", "alias")]));
  assert.ok(matcher.matchPost({ title: "Try  Notion   AI today", body: "" }, [K("Notion AI", "alias")]));
  assert.equal(matcher.matchPost({ title: "notionxso", body: "" }, [K("notion.so", "alias")]), null);
});

// ---------- dedup and dismiss ----------
test("inserting the same posts twice adds nothing the second time", () => {
  const batch = [post("a1"), post("a2"), post("a3")];
  assert.equal(col.insertPosts(companyId, "Acme", batch), 3);
  assert.equal(col.insertPosts(companyId, "Acme", batch), 0);
  const n = dbm.getDb().prepare("SELECT count(*) c FROM posts WHERE company_id = ?").get(companyId).c;
  assert.equal(n, 3);
});

test("a dismissed post stays dismissed and never reappears", () => {
  col.insertPosts(companyId, "Acme", [post("d1"), post("d2")]);
  const db = dbm.getDb();
  db.prepare("UPDATE posts SET relevant = 1, category = 'other', sentiment = 'neutral', urgency = 2, reason = 'r' WHERE reddit_id IN ('d1','d2')").run();
  const id = (rid: string) => db.prepare("SELECT id FROM posts WHERE reddit_id = ?").get(rid).id;

  assert.equal(posts.setStatus(id("d1"), "dismissed"), 1);
  // re-collecting the same post must not resurrect it or touch its status
  assert.equal(col.insertPosts(companyId, "Acme", [post("d1")]), 0);
  assert.equal(db.prepare("SELECT status FROM posts WHERE reddit_id = 'd1'").get().status, "dismissed");
  // a dismissed post cannot be reopened or marked handled
  assert.equal(posts.setStatus(id("d1"), "new"), 0);
  assert.equal(posts.setStatus(id("d1"), "handled"), 0);
  // the feed never shows it, in either tab
  for (const status of ["new", "handled"] as const) {
    const titles = posts.listFeed({ companyId, status }).map((p: any) => p.id);
    assert.ok(!titles.includes(id("d1")));
  }
  // the other post is still visible
  assert.ok(posts.listFeed({ companyId, status: "new" }).some((p: any) => p.id === id("d2")));
});

test("re-collecting does not reset a classification", () => {
  col.insertPosts(companyId, "Acme", [post("c1")]);
  const db = dbm.getDb();
  db.prepare("UPDATE posts SET relevant = 1, category = 'praise', sentiment = 'positive', urgency = 1, reason = 'r' WHERE reddit_id = 'c1'").run();
  col.insertPosts(companyId, "Acme", [post("c1")]);
  assert.equal(db.prepare("SELECT category FROM posts WHERE reddit_id = 'c1'").get().category, "praise");
});

// ---------- classifier with a fake model ----------
const fake = (replies: string[]) => {
  let i = 0;
  return { name: "fake", complete: async () => ({ content: replies[Math.min(i++, replies.length - 1)], usage: { prompt_tokens: 10, completion_tokens: 5 } }) };
};

test("classifier saves valid answers and counts tokens", async () => {
  col.insertPosts(companyId, "Acme", [post("k1")]);
  const db = dbm.getDb();
  db.prepare("UPDATE posts SET relevant = 1 WHERE relevant IS NULL AND reddit_id != 'k1'").run(); // isolate k1
  const s = await cls.classifyPending({ provider: fake([good]), concurrency: 1 });
  assert.equal(s.kept, 1);
  assert.equal(s.failed, 0);
  assert.equal(s.promptTokens, 10);
  assert.equal(db.prepare("SELECT urgency FROM posts WHERE reddit_id = 'k1'").get().urgency, 4);
});

test("classifier leaves a post unclassified when the model keeps returning junk", async () => {
  col.insertPosts(companyId, "Acme", [post("j1")]);
  const db = dbm.getDb();
  db.prepare("UPDATE posts SET relevant = 1 WHERE relevant IS NULL AND reddit_id != 'j1'").run();
  const s = await cls.classifyPending({ provider: fake(["totally not json"]), concurrency: 1 });
  assert.equal(s.failed, 1);
  assert.equal(db.prepare("SELECT relevant FROM posts WHERE reddit_id = 'j1'").get().relevant, null);
});

test("classifier recovers when the first reply is junk but the retry is valid", async () => {
  col.insertPosts(companyId, "Acme", [post("r1")]);
  const db = dbm.getDb();
  db.prepare("UPDATE posts SET relevant = 1 WHERE relevant IS NULL AND reddit_id != 'r1'").run();
  const s = await cls.classifyPending({ provider: fake(["oops", good]), concurrency: 1 });
  assert.equal(s.kept, 1);
  assert.equal(s.failed, 0);
});

test("classifier asks the model to repair a rejected reply", async () => {
  col.insertPosts(companyId, "Acme", [post("p1")]);
  const db = dbm.getDb();
  db.prepare("UPDATE posts SET relevant = 1 WHERE relevant IS NULL AND reddit_id != 'p1'").run();
  const seen: any[] = [];
  const spy = {
    name: "spy",
    complete: async (m: any) => {
      seen.push(m);
      return { content: seen.length === 1 ? good.replace('"negative"', "null") : good, usage: {} };
    },
  };
  const s = await cls.classifyPending({ provider: spy, concurrency: 1 });
  assert.equal(s.kept, 1);
  assert.match(JSON.stringify(seen[1]), /rejected/);
});
