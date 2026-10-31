import { getDb } from "./db";
import { collectAll } from "./collector";
import { classifyPending } from "./classifier";
import { log } from "./log";

type RunState = {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  added: number;
  kept: number;
  dropped: number;
  failed: number;
  collectSec: number;
  classifySec: number;
  error: string | null;
};

// globalThis so every route bundle shares one state (dev mode can load modules twice).
const g = globalThis as unknown as { __radarRun?: RunState };
const state: RunState = (g.__radarRun ??= {
  running: false, startedAt: null, finishedAt: null,
  added: 0, kept: 0, dropped: 0, failed: 0, collectSec: 0, classifySec: 0, error: null,
});

export function getRunState(): RunState {
  return { ...state };
}

export function listRuns(limit = 10) {
  return getDb()
    .prepare(`SELECT id, trigger, started_at, finished_at, added, kept, dropped, failed,
                     collect_sec, classify_sec, errors
              FROM runs ORDER BY id DESC LIMIT ?`)
    .all(limit);
}

export function startRun(
  opts: { cooldownMs?: number; trigger?: string } = {}
): { started: boolean; reason?: string } {
  const trigger = opts.trigger ?? "manual";
  if (state.running) {
    log("warn", "run", "refused: a run is already in progress", { trigger });
    return { started: false, reason: "A run is already in progress" };
  }
  if (opts.cooldownMs && state.finishedAt && Date.now() - state.finishedAt < opts.cooldownMs) {
    log("info", "run", "refused: cooldown", { trigger });
    return { started: false, reason: "A run finished recently. Try again in a couple of minutes." };
  }
  Object.assign(state, {
    running: true, startedAt: Date.now(), finishedAt: null,
    added: 0, kept: 0, dropped: 0, failed: 0, collectSec: 0, classifySec: 0, error: null,
  });
  log("info", "run", "started", { trigger });

  void (async () => {
    const errors: string[] = [];
    let t = Date.now();
    try {
      const { rows, errors: collectErrors } = await collectAll();
      state.added = rows.reduce((n, r) => n + r.added, 0);
      errors.push(...collectErrors);
    } catch (e: any) {
      errors.push(`Collection: ${e.message}`);
      log("error", "run", "collection crashed", { error: e.message });
    }
    state.collectSec = Math.round((Date.now() - t) / 1000);

    t = Date.now();
    try {
      const s = await classifyPending({ limit: Number(process.env.MAX_CLASSIFY_PER_RUN ?? 200) });
      state.kept = s.kept; state.dropped = s.dropped; state.failed = s.failed;
    } catch (e: any) {
      errors.push(`Classification: ${e.message}`);
      log("error", "run", "classification crashed", { error: e.message });
    }
    state.classifySec = Math.round((Date.now() - t) / 1000);

    state.error = errors.length ? errors.join(" | ") : null;
    state.running = false;
    state.finishedAt = Date.now();

    try {
      getDb()
        .prepare(`INSERT INTO runs (trigger, started_at, finished_at, added, kept, dropped, failed,
                                    collect_sec, classify_sec, errors)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(trigger, new Date(state.startedAt!).toISOString(), new Date(state.finishedAt).toISOString(),
             state.added, state.kept, state.dropped, state.failed, state.collectSec, state.classifySec,
             state.error);
    } catch (e: any) {
      log("error", "run", "could not save run history", { error: e.message });
    }
    log(state.error ? "warn" : "info", "run", "finished", {
      trigger, added: state.added, kept: state.kept, dropped: state.dropped, failed: state.failed,
      collect_s: state.collectSec, classify_s: state.classifySec, errors: errors.length,
    });
  })();

  return { started: true };
}
