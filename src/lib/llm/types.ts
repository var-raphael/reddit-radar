export type ChatMessage = { role: "system" | "user"; content: string };
export type LlmResult = {
  content: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
export interface LlmProvider {
  name: string;
  complete(messages: ChatMessage[]): Promise<LlmResult>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  fn: () => Promise<Response>,
  parse: (r: Response) => Promise<T>
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fn();
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const header = Number(res.headers.get("retry-after"));
      const wait = header > 0 ? header * 1000 : Math.min(30000, 2000 * 2 ** attempt);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return parse(res);
  }
}
