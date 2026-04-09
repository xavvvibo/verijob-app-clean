export type OwnerProcessState =
  | "draft"
  | "working"
  | "waiting_action"
  | "completed"
  | "failed"
  | "paused"
  | "active";

export interface OwnerModuleMeta {
  title: string;
  helperText: string;
  processState: OwnerProcessState;
  nextStep?: string;
  stateLabel?: string;
  nextAction?: {
    label: string;
    href?: string;
  };
}

export const STATE_LABEL: Record<OwnerProcessState, string> = {
  draft: "Borrador",
  working: "Trabajando",
  waiting_action: "Esperando acción",
  completed: "Completado",
  failed: "Fallido",
  paused: "Pausado",
  active: "Activo",
};

type Nullable<T> = T | null | undefined;

type GrowthCampaignLike = {
  status?: Nullable<string>;
  execution_status?: Nullable<string>;
  objective?: Nullable<string>;
  channel?: Nullable<string>;
};

type MarketingPromotionLike = {
  is_active?: Nullable<boolean>;
  starts_at?: Nullable<string>;
  expires_at?: Nullable<string>;
  current_redemptions?: Nullable<number>;
  max_redemptions?: Nullable<number>;
  metadata?: Nullable<unknown>;
  status?: Nullable<string>;
};

function labelForState(state: OwnerProcessState): string {
  return STATE_LABEL[state];
}

function normalizeGrowthState(
  status?: Nullable<string>,
  executionStatus?: Nullable<string>,
): OwnerProcessState {
  const raw = String(executionStatus || status || "").trim().toLowerCase();

  if (!raw) return "draft";
  if (["draft", "created", "new"].includes(raw)) return "draft";
  if (["working", "running", "in_progress", "processing", "executing", "sending"].includes(raw)) return "working";
  if (["waiting_action", "waiting", "awaiting_reply", "awaiting_response", "pending_reply", "pending_response"].includes(raw)) return "waiting_action";
  if (["completed", "done", "finished", "sent"].includes(raw)) return "completed";
  if (["failed", "error", "stopped_error"].includes(raw)) return "failed";
  if (["paused", "on_hold"].includes(raw)) return "paused";
  if (["active", "live"].includes(raw)) return "active";

  return "working";
}

function normalizeMarketingState(promo?: MarketingPromotionLike): OwnerProcessState {
  const explicit = String(promo?.status || "").trim().toLowerCase();

  if (explicit) {
    if (["draft", "created", "new"].includes(explicit)) return "draft";
    if (["working", "running", "in_progress", "processing"].includes(explicit)) return "working";
    if (["waiting_action", "waiting", "pending_review", "awaiting_validation"].includes(explicit)) return "waiting_action";
    if (["completed", "finished", "ended"].includes(explicit)) return "completed";
    if (["failed", "error"].includes(explicit)) return "failed";
    if (["paused", "on_hold"].includes(explicit)) return "paused";
    if (["active", "live"].includes(explicit)) return "active";
  }

  const isActive = Boolean(promo?.is_active);
  const now = Date.now();
  const expiresAt = promo?.expires_at ? Date.parse(String(promo.expires_at)) : NaN;
  const redemptions = Number(promo?.current_redemptions ?? 0);
  const maxRedemptions = Number(promo?.max_redemptions ?? 0);
  const capped = maxRedemptions > 0 && redemptions >= maxRedemptions;
  const expired = Number.isFinite(expiresAt) && expiresAt <= now;

  if (capped || expired) return "completed";
  if (isActive) return "active";
  return "draft";
}

