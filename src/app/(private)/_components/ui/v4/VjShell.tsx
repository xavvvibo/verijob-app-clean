import React from "react";

export function VjShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="vj-shell v3">
      <div className="vj-container v3">
        <div className="vj-top v3" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div>
            <div className="vj-h1 v3">{title}</div>
            <div className="vj-subtle">{subtitle}</div>
          </div>
          {right ?? (
            <span className="vj-chip v4">
              <span className="vj-dot" />
              Internal preview
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
