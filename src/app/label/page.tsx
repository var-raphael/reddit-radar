"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, Undo2, X } from "lucide-react";

const CATEGORIES = ["complaint", "bug report", "product idea", "praise", "asking for a recommendation", "other"];
type Post = { id: number; subreddit: string; title: string; body: string; url: string; created_utc: number };

export default function Label() {
  const [post, setPost] = useState<Post | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [relevant, setRelevant] = useState<boolean | null>(null);
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/eval", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok) { setError(j.error ?? "Failed to load"); setLoading(false); return; }
    setPost(j.post); setDone(j.done); setTotal(j.total);
    setRelevant(null); setCategory(""); setUrgency(0); setError(""); setLoading(false);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(rel: boolean) {
    if (!post) return;
    const r = await fetch("/api/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "label", postId: post.id, relevant: rel, category: rel ? category : null, urgency: rel ? urgency : null }),
    });
    if (!r.ok) { setError((await r.json()).error ?? "Failed to save"); return; }
    load();
  }

  async function undo() {
    await fetch("/api/eval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "undo" }) });
    load();
  }

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-sm ${on ? "bg-zinc-900 text-white" : "bg-white ring-1 ring-zinc-300"}`;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Label posts</h1>
          <p className="text-sm text-zinc-500">{done} of {total} done. The AI's answers are hidden.</p>
        </div>
        <button onClick={undo} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-zinc-500 ring-1 ring-zinc-300">
          <Undo2 className="h-4 w-4" />Undo last
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full bg-emerald-500" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
      </div>

      <details className="mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-zinc-200">
        <summary className="cursor-pointer font-medium">Labeling rules (same as the AI's)</summary>
        <p className="mt-2"><b>Relevant</b> only if the post is (a) about Notion's product or company, or (b) about choosing between tools: comparing Notion with alternatives, switching to or from a tool, complaining about a tool in a way that suggests leaving it, or asking which tool to use.</p>
        <p className="mt-2"><b>Not relevant</b> if the author is just using, customizing, showing off, or asking how-to questions about a competitor's product without mentioning Notion or weighing alternatives; the word used in an unrelated sense; spam. If unsure whether it bears on Notion or on a choice between tools, pick not relevant.</p>
        <p className="mt-2"><b>Urgency:</b> 1 nothing to act on · 2 mild, good to know · 3 real issue or question, no rush · 4 clearly unhappy user or strong buying/switching signal · 5 act now (outage, data loss, about to leave).</p>
      </details>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="mt-6 text-sm text-zinc-500">Loading…</p>}

      {!loading && !post && !error && total > 0 && (
        <div className="mt-8 rounded-2xl bg-emerald-50 p-5 text-emerald-800">
          <p className="font-semibold">All {total} posts labeled.</p>
          <p className="mt-1 text-sm">Now run <code>npm run eval</code> in the terminal.</p>
        </div>
      )}

      {post && (
        <article className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <p className="text-xs text-zinc-500">r/{post.subreddit}</p>
          <a href={post.url} target="_blank" rel="noreferrer" className="mt-1 block text-lg font-semibold leading-snug hover:underline">{post.title}</a>
          {post.body && <p className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap text-sm text-zinc-700">{post.body}</p>}

          <div className="mt-5 flex gap-2">
            <button onClick={() => setRelevant(true)} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 font-medium ${relevant === true ? "bg-emerald-600 text-white" : "bg-white ring-1 ring-zinc-300"}`}>
              <Check className="h-4 w-4" />Relevant
            </button>
            <button onClick={() => submit(false)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 font-medium ring-1 ring-zinc-300">
              <X className="h-4 w-4" />Not relevant
            </button>
          </div>

          {relevant && (
            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Category</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>{c}</button>)}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Urgency</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setUrgency(n)} className={`${chip(urgency === n)} w-11`}>{n}</button>)}
                </div>
              </div>
              <button
                onClick={() => submit(true)}
                disabled={!category || !urgency}
                className="w-full rounded-xl bg-zinc-900 py-2.5 font-medium text-white disabled:opacity-30"
              >
                Save and next
              </button>
            </div>
          )}
        </article>
      )}
    </main>
  );
}
