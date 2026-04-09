type Nullable<T> = T | null | undefined;

export type OwnerMarketingLifecycle =
  | "draft"
  | "configured"
  | "active"
  | "paused"
  | "finalized"
  | "archived";

export type OwnerMarketingSurface =
  | "not_connected"
  | "signup"
  | "upgrade"
  | "billing"
  | "owner_manual_assignment"
  | "other";

export type OwnerMarketingMetadata = {
  lifecycle_status?: string;
  application_surface?: string;
  execution_connected?: boolean;
  impact_summary?: string;
  activated_at?: string;
  paused_at?: string;
  archived_at?: string;
  source?: string;
  duplicated_from?: string;
};

export type OwnerMarketingPromoLike = {
  is_active?: Nullable<boolean>;
  starts_at?: Nullable<string>;
  expires_at?: Nullable<string>;
  current_redemptions?: Nullable<number>;
  max_redemptions?: Nullable<number>;
  metadata?: Nullable<unknown>;
};

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function readOwnerMarketingMetadata(value: unknown): OwnerMarketingMetadata {
  const raw = safeObject(value);
  return {
    lifecycle_status: typeof raw.lifecycle_status === "string" ? raw.lifecycle_status : undefined,
    application_surface: typeof raw.application_surface === "string" ? raw.application_surface : undefined,
    execution_connected: typeof raw.execution_connected === "boolean" ? raw.execution_connected : undefined,
    impact_summary: typeof raw.impact_summary === "string" ? raw.impact_summary : undefined,
    activated_at: typeof raw.activated_at === "string" ? raw.activated_at : undefined,
    paused_at: typeof raw.paused_at === "string" ? raw.paused_at : undefined,
    archived_at: typeof raw.archived_at === "string" ? raw.archived_at : undefined,
    source: typeof raw.source === "string" ? raw.source : undefined,
    duplicated_from: typeof raw.duplicated_from === "string" ? raw.duplicated_from : undefined,
  };
}

export function normalizeOwnerMarketingSurface(value: unknown): OwnerMarketingSurface {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "signup") return "signup";
  if (raw === "upgrade") return "upgrade";
  if (raw === "billing") return "billing";
  if (raw === "owner_manual_assignment") return "owner_manual_assignment";
  if (raw === "other" || raw === "otra") return "other";
  return "not_connected";
}

export function ownerMarketingSurfaceLabel(surface: OwnerMarketingSurface): string {
  switch (surface) {
    case "signup":
      return "Signup";
    case "upgrade":
      return "Upgrade";
    case "billing":
      return "Billing";
    case "owner_manual_assignment":
      return "Asignación manual owner";
    case "other":
      return "Otra";
    default:
      return "Destino aún no conectado";
  }
}

export function ownerMarketingExecutionConnected(metadata?: OwnerMarketingMetadata): boolean {
  return Boolean(metadata?.execution_connected);
}

export function ownerMarketingImpactSummary(promo?: OwnerMarketingPromoLike): string {
  const metadata = readOwnerMarketingMetadata(promo?.metadata);
  if (metadata.impact_summary) return metadata.impact_summary;

  const surface = normalizeOwnerMarketingSurface(metadata.application_surface);
  if (!ownerMarketingExecutionConnected(metadata)) {
    return "Promoción registrada sin automatización activa";
  }

  return `Impacta automáticamente en ${ownerMarketingSurfaceLabel(surface)}`;
}

export function resolveOwnerMarketingLifecycle(promo?: OwnerMarketingPromoLike): OwnerMarketingLifecycle {
  const metadata = readOwnerMarketingMetadata(promo?.metadata);
  const explicit = String(metadata.lifecycle_status || "").trim().toLowerCase();
  const executionConnected = ownerMarketingExecutionConnected(metadata);
  const isActive = Boolean(promo?.is_active);
  const now = Date.now();
  const expiresAt = promo?.expires_at ? Date.parse(String(promo.expires_at)) : NaN;
  const redemptions = Number(promo?.current_redemptions ?? 0);
  const maxRedemptions = Number(promo?.max_redemptions ?? 0);
  const capped = maxRedemptions > 0 && redemptions >= maxRedemptions;
  const expired = Number.isFinite(expiresAt) && expiresAt <= now;

  if (explicit === "archived") return "archived";
  if (capped || expired || explicit === "finalized") return "finalized";
  if (explicit === "paused") return "paused";
  if (explicit === "draft") return "draft";
  if (explicit === "configured") return executionConnected ? "active" : "configured";
  if (explicit === "active") return executionConnected && isActive ? "active" : "configured";

  if (isActive) return executionConnected ? "active" : "configured";
  return "draft";
}

