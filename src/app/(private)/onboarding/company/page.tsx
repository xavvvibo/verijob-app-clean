"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  COMPANY_BUSINESS_MODEL_OPTIONS,
  COMPANY_MARKET_SEGMENT_OPTIONS,
  COMPANY_SECTOR_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  getCompanySubsectorOptions,
} from "@/lib/company/company-profile";

type CompanyProfile = Record<string, any>;
type FieldErrors = {
  legal_name?: string;
  contact_email?: string;
  sector?: string;
};

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
        company_type: p.company_type || "",
        sector: p.sector || "",
        subsector: p.subsector || "",
        business_model: p.business_model || "",
        market_segment: p.market_segment || "",
        operating_address: p.operating_address || "",
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
  const subsectorOptions = useMemo(() => getCompanySubsectorOptions(profile.sector), [profile.sector]);
  const emailValue = String(profile.contact_email || "").trim();
  const isValid =
    String(profile.legal_name || "").trim() !== "" &&
    emailValue !== "" &&
    emailValue.includes("@") &&
    String(profile.sector || "").trim() !== "";

  function setField(key: string, value: string) {
    setFieldErrors((prev) => {
      if (!prev[key as keyof FieldErrors]) return prev;
      const next = { ...prev };
      delete next[key as keyof FieldErrors];
      return next;
    });
    setProfile((prev) => {
      if (key === "sector") {
        const nextSubsectors = getCompanySubsectorOptions(value);
        const currentSubsector = String(prev.subsector || "");
        return {
          ...prev,
          sector: value,
          subsector: nextSubsectors.includes(currentSubsector) ? currentSubsector : "",
        };
      }
      return { ...prev, [key]: value };
    });
  }

  function validateProfile(): FieldErrors {
    const nextErrors: FieldErrors = {};
    if (String(profile.legal_name || "").trim() === "") {
      nextErrors.legal_name = "Campo obligatorio";
    }
    const normalizedEmail = String(profile.contact_email || "").trim();
    if (normalizedEmail === "") {
      nextErrors.contact_email = "Campo obligatorio";
    } else if (!normalizedEmail.includes("@")) {
      nextErrors.contact_email = "Campo obligatorio";
    }
    if (String(profile.sector || "").trim() === "") {
      nextErrors.sector = "Campo obligatorio";
    }
    return nextErrors;
  }

  async function onSaveAndContinue() {
    const nextErrors = validateProfile();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setErr(null);
      setOk(null);
      return;
    }

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
        company_type: profile.company_type || null,
        sector: profile.sector || null,
        subsector: profile.subsector || null,
        business_model: profile.business_model || null,
        market_segment: profile.market_segment || null,
        operating_address: profile.operating_address || null,
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
              <div className="space-y-1">
                <input value={profile.legal_name || ""} onChange={(e) => setField("legal_name", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                {fieldErrors.legal_name ? <p className="text-xs text-rose-600">{fieldErrors.legal_name}</p> : null}
              </div>
            </Field>
            <Field label="Nombre comercial">
              <input value={profile.trade_name || ""} onChange={(e) => setField("trade_name", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="CIF/NIF">
              <input value={profile.tax_id || ""} onChange={(e) => setField("tax_id", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Tipo de empresa">
              <select value={profile.company_type || ""} onChange={(e) => setField("company_type", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm">
                <option value="">Selecciona tipo</option>
                {COMPANY_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email corporativo">
              <div className="space-y-1">
                <input value={profile.contact_email || ""} onChange={(e) => setField("contact_email", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
                {fieldErrors.contact_email ? <p className="text-xs text-rose-600">{fieldErrors.contact_email}</p> : null}
              </div>
            </Field>
            <Field label="Teléfono">
              <input value={profile.contact_phone || ""} onChange={(e) => setField("contact_phone", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm" />
            </Field>
            <Field label="Sector">
              <div className="space-y-1">
                <select value={profile.sector || ""} onChange={(e) => setField("sector", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm">
                  <option value="">Selecciona sector</option>
                  {COMPANY_SECTOR_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {fieldErrors.sector ? <p className="text-xs text-rose-600">{fieldErrors.sector}</p> : null}
              </div>
            </Field>
            <Field label="Subsector">
              <select value={profile.subsector || ""} onChange={(e) => setField("subsector", e.target.value)} disabled={!profile.sector} className="w-full rounded-xl border px-3 py-2.5 text-sm disabled:bg-slate-50">
                <option value="">{profile.sector ? "Selecciona subsector" : "Selecciona antes un sector"}</option>
                {subsectorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Modelo de negocio">
              <select value={profile.business_model || ""} onChange={(e) => setField("business_model", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm">
                <option value="">Selecciona modelo</option>
                {COMPANY_BUSINESS_MODEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Segmento de mercado">
              <select value={profile.market_segment || ""} onChange={(e) => setField("market_segment", e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-sm">
                <option value="">Selecciona segmento</option>
                {COMPANY_MARKET_SEGMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
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
            <Field label="Dirección operativa">
              <div className="space-y-1">
                <input
                  value={profile.operating_address || ""}
                  onChange={(e) => setField("operating_address", e.target.value)}
                  placeholder="Calle, número, nave o centro de trabajo"
                  autoComplete="street-address"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm"
                />
                <p className="text-xs text-slate-500">Usa la dirección del centro operativo principal. Ciudad, provincia y código postal se completan después en el perfil.</p>
              </div>
            </Field>
          </div>

          {err ? <p className="mt-4 text-sm text-rose-600">{err}</p> : null}
          {ok ? <p className="mt-4 text-sm text-emerald-700">{ok}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSaveAndContinue}
              disabled={saving || !isValid}
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
