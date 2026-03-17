"use client";

import { useEffect, useState } from "react";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { companyVerificationMethodTone } from "@/lib/company/verification-method";

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
  legal_name?: string | null;
  display_name?: string | null;
  contact_email?: string | null;
  company_document_verification_status?: string | null;
  company_document_verification_label?: string | null;
  company_document_verification_detail?: string | null;
  company_document_review_eta_label?: string | null;
  company_document_review_priority_label?: string | null;
  company_document_latest_document_type?: string | null;
  company_document_last_submitted_at?: string | null;
  company_document_last_reviewed_at?: string | null;
  company_document_rejection_reason?: string | null;
  company_verification_method?: "domain" | "documents" | "both" | "none";
  company_verification_method_label?: string | null;
  company_verification_method_detail?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

type CompanyAccount = {
  user: {
    lifecycle_status: string;
    deleted_at: string | null;
    deletion_requested_at: string | null;
    deletion_mode: string | null;
  };
  company: {
    id: string;
    display_name: string;
    lifecycle_status: string;
    deleted_at: string | null;
    deletion_requested_at: string | null;
    identity_type: string | null;
    identity_masked: string | null;
    has_identity: boolean;
  };
  membership_role: string;
  can_manage_company: boolean;
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
        className={`inline-flex h-9 w-16 shrink-0 items-center rounded-full border transition ${checked ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-slate-100"}`}
        aria-pressed={checked}
      >
        <span className={`h-7 w-7 rounded-full bg-white shadow transition ${checked ? "translate-x-8" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

function verificationLabel(raw: unknown) {
  const value = String(raw || "").toLowerCase();
  if (value === "verified") return "Verificada documentalmente";
  if (value === "uploaded") return "Documento recibido";
  if (value === "under_review") return "En revisión";
  if (value === "rejected") return "Requiere corrección";
  return "Sin documento";
}

function lifecycleLabel(raw: unknown) {
  const value = String(raw || "active").toLowerCase();
  if (value === "disabled") return "Desactivado temporalmente";
  if (value === "scheduled_for_deletion") return "Pendiente de eliminación";
  if (value === "deleted") return "Cerrada / eliminada";
  return "Activo";
}

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsMeta, setSettingsMeta] = useState<SettingsMeta>(null);
  const [profileSummary, setProfileSummary] = useState<CompanyProfileSummary | null>(null);
  const [account, setAccount] = useState<CompanyAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [disableUserConfirmed, setDisableUserConfirmed] = useState(false);
  const [closeCompanyConfirmation, setCloseCompanyConfirmation] = useState("");
  const [deleteUserConfirmation, setDeleteUserConfirmation] = useState("");
  const [resetCompanyConfirmation, setResetCompanyConfirmation] = useState("");

  useEffect(() => {
    (async () => {
      const [settingsRes, profileRes, accountRes] = await Promise.all([
        fetch("/api/company/settings", { cache: "no-store" as any }),
        fetch("/api/company/profile", { cache: "no-store" as any }),
        fetch("/api/company/account", { cache: "no-store" as any }),
      ]);

      const [settingsData, profileData, accountData] = await Promise.all([
        settingsRes.json().catch(() => ({})),
        profileRes.json().catch(() => ({})),
        accountRes.json().catch(() => ({})),
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
          legal_name: profileData?.profile?.legal_name || null,
          display_name: profileData?.profile?.display_name || null,
          contact_email: profileData?.profile?.contact_email || null,
          company_document_verification_status: profileData?.profile?.company_document_verification_status || null,
          company_document_verification_label: profileData?.profile?.company_document_verification_label || null,
          company_document_verification_detail: profileData?.profile?.company_document_verification_detail || null,
          company_document_review_eta_label: profileData?.profile?.company_document_review_eta_label || null,
          company_document_review_priority_label: profileData?.profile?.company_document_review_priority_label || null,
          company_document_latest_document_type: profileData?.profile?.company_document_latest_document_type || null,
          company_document_last_submitted_at: profileData?.profile?.company_document_last_submitted_at || null,
          company_document_last_reviewed_at: profileData?.profile?.company_document_last_reviewed_at || null,
          company_document_rejection_reason: profileData?.profile?.company_document_rejection_reason || null,
          company_verification_method: profileData?.profile?.company_verification_method || "none",
          company_verification_method_label: profileData?.profile?.company_verification_method_label || null,
          company_verification_method_detail: profileData?.profile?.company_verification_method_detail || null,
        });
      }

      if (accountRes.ok) {
        const nextAccount: CompanyAccount = accountData.account;
        setAccount(nextAccount);
      } else {
        setAccountError(accountData?.error || "No se pudo cargar el estado de la cuenta empresa.");
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

  async function runAccountAction(action: string, extra?: Record<string, any>) {
    setAccountSaving(true);
    setAccountError(null);
    setAccountMessage(null);
    const response = await fetch("/api/company/account", {
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
        user: {
          lifecycle_status: payload.account.user?.lifecycle_status ?? current?.user.lifecycle_status ?? "active",
          deleted_at: payload.account.user?.deleted_at ?? current?.user.deleted_at ?? null,
          deletion_requested_at: payload.account.user?.deletion_requested_at ?? current?.user.deletion_requested_at ?? null,
          deletion_mode: payload.account.user?.deletion_mode ?? current?.user.deletion_mode ?? null,
        },
        company: {
          id: current?.company.id || "",
          display_name: current?.company.display_name || resolveCompanyDisplayName(profileSummary || null, "Tu empresa"),
          lifecycle_status: payload.account.company?.lifecycle_status ?? current?.company.lifecycle_status ?? "active",
          deleted_at: payload.account.company?.deleted_at ?? current?.company.deleted_at ?? null,
          deletion_requested_at: payload.account.company?.deletion_requested_at ?? current?.company.deletion_requested_at ?? null,
          identity_type: payload.account.company?.identity_type ?? current?.company.identity_type ?? null,
          identity_masked: payload.account.company?.identity_masked ?? current?.company.identity_masked ?? null,
          has_identity: payload.account.company?.has_identity ?? current?.company.has_identity ?? false,
        },
        membership_role: current?.membership_role || "reviewer",
        can_manage_company: current?.can_manage_company || false,
      }));
    }
    setAccountMessage(payload?.user_message || "Acción completada correctamente.");
    return payload;
  }

  async function deleteUser() {
    const result = await runAccountAction("delete_user");
    if (result?.ok) {
      window.setTimeout(() => {
        window.location.href = "/login?company_user_deleted=1";
      }, 900);
    }
  }

  async function resetCompanyForQa() {
    const result = await runAccountAction("reset_company_for_qa", {
      confirm_phrase: resetCompanyConfirmation,
    });
    if (result?.ok) {
      window.setTimeout(() => {
        window.location.href = "/onboarding/company?qa_reset=1";
      }, 900);
    }
  }

  const companyDisplayName = resolveCompanyDisplayName(profileSummary || account?.company || null, "Tu empresa");
  const companyLifecycle = String(account?.company.lifecycle_status || "active").toLowerCase();
  const userLifecycle = String(account?.user.lifecycle_status || "active").toLowerCase();

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Ajustes del panel empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ajusta señales del panel y gestiona de forma segura tu usuario, la empresa y su identidad asociada.
        </p>
        {saving ? <p className="mt-3 text-xs text-slate-500">Guardando cambios…</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
        {settingsMeta?.warning_message ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{settingsMeta.warning_message}</div>
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
                label="Mostrar ayuda sobre acceso a perfiles"
                helper="Mantiene visible una explicación breve sobre desbloqueo, acceso activo y accesos expirados."
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
              <p className="mt-1 font-semibold text-slate-900">{companyDisplayName}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contacto principal</p>
              <p className="mt-1 font-semibold text-slate-900">{profileSummary?.contact_email || "Sin email de contacto"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Verificación documental</p>
              <p className="mt-1 font-semibold text-slate-900">
                {profileSummary?.company_document_verification_label || verificationLabel(profileSummary?.company_document_verification_status)}
              </p>
              {profileSummary?.company_document_verification_detail ? (
                <p className="mt-2 text-xs text-slate-500">{profileSummary.company_document_verification_detail}</p>
              ) : null}
              {profileSummary?.company_document_review_eta_label ? (
                <p className="mt-2 text-xs text-slate-500">Tiempo estimado según plan: {profileSummary.company_document_review_eta_label}</p>
              ) : null}
              {profileSummary?.company_document_latest_document_type ? (
                <p className="mt-2 text-xs text-slate-500">Documento recibido: {profileSummary.company_document_latest_document_type}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Seguimiento de revisión</p>
              <div className="mt-2 space-y-2 text-xs text-slate-600">
                <p>Enviado: {formatDate(profileSummary?.company_document_last_submitted_at)}</p>
                <p>
                  Prioridad: {profileSummary?.company_document_review_priority_label || "Cola estándar"}
                  {profileSummary?.company_document_review_eta_label ? ` · ${profileSummary.company_document_review_eta_label}` : ""}
                </p>
                <p>Última resolución: {formatDate(profileSummary?.company_document_last_reviewed_at)}</p>
                {profileSummary?.company_document_rejection_reason ? (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                    Motivo visible: {profileSummary.company_document_rejection_reason}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Señales adicionales</p>
              <div className="mt-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${companyVerificationMethodTone(profileSummary?.company_verification_method || "none")}`}>
                  {profileSummary?.company_verification_method_label || "Sin señal adicional confirmada"}
                </span>
              </div>
              {profileSummary?.company_verification_method_detail ? (
                <p className="mt-2 text-xs text-slate-500">{profileSummary.company_verification_method_detail}</p>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Gestión de perfil / cuenta</h2>
            <p className="mt-1 text-sm text-slate-600">
              Eliminar tu usuario o cerrar la empresa no elimina automáticamente las verificaciones históricas ya emitidas a candidatos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              Usuario: {lifecycleLabel(account?.user.lifecycle_status)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              Empresa: {lifecycleLabel(account?.company.lifecycle_status)}
            </span>
          </div>
        </div>

        {accountError ? <p className="mt-4 text-sm text-rose-600">{accountError}</p> : null}
        {accountMessage ? <p className="mt-4 text-sm text-emerald-700">{accountMessage}</p> : null}

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-sm font-semibold text-slate-900">Identidad fiscal de empresa</h3>
            <p className="mt-1 text-sm text-slate-600">
              La edición de CIF/NIF y datos fiscales de empresa se centraliza en Perfil de empresa para evitar duplicidades entre superficies.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-wide text-slate-500">Resumen actual</p>
              <p className="mt-1 font-semibold text-slate-900">
                {account?.company?.has_identity
                  ? `${String(account?.company.identity_type || "").toUpperCase()} · ${account?.company.identity_masked}`
                  : "Todavía no hay identidad fiscal resumida en esta cuenta."}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Si necesitas actualizar el documento fiscal o completar datos legales, hazlo desde el perfil de empresa.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="/company/profile"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Abrir perfil de empresa
              </a>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-semibold text-amber-950">Mi usuario empresa</h3>
              <p className="mt-2 text-sm text-amber-900">
                Desactivar tu usuario detiene tu acceso operativo, pero no borra la empresa ni las verificaciones históricas emitidas.
              </p>
              <label className="mt-4 flex items-start gap-2 text-sm text-amber-900">
                <input type="checkbox" checked={disableUserConfirmed} onChange={(e) => setDisableUserConfirmed(e.target.checked)} />
                <span>Entiendo que es una desactivación temporal y que mis verificaciones históricas se conservan.</span>
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={accountSaving || userLifecycle === "disabled" || userLifecycle === "deleted" || !disableUserConfirmed}
                  onClick={() => runAccountAction("disable_user")}
                  className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-amber-300"
                >
                  Desactivar mi usuario
                </button>
                <button
                  type="button"
                  disabled={accountSaving || userLifecycle !== "disabled"}
                  onClick={() => runAccountAction("reactivate_user")}
                  className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reactivar mi usuario
                </button>
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-amber-950">Escribe ELIMINAR MI USUARIO para borrarlo</span>
                <input
                  type="text"
                  value={deleteUserConfirmation}
                  onChange={(e) => setDeleteUserConfirmation(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                disabled={accountSaving || userLifecycle === "deleted" || deleteUserConfirmation.trim().toUpperCase() !== "ELIMINAR MI USUARIO"}
                onClick={deleteUser}
                className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Eliminar mi usuario
              </button>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h3 className="text-sm font-semibold text-rose-950">Empresa</h3>
              <p className="mt-2 text-sm text-rose-900">
                Cerrar o desactivar la empresa no borra automáticamente las verificaciones históricas ya emitidas a candidatos.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={accountSaving || !account?.can_manage_company || companyLifecycle === "disabled" || companyLifecycle === "deleted"}
                  onClick={() => runAccountAction("disable_company")}
                  className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-rose-300"
                >
                  Desactivar empresa
                </button>
                <button
                  type="button"
                  disabled={accountSaving || !account?.can_manage_company || companyLifecycle === "active"}
                  onClick={() => runAccountAction("reactivate_company")}
                  className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reactivar empresa
                </button>
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-rose-950">Escribe CERRAR EMPRESA para confirmar el cierre</span>
                <input
                  type="text"
                  value={closeCompanyConfirmation}
                  onChange={(e) => setCloseCompanyConfirmation(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                disabled={accountSaving || !account?.can_manage_company || companyLifecycle === "deleted" || closeCompanyConfirmation.trim().toUpperCase() !== "CERRAR EMPRESA"}
                onClick={() => runAccountAction("close_company")}
                className="mt-4 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cerrar empresa definitivamente
              </button>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
              <h3 className="text-sm font-semibold text-sky-950">Reset empresa de prueba</h3>
              <p className="mt-2 text-sm text-sky-900">
                Esta opción está pensada para rehacer QA manual desde cero. Limpia el workspace operativo, la membresía activa, el onboarding,
                los documentos de empresa, los accesos consumidos y el saldo operativo asociado a esta empresa de prueba.
              </p>
              <p className="mt-2 text-sm text-sky-900">
                No borra la huella histórica mínima de la empresa cerrada ni destruye automáticamente verificaciones históricas ya emitidas.
              </p>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-sky-950">Escribe RESET EMPRESA para confirmar</span>
                <input
                  type="text"
                  value={resetCompanyConfirmation}
                  onChange={(e) => setResetCompanyConfirmation(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-sky-300 bg-white px-3 py-2.5 text-sm text-slate-900"
                />
              </label>
              <button
                type="button"
                disabled={accountSaving || !account?.can_manage_company || resetCompanyConfirmation.trim().toUpperCase() !== "RESET EMPRESA"}
                onClick={resetCompanyForQa}
                className="mt-4 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                Reset empresa de prueba
              </button>
            </div>
          </section>
        </div>
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
    </div>
  );
}
