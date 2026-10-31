"use client";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Company = { id: number; name: string };
type Kw = { id: number; term: string; kind: "brand" | "alias" | "competitor" | "topic" };
type Item = { key: string | number; label: string };

async function send(body: object) {
  const r = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

function Section(props: {
  title: string; hint: string; placeholder: string; items: Item[];
  onAdd: (v: string) => void; onRemove: (key: string | number) => void;
}) {
  const [v, setV] = useState("");
  const add = () => { if (v.trim()) { props.onAdd(v.trim()); setV(""); } };
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
      <h2 className="font-semibold">{props.title}</h2>
      <p className="text-xs text-zinc-500">{props.hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.items.map((i) => (
          <span key={i.key} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-3 pr-1.5 text-sm">
            {i.label}
            <button
              aria-label={`Remove ${i.label}`}
              onClick={() => props.onRemove(i.key)}
              className="grid h-5 w-5 place-items-center rounded-full text-zinc-500 hover:bg-zinc-300"
            ><X className="h-3 w-3" /></button>
          </span>
        ))}
        {props.items.length === 0 && <span className="text-sm text-zinc-400">None yet</span>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={props.placeholder}
          className="min-w-0 flex-1 rounded-lg bg-zinc-50 px-3 py-2 text-sm outline-none ring-1 ring-zinc-200 focus:ring-zinc-400"
        />
        <button onClick={add} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
          Add
        </button>
      </div>
    </section>
  );
}

export default function Keywords() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [kws, setKws] = useState<Kw[]>([]);
  const [subs, setSubs] = useState<string[]>([]);
  const [newCompany, setNewCompany] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (id?: number | null) => {
    const r = await fetch(`/api/config${id ? `?company=${id}` : ""}`);
    const j = await r.json();
    setCompanies(j.companies);
    setCompanyId(j.companyId);
    setKws(j.keywords);
    setSubs(j.subreddits);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function run(body: object) {
    try {
      const j = await send({ companyId, ...body });
      setError("");
      await load(j.companyId ?? companyId);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const ofKind = (k: Kw["kind"]): Item[] => kws.filter((x) => x.kind === k).map((x) => ({ key: x.id, label: x.term }));
  const addKw = (kind: Kw["kind"]) => (value: string) => run({ action: "add_keyword", kind, value });
  const rmKw = (key: string | number) => run({ action: "remove_keyword", keywordId: key });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Keywords</h1>
      <p className="text-sm text-zinc-500">
        What to track for a company. Changes apply on the next collection run; posts already collected stay.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {companies.map((c) => (
          <button
            key={c.id}
            onClick={() => load(c.id)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              c.id === companyId
                ? "bg-zinc-900 text-white"
                : "bg-white ring-1 ring-zinc-200"
            }`}
          >
            {c.name}
          </button>
        ))}
        <input
          value={newCompany}
          onChange={(e) => setNewCompany(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newCompany.trim()) {
              run({ action: "add_company", value: newCompany.trim() });
              setNewCompany("");
            }
          }}
          placeholder="+ New company"
          className="w-36 rounded-full bg-transparent px-3 py-1.5 text-sm outline-none ring-1 ring-dashed ring-zinc-300 focus:ring-zinc-500"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {companyId && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-zinc-500">Editing: <span className="font-semibold text-zinc-900">{companies.find((c) => c.id === companyId)?.name}</span></p>
          <Section title="Brand name" hint="The company's name." placeholder="e.g. Notion" items={ofKind("brand")} onAdd={addKw("brand")} onRemove={rmKw} />
          <Section title="Aliases" hint="Other names, products and domains." placeholder="e.g. notion.so" items={ofKind("alias")} onAdd={addKw("alias")} onRemove={rmKw} />
          <Section title="Competitors" hint="Alternatives people compare against." placeholder="e.g. Obsidian" items={ofKind("competitor")} onAdd={addKw("competitor")} onRemove={rmKw} />
          <Section title="Topics" hint="Phrases people use when looking for this kind of product." placeholder="e.g. best note taking app" items={ofKind("topic")} onAdd={addKw("topic")} onRemove={rmKw} />
          <Section
            title="Subreddits"
            hint="Where we look. Posts are matched against the keywords above."
            placeholder="e.g. productivity"
            items={subs.map((s) => ({ key: s, label: `r/${s}` }))}
            onAdd={(value) => run({ action: "add_subreddit", value })}
            onRemove={(key) => run({ action: "remove_subreddit", value: key })}
          />
        </div>
      )}
    </main>
  );
}
