"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CompanyProfile = Record<string, any>;

const SECTORS = ["Hostelería", "Retail", "Logística", "Construcción", "Tecnología", "Servicios", "Otro"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export const dynamic = "force-dynamic";

export default function CompanyOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const blockedGate = searchParams.get("blocked") === "1";
  const source = searchParams.get("source");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfile>({
    legal_name: "",
    trade_name: "",
    tax_id: "",
    contact_email: "",
    contact_phone: "",
    contact_person_name: "",
    contact_person_role: "",
    sector: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      const res = await fetch("/api/company/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setErr(data?.details || data?.error || "No se pudo cargar el setup de empresa.");
        setLoading(false);
        return;
      }

      const p = data?.profile || {};
      setProfile((prev) => ({
        ...prev,
        legal_name: p.legal_name || "",
        trade_name: p.trade_name || "",
        tax_id: p.tax_id || "",
        contact_email: p.contact_email || "",
        contact_phone: p.contact_phone || "",
        contact_person_name: p.contact_person_name || "",
        contact_person_role: p.contact_person_role || "",
        sector: p.sector || "",
      }));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sourceLabel = useMemo(() => {
    if (source === "dashboard") return "dashboard";
    if (source === "company") return "panel de empresa";
    return "área privada";
  }, [source]);

  function setField(key: string, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  async function onSaveAndContinue() {
    setSaving(true);
    setErr(null);
    setOk(null);
    try {
      const payload = {
        legal_name: profile.legal_name || null,
        trade_name: profile.trade_name || null,
        tax_id: profile.tax_id || null,
        contact_email: profile.contact_email || null,
        contact_phone: profile.contact_phone || null,
        contact_person_name: profile.contact_person_name || null,
        contact_person_role: profile.contact_person_role || null,
        sector: profile.sector || null,
      };

      const saveRes = await fetch("/api/company/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        setErr(saveData?.details || saveData?.error || "No se pudo guardar el perfil de empresa.");
        return;
      }

      const completeRes = await fetch("/api/company/onboarding/complete", { method: "POST" });
      const completeData = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) {
        setErr(completeData?.details || completeData?.error || "No se pudo completar el onboarding de empresa.");
        return;
      }

      setOk("Setup de empresa completado. Redirigiendo al panel…");
      router.replace("/company");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "No se pudo completar el setup de empresa.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border bg-white p-8 shadow-sm">
          <div className="text-sm text-slate-600">Cargando setup de empresa…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Onboarding empresa</div>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">Activa tu entorno de empresa</h1>
          <p className="mt-3 text-sm text-slate-600">
            Completa los datos esenciales para operar verificaciones como empresa dentro de VERIJOB.
          </p>
          {blockedGate ? (
            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Acceso temporalmente bloqueado desde {sourceLabel}. Completa este setup para desbloquear el panel de empresa.
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border bg-white p-8 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Razón social">
              <input value={profile.legal_name || ""} onChange={(e) => setField("legal_name", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Nombre comercial">
              <input value={profile.trade_name || ""} onChange={(e) => setField("trade_name", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="CIF/NIF">
              <input value={profile.tax_id || ""} onChange={(e) => setField("tax_id", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Email corporativo">
              <input value={profile.contact_email || ""} onChange={(e) => setField("contact_email", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Teléfono">
              <input value={profile.contact_phone || ""} onChange={(e) => setField("contact_phone", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Sector">
              <select value={profile.sector || ""} onChange={(e) => setField("sector", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm">
                <option value="">Selecciona sector</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Persona de contacto">
              <input value={profile.contact_person_name || ""} onChange={(e) => setField("contact_person_name", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Cargo persona de contacto">
              <input value={profile.contact_person_role || ""} onChange={(e) => setField("contact_person_role", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
          </div>

          {err ? <p className="mt-4 text-sm text-rose-600">{err}</p> : null}
          {ok ? <p className="mt-4 text-sm text-emerald-700">{ok}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saving}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar y continuar"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

