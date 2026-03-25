export function buildDeprecatedPublicCvResponse() {
  return {
    error: "route_deprecated",
    details: "La resolucion publica de CV por user_id queda deshabilitada. Usa el endpoint canonico por token publico.",
    route: "/pages/api/public/cv/[user_id]",
    source_of_truth: "/api/public/candidate/[token]",
  };
}
