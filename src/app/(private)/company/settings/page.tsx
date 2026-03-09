"use client";

import { useEffect, useState } from "react";

type Settings = {
  show_risk_panel: boolean;
  show_reuse_hints: boolean;
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
        className={`shrink-0 inline-flex h-9 w-16 items-center rounded-full border transition ${checked ? "border-blue-600 bg-blue-600" : "border-slate-200 bg-slate-100"}`}
        aria-pressed={checked}
      >
        <span className={`h-7 w-7 rounded-full bg-white shadow transition ${checked ? "translate-x-8" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/company/settings", { cache: "no-store" as any });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "No se pudieron cargar los ajustes.");
        return;
      }
      setSettings(data.settings || { show_risk_panel: true, show_reuse_hints: true });
    })();
  }, []);

  async function persist(next: Settings) {
    setSettings(next);
    setSaving(true);
    setError(null);
    const res = await fetch("/api/company/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) setError(data?.error || "No se pudieron guardar los ajustes.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Ajustes del área empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Personaliza la experiencia del command center para tu equipo sin afectar la privacidad de candidatos.
        </p>
        {saving ? <p className="mt-3 text-xs text-slate-500">Guardando cambios…</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      {settings ? (
        <section className="grid gap-3 md:grid-cols-2">
          <ToggleCard
            label="Mostrar panel de señales de riesgo"
            helper="Añade visibilidad operativa en el dashboard para incidencias de revisión y trazabilidad."
            checked={settings.show_risk_panel}
            onChange={(value) => persist({ ...settings, show_risk_panel: value })}
          />
          <ToggleCard
            label="Mostrar sugerencias de reutilización"
            helper="Presenta recomendaciones para reaprovechar verificaciones ya resueltas en nuevos procesos."
            checked={settings.show_reuse_hints}
            onChange={(value) => persist({ ...settings, show_reuse_hints: value })}
          />
        </section>
      ) : (
        <p className="text-sm text-slate-600">Cargando ajustes…</p>
      )}

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Qué controlan estos ajustes</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>• Orden y enfoque visual del dashboard para reviewers y administradores.</li>
          <li>• Señales de priorización para solicitudes de alta urgencia.</li>
          <li>• Orientación operativa sobre reutilización de verificaciones en curso.</li>
        </ul>
      </section>
    </div>
  );
}
