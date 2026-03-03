import React from "react";

export default function UIPrototypeV4() {
  return (
    <div className="vj-shell v3">
      <div className="vj-container v3">

        <div className="vj-top v3" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div>
            <div className="vj-h1 v3">Trust & Risk Command Center</div>
            <div className="vj-subtle">Infraestructura de confianza profesional verificable</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div className="vj-seg" aria-label="Context switch (prototype)">
              <button className="is-active">Company</button>
              <button>Candidate</button>
              <button>Admin</button>
            </div>
            <span className="vj-chip v4"><span className="vj-dot" /> Live · /ui</span>
          </div>
        </div>

        <div className="vj-grid v3">
          <aside className="vj-panel v3 vj-panel v4 vj-sidebar v3">
            <div className="vj-sidebar-header">
              <div className="vj-logo" />
              <div className="vj-brand">Verijob</div>
            </div>
            <div className="vj-nav v3">
              <button className="is-active">Dashboard</button>
              <button>Requests</button>
              <button>Verificaciones</button>
              <button>Evidencias</button>
              <button>Reuse</button>
              <button>Settings</button>
            </div>
          </aside>

          <main className="vj-main">

            {/* HERO (impact) */}
            <section className="vj-heroBox v4">
              <span className="vj-heroRail" />
              <div className="vj-hero v3" style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <div className="vj-title v3">Estado operativo hoy</div>

                  <div className="vj-metricRow">
                    <span className="vj-chip v4"><span className="vj-dot warn" /> 8 pendientes</span>
                    <span className="vj-chip v4">24 verificaciones</span>
                    <span className="vj-chip v4">Risk Score 92/100</span>
                    <span className="vj-chip v4">Reuse 90 días</span>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className="vj-btn v3 v4 primary">Procesar pendientes</button>
                    <button className="vj-btn v3 v4 ghost">Importar reuse</button>
                    <button className="vj-btn v3 v4 ghost">Crear solicitud</button>
                  </div>

                  <div className="vj-subtle" style={{ marginTop: 10 }}>
                    Prioridad: reducir riesgo en contratación con verificación trazable.
                  </div>
                </div>

                {/* Compact ring: más “pro”, menos “juguete” */}
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div className="vj-ring v3" style={{ width: 140, height: 140 }}>
                    <div className="vj-ring-inner v3" style={{
                      position:"absolute",
                      inset: 12,
                      background:"white",
                      border:"1px solid rgba(226,232,240,0.9)",
                      borderRadius:"999px",
                      display:"flex",
                      alignItems:"center",
                      justifyContent:"center",
                      flexDirection:"column"
                    }}>
                      <div className="vj-ring-top">Risk Score</div>
                      <div className="vj-ring-mid v3" style={{ fontSize: 38 }}>92</div>
                      <div className="vj-ring-bot" style={{ color: "var(--vj-green)" }}>Bajo</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* KPI STRIP (impact by contrast + sparklines) */}
            <section className="vj-kpiStrip">
              <div className="k">
                <div className="l">Créditos</div>
                <div className="v">18/50</div>
                <div className="vj-miniSpark" style={{ marginTop: 10 }}><div style={{ width: "64%" }} /></div>
              </div>
              <div className="k">
                <div className="l">Pendientes</div>
                <div className="v">8</div>
                <div className="vj-miniSpark" style={{ marginTop: 10 }}><div style={{ width: "48%" }} /></div>
              </div>
              <div className="k">
                <div className="l">Tiempo medio</div>
                <div className="v">2.4d</div>
                <div className="vj-miniSpark" style={{ marginTop: 10 }}><div style={{ width: "72%" }} /></div>
              </div>
              <div className="k">
                <div className="l">Reuse rate</div>
                <div className="v">31%</div>
                <div className="vj-miniSpark" style={{ marginTop: 10 }}><div style={{ width: "31%" }} /></div>
              </div>
            </section>

            {/* TABLE: this is what makes it feel like LinkedIn/Stripe production */}
            <section className="vj-card2 v3 vj-card2 v4" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <div>
                  <div className="vj-title v3">Cola de verificación</div>
                  <div className="vj-subtle">Acciones inline · tiempo objetivo: &lt;8s por revisión</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span className="vj-pill warn">8 pendientes</span>
                  <span className="vj-pill good">16 verificados</span>
                  <button className="vj-btn v3 v4 ghost">Ver todo</button>
                </div>
              </div>

              <table className="vj-table2">
                <thead>
                  <tr>
                    <th>Candidato</th>
                    <th>Puesto</th>
                    <th>Empresa</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "right" }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: "Ana Gómez", role: "Camarera", company: "Tech Solutions", status: "Pendiente", tone: "warn" as const },
                    { name: "Luis Pérez", role: "Cocinero", company: "Beta Corp", status: "Verificado", tone: "good" as const },
                    { name: "Sara Rivas", role: "Encargada", company: "Global Sales Inc.", status: "En revisión", tone: "warn" as const },
                  ].map((r) => (
                    <tr className="vj-tr" key={r.name}>
                      <td><strong style={{ color: "var(--vj-slate-900)" }}>{r.name}</strong></td>
                      <td>{r.role}</td>
                      <td>{r.company}</td>
                      <td>
                        <span className={`vj-pill ${r.tone}`}>{r.status}</span>
                      </td>
                      <td>
                        <div className="vj-actionsInline">
                          <button className="vj-btn v3 v4 ghost">Ver</button>
                          <button className="vj-btn v3 v4 primary">Aprobar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="vj-chip v4">Autorización por roles</span>
                <span className="vj-chip v4">RLS + multi-tenant</span>
                <span className="vj-chip v4">Auditoría de acciones</span>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}
