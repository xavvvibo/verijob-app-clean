import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";

export function createPagesRouteClient(req: NextApiRequest, res: NextApiResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies[name];
        },
        set(name: string, value: string, options: any) {
          const attrs: string[] = [];
          attrs.push(`${name}=${encodeURIComponent(value)}`);
          attrs.push(`Path=${options?.path ?? "/"}`);
          if (options?.httpOnly) attrs.push("HttpOnly");
          if (options?.secure) attrs.push("Secure");
          if (options?.sameSite) {
            const sameSite =
              options.sameSite === true
                ? "Strict"
                : String(options.sameSite).charAt(0).toUpperCase() + String(options.sameSite).slice(1);
            attrs.push(`SameSite=${sameSite}`);
          }
          if (typeof options?.maxAge === "number") attrs.push(`Max-Age=${options.maxAge}`);
          if (options?.expires) attrs.push(`Expires=${new Date(options.expires).toUTCString()}`);

          const prev = res.getHeader("Set-Cookie");
          const nextCookie = attrs.join("; ");

          if (!prev) {
            res.setHeader("Set-Cookie", nextCookie);
          } else if (Array.isArray(prev)) {
            res.setHeader("Set-Cookie", [...prev, nextCookie]);
          } else {
            res.setHeader("Set-Cookie", [String(prev), nextCookie]);
          }
        },
        remove(name: string, options: any) {
          const prev = res.getHeader("Set-Cookie");
          const nextCookie = `${name}=; Path=${options?.path ?? "/"}; Max-Age=0`;

          if (!prev) {
            res.setHeader("Set-Cookie", nextCookie);
          } else if (Array.isArray(prev)) {
            res.setHeader("Set-Cookie", [...prev, nextCookie]);
          } else {
            res.setHeader("Set-Cookie", [String(prev), nextCookie]);
          }
        },
      },
    }
  );
}
