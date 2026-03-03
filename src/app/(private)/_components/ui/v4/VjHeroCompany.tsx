import React from "react";

export function VjHeroCompany() {
  return (
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

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div className="vj-ring v3" style={{ width: 140, height: 140 }}>
            <div
              className="vj-ring-inner v3"
              style={{
                position: "absolute",
                inset: 12,
                background: "white",
                border: "1px solid rgba(226,232,240,0.9)",
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
              }}
            >
              <div className="vj-ring-top">Risk Score</div>
              <div className="vj-ring-mid v3" style={{ fontSize: 38 }}>
                92
              </div>
              <div className="vj-ring-bot" style={{ color: "var(--vj-green)" }}>
                Bajo
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
