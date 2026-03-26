"use client";

import { useEffect, useState } from "react";
import CandidateFormLayout from "@/components/candidate-v2/layouts/CandidateFormLayout";
import CandidatePageHeader from "@/components/candidate-v2/primitives/CandidatePageHeader";
import CandidateSaveBar from "@/components/candidate-v2/forms/CandidateSaveBar";

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

type CandidateAccount = {
  lifecycle_status: string;
  deleted_at: string | null;
  deletion_requested_at: string | null;
  deletion_mode: string | null;
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

function lifecycleLabel(raw: unknown) {
  const value = String(raw || "active").toLowerCase();
  if (value === "disabled") return "Desactivado temporalmente";
  if (value === "scheduled_for_deletion") return "Pendiente de eliminación";
  if (value === "deleted") return "Eliminado";
  return "Activo";
}

function Toggle({ label, checked, onChange, help }: { label: string; checked: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 p-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        {help ? <div className="mt-1 text-xs text-gray-500">{help}</div> : null}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`inline-flex h-9 w-16 shrink-0 items-center rounded-full border transition ${checked ? "border-blue-600 bg-blue-600" : "border-gray-200 bg-gray-100"}`}
        aria-pressed={checked}
      >
        <span className={`h-7 w-7 rounded-full bg-white shadow transition ${checked ? "translate-x-8" : "translate-x-1"}`} />
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
                onChange={(e) => onChange(e.target.checked ? [...selected, o.value] : selected.filter((x) => x !== o.value))}
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
  const [settings, setSettings] = useState<Settings | null>(null);
  const [initial, setInitial] = useState<Settings | null>(null);
  const [account, setAccount] = useState<CandidateAccount | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [disableConfirmed, setDisableConfirmed] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [resetCandidateConfirmation, setResetCandidateConfirmation] = useState("");

  useEffect(() => {
    (async () => {
      const [settingsRes, accountRes] = await Promise.all([
        fetch("/api/candidate/settings", { cache: "no-store" as any }),
        fetch("/api/candidate/account", { cache: "no-store" as any }),
      ]);
      const [settingsJson, accountJson] = await Promise.all([
        settingsRes.json().catch(() => ({})),
        accountRes.json().catch(() => ({})),
      ]);

      if (!settingsRes.ok) {
        setErr(settingsJson?.error || "No se pudieron cargar los ajustes.");
      } else {
        const loaded: Settings = {
          show_trust_score: !!settingsJson?.settings?.show_trust_score,
          show_verification_counts: !!settingsJson?.settings?.show_verification_counts,
          show_verified_timeline: !!settingsJson?.settings?.show_verified_timeline,
          allow_company_email_contact: !!settingsJson?.settings?.allow_company_email_contact,
          allow_company_phone_contact: !!settingsJson?.settings?.allow_company_phone_contact,
          job_search_status: String(settingsJson?.settings?.job_search_status || "abierto_oportunidades"),
          availability_start: String(settingsJson?.settings?.availability_start || "mas_adelante"),
          preferred_workday: normalizeLegacyWorkday(String(settingsJson?.settings?.preferred_workday || "flexible")),
          preferred_roles: Array.isArray(settingsJson?.settings?.preferred_roles)
            ? Array.from(new Set(settingsJson.settings.preferred_roles.map((x: string) => normalizeLegacyRole(String(x)))))
            : [],
          work_zones: String(settingsJson?.settings?.work_zones || ""),
          availability_schedule: Array.isArray(settingsJson?.settings?.availability_schedule)
            ? Array.from(new Set(settingsJson.settings.availability_schedule.map((x: string) => normalizeLegacySchedule(String(x)))))
            : [],
        };
        setSettings(loaded);
        setInitial(loaded);
      }

      if (accountRes.ok) {
        const nextAccount: CandidateAccount = {
          lifecycle_status: String(accountJson?.account?.lifecycle_status || "active"),
          deleted_at: accountJson?.account?.deleted_at || null,
          deletion_requested_at: accountJson?.account?.deletion_requested_at || null,
          deletion_mode: accountJson?.account?.deletion_mode || null,
        };
        setAccount(nextAccount);
      } else {
        setAccountError(accountJson?.error || "No se pudo cargar el estado de la cuenta.");
      }
    })();
  }, []);

  function setPatch(patch: Partial<Settings>) {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
    setOk(null);
    setErr(null);
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    setErr(null);
    setOk(null);
    const response = await fetch("/api/candidate/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setErr(payload?.error ? `${payload.error}${payload.details ? `: ${payload.details}` : ""}` : "No se pudieron guardar los ajustes.");
      return;
    }
    setInitial(settings);
    setOk("Cambios guardados correctamente.");
  }

  async function runAccountAction(action: string, extra?: Record<string, any>) {
    setAccountSaving(true);
    setAccountMessage(null);
    setAccountError(null);
    const response = await fetch("/api/candidate/account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const payload = await response.json().catch(() => ({}));
    setAccountSaving(false);
    if (!response.ok) {
      setAccountError(payload?.user_message || payload?.error || "No se pudo completar la acción.");
      return null;
    }
    if (payload?.account) {
      setAccount((current) => ({
        lifecycle_status: payload.account.lifecycle_status ?? current?.lifecycle_status ?? "active",
        deleted_at: payload.account.deleted_at ?? current?.deleted_at ?? null,
        deletion_requested_at: payload.account.deletion_requested_at ?? current?.deletion_requested_at ?? null,
        deletion_mode: payload.account.deletion_mode ?? current?.deletion_mode ?? null,
      }));
    }
    setAccountMessage(payload?.user_message || "Acción completada correctamente.");
    return payload;
  }

  async function deleteProfile() {
    const result = await runAccountAction("delete_profile");
    if (result?.ok) {
      window.setTimeout(() => {
        window.location.href = "/login?account_deleted=1";
      }, 900);
    }
  }

  async function resetCandidateForQa() {
    const result = await runAccountAction("reset_candidate_for_qa", {
      confirm_phrase: resetCandidateConfirmation,
    });
    if (result?.ok) {
      window.setTimeout(() => {
        window.location.href = "/candidate/onboarding?qa_reset=1";
      }, 900);
    }
  }

  const hasChanges = !!(settings && initial && JSON.stringify(settings) !== JSON.stringify(initial));
  const isDisabled = String(account?.lifecycle_status || "active").toLowerCase() === "disabled";
  const isDeleted = String(account?.lifecycle_status || "active").toLowerCase() === "deleted";

  return (
    <CandidateFormLayout>
      <CandidatePageHeader
        eyebrow="Ajustes"
        title="Controla la visibilidad y el estado de tu perfil"
        description="Gestiona privacidad, contacto, disponibilidad profesional y las acciones críticas de tu cuenta sin perder contexto."
        badges={["Privacidad", "Contacto", "Disponibilidad"]}
        variant="management"
      />
      {err ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div> : null}

      {settings ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="text-base font-semibold text-gray-900">Visibilidad de credibilidad</div>
                <div className="mt-3 space-y-3">
                  <Toggle
                    label="Mostrar Trust Score"
                    checked={settings.show_trust_score}
                    onChange={(v) => setPatch({ show_trust_score: v })}
                    help="Puedes ocultarlo en el perfil compartido para reforzar privacidad."
                  />
                  <Toggle
                    label="Mostrar número de verificaciones"
                    checked={settings.show_verification_counts}
                    onChange={(v) => setPatch({ show_verification_counts: v })}
                    help="Se mostrará en CV compartido y exportado como señal de confianza."
                  />
                  <Toggle
                    label="Mostrar cronología verificada"
                    checked={settings.show_verified_timeline}
                    onChange={(v) => setPatch({ show_verified_timeline: v })}
                    help="Si la ocultas, compartes menos señal histórica en el perfil público."
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <div className="text-base font-semibold text-gray-900">Configuración de contacto</div>
                <div className="mt-2 text-sm text-gray-600">
                  Decide si las empresas registradas pueden ver tus métodos de contacto directo en el perfil ampliado.
                </div>
                <div className="mt-4 space-y-3">
                  <Toggle
                    label="Mostrar email a empresas registradas"
                    checked={settings.allow_company_email_contact}
                    onChange={(v) => setPatch({ allow_company_email_contact: v })}
                  />
                  <Toggle
                    label="Mostrar teléfono a empresas registradas"
                    checked={settings.allow_company_phone_contact}
                    onChange={(v) => setPatch({ allow_company_phone_contact: v })}
                  />
                </div>
                <div className="mt-3 text-xs text-gray-500">Estos datos no se mostrarán en tu perfil público abierto.</div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="text-base font-semibold text-gray-900">Disponibilidad profesional</div>
              <div className="mt-2 text-sm text-gray-600">
                Completa esta información para ayudar a las empresas registradas a entender tu disponibilidad real.
              </div>

              <div className="mt-4 grid gap-4">
                <SelectField
                  label="Estado de búsqueda"
                  value={settings.job_search_status}
                  onChange={(v) => setPatch({ job_search_status: v })}
                  options={JOB_SEARCH_OPTIONS}
                />
                <SelectField
                  label="Incorporación"
                  value={settings.availability_start}
                  onChange={(v) => setPatch({ availability_start: v })}
                  options={AVAILABILITY_START_OPTIONS}
                />
                <SelectField
                  label="Jornada preferida"
                  value={settings.preferred_workday}
                  onChange={(v) => setPatch({ preferred_workday: v })}
                  options={WORKDAY_OPTIONS}
                />
                <MultiSelectChecks
                  label="Áreas o funciones de interés"
                  options={ROLE_OPTIONS}
                  selected={settings.preferred_roles}
                  onChange={(v) => setPatch({ preferred_roles: Array.from(new Set(v)) })}
                />
                <label className="block">
                  <div className="text-sm font-semibold text-gray-900">Zona o zonas donde prefieres trabajar</div>
                  <input
                    type="text"
                    value={settings.work_zones}
                    onChange={(e) => setPatch({ work_zones: e.target.value })}
                    placeholder="Ej.: Madrid centro, Chamberí y Salamanca"
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900"
                  />
                </label>
                <MultiSelectChecks
                  label="Disponibilidad horaria"
                  options={SCHEDULE_OPTIONS}
                  selected={settings.availability_schedule}
                  onChange={(v) => setPatch({ availability_schedule: Array.from(new Set(v)) })}
                />
              </div>
            </div>
          </div>

          <section className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Gestión de perfil / cuenta</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Controla el estado de tu perfil. El documento de identidad ahora se gestiona dentro de tus datos personales.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Estado: {lifecycleLabel(account?.lifecycle_status)}
              </div>
            </div>

            {accountError ? <p className="mt-4 text-sm text-rose-600">{accountError}</p> : null}
            {accountMessage ? <p className="mt-4 text-sm text-emerald-700">{accountMessage}</p> : null}

            <div className="mt-6 grid gap-4">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">Documento de identidad</h3>
                <p className="mt-2 text-sm text-slate-600">
                  El DNI, NIE o pasaporte se edita en <a className="font-semibold text-slate-900 underline" href="/candidate/profile">Datos personales</a>. Allí se genera automáticamente la máscara visible y el hash interno.
                </p>
              </section>

              <section className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="text-sm font-semibold text-amber-950">Desactivar perfil temporalmente</h3>
                  <p className="mt-2 text-sm text-amber-900">
                    Tu perfil público dejará de estar disponible y no aparecerás como candidato activo, pero tus datos seguirán recuperables.
                  </p>
                  <label className="mt-4 flex items-start gap-2 text-sm text-amber-900">
                    <input type="checkbox" checked={disableConfirmed} onChange={(e) => setDisableConfirmed(e.target.checked)} />
                    <span>Entiendo que la desactivación oculta mi perfil y puedo reactivarlo más adelante.</span>
                  </label>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={accountSaving || isDisabled || isDeleted || !disableConfirmed}
                      onClick={() => runAccountAction("disable_profile")}
                      className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-amber-300"
                    >
                      Desactivar perfil
                    </button>
                    <button
                      type="button"
                      disabled={accountSaving || !isDisabled}
                      onClick={() => runAccountAction("reactivate_profile")}
                      className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reactivar perfil
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
                  <h3 className="text-sm font-semibold text-rose-950">Eliminar perfil definitivamente</h3>
                  <p className="mt-2 text-sm text-rose-900">
                    Esta acción es irreversible. El perfil público desaparecerá y conservaremos solo la información mínima necesaria para integridad técnica e histórica.
                  </p>
                  <p className="mt-2 text-sm text-rose-900">
                    Las verificaciones ya emitidas no se destruyen, pero el perfil y los enlaces públicos dejarán de estar disponibles.
                  </p>
                  <label className="mt-4 block">
                    <span className="text-sm font-semibold text-rose-950">Escribe ELIMINAR para confirmar</span>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={accountSaving || isDeleted || deleteConfirmation.trim().toUpperCase() !== "ELIMINAR"}
                    onClick={deleteProfile}
                    className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
                  >
                    Eliminar perfil definitivamente
                  </button>
                </div>

                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
                  <h3 className="text-sm font-semibold text-sky-950">Reset cuenta candidata de prueba</h3>
                  <p className="mt-2 text-sm text-sky-900">
                    Esta opción limpia tu workspace candidato de prueba para rehacer QA manual desde cero: perfil, experiencias, formación,
                    idiomas, logros, CV importado, foto, evidencias, verificaciones, enlaces públicos, onboarding y estado visible del plan.
                  </p>
                  <p className="mt-2 text-sm text-sky-900">
                    No elimina el usuario de Auth ni pretende destruir trazas mínimas técnicas que puedan quedar fuera del workspace operativo.
                  </p>
                  <label className="mt-4 block">
                    <span className="text-sm font-semibold text-sky-950">Escribe RESET CANDIDATO para confirmar</span>
                    <input
                      type="text"
                      value={resetCandidateConfirmation}
                      onChange={(e) => setResetCandidateConfirmation(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-sky-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={accountSaving || resetCandidateConfirmation.trim().toUpperCase() !== "RESET CANDIDATO"}
                    onClick={resetCandidateForQa}
                    className="mt-4 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-sky-300"
                  >
                    Reset cuenta candidata de prueba
                  </button>
                </div>
              </section>
            </div>
          </section>

          <div className="pb-28" />
        </div>
      ) : (
        <div className="text-sm text-gray-600">Cargando…</div>
      )}

      {settings ? (
        <CandidateSaveBar>
            <div className="min-w-0">
              {saving ? <div className="text-sm text-gray-600">Guardando cambios…</div> : null}
              {!saving && ok ? <div className="text-sm font-semibold text-green-700">{ok}</div> : null}
              {!saving && !ok && hasChanges ? <div className="text-sm text-gray-600">Tienes cambios pendientes de guardar.</div> : null}
              {!saving && !ok && !hasChanges ? <div className="text-sm text-gray-500">Todo guardado.</div> : null}
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || !hasChanges}
              className={`inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                saving || !hasChanges ? "cursor-not-allowed bg-gray-400" : "bg-slate-900 hover:bg-black"
              }`}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
        </CandidateSaveBar>
      ) : null}
    </CandidateFormLayout>
  );
}
