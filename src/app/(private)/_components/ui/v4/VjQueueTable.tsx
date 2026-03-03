import React from "react";

export function VjQueueTable() {
  const rows = [
    { name: "Ana Gómez", role: "Camarera", company: "Tech Solutions", status: "Pendiente", tone: "warn" as const },
    { name: "Luis Pérez", role: "Cocinero", company: "Beta Corp", status: "Verificado", tone: "good" as const },
    { name: "Sara Rivas", role: "Encargada", company: "Global Sales Inc.", status: "En revisión", tone: "warn" as const },
  ];

  return (
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
          {rows.map((r) => (
            <tr className="vj-tr" key={r.name}>
              <td><strong style={{ color: "var(--vj-slate-900)" }}>{r.name}</strong></td>
              <td>{r.role}</td>
              <td>{r.company}</td>
              <td><span className={`vj-pill ${r.tone}`}>{r.status}</span></td>
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
  );
}
