"use client";
import { useCallback, useEffect, useState } from "react";
import { Play } from "lucide-react";
import Spinner from "./Spinner";

type RunState = {
  running: boolean; startedAt: number | null; finishedAt: number | null;
  added: number; kept: number; dropped: number; failed: number;
  collectSec: number; classifySec: number; error: string | null;
};

function ago(ms: number) {
  const m = Math.floor((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ago`;
}

export default function RunBar({ onFinished }: { onFinished?: () => void }) {
  const [s, setS] = useState<RunState | null>(null);
  const [msg, setMsg] = useState("");

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/run", { cache: "no-store" });
      setS(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { poll(); }, [poll]);

  useEffect(() => {
    if (!s?.running) return;
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [s?.running, poll]);

  const wasRunning = s?.running;
  useEffect(() => {
    if (wasRunning === false && s?.finishedAt) onFinished?.();
  }, [wasRunning, s?.finishedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setMsg("");
    const r = await fetch("/api/run", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(j.reason ?? "Could not start a run");
    poll();
  }

  return (
    <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200">
      <div className="min-w-0 text-sm">
        {s?.running ? (
          <p className="flex items-center gap-2 font-medium">
            <Spinner />Collecting and classifying…
          </p>
        ) : s?.finishedAt ? (
          <p>
            <span className="font-medium">Last run {ago(s.finishedAt)}</span>
            <span className="text-zinc-500"> · {s.added} new · {s.kept} kept · {s.dropped} dropped · collect {s.collectSec}s · classify {s.classifySec}s</span>
          </p>
        ) : (
          <p className="text-zinc-500">No run since the server started</p>
        )}
        {msg && <p className="text-xs text-amber-700">{msg}</p>}
        {s?.error && <p className="truncate text-xs text-red-700">{s.error}</p>}
      </div>
      <button
        onClick={start}
        disabled={s?.running}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {s?.running ? <Spinner /> : <Play className="h-4 w-4" />}
        {s?.running ? "Running" : "Run now"}
      </button>
    </div>
  );
}
