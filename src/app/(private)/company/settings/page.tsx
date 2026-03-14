"use client";

import { useEffect, useState } from "react";

type Settings = {
  show_risk_panel: boolean;
  show_reuse_hints: boolean;
};

type SettingsMeta = {
  available?: boolean;
  warning_message?: string | null;
} | null;

type CompanyProfileSummary = {
  trade_name?: string | null;
  contact_email?: string | null;
  company_verification_review_status?: string | null;
};

function ToggleCard({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`shrink-0 inline-flex h-9 w-16 items-center rounded-full border transition ${checked ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-slate-100"}`}
        aria-pressed={checked}
      >
        <span className={`h-7 w-7 rounded-full bg-white shadow transition ${checked ? "translate-x-8" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function verificationLabel(raw: unknown) {
  const value = String(raw || "").toLowerCase();
  if (value === "verified") return "Verificada";
  if (value === "pending_review") return "Pendiente de revisión";
  if (value === "rejected") return "Rechazada";
  return "Sin verificar";
}

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsMeta, setSettingsMeta] = useState<SettingsMeta>(null);
  const [profileSummary, setProfileSummary] = useState<CompanyProfileSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [settingsRes, profileRes] = await Promise.all([
        fetch("/api/company/settings", { cache: "no-store" as any }),
        fetch("/api/company/profile", { cache: "no-store" as any }),
      ]);

      const [settingsData, profileData] = await Promise.all([
        settingsRes.json().catch(() => ({})),
        profileRes.json().catch(() => ({})),
      ]);

      if (!settingsRes.ok) {
        setError(settingsData?.error || "No se pudieron cargar los ajustes.");
      } else {
        setSettings(settingsData.settings || { show_risk_panel: true, show_reuse_hints: true });
        setSettingsMeta(settingsData.settings_meta || null);
      }

      if (profileRes.ok) {
        setProfileSummary({
          trade_name: profileData?.profile?.trade_name || null,
          contact_email: profileData?.profile?.contact_email || null,
          company_verification_review_status: profileData?.profile?.company_verification_review_status || null,
        });
      }
    })();
  }, []);

  async function persist(next: Settings) {
    setSettings(next);
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/company/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data?.error || "No se pudieron guardar los ajustes.");
      return;
    }
    setSettingsMeta(data?.settings_meta || null);
    setMessage(
      data?.settings_meta?.available === false
        ? data?.settings_meta?.warning_message || "Los cambios se han aplicado en la interfaz, pero no se persisten en esta base."
        : "Ajustes guardados correctamente."
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Ajustes del panel empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ajusta qué señales quieres ver primero y mantén a mano la configuración operativa clave.
        </p>
        {saving ? <p className="mt-3 text-xs text-slate-500">Guardando cambios…</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {settingsMeta?.warning_message ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {settingsMeta.warning_message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="grid gap-3 md:grid-cols-2">
          {settings ? (
            <>
              <ToggleCard
                label="Mostrar señales de revisión"
                helper="Da prioridad a incidencias, rechazos y puntos que requieren atención inmediata en el panel."
                checked={settings.show_risk_panel}
                onChange={(value) => persist({ ...settings, show_risk_panel: value })}
              />
              <ToggleCard
                label="Mostrar ayuda de reutilización"
                helper="Mantiene visible una explicación breve para aprovechar verificaciones ya realizadas."
                checked={settings.show_reuse_hints}
                onChange={(value) => persist({ ...settings, show_reuse_hints: value })}
              />
            </>
          ) : (
            <p className="text-sm text-slate-600">Cargando ajustes…</p>
          )}
        </section>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Resumen operativo</h2>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Empresa</p>
              <p className="mt-1 font-semibold text-slate-900">{profileSummary?.trade_name || "Perfil empresa"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contacto principal</p>
              <p className="mt-1 font-semibold text-slate-900">{profileSummary?.contact_email || "Sin email de contacto"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Verificación empresa</p>
              <p className="mt-1 font-semibold text-slate-900">{verificationLabel(profileSummary?.company_verification_review_status)}</p>
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Accesos directos</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <a href="/company/profile" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Perfil empresa</p>
            <p className="mt-1 text-sm text-slate-600">Editar identidad, contratación y documentación.</p>
          </a>
          <a href="/company/team" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Equipo y permisos</p>
            <p className="mt-1 text-sm text-slate-600">Gestionar miembros, plazas e invitaciones.</p>
          </a>
          <a href="/company/subscription" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100">
            <p className="text-sm font-semibold text-slate-900">Suscripción</p>
            <p className="mt-1 text-sm text-slate-600">Revisar plan actual y ampliar capacidad.</p>
          </a>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Qué sí puedes controlar ahora</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>• Prioridad visual de señales de revisión en el dashboard.</li>
          <li>• Visibilidad de ayudas de reutilización para el equipo.</li>
          <li>• Acceso rápido a perfil, equipo y suscripción sin salir del área empresa.</li>
        </ul>
      </section>
    </div>
  );
}
