"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

type Role = "candidate" | "company" | "owner" | string | null | undefined;

export default function PrivateShell({
  role,
  children,
}: {
  role?: Role;
  children: ReactNode;
}) {
  const pathname = usePathname() || "/";
  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  if (isOnboarding) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh", background: "#F8FAFC" }}>
      <Sidebar role={role} />
      <div>
        <Topbar role={role} />
        <main style={{ padding: "32px" }}>{children}</main>
      </div>
    </div>
  );
}
