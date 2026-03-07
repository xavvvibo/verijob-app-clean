import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildTarget(req: Request) {
  const url = new URL(req.url);
  return `${url.origin}/api/_stripe/portal`;
}

export async function POST(req: Request) {
  const target = buildTarget(req);

  const headers = new Headers();
  const cookie = req.headers.get("cookie");
  const contentType = req.headers.get("content-type");

  if (cookie) headers.set("cookie", cookie);
  if (contentType) headers.set("content-type", contentType);

  const bodyText = await req.text();

  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: bodyText || undefined,
    cache: "no-store",
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed", route: "/app/api/stripe/portal-shim" },
    { status: 405, headers: { "cache-control": "no-store", Allow: "POST" } }
  );
}
