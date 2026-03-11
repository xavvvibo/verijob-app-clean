import { createServiceRoleClient } from "@/utils/supabase/service";
import ResolveExperienceForm from "./ResolveExperienceForm";

type PageProps = {
  params: Promise<{ token: string }>;
};

function maskCandidateName(fullName: string | null | undefined) {
  const raw = String(fullName || "").trim();
  if (!raw) return "Candidato";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const secondInitial = parts[1]?.charAt(0)?.toUpperCase() || "";
  return secondInitial ? `${first} ${secondInitial}.` : first;
}

function formatDate(value?: string | null) {
  if (!value) return "No especificada";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No especificada";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function VerifyExperienceByTokenPage({ params }: PageProps) {
  const { token } = await params;
  const normalizedToken = decodeURIComponent(String(token || ""))
    .trim()
    .replace(/\s+/g, "");

  console.info("[verify-experience] token received", {
    raw_length: String(token || "").length,
    normalized_length: normalizedToken.length,
    token_prefix: normalizedToken.slice(0, 8),
  });

  if (!normalizedToken) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Enlace no válido</h1>
          <p className="mt-2 text-sm text-slate-600">
            Este enlace no contiene un token de verificación válido. Revisa el email recibido y vuelve a intentarlo.
          </p>
        </div>
      </main>
    );
  }

  const admin = createServiceRoleClient();

  const { data: requestRows, error: requestErr } = await admin
    .from("verification_requests")
    .select("id,requested_by,company_name_target,external_token_expires_at,external_resolved,employment_record_id")
    .eq("external_token", normalizedToken)
    .order("created_at", { ascending: false })
    .limit(1);

  if (requestErr) {
    console.error("[verify-experience] token lookup failed", {
      token_prefix: normalizedToken.slice(0, 8),
      code: (requestErr as any)?.code || null,
      message: requestErr.message,
      details: (requestErr as any)?.details || null,
    });
  }

  const requestRow = Array.isArray(requestRows) && requestRows.length > 0 ? requestRows[0] : null;

  console.info("[verify-experience] token lookup result", {
    token_prefix: normalizedToken.slice(0, 8),
    found: Boolean(requestRow?.id),
    rows: Array.isArray(requestRows) ? requestRows.length : 0,
  });

  if (!requestRow?.id) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Enlace no encontrado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Este enlace de verificación no existe o ya no está disponible. Solicita al candidato que genere un nuevo
            enlace.
          </p>
        </div>
      </main>
    );
  }

  const expiresAt = requestRow.external_token_expires_at ? Date.parse(String(requestRow.external_token_expires_at)) : NaN;
  if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">Enlace caducado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Este enlace de verificación ha caducado. Solicita un nuevo enlace al candidato.
          </p>
        </div>
      </main>
    );
  }

  const { data: candidateProfile } = requestRow.requested_by
    ? await admin.from("profiles").select("full_name").eq("id", requestRow.requested_by).maybeSingle()
    : { data: null as any };

  const { data: employment } = requestRow.employment_record_id
    ? await admin
        .from("employment_records")
        .select("position,start_date,end_date,company_name_freeform")
        .eq("id", requestRow.employment_record_id)
        .maybeSingle()
    : { data: null as any };

  const companyName = requestRow.company_name_target || employment?.company_name_freeform || "Empresa objetivo";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">VERIJOB</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Verificación de experiencia laboral</h1>
          <p className="mt-2 text-sm text-slate-600">
            Puedes confirmar o rechazar esta experiencia en menos de 30 segundos. No necesitas crear cuenta.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Detalle de la experiencia</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidato</dt>
              <dd className="mt-1 text-sm text-slate-900">{maskCandidateName(candidateProfile?.full_name)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa solicitada</dt>
              <dd className="mt-1 text-sm text-slate-900">{companyName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puesto</dt>
              <dd className="mt-1 text-sm text-slate-900">{employment?.position || "No especificado"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo</dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatDate(employment?.start_date)} — {employment?.end_date ? formatDate(employment?.end_date) : "Actualidad"}
              </dd>
            </div>
          </dl>
          {requestRow.external_resolved ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Esta solicitud ya fue respondida anteriormente.
            </div>
          ) : null}
        </section>

        {!requestRow.external_resolved ? <ResolveExperienceForm token={normalizedToken} /> : null}
      </div>
    </main>
  );
}
