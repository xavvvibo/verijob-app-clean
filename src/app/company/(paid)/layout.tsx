import React from "react";
import RequireActiveSubscription from "@/app/(private)/_components/RequireActiveSubscription";

export default async function PaidCompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireActiveSubscription redirectTo="/company/upgrade">
      {children}
    </RequireActiveSubscription>
  );
}
