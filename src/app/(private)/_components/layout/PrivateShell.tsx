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
    <div style={{ display: "grid", gridTemplateColumns: "260px minmax(0,1fr)", minHeight: "100vh", background: "#F8FAFC" }}>
      <Sidebar role={role} />
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar role={role} />
        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 40px" }}>{children}</main>
      </div>
    </div>
  );
}
