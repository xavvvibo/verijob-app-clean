import React from "react";

type Props = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function DashboardShell({ title, subtitle, children }: Props) {
  return (
    <main style={{ minHeight: "100vh", padding: 24, background: "#F7F9FC" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {(title || subtitle) && (
          <header style={{ marginBottom: 16 }}>
            {title && (
              <h1 style={{ margin: 0, fontSize: 28, color: "#0B1F3B" }}>
                {title}
              </h1>
            )}
            {subtitle && (
              <p style={{ marginTop: 6, color: "#5B6B7D" }}>{subtitle}</p>
            )}
          </header>
        )}

        <div>{children}</div>
      </div>
    </main>
  );
}
