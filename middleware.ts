export const runtime = "edge";

import { NextResponse, type NextRequest } from "next/server";

/**
 * HARD RULE:
 * - Middleware must NEVER rewrite/redirect/proxy API routes.
 */
const BYPASS_PREFIXES = [
  "/api/",
  "/auth/callback",
  "/_next/",
  "/favicon.ico",
  "/brand/",
];

const APP_HOSTS = new Set([
  "app.verijob.es",
]);

// Rutas marketing que NO deben vivir en app.* (solo en verijob.es)
const MARKETING_PREFIXES = [
  "/como-funciona",
  "/precios",
  "/seguridad",
  "/faq",
  "/contacto",
  "/hosteleria",
  "/retail",
  "/logistica",
  "/para-candidatos",
  "/para-empresas",
  "/privacidad",
  "/cookies",
  "/terminos",
  "/construccion",
  "/ui",
  "/(marketing)", // por si algún path raro llega
];

function shouldBypass(pathname: string) {
  return BYPASS_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function isAppHost(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return APP_HOSTS.has(host);
}

function isMarketingPath(pathname: string) {
  return MARKETING_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  // allow public QR + public verification assets (must bypass auth/rewrites)
  const pth = req.nextUrl.pathname
  if (pth.startsWith("/api/qr/")) return NextResponse.next()
  if (pth.startsWith("/api/public/verification/")) return NextResponse.next()

  const { pathname, search } = req.nextUrl;

  if (shouldBypass(pathname)) return NextResponse.next();

  // En app.verijob.es, todo marketing se va a verijob.es
  if (isAppHost(req) && isMarketingPath(pathname)) {
    const url = new URL(`https://verijob.es${pathname}${search}`);
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
