export function buildExternalExperienceVerificationEmail(params: { link: string }) {
  const subject = "Confirmación de experiencia laboral en VERIJOB";
  const body = [
    "Un candidato ha indicado que trabajó en su empresa.",
    "",
    "Puede confirmar o rechazar esta experiencia aquí:",
    params.link,
    "",
    "Este proceso tarda menos de 30 segundos.",
    "No necesita crear cuenta.",
  ].join("\n");

  return { subject, body };
}
