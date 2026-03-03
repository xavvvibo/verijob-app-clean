import React from "react";

export function VjKpisCompany() {
  return (
    <section className="vj-kpiStrip">
      <div className="k">
        <div className="l">Créditos</div>
        <div className="v">18/50</div>
        <div className="vj-miniSpark" style={{ marginTop: 10 }}>
          <div style={{ width: "64%" }} />
        </div>
      </div>
      <div className="k">
        <div className="l">Pendientes</div>
        <div className="v">8</div>
        <div className="vj-miniSpark" style={{ marginTop: 10 }}>
          <div style={{ width: "48%" }} />
        </div>
      </div>
      <div className="k">
        <div className="l">Tiempo medio</div>
        <div className="v">2.4d</div>
        <div className="vj-miniSpark" style={{ marginTop: 10 }}>
          <div style={{ width: "72%" }} />
        </div>
      </div>
      <div className="k">
        <div className="l">Reuse rate</div>
        <div className="v">31%</div>
        <div className="vj-miniSpark" style={{ marginTop: 10 }}>
          <div style={{ width: "31%" }} />
        </div>
      </div>
    </section>
  );
}
