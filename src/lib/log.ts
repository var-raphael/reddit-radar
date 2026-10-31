type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function minLevel(): number {
  const l = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;
  return order[l] ?? 1;
}

// One line per event: time, level, [scope], message, key=value fields.
// Never pass secrets or request headers in here.
export function log(level: Level, scope: string, msg: string, fields?: Record<string, unknown>) {
  if (order[level] < minLevel()) return;
  const extra = fields
    ? " " + Object.entries(fields)
        .map(([k, v]) => {
          const s = String(v);
          return `${k}=${/[\s"]/.test(s) ? JSON.stringify(s) : s}`;
        })
        .join(" ")
    : "";
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}${extra}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
