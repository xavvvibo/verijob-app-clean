import React from "react";
import { VjShell } from "@/app/(private)/_components/ui/v4/VjShell";
import { VjSidebar } from "@/app/(private)/_components/ui/v4/VjSidebar";
import { VjHeroCompany } from "@/app/(private)/_components/ui/v4/VjHeroCompany";
import { VjKpisCompany } from "@/app/(private)/_components/ui/v4/VjKpisCompany";
import { VjQueueTable } from "@/app/(private)/_components/ui/v4/VjQueueTable";

export default function CompanyDashboardV4() {
  return (
    <VjShell title="Company Dashboard" subtitle="Trust & Risk Command Center (V4 · preview)">
      <div className="vj-grid v3">
        <VjSidebar active="Dashboard" />
        <main className="vj-main">
          <VjHeroCompany />
          <VjKpisCompany />
          <VjQueueTable />
        </main>
      </div>
    </VjShell>
  );
}
