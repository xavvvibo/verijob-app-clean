import Link from "next/link";

export default function Sidebar({ role }: { role: string }) {
  const linkStyle = {
    display: "block",
    padding: "10px 14px",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 500,
    marginBottom: "8px",
    color: "#0F172A"
  };

  return (
    <aside style={{
      borderRight: "1px solid #E5E7EB",
      padding: "24px",
      background: "#FFFFFF",
      minHeight: "100vh"
    }}>
      <div style={{ fontWeight: 700, marginBottom: "24px" }}>VERIJOB</div>

      {role === "candidate" && (
        <>
          <Link href="/candidate/dashboard" style={linkStyle}>Dashboard</Link>
          <Link href="/candidate/experience" style={linkStyle}>Experiencias</Link>
        </>
      )}

      {(role === "company" || role === "owner") && (
        <>
          <Link href="/company/dashboard" style={linkStyle}>Dashboard</Link>
          <Link href="/company/requests" style={linkStyle}>Verificaciones</Link>
        </>
      )}
    </aside>
  );
}
