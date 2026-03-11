"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { vjEvents } from "@/lib/analytics";

function normalizeDateForInput(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = raw.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return "";
}

export default function NewVerificationClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [company, setCompany] = useState(searchParams?.get("company") || "");
  const [position, setPosition] = useState(searchParams?.get("position") || "");
  const [start, setStart] = useState(normalizeDateForInput(searchParams?.get("start") || ""));
  const [end, setEnd] = useState(normalizeDateForInput(searchParams?.get("end") || ""));
  const [sourceProfileExperienceId] = useState(searchParams?.get("source_profile_experience_id") || "");
  const [companyEmail, setCompanyEmail] = useState(searchParams?.get("company_email") || "");
  const [isCurrent, setIsCurrent] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState("Solicitar verificación a empresa");

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(companyEmail || "").trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    if (!emailIsValid) {
      setErr("Introduce un email válido.");
      return;
    }
    if (!sourceProfileExperienceId) {
      setErr("Falta la experiencia asociada. Inicia la solicitud desde tu sección de experiencia.");
      return;
    }
    setSaving(true);
    setButtonLabel("Enviando solicitud...");

    try {
      const { data: au } = await supabase.auth.getUser();
      if (!au.user) {
        router.replace("/login?next=/candidate/verifications/new");
        return;
      }

      const res = await fetch("/api/candidate/verification/create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employment_record_id: sourceProfileExperienceId,
          company_name_freeform: company,
          company_email: companyEmail,
          position,
          start_date: start,
          end_date: isCurrent ? null : end,
          is_current: isCurrent,
          source_profile_experience_id: sourceProfileExperienceId || null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "No se pudo crear la solicitud de verificación");
      }

      const vid = (json?.verification_request_id || json?.verification_id) as string | undefined;
      if (!vid) throw new Error("Respuesta inválida (sin verification_id)");

      vjEvents.verification_created(vid);
      setSuccess("Solicitud enviada correctamente.");
      setButtonLabel("Solicitud enviada");
      setTimeout(() => {
        router.replace(`/candidate/verification?verification_request_id=${encodeURIComponent(vid)}`);
        router.refresh();
      }, 700);
    } catch (e: any) {
      setErr(e?.message || "No hemos podido enviar la solicitud. Revisa el email o inténtalo de nuevo.");
      setButtonLabel("Solicitar verificación a empresa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10">
      <h1 className="text-2xl font-semibold">Nueva solicitud de verificación</h1>
      <p className="mt-2 text-sm text-gray-600">Solicita la verificación de una experiencia laboral concreta y continúa con evidencias si lo necesitas.</p>

      {err && (
        <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
{err}
        </pre>
      )}
      {success && <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-700">{success}</div>}

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
          <label className="block text-sm font-medium">Email de la persona o empresa que puede validar esta experiencia</label>
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
            onChange={(e) => {
              const next = e.target.checked;
              setIsCurrent(next);
              if (next) setEnd("");
            }}
          />
          Sigo actualmente en este puesto
        </label>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Enviando solicitud..." : buttonLabel}
        </button>
      </form>
    </div>
  );
}
