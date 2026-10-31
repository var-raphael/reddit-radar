import { NextResponse } from "next/server";
import { listFeed } from "@/lib/posts";
import { listCompanies } from "@/lib/keywords";


export function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const companies = listCompanies();
  const companyId = Number(q.get("company")) || companies[0]?.id;
  const posts = companyId
    ? listFeed({
        companyId,
        category: q.get("category") || undefined,
        minUrgency: Number(q.get("minUrgency")) || undefined,
        status: q.get("status") === "handled" ? "handled" : "new",
      })
    : [];
  return NextResponse.json({ companies, companyId, posts });
}
