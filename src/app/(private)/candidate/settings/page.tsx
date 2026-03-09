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
  { value: "temporal_proyectos", label: "Temporal / por proyectos" },
  { value: "flexible", label: "Flexible" },
];

const ROLE_OPTIONS = [
  { value: "atencion_cliente", label: "Atención al cliente" },
  { value: "administracion", label: "Administración" },
  { value: "operaciones", label: "Operaciones" },
  { value: "ventas", label: "Ventas" },
  { value: "produccion", label: "Producción" },
  { value: "logistica", label: "Logística" },
  { value: "soporte_tecnico", label: "Soporte técnico" },
  { value: "otros", label: "Otros" },
];

const SCHEDULE_OPTIONS = [
  { value: "mananas", label: "Mañanas" },
  { value: "tardes", label: "Tardes" },
  { value: "noches", label: "Noches" },
  { value: "horario_flexible", label: "Horario flexible" },
  { value: "turnos_rotativos", label: "Turnos rotativos" },
];

function normalizeLegacyWorkday(value: string) {
  if (value === "extras_eventos" || value === "fines_semana") return "temporal_proyectos";
  return value;
}

function normalizeLegacyRole(value: string) {
  const map: Record<string, string> = {
    sala: "atencion_cliente",
    barra: "atencion_cliente",
    cocina: "produccion",
    recepcion: "administracion",
    limpieza: "operaciones",
    encargado_supervision: "operaciones",
  };
  return map[value] || value;
}

function normalizeLegacySchedule(value: string) {
  if (value === "fines_semana") return "horario_flexible";
  return value;
}

function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-gray-200 rounded-2xl p-4">
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
      if (!r.ok) { setErr(j?.error || "No se pudieron cargar los ajustes."); return; }
      const loaded: Settings = {
        show_trust_score: !!j?.settings?.show_trust_score,
        show_verification_counts: !!j?.settings?.show_verification_counts,
        show_verified_timeline: !!j?.settings?.show_verified_timeline,
        allow_company_email_contact: !!j?.settings?.allow_company_email_contact,
        allow_company_phone_contact: !!j?.settings?.allow_company_phone_contact,
        job_search_status: String(j?.settings?.job_search_status || "abierto_oportunidades"),
        availability_start: String(j?.settings?.availability_start || "mas_adelante"),
        preferred_workday: normalizeLegacyWorkday(String(j?.settings?.preferred_workday || "flexible")),
        preferred_roles: Array.isArray(j?.settings?.preferred_roles)
          ? Array.from(new Set(j.settings.preferred_roles.map((x: string) => normalizeLegacyRole(String(x)))))
          : [],
        work_zones: String(j?.settings?.work_zones || ""),
        availability_schedule: Array.isArray(j?.settings?.availability_schedule)
          ? Array.from(new Set(j.settings.availability_schedule.map((x: string) => normalizeLegacySchedule(String(x)))))
          : [],
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
      setErr(j?.error ? `${j.error}${j.details ? `: ${j.details}` : ""}` : "No se pudieron guardar los ajustes.");
      return;
    }
    setInitial(s);
    setOk("Cambios guardados correctamente.");
  }

  const hasChanges = !!(s && initial && JSON.stringify(s) !== JSON.stringify(initial));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-3xl shadow-sm p-7">
        <div className="text-2xl font-semibold text-gray-900">Ajustes</div>
        <div className="mt-2 text-sm text-gray-600">
          Aquí gestionas privacidad, visibilidad, contacto y disponibilidad profesional.
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Los datos de identidad personal se editan en la sección Perfil.
        </div>
        {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
      </div>

      {s ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="text-base font-semibold text-gray-900">Visibilidad de credibilidad</div>
                <div className="mt-3 space-y-3">
                  <Toggle
                    label="Mostrar Trust Score"
                    checked={s.show_trust_score}
                    onChange={(v) => setPatch({ show_trust_score: v })}
                    help="Puedes ocultarlo en el perfil compartido para reforzar privacidad."
                  />
                  <Toggle
                    label="Mostrar número de verificaciones (total + por tipo)"
                    checked={s.show_verification_counts}
                    onChange={(v) => setPatch({ show_verification_counts: v })}
                    help="Se mostrará en CV compartido/exportado para reflejar credibilidad real."
                  />
                  <Toggle
                    label="Mostrar cronología verificada (CV + verificaciones)"
                    checked={s.show_verified_timeline}
                    onChange={(v) => setPatch({ show_verified_timeline: v })}
                    help="Si lo ocultas, la empresa verá menos señal (pero siempre respetamos tu privacidad)."
                  />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5">
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
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="text-base font-semibold text-gray-900">Disponibilidad profesional</div>
              <div className="mt-2 text-sm text-gray-600">
                Completa esta información para ayudar a las empresas registradas a entender tu disponibilidad y tipo de oportunidad profesional que buscas.
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
                  label="Áreas o funciones de interés"
                  options={ROLE_OPTIONS}
                  selected={s.preferred_roles}
                  onChange={(v) => setPatch({ preferred_roles: Array.from(new Set(v)) })}
                />
                <label className="block">
                  <div className="text-sm font-semibold text-gray-900">Zona o zonas donde prefieres trabajar</div>
                  <input
                    type="text"
                    value={s.work_zones}
                    onChange={(e) => setPatch({ work_zones: e.target.value })}
                    placeholder="Ej.: Madrid centro, Chamberí y Salamanca"
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    Puedes indicar ciudades, zonas o áreas donde te gustaría trabajar.
                  </div>
                </label>
                <MultiSelectChecks
                  label="Disponibilidad horaria"
                  options={SCHEDULE_OPTIONS}
                  selected={s.availability_schedule}
                  onChange={(v) => setPatch({ availability_schedule: Array.from(new Set(v)) })}
                />
              </div>
            </div>
          </div>

          <div className="pb-28" />
        </div>
      ) : (
        <div className="text-sm text-gray-600">Cargando…</div>
      )}

      {s ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-6 py-3">
            <div className="min-w-0">
              {saving ? <div className="text-sm text-gray-600">Guardando cambios…</div> : null}
              {!saving && ok ? <div className="text-sm font-semibold text-green-700">{ok}</div> : null}
              {!saving && !ok && hasChanges ? <div className="text-sm text-gray-600">Tienes cambios pendientes de guardar.</div> : null}
              {!saving && !ok && !hasChanges ? <div className="text-sm text-gray-500">Todo guardado.</div> : null}
            </div>
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
