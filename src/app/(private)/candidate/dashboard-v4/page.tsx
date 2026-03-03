import React from "react";
import { VjShell } from "@/app/(private)/_components/ui/v4/VjShell";
import { VjSidebar } from "@/app/(private)/_components/ui/v4/VjSidebar";
import { VjQueueTable } from "@/app/(private)/_components/ui/v4/VjQueueTable";

export default function CandidateDashboardV4() {
  return (
    <VjShell title="Candidate Dashboard" subtitle="Trust Center (V4 · preview)">
      <div className="vj-grid v3">
        <VjSidebar active="Dashboard" />
        <main className="vj-main">
          <section className="vj-heroBox v4">
            <span className="vj-heroRail" />
            <div className="vj-title v3">Nivel de confianza profesional</div>
            <div className="vj-metricRow" style={{ marginTop: 10 }}>
              <span className="vj-chip v4"><span className="vj-dot" /> 87% Alto</span>
              <span className="vj-chip v4"><span className="vj-dot warn" /> 1 en revisión</span>
              <span className="vj-chip v4">3 verificaciones completas</span>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="vj-btn v3 v4 primary">Solicitar validación</button>
              <button className="vj-btn v3 v4 ghost">Compartir perfil</button>
            </div>
          </section>

          <VjQueueTable />
        </main>
      </div>
    </VjShell>
  );
}
