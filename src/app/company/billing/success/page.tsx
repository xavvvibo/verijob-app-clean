import Link from "next/link";
export const dynamic = "force-dynamic";
export default function BillingSuccessPage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, marginBottom: 12 }}>Suscripción activada</h1>
      <p style={{ lineHeight: 1.6 }}>Pago recibido correctamente.</p>
      <div style={{ marginTop: 20 }}>
        <Link href="/company" style={{ textDecoration: "underline" }}>Ir a /company</Link>
      </div>
    </main>
  );
}
