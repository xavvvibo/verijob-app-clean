type SubscriptionEmailKind =
  | "plan_updated"
  | "owner_plan_updated"
  | "trial_extended"
  | "payment_failed"
  | "subscription_changed"
  | "subscription_renewed";

type BuildSubscriptionEmailInput = {
  kind: SubscriptionEmailKind;
  planName?: string | null;
  previousPlanName?: string | null;
  effectiveAt?: string | null;
  periodEnd?: string | null;
  immediate?: boolean;
  dashboardUrl?: string | null;
  billingUrl?: string | null;
  reason?: string | null;
};

function esc(value: unknown) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function headline(kind: SubscriptionEmailKind) {
  if (kind === "plan_updated") return "Tu plan de VERIJOB ha sido actualizado";
  if (kind === "owner_plan_updated") return "Tu plan de VERIJOB ha sido actualizado por el equipo";
  if (kind === "trial_extended") return "Tu periodo de prueba de VERIJOB ha sido ampliado";
  if (kind === "payment_failed") return "No hemos podido procesar tu pago en VERIJOB";
  if (kind === "subscription_changed") return "Tu suscripción de VERIJOB ha cambiado";
  return "Tu suscripción de VERIJOB se ha renovado";
}

function bodyCopy(input: BuildSubscriptionEmailInput) {
  const plan = input.planName || "tu plan actual";
  const prev = input.previousPlanName || null;
  const eff = fmtDate(input.effectiveAt);
  const periodEnd = fmtDate(input.periodEnd);
  const immediate = input.immediate !== false;
  const reason = input.reason ? String(input.reason).trim() : null;

  if (input.kind === "plan_updated" || input.kind === "owner_plan_updated") {
    return {
      lead: prev
        ? `Hemos registrado un cambio de plan de ${prev} a ${plan}.`
        : `Hemos registrado una actualización de tu plan a ${plan}.`,
      detail: immediate
        ? "El cambio aplica de forma inmediata en tu cuenta."
        : `El cambio aplicará en la próxima renovación${eff ? ` (${eff})` : ""}.`,
      ctaLabel: "Ir a suscripción",
    };
  }

  if (input.kind === "trial_extended") {
    return {
      lead: `Tu periodo de prueba se ha extendido para el plan ${plan}.`,
      detail: periodEnd
        ? `La nueva fecha de fin de trial es ${periodEnd}.`
        : "La extensión de trial se ha aplicado correctamente.",
      ctaLabel: "Revisar suscripción",
    };
  }

  if (input.kind === "payment_failed") {
    return {
      lead: `No hemos podido procesar el cobro de tu suscripción (${plan}).`,
      detail: "Actualiza tu método de pago para evitar interrupciones en el servicio.",
      ctaLabel: "Ir a facturación",
    };
  }

  if (input.kind === "subscription_changed") {
    return {
      lead: `Se ha registrado un cambio en tu suscripción (${plan}).`,
      detail:
        reason ||
        (immediate
          ? "El cambio ya está reflejado en tu cuenta."
          : `El cambio se aplicará en la próxima renovación${eff ? ` (${eff})` : ""}.`),
      ctaLabel: "Revisar suscripción",
    };
  }

  return {
    lead: `Tu suscripción (${plan}) se ha renovado correctamente.`,
    detail: periodEnd ? `Próxima renovación estimada: ${periodEnd}.` : "La renovación se ha procesado correctamente.",
    ctaLabel: "Ver suscripción",
  };
}

export function buildSubscriptionLifecycleEmail(input: BuildSubscriptionEmailInput) {
  const title = headline(input.kind);
  const copy = bodyCopy(input);
  const dashboardUrl = String(input.dashboardUrl || "").trim();
  const billingUrl = String(input.billingUrl || "").trim();
  const ctaUrl = input.kind === "payment_failed" && billingUrl ? billingUrl : dashboardUrl || billingUrl;
  const footer = "Si no reconoces este cambio, contacta con soporte desde tu panel.";

  const text = [
    title,
    "",
    copy.lead,
    copy.detail,
    ctaUrl ? `\n${copy.ctaLabel}: ${ctaUrl}` : "",
    "",
    footer,
    "",
    "VERIJOB",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px 24px 8px 24px;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;color:#0f172a;">${esc(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;">
                <p style="margin:0 0 12px 0;font-size:15px;line-height:1.6;color:#334155;">${esc(copy.lead)}</p>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:#475569;">${esc(copy.detail)}</p>
              </td>
            </tr>
            ${ctaUrl ? `
            <tr>
              <td style="padding:0 24px 8px 24px;">
                <a href="${esc(ctaUrl)}" style="display:inline-block;background:#3b5bd6;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1;padding:12px 16px;border-radius:10px;">
                  ${esc(copy.ctaLabel)}
                </a>
              </td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding:14px 24px 22px 24px;border-top:1px solid #e2e8f0;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">${esc(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return {
    subject: title,
    html,
    text,
  };
}
