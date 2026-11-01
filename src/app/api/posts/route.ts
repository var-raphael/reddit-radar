import { NextResponse } from "next/server";
import { countFeed, listFeed, type FeedFilter } from "@/lib/posts";
import { listCompanies } from "@/lib/keywords";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const companies = listCompanies();
  const companyId = Number(q.get("company")) || companies[0]?.id;
  if (!companyId) return NextResponse.json({ companies, companyId: null, posts: [], total: 0 });
  const f: FeedFilter = {
    companyId,
    category: q.get("category") || undefined,
    minUrgency: Number(q.get("minUrgency")) || undefined,
    status: q.get("status") === "handled" ? "handled" : "new",
    sort: q.get("sort") === "new" ? "new" : "urgent",
    limit: Math.min(Number(q.get("limit")) || 100, 500),
  };
  return NextResponse.json({ companies, companyId, posts: listFeed(f), total: countFeed(f) });
}
