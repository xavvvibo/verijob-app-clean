import { Suspense } from "react";
import LoginClient from "./LoginClient";

/**
 * Login page wrapper (Server Component)
 * - Evita prerender estático
 * - Permite usar useSearchParams en el cliente
 * - Compatible con Next.js 16 + Supabase SSR
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ opacity: 0.7 }}>Cargando acceso seguro…</div>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}