export function ownerMarketingLifecycleLabel(lifecycle: OwnerMarketingLifecycle, promo?: OwnerMarketingPromoLike): string {
  const executionConnected = ownerMarketingExecutionConnected(readOwnerMarketingMetadata(promo?.metadata));
  if (lifecycle === "configured" && !executionConnected) return "Pendiente de activación real";
  if (lifecycle === "configured") return "Configurada";
  if (lifecycle === "active") return "Activa";
  if (lifecycle === "paused") return "Pausada";
  if (lifecycle === "finalized") return "Finalizada";
  if (lifecycle === "archived") return "Archivada";
  return "Borrador";
}

export function ownerMarketingLifecycleHelper(promo?: OwnerMarketingPromoLike): string {
  const lifecycle = resolveOwnerMarketingLifecycle(promo);
  const metadata = readOwnerMarketingMetadata(promo?.metadata);

  if (lifecycle === "draft") {
    return "Registro interno editable. Todavía no tiene activación ni automatización.";
  }
  if (lifecycle === "configured") {
    return ownerMarketingExecutionConnected(metadata)
      ? "Configurada y conectada a una superficie real."
      : "Configurada por owner, pero sin conexión automática a producto o billing.";
  }
  if (lifecycle === "active") {
    return "Activa con impacto real sobre una superficie conectada.";
  }
  if (lifecycle === "paused") {
    return "Pausada por owner. No debería aplicarse mientras siga en pausa.";
  }
  if (lifecycle === "archived") {
    return "Archivada para consulta histórica.";
  }
  return "Finalizada por caducidad o por alcanzar el límite de uso.";
}

export function ownerMarketingProcessState(
  promo?: OwnerMarketingPromoLike,
): "draft" | "waiting_action" | "active" | "paused" | "completed" {
  const lifecycle = resolveOwnerMarketingLifecycle(promo);
  if (lifecycle === "draft") return "draft";
  if (lifecycle === "configured") return "waiting_action";
  if (lifecycle === "active") return "active";
  if (lifecycle === "paused") return "paused";
  return "completed";
}

export function ownerMarketingCanEditDraft(promo?: OwnerMarketingPromoLike): boolean {
  return resolveOwnerMarketingLifecycle(promo) === "draft";
}

export function ownerMarketingCanDeleteDraft(promo?: OwnerMarketingPromoLike): boolean {
  return resolveOwnerMarketingLifecycle(promo) === "draft" && Number(promo?.current_redemptions ?? 0) === 0;
}

export function ownerMarketingCanActivate(promo?: OwnerMarketingPromoLike): boolean {
  const lifecycle = resolveOwnerMarketingLifecycle(promo);
  return lifecycle === "draft" || lifecycle === "paused";
}

export function ownerMarketingCanPause(promo?: OwnerMarketingPromoLike): boolean {
  const lifecycle = resolveOwnerMarketingLifecycle(promo);
  return lifecycle === "configured" || lifecycle === "active";
}

export function ownerMarketingCanArchive(promo?: OwnerMarketingPromoLike): boolean {
  const lifecycle = resolveOwnerMarketingLifecycle(promo);
  return lifecycle !== "archived";
}

export function buildOwnerMarketingMetadata(input?: {
  existing?: unknown;
  lifecycleStatus?: OwnerMarketingLifecycle;
  applicationSurface?: string;
  executionConnected?: boolean;
  impactSummary?: string;
  source?: string;
  activatedAt?: string;
  pausedAt?: string;
  archivedAt?: string;
  duplicatedFrom?: string;
}): Record<string, unknown> {
  const existing = safeObject(input?.existing);
  const surface = normalizeOwnerMarketingSurface(input?.applicationSurface ?? existing.application_surface);
  const executionConnected =
    typeof input?.executionConnected === "boolean"
      ? input.executionConnected
      : typeof existing.execution_connected === "boolean"
        ? Boolean(existing.execution_connected)
        : false;

  const impactSummary =
    input?.impactSummary ||
    (executionConnected
      ? `Impacta automáticamente en ${ownerMarketingSurfaceLabel(surface)}`
      : "Promoción registrada sin automatización activa");

  return {
    ...existing,
    lifecycle_status: input?.lifecycleStatus || existing.lifecycle_status || "draft",
    application_surface: surface,
    execution_connected: executionConnected,
    impact_summary: impactSummary,
    ...(input?.source ? { source: input.source } : {}),
    ...(input?.activatedAt ? { activated_at: input.activatedAt } : {}),
    ...(input?.pausedAt ? { paused_at: input.pausedAt } : {}),
    ...(input?.archivedAt ? { archived_at: input.archivedAt } : {}),
    ...(input?.duplicatedFrom ? { duplicated_from: input.duplicatedFrom } : {}),
  };
}
