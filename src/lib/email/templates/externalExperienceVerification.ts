import { resolveCompanyDisplayName } from "@/lib/company/company-profile";

type ExternalExperienceVerificationEmailParams = {
  candidateName?: string | null;
  companyName?: string | null;
  roleTitle?: string | null;
  verificationLink?: string | null;
  // Compatibilidad con implementaciones anteriores
  link?: string | null;
};

export function buildExternalExperienceVerificationEmail(
  params: ExternalExperienceVerificationEmailParams,
) {
  const subject = "Solicitud de verificación laboral — Verijob";
  const verificationLink = String(
    params.verificationLink || params.link || "",
  ).trim();
  const candidateName = String(params.candidateName || "Candidato").trim();
  const companyName = resolveCompanyDisplayName(params.companyName, "Tu empresa");
  const roleTitle = String(params.roleTitle || "puesto no especificado").trim();

  const text = [
    "Solicitud de verificación de experiencia laboral",
    "",
    `Un candidato (${candidateName}) ha indicado que trabajó en ${companyName} como ${roleTitle} y ha solicitado verificar esta experiencia a través de Verijob.`,
    "",
    "Le pedimos confirmar si esta experiencia es correcta.",
    "",
    "Verificar experiencia:",
    verificationLink,
    "",
    "Este proceso tarda menos de 30 segundos y ayuda a crear perfiles profesionales verificables.",
    "",
    "Opciones de verificación:",
    "- Confirmar experiencia",
    "- Rechazar experiencia",
    "",
    "Verijob — Infraestructura de credenciales laborales verificadas.",
    "",
    "Si usted no reconoce esta solicitud simplemente ignore este mensaje.",
  ].join("\n");

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
                <h1 style="margin:0;font-size:24px;line-height:1.3;color:#0f172a;">Solicitud de verificación de experiencia laboral</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;">
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Un candidato ha indicado que trabajó en su empresa y ha solicitado verificar esta experiencia a través de Verijob.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155;">
                  Le pedimos confirmar si esta experiencia es correcta.
                </p>
                <p style="margin:0 0 6px 0;font-size:14px;line-height:1.5;color:#475569;">
                  <strong>Candidato:</strong> ${escapeHtml(candidateName)}<br/>
                  <strong>Empresa:</strong> ${escapeHtml(companyName)}<br/>
                  <strong>Puesto:</strong> ${escapeHtml(roleTitle)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 8px 24px;">
                <a href="${escapeHtml(verificationLink)}" style="display:inline-block;background:#3b5bd6;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1;padding:14px 18px;border-radius:10px;">
                  Verificar experiencia
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 0 24px;">
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#475569;">
                  Este proceso tarda menos de 30 segundos y ayuda a crear perfiles profesionales verificables.
                </p>
                <p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#475569;">
                  Opciones de verificación:
                </p>
                <ul style="margin:0 0 14px 20px;padding:0;color:#334155;font-size:14px;line-height:1.6;">
                  <li>Confirmar experiencia</li>
                  <li>Rechazar experiencia</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px 0 24px;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 10px 0;font-size:13px;line-height:1.6;color:#475569;">
                  Verijob — Infraestructura de credenciales laborales verificadas.
                </p>
                <p style="margin:0 0 20px 0;font-size:12px;line-height:1.6;color:#64748b;">
                  Si usted no reconoce esta solicitud simplemente ignore este mensaje.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return {
    subject,
    html,
    text,
    // Compatibilidad con código existente que lea tpl.body
    body: text,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
