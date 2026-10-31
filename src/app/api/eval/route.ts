import { NextResponse } from "next/server";
import { ensureSample, nextToLabel, progress, saveLabel, undoLast } from "@/lib/evalset";
import { listCompanies } from "@/lib/keywords";

export function GET(req: Request) {
  void req.url;
  const c = listCompanies()[0];
  if (!c) return NextResponse.json({ error: "No company yet" }, { status: 400 });
  ensureSample(c.id);
  return NextResponse.json({ post: nextToLabel(), ...progress() });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (b.action === "undo") {
    undoLast();
    return NextResponse.json({ ok: true });
  }
  const err = saveLabel(Number(b.postId), b.relevant, b.category, b.urgency);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  return NextResponse.json({ ok: true });
}
