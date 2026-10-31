import { collectAll } from "./collector";
import { classifyPending } from "./classifier";

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

export function startRun(opts: { cooldownMs?: number } = {}): { started: boolean; reason?: string } {
  if (state.running) return { started: false, reason: "A run is already in progress" };
  if (opts.cooldownMs && state.finishedAt && Date.now() - state.finishedAt < opts.cooldownMs) {
    return { started: false, reason: "A run finished recently. Try again in a couple of minutes." };
  }
  Object.assign(state, {
    running: true, startedAt: Date.now(), finishedAt: null,
    added: 0, kept: 0, dropped: 0, failed: 0, collectSec: 0, classifySec: 0, error: null,
  });

  void (async () => {
    const errors: string[] = [];
    let t = Date.now();
    try {
      const { rows, errors: collectErrors } = await collectAll();
      state.added = rows.reduce((n, r) => n + r.added, 0);
      errors.push(...collectErrors);
    } catch (e: any) {
      errors.push(`Collection: ${e.message}`);
    }
    state.collectSec = Math.round((Date.now() - t) / 1000);

    t = Date.now();
    try {
      const s = await classifyPending({ limit: Number(process.env.MAX_CLASSIFY_PER_RUN ?? 200) });
      state.kept = s.kept; state.dropped = s.dropped; state.failed = s.failed;
    } catch (e: any) {
      errors.push(`Classification: ${e.message}`);
    }
    state.classifySec = Math.round((Date.now() - t) / 1000);

    state.error = errors.length ? errors.join(" | ") : null;
    state.running = false;
    state.finishedAt = Date.now();
  })();

  return { started: true };
}
