export const runtime = "edge";

import { NextResponse, type NextRequest } from "next/server";

/**
 * HARD RULE:
 * - Middleware must NEVER rewrite/redirect/proxy API routes.
 * - API routes must be handled by Route Handlers.
 */
const BYPASS_PREFIXES = [
  "/api/",          // <- blindaje total
  "/auth/callback", // callback local/edge safe
];

function isLocal(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

function shouldBypass(pathname: string) {
  return BYPASS_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // NEVER touch /api/*
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Always bypass callback
  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  // En local: no aplicamos ninguna lógica adicional aquí (evita sorpresas)
  if (isLocal(req)) {
    return NextResponse.next();
  }

  // Producción: por defecto no interferimos (si más adelante metes proxy, hazlo explícito aquí)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
