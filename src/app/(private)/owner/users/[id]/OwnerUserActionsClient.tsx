"use client";

import { useMemo, useState } from "react";
import {
  getManagedSubscriptionPlansForRole,
  managedPlanLabel,
  normalizeManagedSubscriptionPlanKey,
} from "@/lib/billing/managedPlans";

type ExperienceItem = {
  id: string;
  label: string;
  status: string;
};

type EvidenceItem = {
  id: string;
  label: string;
  status: string;
};

type Props = {
  targetUserId: string;
  role: string;
  currentPlan: string;
  currentLifecycleStatus?: string;
  isArchived?: boolean;
  experiences: ExperienceItem[];
  evidences: EvidenceItem[];
};

type ActionState = {
  busy: boolean;
  message: string | null;
  isError: boolean;
};

const INITIAL_ACTION_STATE: ActionState = {
  busy: false,
  message: null,
  isError: false,
};

function ActionModal({
  open,
  title,
  description,
  confirmLabel,
  confirmTone = "neutral",
  confirmTextValue,
  confirmTextPlaceholder,
  onConfirmTextChange,
  confirmDisabled = false,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: "neutral" | "danger";
  confirmTextValue?: string;
  confirmTextPlaceholder?: string;
  onConfirmTextChange?: (value: string) => void;
  confirmDisabled?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {onConfirmTextChange ? (
          <input
            type="text"
            value={confirmTextValue || ""}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder={confirmTextPlaceholder}
            className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          />
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
              confirmTone === "danger" ? "bg-red-700" : "bg-slate-900"
            }`}
          >
            {busy ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function ownerActionErrorMessage(errorCode: string, details: string | null) {
  const withDetails = (message: string) => (details ? `${message} Detalle: ${details}` : message);
  if (errorCode === "invalid_target_plan") return "El plan seleccionado no está soportado en el catálogo actual.";
  if (errorCode === "invalid_target_plan_for_role") return "Ese plan no es válido para el tipo de usuario seleccionado.";
  if (errorCode === "missing_plan_mapping") return "Falta el mapeo interno del plan seleccionado. Revisa catálogo de billing.";
  if (errorCode === "plan_persistence_rejected") {
    return "El plan es válido en la app, pero la base remota ha rechazado guardarlo. Revisa la restricción legacy de subscriptions antes de reintentar.";
  }
  if (errorCode === "plan_override_create_failed") {
    return "No se pudo guardar el cambio manual de plan en overrides owner. Revisa la persistencia remota antes de reintentar.";
  }
  if (errorCode === "plan_change_failed") {
    if (details && /constraint|check|enum|invalid input value/i.test(details)) {
      return "No se pudo aplicar el plan porque la persistencia remota lo ha rechazado. Revisa la configuración legacy de subscriptions.";
    }
    if (details && /null value|null/i.test(details)) {
      return "No se pudo aplicar el plan por un dato interno obligatorio que falta en suscripción.";
    }
    return "No se pudo aplicar el cambio de plan. Revisa la configuración interna de suscripciones.";
  }
  if (errorCode === "hard_delete_cleanup_failed") {
    return withDetails("No se pudo completar la limpieza fuerte del candidato.");
  }
  if (errorCode === "hard_delete_profile_failed") {
    return withDetails("La limpieza se ejecutó, pero no se pudo marcar el perfil como eliminado.");
  }
  if (errorCode === "hard_delete_auth_disable_failed") {
    return withDetails("No se pudo bloquear el acceso en Auth tras la limpieza fuerte del candidato.");
  }
  if (errorCode === "owner_action_failed") return "La acción owner no pudo completarse.";
  return withDetails(`No se pudo ejecutar la acción (${errorCode || "unknown_error"}).`);
}

function normalizeRole(raw: string) {
  const r = String(raw || "").toLowerCase();
  if (r === "company") return "company";
  if (r === "owner" || r === "admin") return "owner";
  return "candidate";
}

export default function OwnerUserActionsClient({
  targetUserId,
  role,
  currentPlan,
  currentLifecycleStatus = "active",
  isArchived = false,
  experiences,
  evidences,
}: Props) {
  const [stateByAction, setStateByAction] = useState<Record<string, ActionState>>({});
  const normalizedRole = normalizeRole(role);
  const planOptions = useMemo(
    () => getManagedSubscriptionPlansForRole(normalizedRole === "company" ? "company" : "candidate"),
    [normalizedRole]
  );
  const normalizedCurrentPlan = normalizeManagedSubscriptionPlanKey(currentPlan);
  const initialPlanTarget =
    normalizedCurrentPlan && planOptions.some((plan) => plan.key === normalizedCurrentPlan)
      ? normalizedCurrentPlan
      : planOptions[0]?.key || "free";
  const [planTarget, setPlanTarget] = useState<string>(initialPlanTarget);
  const [planReason, setPlanReason] = useState("");

  const [trialMode, setTrialMode] = useState<"days" | "date">("days");
  const [trialDays, setTrialDays] = useState<string>("7");
  const [trialUntil, setTrialUntil] = useState("");
  const [trialReason, setTrialReason] = useState("");

  const [noteText, setNoteText] = useState("");
  const [noteReason, setNoteReason] = useState("");

  const [selectedExperienceId, setSelectedExperienceId] = useState<string>(experiences[0]?.id || "");
  const [experienceReason, setExperienceReason] = useState("");

  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>(evidences[0]?.id || "");
  const [evidenceReason, setEvidenceReason] = useState("");

  const [repairCompanyId, setRepairCompanyId] = useState("");
  const [repairCompanyName, setRepairCompanyName] = useState("");
  const [repairKeepOnboarding, setRepairKeepOnboarding] = useState(false);
  const [repairReason, setRepairReason] = useState("");

  const [archiveReason, setArchiveReason] = useState("");
  const [archiveConfirmPhrase, setArchiveConfirmPhrase] = useState("");
  const [adminModal, setAdminModal] = useState<null | "disable" | "reactivate" | "reset" | "delete" | "hard-delete">(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState("");

  const lifecycle = String(currentLifecycleStatus || "active").toLowerCase();
  const canResetCandidate = normalizedRole === "candidate";
  const isDisabled = lifecycle === "disabled";
  const isDeletedLifecycle = lifecycle === "deleted";

  function setActionState(actionKey: string, partial: Partial<ActionState>) {
    setStateByAction((prev) => ({
      ...prev,
      [actionKey]: {
        ...(prev[actionKey] || INITIAL_ACTION_STATE),
        ...partial,
      },
    }));
  }

  async function runAction(
    actionType: string,
    reason: string,
    payload: Record<string, any>,
    confirmText: string,
    options?: { skipBrowserConfirm?: boolean }
  ) {
    if (!options?.skipBrowserConfirm && !window.confirm(confirmText)) return null;
    setActionState(actionType, { busy: true, message: null, isError: false });
    try {
      const res = await fetch(`/api/internal/owner/users/${encodeURIComponent(targetUserId)}/actions`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action_type: actionType,
          reason,
          payload,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = String(j?.error || "owner_action_failed");
        const details = typeof j?.details === "string" ? j.details : null;
        throw new Error(ownerActionErrorMessage(code, details));
      }
      setActionState(actionType, {
        busy: false,
        isError: false,
        message: String(j?.message || "Acción aplicada correctamente."),
      });
      return j;
    } catch (e: any) {
      setActionState(actionType, {
        busy: false,
        isError: true,
        message: e?.message || "No se pudo ejecutar la acción.",
      });
      return null;
    }
  }

  async function submitPlanChange() {
    const reason = planReason.trim();
    if (!reason) {
      setActionState("change_plan", { isError: true, message: "El motivo es obligatorio para cambiar plan." });
      return;
    }
    if (!planTarget) {
      setActionState("change_plan", { isError: true, message: "Selecciona un plan destino." });
      return;
    }
    const result = await runAction(
      "change_plan",
      reason,
      { target_plan: planTarget },
      `Se aplicará cambio de plan de "${managedPlanLabel(currentPlan || "free")}" a "${managedPlanLabel(planTarget)}". ¿Confirmas?`
    );
    if (result) setPlanReason("");
  }

  async function submitTrialExtension() {
    const reason = trialReason.trim();
    if (!reason) {
      setActionState("extend_trial", { isError: true, message: "El motivo es obligatorio para extender trial." });
      return;
    }

    if (trialMode === "days") {
      const days = Number(trialDays);
      if (!Number.isFinite(days) || days <= 0 || days > 365) {
        setActionState("extend_trial", { isError: true, message: "Selecciona días válidos (1-365)." });
        return;
      }
      const result = await runAction(
        "extend_trial",
        reason,
        { mode: "days", days },
        `Se extenderá el trial en ${days} días. ¿Confirmas?`
      );
      if (result) setTrialReason("");
      return;
    }

    if (!trialUntil) {
      setActionState("extend_trial", { isError: true, message: "Selecciona una fecha de fin trial." });
      return;
    }
    const result = await runAction(
      "extend_trial",
      reason,
      { mode: "date", until: trialUntil },
      `Se fijará trial hasta ${trialUntil}. ¿Confirmas?`
    );
    if (result) setTrialReason("");
  }

  async function submitInternalNote() {
    const note = noteText.trim();
    const reason = noteReason.trim();
    if (!note) {
      setActionState("add_internal_note", { isError: true, message: "La nota no puede estar vacía." });
      return;
    }
    if (!reason) {
      setActionState("add_internal_note", { isError: true, message: "El motivo es obligatorio." });
      return;
    }
    const result = await runAction(
      "add_internal_note",
      reason,
      { note },
      "Se guardará una nota interna para este usuario. ¿Confirmas?"
    );
    if (result) {
      setNoteText("");
      setNoteReason("");
    }
  }

  async function submitExperienceReview() {
    const reason = experienceReason.trim();
    if (!selectedExperienceId) {
      setActionState("mark_experience_manual_review", { isError: true, message: "Selecciona una experiencia." });
      return;
    }
    if (!reason) {
      setActionState("mark_experience_manual_review", { isError: true, message: "El motivo es obligatorio." });
      return;
    }
    const result = await runAction(
      "mark_experience_manual_review",
      reason,
      { experience_id: selectedExperienceId },
      "La experiencia seleccionada pasará a revisión manual. ¿Confirmas?"
    );
    if (result) setExperienceReason("");
  }

  async function submitEvidenceReview() {
    const reason = evidenceReason.trim();
    if (!selectedEvidenceId) {
      setActionState("mark_evidence_manual_review", { isError: true, message: "Selecciona una evidencia." });
      return;
    }
    if (!reason) {
      setActionState("mark_evidence_manual_review", { isError: true, message: "El motivo es obligatorio." });
      return;
    }
    const result = await runAction(
      "mark_evidence_manual_review",
      reason,
      { evidence_id: selectedEvidenceId },
      "La evidencia seleccionada pasará a revisión manual. ¿Confirmas?"
    );
    if (result) setEvidenceReason("");
  }

  async function submitRepairCompanyContext() {
    const reason = repairReason.trim();
    if (!reason) {
      setActionState("repair_company_context", { isError: true, message: "El motivo es obligatorio." });
      return;
    }
    if (repairCompanyId.trim() && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(repairCompanyId.trim())) {
      setActionState("repair_company_context", { isError: true, message: "El Company ID debe ser UUID válido o vacío." });
      return;
    }
    const result = await runAction(
      "repair_company_context",
      reason,
      {
        company_id: repairCompanyId.trim() || null,
        company_name: repairCompanyName.trim() || null,
        keep_onboarding_completed: repairKeepOnboarding,
      },
      "Se convertirá/reparará el contexto empresa (rol, membership, active_company_id y company_profile). ¿Confirmas?"
    );
    if (result) {
      setRepairReason("");
      window.location.reload();
    }
  }

  async function submitArchiveUser() {
    const reason = archiveReason.trim();
    if (!reason) {
      setActionState("archive_user", { isError: true, message: "El motivo es obligatorio." });
      return;
    }
    if (archiveConfirmPhrase.trim().toUpperCase() !== "ELIMINAR") {
      setActionState("archive_user", { isError: true, message: 'Escribe "ELIMINAR" para confirmar.' });
      return;
    }
    const result = await runAction(
      "archive_user",
      reason,
      {
        confirm_phrase: "ELIMINAR",
        disable_signin: true,
        clear_full_name: true,
        keep_role: true,
      },
      "Se archivará el usuario y se bloqueará su acceso. Se preserva el histórico de verificaciones. ¿Confirmas?"
    );
    if (result) {
      setArchiveReason("");
      setArchiveConfirmPhrase("");
      window.location.reload();
    }
  }

  function ActionFeedback({ actionKey }: { actionKey: string }) {
    const state = stateByAction[actionKey];
    if (!state?.message) return null;
    return (
      <div
        className={`mt-3 rounded-lg border p-2 text-xs ${
          state.isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}
      >
        {state.message}
      </div>
    );
  }

  async function submitAdminAction(actionType: string, reason: string, payload: Record<string, any>, reload = true) {
    const result = await runAction(actionType, reason, payload, "Confirmar acción", {
      skipBrowserConfirm: true,
    });
    if (result && reload) {
      window.location.reload();
    }
    return result;
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Acciones owner (operativas)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Acciones con validación y ejecución real. Cada operación deja trazabilidad en owner_actions.
      </p>
      <div className="mt-2 text-xs text-slate-600">
        Estado lifecycle actual: <span className="font-semibold text-slate-900">{currentLifecycleStatus}</span>
      </div>
      {isArchived ? (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El usuario está archivado. Las acciones de plan/trial/revisión se desactivan hasta reactivar el contexto.
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAdminModal("disable")}
            disabled={stateByAction.disable_user?.busy || isDeletedLifecycle || isDisabled}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
          >
            Desactivar usuario
          </button>
          <button
            type="button"
            onClick={() => setAdminModal("reactivate")}
            disabled={stateByAction.reactivate_user?.busy || (!isDisabled && !isArchived)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
          >
            Reactivar usuario
          </button>
          <button
            type="button"
            onClick={() => setAdminModal("reset")}
            disabled={stateByAction.reset_candidate?.busy || !canResetCandidate}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
          >
            Resetear candidato
          </button>
          <button
            type="button"
            onClick={() => setAdminModal("delete")}
            disabled={stateByAction.delete_user?.busy || isArchived}
            className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
          >
            Eliminar usuario
          </button>
          <button
            type="button"
            onClick={() => setAdminModal("hard-delete")}
            disabled={stateByAction.hard_delete_user?.busy || !canResetCandidate || isDeletedLifecycle}
            className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Eliminar completamente
          </button>
        </div>
        <ActionFeedback actionKey="disable_user" />
        <ActionFeedback actionKey="reactivate_user" />
        <ActionFeedback actionKey="reset_candidate" />
        <ActionFeedback actionKey="delete_user" />
        <ActionFeedback actionKey="hard_delete_user" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Cambio de plan</h3>
          <p className="mt-1 text-xs text-slate-600">Plan actual: <span className="font-semibold">{managedPlanLabel(currentPlan || "free")}</span></p>
          {!normalizedCurrentPlan ? (
            <p className="mt-1 text-xs text-amber-700">
              El plan actual no está en el catálogo canónico owner. Puedes mover al usuario a un plan válido desde esta lista.
            </p>
          ) : null}
          <select
            value={planTarget}
            onChange={(e) => setPlanTarget(e.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {planOptions.map((plan) => (
              <option key={plan.key} value={plan.key}>{plan.label}</option>
            ))}
          </select>
          <textarea
            value={planReason}
            onChange={(e) => setPlanReason(e.target.value)}
            placeholder="Motivo obligatorio"
            className="mt-2 min-h-[72px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitPlanChange()}
            disabled={stateByAction.change_plan?.busy || isArchived}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {stateByAction.change_plan?.busy ? "Aplicando..." : "Aplicar cambio de plan"}
          </button>
          <ActionFeedback actionKey="change_plan" />
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Extender trial</h3>
          <div className="mt-2 flex gap-2 text-xs">
            <label className="inline-flex items-center gap-1">
              <input type="radio" checked={trialMode === "days"} onChange={() => setTrialMode("days")} />
              Días
            </label>
            <label className="inline-flex items-center gap-1">
              <input type="radio" checked={trialMode === "date"} onChange={() => setTrialMode("date")} />
              Fecha fija
            </label>
          </div>
          {trialMode === "days" ? (
            <input
              value={trialDays}
              onChange={(e) => setTrialDays(e.target.value)}
              type="number"
              min={1}
              max={365}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Días (ej. 7, 15, 30)"
            />
          ) : (
            <input
              value={trialUntil}
              onChange={(e) => setTrialUntil(e.target.value)}
              type="date"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          )}
          <textarea
            value={trialReason}
            onChange={(e) => setTrialReason(e.target.value)}
            placeholder="Motivo obligatorio"
            className="mt-2 min-h-[72px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitTrialExtension()}
            disabled={stateByAction.extend_trial?.busy || isArchived}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {stateByAction.extend_trial?.busy ? "Aplicando..." : "Extender trial"}
          </button>
          <ActionFeedback actionKey="extend_trial" />
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Añadir nota interna</h3>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Nota interna"
            className="mt-2 min-h-[96px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <textarea
            value={noteReason}
            onChange={(e) => setNoteReason(e.target.value)}
            placeholder="Motivo obligatorio"
            className="mt-2 min-h-[72px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitInternalNote()}
            disabled={stateByAction.add_internal_note?.busy}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {stateByAction.add_internal_note?.busy ? "Guardando..." : "Guardar nota"}
          </button>
          <ActionFeedback actionKey="add_internal_note" />
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Marcar experiencia para revisión manual</h3>
          <select
            value={selectedExperienceId}
            onChange={(e) => setSelectedExperienceId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {experiences.length === 0 ? <option value="">Sin experiencias</option> : null}
            {experiences.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <textarea
            value={experienceReason}
            onChange={(e) => setExperienceReason(e.target.value)}
            placeholder="Motivo obligatorio"
            className="mt-2 min-h-[72px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitExperienceReview()}
            disabled={stateByAction.mark_experience_manual_review?.busy || experiences.length === 0 || isArchived}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {stateByAction.mark_experience_manual_review?.busy ? "Aplicando..." : "Marcar experiencia"}
          </button>
          <ActionFeedback actionKey="mark_experience_manual_review" />
        </article>

        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900">Marcar evidencia para revisión manual</h3>
          <select
            value={selectedEvidenceId}
            onChange={(e) => setSelectedEvidenceId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {evidences.length === 0 ? <option value="">Sin evidencias</option> : null}
            {evidences.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <textarea
            value={evidenceReason}
            onChange={(e) => setEvidenceReason(e.target.value)}
            placeholder="Motivo obligatorio"
            className="mt-2 min-h-[72px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitEvidenceReview()}
            disabled={stateByAction.mark_evidence_manual_review?.busy || evidences.length === 0 || isArchived}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {stateByAction.mark_evidence_manual_review?.busy ? "Aplicando..." : "Marcar evidencia"}
          </button>
          <ActionFeedback actionKey="mark_evidence_manual_review" />
        </article>

        <article className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <h3 className="text-sm font-semibold text-emerald-900">Convertir a empresa / reparar contexto</h3>
          <p className="mt-1 text-xs text-emerald-800">
            Corrige usuarios legacy: rol company, active_company_id, membership admin y company_profile.
          </p>
          <input
            value={repairCompanyId}
            onChange={(e) => setRepairCompanyId(e.target.value)}
            placeholder="Company ID existente (UUID) opcional"
            className="mt-2 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={repairCompanyName}
            onChange={(e) => setRepairCompanyName(e.target.value)}
            placeholder="Nombre empresa (si necesita crearla)"
            className="mt-2 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm"
          />
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-900">
            <input
              type="checkbox"
              checked={repairKeepOnboarding}
              onChange={(e) => setRepairKeepOnboarding(e.target.checked)}
            />
            Mantener onboarding_completed actual (si ya está en true).
          </label>
          <textarea
            value={repairReason}
            onChange={(e) => setRepairReason(e.target.value)}
            placeholder="Motivo obligatorio"
            className="mt-2 min-h-[72px] w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitRepairCompanyContext()}
            disabled={stateByAction.repair_company_context?.busy}
            className="mt-3 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {stateByAction.repair_company_context?.busy ? "Aplicando..." : "Reparar contexto empresa"}
          </button>
          <ActionFeedback actionKey="repair_company_context" />
        </article>

        <article className="rounded-lg border border-red-200 bg-red-50 p-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-red-900">Eliminar usuario (archivar)</h3>
          <p className="mt-1 text-xs text-red-800">
            Soft delete con trazabilidad: bloquea acceso y conserva histórico de verificaciones/evidencias.
          </p>
          <textarea
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            placeholder="Motivo obligatorio"
            className="mt-2 min-h-[72px] w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm"
          />
          <input
            value={archiveConfirmPhrase}
            onChange={(e) => setArchiveConfirmPhrase(e.target.value)}
            placeholder='Escribe "ELIMINAR" para confirmar'
            className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void submitArchiveUser()}
            disabled={stateByAction.archive_user?.busy || isArchived}
            className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {stateByAction.archive_user?.busy ? "Archivando..." : isArchived ? "Usuario ya archivado" : "Archivar usuario"}
          </button>
          <ActionFeedback actionKey="archive_user" />
        </article>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Reenviar magic link no está disponible en este módulo: no existe backend seguro de reenvío owner en el sistema actual.
      </div>

      <ActionModal
        open={adminModal === "disable"}
        title="Desactivar usuario"
        description="Se bloqueará el acceso y el perfil dejará de estar operativo."
        confirmLabel="Confirmar"
        busy={Boolean(stateByAction.disable_user?.busy)}
        confirmDisabled={isDeletedLifecycle || isDisabled}
        onClose={() => setAdminModal(null)}
        onConfirm={async () => {
          const result = await submitAdminAction("disable_user", "Owner disabled user from owner panel", {}, true);
          if (result) setAdminModal(null);
        }}
      />

      <ActionModal
        open={adminModal === "reactivate"}
        title="Reactivar usuario"
        description="Se restaurará el acceso y el perfil volverá a estar operativo."
        confirmLabel="Confirmar"
        busy={Boolean(stateByAction.reactivate_user?.busy)}
        confirmDisabled={!isDisabled && !isArchived}
        onClose={() => setAdminModal(null)}
        onConfirm={async () => {
          const result = await submitAdminAction("reactivate_user", "Owner reactivated user from owner panel", {}, true);
          if (result) setAdminModal(null);
        }}
      />

      <ActionModal
        open={adminModal === "reset"}
        title="Resetear candidato"
        description="Esto borrará el perfil del candidato y lo dejará limpio para QA."
        confirmLabel="Confirmar"
        busy={Boolean(stateByAction.reset_candidate?.busy)}
        confirmDisabled={!canResetCandidate}
        onClose={() => setAdminModal(null)}
        onConfirm={async () => {
          const result = await submitAdminAction("reset_candidate", "Owner reset candidate for QA from owner panel", {}, true);
          if (result) setAdminModal(null);
        }}
      />

      <ActionModal
        open={adminModal === "delete"}
        title="Eliminar usuario"
        description="Se archivará el usuario y se bloqueará su acceso."
        confirmLabel="Confirmar"
        confirmTone="danger"
        busy={Boolean(stateByAction.delete_user?.busy)}
        confirmDisabled={isArchived}
        onClose={() => setAdminModal(null)}
        onConfirm={async () => {
          const result = await submitAdminAction(
            "delete_user",
            "Owner soft deleted user from owner panel",
            { confirm_phrase: "ELIMINAR", disable_signin: true, clear_full_name: true, keep_role: true },
            true
          );
          if (result) setAdminModal(null);
        }}
      />

      <ActionModal
        open={adminModal === "hard-delete"}
        title="Eliminar completamente"
        description="Esto ejecutará un borrado fuerte equivalente: limpia datos operativos, desactiva enlaces públicos y bloquea el acceso. Escribe DELETE para continuar."
        confirmLabel="Confirmar"
        confirmTone="danger"
        confirmTextValue={hardDeleteConfirm}
        confirmTextPlaceholder="DELETE"
        onConfirmTextChange={setHardDeleteConfirm}
        confirmDisabled={!canResetCandidate || hardDeleteConfirm.trim().toUpperCase() !== "DELETE"}
        busy={Boolean(stateByAction.hard_delete_user?.busy)}
        onClose={() => {
          setAdminModal(null);
          setHardDeleteConfirm("");
        }}
        onConfirm={async () => {
          const result = await submitAdminAction(
            "hard_delete_user",
            "Owner hard deleted candidate from owner panel",
            { confirm_phrase: "DELETE" },
            false
          );
          if (result) {
            setHardDeleteConfirm("");
            setAdminModal(null);
            window.location.href = "/owner/users?deleted=1";
          }
        }}
      />
    </section>
  );
}
