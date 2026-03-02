"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type PublicResponse = {
  verification_id: string;
  token: string;
  url: string;
};

export default function ReuseClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<PublicResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const verificationId = sp.get("id") || sp.get("verification_id");
        if (!verificationId) {
          setErr("Falta el parámetro id (o verification_id) en la URL.");
          return;
        }

        // Si esta pantalla requiere sesión, lo comprobamos aquí.
        // (Si NO quieres sesión, dime y lo cambio)
        const supabase = createClient();
        const { data: au } = await supabase.auth.getUser();
        if (!au.user) {
          router.replace(`/login?next=/company/reuse?id=${encodeURIComponent(verificationId)}`);
          return;
        }

        const res = await fetch("/api/company/reuse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ verification_id: verificationId }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || "No se pudo generar el link reutilizable");
        }

        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "Error desconocido");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sp, router]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">Reutilizar verificación</h1>

      {loading ? (
        <div className="text-sm text-gray-600">Generando enlace…</div>
      ) : err ? (
        <div className="text-sm text-red-600">{err}</div>
      ) : data ? (
        <div className="space-y-2">
          <div className="text-sm text-gray-700">
            Enlace público generado:
          </div>
          <a className="text-sm underline" href={data.url} target="_blank" rel="noreferrer">
            {data.url}
          </a>
          <div className="text-xs text-gray-500">
            Token: {data.token}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">Sin datos.</div>
      )}
    </div>
  );
}
