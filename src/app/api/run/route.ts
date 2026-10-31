import { NextResponse } from "next/server";
import { getRunState, startRun } from "@/lib/runner";

export function GET(req: Request) {
  void req.url;
  return NextResponse.json(getRunState());
}

export async function POST() {
  const cooldown = Number(process.env.RUN_COOLDOWN_SEC ?? 120) * 1000;
  const r = startRun({ cooldownMs: cooldown, trigger: "button" });
  return NextResponse.json(r, { status: r.started ? 202 : 409 });
}
