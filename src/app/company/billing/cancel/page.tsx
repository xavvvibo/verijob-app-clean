import Link from "next/link";
export const dynamic = "force-dynamic";
export default function BillingCancelPage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Pago cancelado</h1>
      <p style={{ lineHeight: 1.6 }}>No se completó la suscripción.</p>
      <div style={{ marginTop: 20 }}>
        <Link href="/company" style={{ textDecoration: "underline" }}>Volver a /company</Link>
      </div>
    </main>
  );
}
