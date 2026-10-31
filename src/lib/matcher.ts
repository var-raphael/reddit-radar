import type { Keyword } from "./keywords";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whole-word, case-insensitive. Multi-word terms allow any whitespace between words.
// "notion.so" matches "notion.so" but "Notion" does not match "Notional".
export function termRegex(term: string): RegExp {
  const body = term.trim().split(/\s+/).map(escapeRe).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "iu");
}

export function matchPost(
  post: { title: string; body: string },
  keywords: Keyword[]
): Keyword | null {
  const text = `${post.title}\n${post.body}`;
  for (const k of keywords) {
    if (termRegex(k.term).test(text)) return k;
  }
  return null;
}