export const ownerOverviewBlockMeta = {
  keyMetrics: {
    title: "Métricas clave",
    helperText: "Resume el estado actual del negocio, producto y actividad operativa.",
    processState: "active" as const,
    stateLabel: labelForState("active"),
    nextStep: "Revisar variaciones y detectar anomalías.",
    nextAction: { label: "Ver detalle", href: "/owner/overview" },
  },
  activationFunnel: {
    title: "Embudo de activación",
    helperText: "Muestra el paso de usuario activo a conversión para detectar bloqueos.",
    processState: "working" as const,
    stateLabel: labelForState("working"),
    nextStep: "Localizar el mayor cuello de botella del flujo.",
    nextAction: { label: "Analizar embudo", href: "/owner/growth" },
  },
  dailyOperations: {
    title: "Operaciones diarias",
    helperText: "Centraliza tareas que requieren revisión o seguimiento inmediato.",
    processState: "waiting_action" as const,
    stateLabel: labelForState("waiting_action"),
    nextStep: "Resolver primero lo que esté pendiente de revisión.",
    nextAction: { label: "Revisar ahora", href: "/owner/issues" },
  },
  systemIntegrity: {
    title: "Integridad del sistema",
    helperText: "Ayuda a detectar anomalías, fraude potencial o incoherencias operativas.",
    processState: "working" as const,
    stateLabel: labelForState("working"),
    nextStep: "Validar señales anómalas y revisar outliers.",
  },
  growthOpportunities: {
    title: "Oportunidades de crecimiento",
    helperText: "Señala segmentos, zonas o patrones con potencial comercial.",
    processState: "working" as const,
    stateLabel: labelForState("working"),
    nextStep: "Priorizar el siguiente experimento comercial.",
    nextAction: { label: "Ir a Growth", href: "/owner/growth" },
  },
  businessEconomics: {
    title: "Economía del negocio",
    helperText: "Resume ingresos, planes, consumo y señales SaaS clave.",
    processState: "active" as const,
    stateLabel: labelForState("active"),
    nextStep: "Revisar monetización y señales de conversión.",
    nextAction: { label: "Ver monetización", href: "/owner/monetization" },
  },
  alertsAnomalies: {
    title: "Alertas y anomalías",
    helperText: "Destaca incidencias o desviaciones que requieren atención.",
    processState: "waiting_action" as const,
    stateLabel: labelForState("waiting_action"),
    nextStep: "Confirmar impacto y asignar seguimiento.",
    nextAction: { label: "Abrir incidencias", href: "/owner/issues" },
  },
  globalTimeline: {
    title: "Timeline global",
    helperText: "Recoge la actividad reciente relevante del sistema.",
    processState: "active" as const,
    stateLabel: labelForState("active"),
    nextStep: "Seguir actividad reciente y validar tendencias.",
  },
  quickActions: {
    title: "Acciones rápidas",
    helperText: "Atajos para revisar, corregir o actuar sin salir del panel.",
    processState: "active" as const,
    stateLabel: labelForState("active"),
    nextStep: "Ejecutar la siguiente acción prioritaria.",
  },
} as const;

const growthObjectiveFlowMap: Record<string, string> = {
  new_leads: "Flujo: captación en LinkedIn/fuentes externas → CRM → outreach → respuesta → demo.",
  leads: "Flujo: captación en LinkedIn/fuentes externas → CRM → outreach → respuesta → demo.",
  acquire_leads: "Flujo: captación en LinkedIn/fuentes externas → CRM → outreach → respuesta → demo.",
  book_demos: "Flujo: selección de prospectos → contacto → respuesta positiva → agenda de demo.",
  demos: "Flujo: selección de prospectos → contacto → respuesta positiva → agenda de demo.",
  reactivate: "Flujo: selección de leads fríos → contacto de reactivación → seguimiento → recuperación.",
  reactivate_leads: "Flujo: selección de leads fríos → contacto de reactivación → seguimiento → recuperación.",
  outbound_email: "Flujo: segmentación → CRM → secuencia de email → respuesta → demo.",
  linkedin: "Flujo: detección en LinkedIn → CRM → mensaje inicial → follow-up → demo.",
  multichannel: "Flujo: captación → CRM → outreach multicanal → respuesta → demo.",
};

export function growthBuilderMeta(isSaving = false): OwnerModuleMeta {
  const processState: OwnerProcessState = isSaving ? "working" : "draft";
  return {
    title: "Constructor de campañas",
    helperText: "Define el objetivo y activa el flujo de captación y seguimiento comercial.",
    processState,
    stateLabel: labelForState(processState),
    nextStep: isSaving
      ? "Guardando configuración y preparando lanzamiento."
      : "Configurar objetivo, canal y mensaje base antes del lanzamiento.",
    nextAction: {
      label: isSaving ? "Guardando..." : "Lanzar campaña",
    },
  };
}

export function growthHistoryMeta(hasCampaigns = false): OwnerModuleMeta {
  const processState: OwnerProcessState = hasCampaigns ? "active" : "draft";
  return {
    title: "Historial de campañas",
    helperText: "Muestra el avance real de cada campaña y su punto actual en el embudo.",
    processState,
    stateLabel: labelForState(processState),
    nextStep: hasCampaigns
      ? "Identificar campañas pausadas, fallidas o esperando respuesta."
      : "Crear la primera campaña para empezar a medir el pipeline.",
  };
}

export function growthObjectiveFlow(
  objective?: Nullable<string>,
  channel?: Nullable<string>,
): string {
  const objectiveKey = String(objective || "").trim().toLowerCase();
  const channelKey = String(channel || "").trim().toLowerCase();

  if (objectiveKey && growthObjectiveFlowMap[objectiveKey]) {
    return growthObjectiveFlowMap[objectiveKey];
  }

  if (channelKey.includes("linkedin")) {
    return "Flujo: detección en LinkedIn → CRM → mensaje inicial → follow-up → demo.";
  }

  if (channelKey.includes("email")) {
    return "Flujo: segmentación → CRM → secuencia de email → respuesta → demo.";
  }

  if (channelKey.includes("multi") || channelKey.includes("mix")) {
    return "Flujo: captación → CRM → outreach multicanal → respuesta → demo.";
  }

  return "Flujo: captación → CRM → outreach → respuesta → demo.";
}

