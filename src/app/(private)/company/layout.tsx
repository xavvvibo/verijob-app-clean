import { redirect } from "next/navigation";
import { headers } from "next/headers";

type Props = { children: React.ReactNode };

function originFromHeaders(h: Headers) {
  const proto = h.get("x-forwarded-proto") || "https";
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!host) return "https://app.verijob.es";
  return `${proto}://${host}`;
}

export default async function CompanyLayout({ children }: Props) {
  const h = await headers();
  const origin = originFromHeaders(h);
  const cookie = h.get("cookie") ?? "";

  const res = await fetch(`${origin}/api/auth/me`, {
    method: "GET",
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) redirect("/login");

  const json: any = await res.json().catch(() => ({}));
  const profile =
    json?.profile ??
    json?.data?.profile ??
    json?.user?.profile ??
    json;

  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (!profile?.active_company_id) redirect("/dashboard");

  return <>{children}</>;
}
