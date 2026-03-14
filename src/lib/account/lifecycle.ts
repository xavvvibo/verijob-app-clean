export type LifecycleStatus = "active" | "disabled" | "scheduled_for_deletion" | "deleted";

export function normalizeLifecycleStatus(value: unknown): LifecycleStatus {
  const status = String(value || "").trim().toLowerCase();
  if (status === "disabled") return "disabled";
  if (status === "scheduled_for_deletion") return "scheduled_for_deletion";
  if (status === "deleted") return "deleted";
  return "active";
}

export function isUnavailableLifecycleStatus(value: unknown) {
  const status = normalizeLifecycleStatus(value);
  return status === "disabled" || status === "scheduled_for_deletion" || status === "deleted";
}

export function lifecycleLabel(value: unknown) {
  const status = normalizeLifecycleStatus(value);
  if (status === "disabled") return "Desactivado";
  if (status === "scheduled_for_deletion") return "Pendiente de eliminación";
  if (status === "deleted") return "Eliminado";
  return "Activo";
}

