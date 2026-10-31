import type { LlmProvider } from "./types";
import { openaiCompatible } from "./openaiCompatible";
import { anthropic } from "./anthropic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Spaces out request starts so we stay under a provider's rate limit.
function throttled(inner: LlmProvider, minIntervalMs: number): LlmProvider {
  let nextAt = 0;
  return {
    name: inner.name,
    async complete(messages) {
      const now = Date.now();
      const start = Math.max(now, nextAt);
      nextAt = start + minIntervalMs;
      if (start > now) await sleep(start - now);
      return inner.complete(messages);
    },
  };
}

function build(): LlmProvider {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set (see .env.example)");
  const kind = (process.env.LLM_PROVIDER ?? "openai-compatible").toLowerCase();
  const model = process.env.LLM_MODEL;
  if (!model) throw new Error("LLM_MODEL is not set (see .env.example)");
  if (kind === "anthropic") return anthropic({ apiKey, model });
  if (kind === "openai-compatible") {
    return openaiCompatible({
      apiKey, model,
      baseUrl: process.env.LLM_BASE_URL ?? "https://api.mistral.ai/v1",
      jsonMode: (process.env.LLM_JSON_MODE ?? "on").toLowerCase() !== "off",
    });
  }
  throw new Error(`Unknown LLM_PROVIDER: ${kind}`);
}

export function getProvider(): LlmProvider {
  const gap = Number(process.env.LLM_MIN_INTERVAL_MS ?? 1500);
  return throttled(build(), gap);
}
