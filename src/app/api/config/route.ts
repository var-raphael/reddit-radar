import { NextResponse } from "next/server";
import { resetBookmarks, addKeyword, ensureCompany, listCompanies, listKeywords, removeKeyword, type Kind } from "@/lib/keywords";
import { addSubreddit, listSubreddits, removeSubreddit } from "@/lib/subreddits";

const KINDS = ["brand", "alias", "competitor", "topic"];

export function GET(req: Request) {
  const companies = listCompanies();
  const id = Number(new URL(req.url).searchParams.get("company")) || companies[0]?.id;
  return NextResponse.json({
    companies,
    companyId: id ?? null,
    keywords: id ? listKeywords(id) : [],
    subreddits: id ? listSubreddits(id) : [],
  });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const text = String(b.value ?? "").trim().slice(0, 100);
  const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });
  const companyId = Number(b.companyId);
  const known = listCompanies().some((c) => c.id === companyId);

  if (b.action === "add_company") {
    if (!text) return bad("Company name is required");
    return NextResponse.json({ ok: true, companyId: ensureCompany(text) });
  }
  if (!known) return bad("Unknown company");

  switch (b.action) {
    case "add_keyword":
      if (!text || !KINDS.includes(b.kind)) return bad("Enter a keyword");
      addKeyword(companyId, text, b.kind as Kind);
      resetBookmarks(companyId);
      break;
    case "remove_keyword":
      removeKeyword(companyId, Number(b.keywordId));
      break;
    case "add_subreddit": {
      const name = text.replace(/^\/?r\//i, "");
      if (!/^[A-Za-z0-9_]{2,21}$/.test(name)) return bad("Not a valid subreddit name");
      addSubreddit(companyId, name);
      break;
    }
    case "remove_subreddit":
      removeSubreddit(companyId, String(b.value ?? ""));
      break;
    default:
      return bad("Unknown action");
  }
  return NextResponse.json({ ok: true });
}
