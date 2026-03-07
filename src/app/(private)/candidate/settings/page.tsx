"use client";

import { useEffect, useState } from "react";

type Settings = {
  show_trust_score: boolean;
  show_verification_counts: boolean;
  show_verified_timeline: boolean;
  allow_company_email_contact: boolean;
  allow_company_phone_contact: boolean;
};

function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border border-gray-200 rounded-2xl p-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        {help ? <div className="mt-1 text-xs text-gray-500">{help}</div> : null}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`shrink-0 inline-flex h-9 w-16 items-center rounded-full border transition ${checked ? "bg-blue-600 border-blue-600" : "bg-gray-100 border-gray-200"}`}
        aria-pressed={checked}
      >
        <span className={`h-7 w-7 rounded-full bg-white shadow transform transition ${checked ? "translate-x-8" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function CandidateSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [initial, setInitial] = useState<Settings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/candidate/settings", { cache: "no-store" as any });
      const j = await r.json();
      if (!r.ok) { setErr(j?.error || "load_failed"); return; }
      setS(j.settings);
      setInitial(j.settings);
    })();
  }, []);

  function setPatch(patch: Partial<Settings>) {
    if (!s) return;
    setS({ ...s, ...patch });
    setOk(null);
    setErr(null);
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    setErr(null);
    setOk(null);
    const r = await fetch("/api/candidate/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(s),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      setErr(j?.error ? `${j.error}${j.details ? `: ${j.details}` : ""}` : "save_failed");
      return;
    }
    setInitial(s);
    setOk("Cambios guardados correctamente.");
  }

  const hasChanges = !!(s && initial && JSON.stringify(s) !== JSON.stringify(initial));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-7">
        <div className="text-2xl font-semibold text-gray-900">Ajustes de privacidad</div>
        <div className="mt-2 text-sm text-gray-600">Controla qué se muestra en tu perfil y en el CV compartido/exportado.</div>
        {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
        {ok ? <div className="mt-3 text-sm text-green-700">{ok}</div> : null}
        {saving ? <div className="mt-3 text-xs text-gray-500">Guardando…</div> : null}
      </div>

      {s ? (
        <div className="space-y-3">
          <Toggle
            label="Mostrar Trust Score (rating)"
            checked={s.show_trust_score}
            onChange={(v) => setPatch({ show_trust_score: v })}
            help="RGPD: puedes ocultarlo en el perfil compartido y CV exportado."
          />
          <Toggle
            label="Mostrar número de verificaciones (total + por tipo)"
            checked={s.show_verification_counts}
            onChange={(v) => setPatch({ show_verification_counts: v })}
            help="Se mostrará en CV compartido/exportado para reflejar credibilidad real."
          />
          <Toggle
            label="Mostrar timeline verificada (CV + verificaciones)"
            checked={s.show_verified_timeline}
            onChange={(v) => setPatch({ show_verified_timeline: v })}
            help="Si lo ocultas, la empresa verá menos señal (pero siempre respetamos tu privacidad)."
          />

          <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-6">
            <div className="text-base font-semibold text-gray-900">Configuración de contacto</div>
            <div className="mt-2 text-sm text-gray-600">
              Decide si las empresas registradas en VERIJOB pueden ver métodos de contacto directo en tu perfil ampliado.
            </div>
            <div className="mt-4 space-y-3">
              <Toggle
                label="Mostrar email a empresas registradas"
                checked={s.allow_company_email_contact}
                onChange={(v) => setPatch({ allow_company_email_contact: v })}
              />
              <Toggle
                label="Mostrar teléfono a empresas registradas"
                checked={s.allow_company_phone_contact}
                onChange={(v) => setPatch({ allow_company_phone_contact: v })}
              />
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Estos datos no se mostrarán en tu perfil público abierto.
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || !hasChanges}
              className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                saving || !hasChanges ? "bg-gray-400 cursor-not-allowed" : "bg-blue-700 hover:bg-blue-800"
              }`}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            {hasChanges ? <div className="mt-2 text-xs text-gray-500">Tienes cambios pendientes de guardar.</div> : null}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">Cargando…</div>
      )}
    </div>
  );
}
