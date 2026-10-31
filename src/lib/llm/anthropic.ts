import { withRetry, type LlmProvider } from "./types";

export function anthropic(cfg: { apiKey: string; model: string }): LlmProvider {
  return {
    name: `anthropic:${cfg.model}`,
    async complete(messages) {
      const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const rest = messages.filter((m) => m.role !== "system");
      return withRetry(
        () =>
          fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": cfg.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({ model: cfg.model, max_tokens: 400, temperature: 0, system, messages: rest }),
          }),
        async (res) => {
          const j: any = await res.json();
          const text = (j?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
          return {
            content: text,
            usage: { prompt_tokens: j?.usage?.input_tokens, completion_tokens: j?.usage?.output_tokens },
          };
        }
      );
    },
  };
}
