import { resolveCompanyDisplayName } from "@/lib/company/company-profile";

type CompanyCandidateImportInviteEmailParams = {
  companyName?: string | null;
  candidateEmail?: string | null;
  candidateName?: string | null;
  targetRole?: string | null;
  acceptanceLink?: string | null;
};

export function buildCompanyCandidateImportInviteEmail(
  params: CompanyCandidateImportInviteEmailParams,
) {
  const companyName = resolveCompanyDisplayName(params.companyName, "Tu empresa");
  const candidateName = String(params.candidateName || "").trim();
  const targetRole = String(params.targetRole || "").trim();
  const candidateEmail = String(params.candidateEmail || "").trim();
  const acceptanceLink = String(params.acceptanceLink || "").trim();
  const subject = `La empresa ${companyName} ha incluido tu perfil en su proceso de selección`;

  const greetingName = candidateName || candidateEmail || "Hola";
  const roleLine = targetRole ? `Puesto asociado: ${targetRole}` : null;

  const text = [
    `${greetingName},`,
    "",
    `${companyName} utiliza VERIJOB para gestionar candidaturas con perfiles verificables.`,
    "Ha incorporado tu CV a su proceso de selección y te invita a revisar la importación inicial de tu perfil.",
    "",
    "Antes de continuar podrás confirmar expresamente:",
    `- que entregaste voluntariamente tu CV a ${companyName}`,
    `- que aceptas que ${companyName} gestione tu candidatura mediante VERIJOB`,
    "- que autorizas la importación y estructuración inicial de los datos de tu CV",
    "- que podrás revisar, corregir y completar la información antes de publicarla o verificarla",
    "",
    roleLine,
    "",
    "Revisar y aceptar invitación:",
    acceptanceLink,
    "",
    "Completar tu perfil en VERIJOB te permitirá continuar el proceso con un perfil más estructurado y fiable.",
    "",
    "Si este mensaje no corresponde contigo, puedes ignorarlo.",
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
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:30px 28px 12px 28px;">
                <p style="margin:0 0 12px 0;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#475569;">VERIJOB</p>
                <h1 style="margin:0;font-size:26px;line-height:1.3;color:#0f172a;">${escapeHtml(companyName)} ha incluido tu perfil en un proceso de selección</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 8px 28px;">
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#334155;">
                  ${escapeHtml(companyName)} utiliza VERIJOB para gestionar candidaturas con perfiles verificables. Ha incorporado tu CV a su proceso de selección.
                </p>
                <p style="margin:0 0 14px 0;font-size:15px;line-height:1.7;color:#334155;">
                  Podrás revisar tu perfil pre-rellenado y confirmar expresamente la gestión de tu candidatura antes de continuar.
                </p>
                <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#475569;">
                  <strong>Email asociado:</strong> ${escapeHtml(candidateEmail || "No indicado")}<br/>
                  ${targetRole ? `<strong>Puesto asociado:</strong> ${escapeHtml(targetRole)}<br/>` : ""}
                  <strong>Empresa:</strong> ${escapeHtml(companyName)}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 8px 28px;">
                <a href="${escapeHtml(acceptanceLink)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1;padding:15px 18px;border-radius:10px;">
                  Revisar y aceptar invitación
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 0 28px;">
                <ul style="margin:0;padding-left:18px;color:#475569;font-size:14px;line-height:1.7;">
                  <li>Confirmarás que entregaste voluntariamente tu CV a esta empresa.</li>
                  <li>Aceptarás la importación inicial y estructuración de tus datos.</li>
                  <li>Podrás revisar, corregir y completar la información antes de publicarla o verificarla.</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 24px 28px;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 10px 0;font-size:13px;line-height:1.7;color:#475569;">
                  Completar tu perfil en VERIJOB te permitirá continuar el proceso con un perfil más fiable y estructurado.
                </p>
                <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">
                  Si este mensaje no corresponde contigo, puedes ignorarlo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return { subject, text, html, body: text };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
