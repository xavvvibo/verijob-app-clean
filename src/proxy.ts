import { NextResponse, type NextRequest } from "next/server";

function getAppBase(req: NextRequest) {
  const envBase =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "";
  if (envBase && envBase.startsWith("http")) return envBase.replace(/\/+$/, "");
  return (process.env.NODE_ENV !== "production")
    ? "http://localhost:3010"
    : "https://app.verijob.es";
}

function isLocalHost(host: string) {
  if (host.startsWith("localhost:")) return true;
  if (host.startsWith("127.0.0.1:")) return true;
  if (host.startsWith("0.0.0.0:")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("172.")) return true;
  return false;
}

function isAppLikePath(pathname: string) {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/auth")
  );
}

export function proxy(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const { pathname, search } = req.nextUrl;

  // LOCAL DEV BYPASS: nunca redirigir/proxy en local
  if (isLocalHost(host)) {
    return NextResponse.next();
  }

  const appBase = getAppBase(req);
  const appHost = (() => {
    try {
      return new URL(appBase).host;
    } catch {
      return (process.env.NODE_ENV !== "production") ? "localhost:3010" : "app.verijob.es";
    }
  })();

  // Si estás en host marketing pero entras a rutas de app, redirige a app host
  if (host && host !== appHost && isAppLikePath(pathname)) {
    const dest = new URL(appBase);
    dest.pathname = pathname;
    dest.search = search;
    return NextResponse.redirect(dest);
  }

  return NextResponse.next();
}