export function resolveGrowthCampaignMeta(
  campaign?: GrowthCampaignLike,
): OwnerModuleMeta {
  const processState = normalizeGrowthState(campaign?.status, campaign?.execution_status);
  const flow = growthObjectiveFlow(campaign?.objective, campaign?.channel);

  return {
    title: "Campaña",
    helperText: flow,
    processState,
    stateLabel: labelForState(processState),
    nextStep:
      processState === "waiting_action"
        ? "Revisar respuestas pendientes y decidir siguiente contacto."
        : processState === "draft"
          ? "Completar configuración y lanzar campaña."
          : processState === "failed"
            ? "Revisar el bloqueo y reactivar la ejecución."
            : processState === "completed"
              ? "Analizar resultados y decidir siguiente oleada."
              : "Seguir el progreso y ajustar el outreach si hace falta.",
    nextAction:
      processState === "draft"
        ? { label: "Activar campaña" }
        : processState === "waiting_action"
          ? { label: "Continuar seguimiento" }
          : processState === "failed"
            ? { label: "Revisar bloqueo" }
            : undefined,
  };
}

export function marketingBuilderMeta(isSaving = false): OwnerModuleMeta {
  const processState: OwnerProcessState = isSaving ? "working" : "draft";
  return {
    title: "Crear promoción",
    helperText: "Registra una promoción interna con target, incentivo, duración y destino previsto. No activa automatización real por sí sola.",
    processState,
    stateLabel: labelForState(processState),
    nextStep: isSaving
      ? "Guardando borrador y preparando revisión owner."
      : "Definir target, destino y dejarla lista antes de activación real.",
    nextAction: {
      label: isSaving ? "Guardando..." : "Crear promoción",
    },
  };
}

export function marketingHistoryMeta(hasPromotions = false): OwnerModuleMeta {
  const processState: OwnerProcessState = hasPromotions ? "waiting_action" : "draft";
  return {
    title: "Historial de promociones",
    helperText: "Permite revisar promociones registradas, su estado operativo y si impactan una superficie conectada.",
    processState,
    stateLabel: labelForState(processState),
    nextStep: hasPromotions
      ? "Detectar qué promociones siguen en borrador, cuáles están pausadas y cuáles aún no tienen automatización."
      : "Crear la primera promoción para dejar trazabilidad comercial.",
  };
}

export const marketingPromotionFlow =
  "Flujo MVP: definición de target → configuración del beneficio → selección del destino previsto → revisión owner → activación interna/pausa → seguimiento de usos registrados.";

export const marketingPromotionLifecycleFlow = marketingPromotionFlow;

export function resolveMarketingPromotionMeta(
  promo?: MarketingPromotionLike,
): OwnerModuleMeta {
  const processState = normalizeMarketingState(promo);

  return {
    title: "Promoción",
    helperText: marketingPromotionFlow,
    processState,
    stateLabel: labelForState(processState),
    nextStep:
      processState === "draft"
        ? "Revisar condiciones y completar el borrador."
        : processState === "active"
          ? "Seguir uso y confirmar que la superficie conectada sigue vigente."
          : processState === "completed"
            ? "Analizar resultados y decidir si archivar o relanzar."
            : processState === "failed"
              ? "Corregir el problema antes de volver a activarla."
              : "Revisar el siguiente paso operativo o si falta conexión real.",
    nextAction:
      processState === "draft"
        ? { label: "Editar borrador" }
        : processState === "active"
          ? { label: "Ver detalle" }
          : undefined,
  };
}

export const growthCampaignBuilderMeta = growthBuilderMeta;
export const growthCampaignHistoryMeta = growthHistoryMeta;
export const resolveGrowthFlow = growthObjectiveFlow;
export const marketingPromoBuilderMeta = marketingBuilderMeta;
export const marketingPromoHistoryMeta = marketingHistoryMeta;
export const resolvePromoCodeMeta = resolveMarketingPromotionMeta;

export function marketingFlowMeta(isActive = false): OwnerModuleMeta {
  const processState: OwnerProcessState = isActive ? "waiting_action" : "draft";
  return {
    title: "Flujo de promoción",
    helperText: marketingPromotionFlow,
    processState,
    stateLabel: labelForState(processState),
    nextStep: isActive
      ? "Revisar si la promoción ya tiene destino conectado o solo está configurada."
      : "Definir condiciones, guardar el borrador y decidir si requiere activación real.",
  };
}

export const resolvePromoMeta = resolveMarketingPromotionMeta;
