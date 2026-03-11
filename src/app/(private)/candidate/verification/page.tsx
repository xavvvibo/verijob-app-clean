"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function CandidateVerificationPage() {
  const supabase = useMemo(() => createClient(), []);
  const sp = useSearchParams();

  const [vrId, setVrId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setGlobalError(null);

        const fromUrl = sp ? (sp.get("id") || sp.get("verification_request_id")) : null;
        if (fromUrl) {
          if (!cancelled) setVrId(fromUrl);
          return;
        }

        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const userId = authRes?.user?.id;
        if (!userId) {
          if (!cancelled) setGlobalError("No autorizado");
          return;
        }

        const { data, error } = await supabase
          .from("verification_requests")
          .select("id, created_at")
          .eq("requested_by", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (!cancelled && data?.id) {
          setVrId(data.id);
        }
      } catch (e: any) {
        if (!cancelled) {
          setGlobalError(e?.message || "Error cargando verificación");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [sp, supabase]);

  if (loading) {
    return <div className="p-6">Cargando…</div>;
  }

  if (globalError) {
    return <div className="p-6 text-red-600">{globalError}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Verificación</h1>
      {vrId ? (
        <p>ID de verificación: {vrId}</p>
      ) : (
        <p>No se encontró ninguna verificación.</p>
      )}
    </div>
  );
}
