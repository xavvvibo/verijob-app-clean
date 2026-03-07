"use client";

import { useEffect, useState } from "react";

type Settings = {
  show_trust_score: boolean;
  show_verification_counts: boolean;
  show_verified_timeline: boolean;
  allow_company_email_contact: boolean;
  allow_company_phone_contact: boolean;
  job_search_status: string;
  availability_start: string;
  preferred_workday: string;
  preferred_roles: string[];
  work_zones: string;
  availability_schedule: string[];
};

const JOB_SEARCH_OPTIONS = [
  { value: "buscando_activamente", label: "Buscando activamente" },
  { value: "abierto_oportunidades", label: "Abierto a oportunidades" },
  { value: "no_disponible", label: "No disponible" },
];

const AVAILABILITY_START_OPTIONS = [
  { value: "inmediata", label: "Inmediata" },
  { value: "7_dias", label: "En 7 días" },
  { value: "15_dias", label: "En 15 días" },
  { value: "30_dias", label: "En 30 días" },
  { value: "mas_adelante", label: "Más adelante" },
];

const WORKDAY_OPTIONS = [
  { value: "jornada_completa", label: "Jornada completa" },
  { value: "media_jornada", label: "Media jornada" },
  { value: "extras_eventos", label: "Extras y eventos" },
  { value: "fines_semana", label: "Fines de semana" },
  { value: "flexible", label: "Flexible" },
];

const ROLE_OPTIONS = [
  { value: "sala", label: "Sala" },
  { value: "barra", label: "Barra" },
  { value: "cocina", label: "Cocina" },
  { value: "recepcion", label: "Recepción" },
  { value: "limpieza", label: "Limpieza" },
  { value: "encargado_supervision", label: "Encargado / supervisión" },
  { value: "otros", label: "Otros" },
];

const SCHEDULE_OPTIONS = [
  { value: "mananas", label: "Mañanas" },
  { value: "tardes", label: "Tardes" },
  { value: "noches", label: "Noches" },
  { value: "fines_semana", label: "Fines de semana" },
  { value: "turnos_rotativos", label: "Turnos rotativos" },
];

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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiSelectChecks({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-gray-900">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  onChange(e.target.checked ? [...selected, o.value] : selected.filter((x) => x !== o.value))
                }
              />
              <span>{o.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
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
      const loaded: Settings = {
        show_trust_score: !!j?.settings?.show_trust_score,
        show_verification_counts: !!j?.settings?.show_verification_counts,
        show_verified_timeline: !!j?.settings?.show_verified_timeline,
        allow_company_email_contact: !!j?.settings?.allow_company_email_contact,
        allow_company_phone_contact: !!j?.settings?.allow_company_phone_contact,
        job_search_status: String(j?.settings?.job_search_status || "abierto_oportunidades"),
        availability_start: String(j?.settings?.availability_start || "mas_adelante"),
        preferred_workday: String(j?.settings?.preferred_workday || "flexible"),
        preferred_roles: Array.isArray(j?.settings?.preferred_roles) ? j.settings.preferred_roles : [],
        work_zones: String(j?.settings?.work_zones || ""),
        availability_schedule: Array.isArray(j?.settings?.availability_schedule) ? j.settings.availability_schedule : [],
      };
      setS(loaded);
      setInitial(loaded);
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

          <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-6">
            <div className="text-base font-semibold text-gray-900">Disponibilidad laboral</div>
            <div className="mt-2 text-sm text-gray-600">
              Completa esta información para que las empresas registradas entiendan mejor tu disponibilidad y encaje profesional.
            </div>

            <div className="mt-4 grid gap-4">
              <SelectField
                label="Estado de búsqueda"
                value={s.job_search_status}
                onChange={(v) => setPatch({ job_search_status: v })}
                options={JOB_SEARCH_OPTIONS}
              />
              <SelectField
                label="Incorporación"
                value={s.availability_start}
                onChange={(v) => setPatch({ availability_start: v })}
                options={AVAILABILITY_START_OPTIONS}
              />
              <SelectField
                label="Jornada preferida"
                value={s.preferred_workday}
                onChange={(v) => setPatch({ preferred_workday: v })}
                options={WORKDAY_OPTIONS}
              />
              <MultiSelectChecks
                label="Roles preferidos"
                options={ROLE_OPTIONS}
                selected={s.preferred_roles}
                onChange={(v) => setPatch({ preferred_roles: Array.from(new Set(v)) })}
              />
              <label className="block">
                <div className="text-sm font-semibold text-gray-900">Zonas de trabajo</div>
                <input
                  type="text"
                  value={s.work_zones}
                  onChange={(e) => setPatch({ work_zones: e.target.value })}
                  placeholder="Ej.: Madrid centro, Chamberí y Salamanca"
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                />
              </label>
              <MultiSelectChecks
                label="Disponibilidad horaria"
                options={SCHEDULE_OPTIONS}
                selected={s.availability_schedule}
                onChange={(v) => setPatch({ availability_schedule: Array.from(new Set(v)) })}
              />
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
