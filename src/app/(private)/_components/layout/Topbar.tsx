import Link from "next/link";

export default function Topbar() {
  return (
    <div style={{
      background: "#FFFFFF",
      borderBottom: "1px solid #E5E7EB",
      padding: "16px 32px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }}>
      <div style={{ fontWeight: 600 }}>Trust Infrastructure</div>
      <Link href="/auth/logout" style={{
        padding: "8px 14px",
        background: "#111827",
        color: "#FFFFFF",
        borderRadius: "10px",
        textDecoration: "none",
        fontSize: "14px"
      }}>
        Cerrar sesión
      </Link>
    </div>
  );
}
