import { redirect } from "next/navigation";
import { headers } from "next/headers";

type Props = { children: React.ReactNode };

function getOrigin() {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) return process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function CompanyLayout({ children }: Props) {
  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const res = await fetch(`${getOrigin()}/api/auth/me`, {
    method: "GET",
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) redirect("/login");

  const json = await res.json().catch(() => null);
  const profile = json?.profile;

  // Ajusta aquí solo lo imprescindible para company area
  if (!profile?.onboarding_completed) redirect("/onboarding");
  if (!profile?.active_company_id) redirect("/dashboard");

  return <>{children}</>;
}
