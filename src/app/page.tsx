"use client";
import Spinner from "./Spinner";
import RunBar from "./RunBar";
import { ArrowUp, Check, Inbox, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Post = {
  id: number; subreddit: string; title: string; body: string; url: string;
  score: number; created_utc: number; category: string; sentiment: string;
  urgency: number; reason: string;
};
type Company = { id: number; name: string };

const CATEGORIES = ["complaint", "bug report", "product idea", "praise", "asking for a recommendation", "other"];
const CAT_STYLE: Record<string, string> = {
  complaint: "bg-rose-100 text-rose-700",
  "bug report": "bg-orange-100 text-orange-700",
  "product idea": "bg-violet-100 text-violet-700",
  praise: "bg-emerald-100 text-emerald-700",
  "asking for a recommendation": "bg-sky-100 text-sky-700",
  other: "bg-zinc-200 text-zinc-700",
};
const URG_BAR = ["", "bg-zinc-300", "bg-sky-400", "bg-amber-400", "bg-orange-500", "bg-red-500"];
const URG_LABEL = ["", "Info", "Low", "Medium", "High", "Critical"];
const SENT: Record<string, string> = {
  positive: "text-emerald-600",
  neutral: "text-zinc-500",
  negative: "text-rose-600",
};

function ago(utc: number) {
  const h = Math.floor((Date.now() / 1000 - utc) / 3600);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm transition ${
        active
          ? "bg-zinc-900 text-white"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:ring-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function Feed() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<number | undefined>();
  const [category, setCategory] = useState("");
  const [minUrgency, setMinUrgency] = useState(0);
  const [tab, setTab] = useState<"new" | "handled">("new");
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const q = new URLSearchParams({ status: tab });
    if (company) q.set("company", String(company));
    if (category) q.set("category", category);
    if (minUrgency) q.set("minUrgency", String(minUrgency));
    try {
      const r = await fetch(`/api/posts?${q}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setCompanies(j.companies);
      setPosts(j.posts);
      if (!company && j.companyId) setCompany(j.companyId);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [company, category, minUrgency, tab]);

  useEffect(() => { load(); }, [load]);

  async function act(id: number, status: "new" | "handled" | "dismissed") {
    setPosts((p) => p.filter((x) => x.id !== id));
    const r = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) load();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <RunBar onFinished={load} />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
          <p className="text-sm text-zinc-500">
            {loading ? "Loading…" : `${posts.length} ${tab === "new" ? "open" : "handled"} post${posts.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {companies.length > 1 && (
          <select
            value={company}
            onChange={(e) => setCompany(Number(e.target.value))}
            className="rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-zinc-200"
          >
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Pill active={category === ""} onClick={() => setCategory("")}>All</Pill>
        {CATEGORIES.map((c) => (
          <Pill key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Pill>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-sm">
          <span className="mr-1 text-zinc-500">Urgency</span>
          {[0, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setMinUrgency(n)}
              className={`rounded-md px-2 py-1 ${
                minUrgency === n ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-200/60"
              }`}
            >
              {n === 0 ? "Any" : `${n}+`}
            </button>
          ))}
        </div>
        <div className="flex rounded-full bg-zinc-200/70 p-1 text-sm">
          {(["new", "handled"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 ${tab === t ? "bg-white font-medium shadow-sm" : "text-zinc-500"}`}
            >
              {t === "new" ? "Open" : "Handled"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Could not load the feed: {error}
        </p>
      )}

      {loading && (<p className="mt-6 flex items-center gap-2 text-sm text-zinc-500"><Spinner />Loading posts…</p>)}

      {!loading && !error && posts.length === 0 && (
        <div className="mt-12 text-center text-zinc-500">
          <Inbox className="mx-auto h-10 w-10 text-zinc-400" />
          <p className="mt-2 font-medium">Nothing here</p>
          <p className="text-sm">Try clearing the filters, or run a collection.</p>
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {posts.map((p) => (
          <li key={p.id} className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
            <div className={`w-1.5 shrink-0 ${URG_BAR[p.urgency]}`} />
            <div className="min-w-0 flex-1 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${CAT_STYLE[p.category] ?? CAT_STYLE.other}`}>{p.category}</span>
                <span className="font-medium text-zinc-700">{URG_LABEL[p.urgency]} · U{p.urgency}</span>
                <span className={`inline-flex items-center gap-1 ${SENT[p.sentiment]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{p.sentiment}</span>
              </div>
              <a href={p.url} target="_blank" rel="noreferrer" className="mt-2 block text-base font-semibold leading-snug hover:underline">
                {p.title}
              </a>
              <p className="mt-0.5 text-xs text-zinc-500">r/{p.subreddit} · {ago(p.created_utc)} · <ArrowUp className="inline h-3 w-3 align-[-1px]" /> {p.score}</p>
              {p.body && <p className="mt-2 line-clamp-3 text-sm text-zinc-600">{p.body}</p>}
              <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
                <Sparkles className="mr-1 inline h-3.5 w-3.5 align-[-2px]" /><span className="font-medium">Why: </span>{p.reason}
              </p>
              <div className="mt-3 flex gap-2 text-sm">
                {tab === "new" ? (
                  <button onClick={() => act(p.id, "handled")} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4" />Mark handled
                  </button>
                ) : (
                  <button onClick={() => act(p.id, "new")} className="rounded-lg px-3 py-1.5 font-medium ring-1 ring-zinc-300 inline-flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4" />Reopen
                  </button>
                )}
                <button onClick={() => act(p.id, "dismissed")} className="rounded-lg px-3 py-1.5 text-zinc-500 hover:bg-zinc-100 inline-flex items-center gap-1.5">
                  <X className="h-4 w-4" />Dismiss
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
