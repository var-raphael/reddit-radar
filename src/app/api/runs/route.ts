import { NextResponse } from "next/server";
import { listRuns } from "@/lib/runner";

export function GET(req: Request) {
  void req.url;
  return NextResponse.json({ runs: listRuns(10) });
}
