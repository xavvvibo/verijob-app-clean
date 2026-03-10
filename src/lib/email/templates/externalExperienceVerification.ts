export function buildExternalExperienceVerificationEmail(params: { link: string }) {
  const subject = "Confirmación de experiencia laboral en VERIJOB";
  const body = [
    "Un candidato ha solicitado validar una experiencia laboral en su empresa.",
    "",
    "Revise y confirme o rechace esta experiencia aquí:",
    params.link,
    "",
    "El proceso tarda menos de 30 segundos y no requiere crear cuenta.",
    "La validación aplica únicamente a esa experiencia, no al perfil completo del candidato.",
    "",
    "Si no reconoce la solicitud, puede ignorar este mensaje.",
  ].join("\n");

  return { subject, body };
}
