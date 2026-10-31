import { NextResponse } from "next/server";
import { setStatus } from "@/lib/posts";


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (!["new", "handled", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  const changed = setStatus(Number(id), status);
  return NextResponse.json({ ok: changed > 0 });
}
