import Link from "next/link";
import { headers } from "next/headers";

function isActive(pathname: string, href: string) {
  if (href === "/owner/overview") return pathname === "/owner" || pathname === "/owner/overview";
  return pathname === href || pathname.startsWith(href + "/");
}

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || ""; // best-effort; ok if empty

  const items: Array<{ href: string; label: string }> = [
    { href: "/owner/overview", label: "Overview" },
    { href: "/owner/users", label: "Usuarios" },
    { href: "/owner/companies", label: "Empresas" },
    { href: "/owner/verifications", label: "Verificaciones" },
    { href: "/owner/evidences", label: "Evidencias" },
    { href: "/owner/issues", label: "Issues" },
    { href: "/owner/ai-ops", label: "AI Ops" },
    { href: "/owner/monetization", label: "Monetización" },
    { href: "/owner/marketing", label: "Marketing" },
    { href: "/owner/settings", label: "Settings" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {items.map((it) => {
            const active = pathname ? isActive(pathname, it.href) : false;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={
                  "rounded-lg px-3 py-2 text-sm font-medium border " +
                  (active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-900 border-gray-200 hover:bg-gray-50")
                }
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div>{children}</div>
    </div>
  );
}
