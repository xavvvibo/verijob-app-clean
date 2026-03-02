import { redirect } from "next/navigation";
import { headers } from "next/headers";

type Props = { children: React.ReactNode };

function getOrigin() {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) return process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export default async function CompanyDebugLayout({ children }: Props) {
  if (process.env.ENABLE_INTERNAL_DEBUG !== "true") redirect("/dashboard");

  const h = await headers();
  const cookie = h.get("cookie") ?? "";

  const res = await fetch(`${getOrigin()}/api/auth/me`, {
    method: "GET",
    headers: { cookie },
    cache: "no-store",
  });

  if (!res.ok) redirect("/login?next=/dashboard");

  const json = await res.json().catch(() => null);
  const profile = json?.profile;

  // Mantengo tu lógica previa: role owner
  if ((profile?.role || "").toLowerCase() !== "owner") redirect("/dashboard");

  return <>{children}</>;
}
