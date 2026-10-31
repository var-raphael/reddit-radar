import { NextResponse } from "next/server";

export function GET(req: Request) {
  void req.url; // reading the request keeps this route dynamic
  return NextResponse.json({ ok: true });
}
