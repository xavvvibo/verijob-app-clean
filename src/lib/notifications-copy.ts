export function buildVerificationNotification({
  company,
  confidence,
}: {
  company: string;
  confidence: "high" | "medium" | "low";
}) {
  return {
    title: "Validación completada",
    body:
      confidence === "high"
        ? `${company} · Validación con alta confianza`
        : confidence === "medium"
        ? `${company} · Validación con confianza media`
        : `${company} · Validación con baja confianza`,
  };
}
