"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/candidate/overview", label: "Resumen" },
  { href: "/candidate/profile", label: "Mi perfil" },
  { href: "/candidate/verifications", label: "Verificaciones" },
  { href: "/candidate/share", label: "Perfil público" },
  { href: "/candidate/settings", label: "Ajustes" },
];

export default function CandidateNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {items.map((it) => {
        const active = pathname === it.href || pathname?.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={[
              "block rounded-md px-3 py-2 text-sm transition",
              "border",
              active ? "bg-gray-100 border-gray-300 font-medium" : "bg-white border-gray-200 hover:bg-gray-50",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}

      <div className="pt-2 mt-2 border-t border-gray-200" />

      <Link
        href="/logout"
        className={[
          "block rounded-md px-3 py-2 text-sm transition border",
          "bg-white border-gray-200 hover:bg-gray-50",
          "text-red-600",
        ].join(" ")}
      >
        Cerrar sesión
      </Link>
    </nav>
  );
}
