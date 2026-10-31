import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { startRun } from "@/lib/runner";

function authorized(req: Request): "ok" | "unconfigured" | "denied" {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "unconfigured";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const given = req.headers.get("x-cron-secret") ?? bearer ?? "";
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "denied";
}

export async function POST(req: Request) {
  const auth = authorized(req);
  if (auth === "unconfigured") {
    return NextResponse.json({ error: "CRON_SECRET is not set on the server" }, { status: 503 });
  }
  if (auth === "denied") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = startRun({ trigger: "cron" });
  return NextResponse.json(r, { status: r.started ? 202 : 409 });
}
