"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { vjEvents } from "@/lib/analytics";

export default function NewVerificationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [company, setCompany] = useState(searchParams?.get("company") || "");
  const [position, setPosition] = useState(searchParams?.get("position") || "");
  const [start, setStart] = useState(searchParams?.get("start") || "");
  const [end, setEnd] = useState(searchParams?.get("end") || "");
  const [companyEmail, setCompanyEmail] = useState(searchParams?.get("company_email") || "");
  const [isCurrent, setIsCurrent] = useState(false);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);

    try {
      const { data: au } = await supabase.auth.getUser();
      if (!au.user) {
        router.replace("/login?next=/candidate/verifications/new");
        return;
      }

      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company_name_freeform: company,
          company_email: companyEmail,
          position,
          start_date: start,
          end_date: end,
          is_current: isCurrent,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "No se pudo crear la verificación");
      }

      const vid = (json?.verification_request_id || json?.verification_id) as string | undefined;
      if (!vid) throw new Error("Respuesta inválida (sin verification_id)");

      vjEvents.verification_created(vid);

      router.replace(`/candidate/verification?verification_request_id=${encodeURIComponent(vid)}`);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-semibold">Nueva verificación</h1>
      <p className="mt-2 text-sm text-gray-600">Crea una solicitud y continúa con la subida de evidencias.</p>

      {err && (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
{err}
        </pre>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Empresa</label>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Ej: La Picatería"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Email de verificación de la empresa</label>
          <input
            type="email"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="ejemplo@empresa.com"
            required
          />
          <p className="mt-1 text-xs text-gray-600">Indica el email al que quieres enviar esta solicitud.</p>
        </div>

        <div>
          <label className="block text-sm font-medium">Puesto</label>
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2"
            placeholder="Ej: Camarero"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Inicio</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Fin</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              disabled={isCurrent}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
          />
          Sigo actualmente en este puesto
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Creando…" : "Crear verificación"}
        </button>
      </form>
    </div>
  );
}
