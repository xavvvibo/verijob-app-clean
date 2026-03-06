import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/internal/cv-parse/run",
    method: "GET",
    ts: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    route: "/api/internal/cv-parse/run",
    method: "POST",
    received: body,
    ts: new Date().toISOString(),
  });
}
