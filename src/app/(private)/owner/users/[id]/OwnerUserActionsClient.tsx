"use client";

import { useMemo, useState } from "react";

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

const CANDIDATE_PLAN_OPTIONS = [
  "free",
  "candidate_starter_monthly",
  "candidate_pro_monthly",
  "candidate_proplus_monthly",
  "candidate_proplus_yearly",
];

const COMPANY_PLAN_OPTIONS = [
  "free",
  "company_access_monthly",
  "company_hiring_monthly",
  "company_team_monthly",
];

function normalizeRole(raw: string) {
  const r = String(raw || "").toLowerCase();
  if (r === "company") return "company";
  if (r === "owner" || r === "admin") return "owner";
  return "candidate";
}

function planOptionsForRole(role: string) {
  const normalized = normalizeRole(role);
  if (normalized === "company") return COMPANY_PLAN_OPTIONS;
  return CANDIDATE_PLAN_OPTIONS;
}

export default function OwnerUserActionsClient({
  targetUserId,
  role,
  currentPlan,
  experiences,
  evidences,
}: Props) {
  const [stateByAction, setStateByAction] = useState<Record<string, ActionState>>({});
  const [planTarget, setPlanTarget] = useState<string>(currentPlan || "free");
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

  const planOptions = useMemo(() => planOptionsForRole(role), [role]);

  function setActionState(actionKey: string, partial: Partial<ActionState>) {
    setStateByAction((prev) => ({
      ...prev,
      [actionKey]: {
        ...(prev[actionKey] || INITIAL_ACTION_STATE),
        ...partial,
      },
    }));
  }

  async function runAction(actionType: string, reason: string, payload: Record<string, any>, confirmText: string) {
    if (!window.confirm(confirmText)) return null;
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
      if (!res.ok) throw new Error(j?.error || "owner_action_failed");
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
      `Se aplicará cambio de plan de "${currentPlan || "free"}" a "${planTarget}". ¿Confirmas?`
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

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Acciones owner (operativas)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Acciones con validación y ejecución real. Cada operación deja trazabilidad en owner_actions.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-900">Cambio de plan</h3>
          <p className="mt-1 text-xs text-slate-600">Plan actual: <span className="font-semibold">{currentPlan || "free"}</span></p>
          <select
            value={planTarget}
            onChange={(e) => setPlanTarget(e.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {planOptions.map((plan) => (
              <option key={plan} value={plan}>{plan}</option>
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
            disabled={stateByAction.change_plan?.busy}
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
            disabled={stateByAction.extend_trial?.busy}
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
            disabled={stateByAction.mark_experience_manual_review?.busy || experiences.length === 0}
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
            disabled={stateByAction.mark_evidence_manual_review?.busy || evidences.length === 0}
            className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {stateByAction.mark_evidence_manual_review?.busy ? "Aplicando..." : "Marcar evidencia"}
          </button>
          <ActionFeedback actionKey="mark_evidence_manual_review" />
        </article>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Reenviar magic link no está disponible en este módulo: no existe backend seguro de reenvío owner en el sistema actual.
      </div>
    </section>
  );
}
