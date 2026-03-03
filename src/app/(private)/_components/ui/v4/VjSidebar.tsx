import React from "react";

export function VjSidebar({ active = "Dashboard" }: { active?: string }) {
  const items = ["Dashboard", "Requests", "Verificaciones", "Evidencias", "Reuse", "Settings"];
  return (
    <aside className="vj-panel v3 vj-panel v4 vj-sidebar v3">
      <div className="vj-sidebar-header">
        <div className="vj-logo" />
        <div className="vj-brand">Verijob</div>
      </div>
      <div className="vj-nav v3">
        {items.map((label) => (
          <button key={label} className={label === active ? "is-active" : ""}>
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}
