import { withRetry, type LlmProvider } from "./types";

export function openaiCompatible(cfg: {
  apiKey: string; model: string; baseUrl: string; jsonMode: boolean;
}): LlmProvider {
  return {
    name: `openai-compatible:${cfg.model}`,
    async complete(messages) {
      return withRetry(
        () =>
          fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
            body: JSON.stringify({
              model: cfg.model, messages, temperature: 0, top_p: 1,
              ...(cfg.jsonMode ? { response_format: { type: "json_object" } } : {}),
            }),
          }),
        async (res) => {
          const j: any = await res.json();
          const c = j?.choices?.[0]?.message?.content;
          const content = Array.isArray(c)
            ? c.filter((b: any) => b?.type === "text").map((b: any) => b.text).join("")
            : String(c ?? "");
          return { content, usage: j?.usage };
        }
      );
    },
  };
}
