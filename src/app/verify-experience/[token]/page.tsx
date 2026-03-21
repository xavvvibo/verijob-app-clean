import ResolveExperienceForm from "./ResolveExperienceForm";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function VerifyExperiencePage({ params }: PageProps) {
  const { token } = await params;
  const rawToken = token || "";

  const normalizedToken = decodeURIComponent(String(rawToken))
    .trim()
    .replace(/\s+/g, "");

  const admin = createServiceRoleClient();
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role,active_company_id").eq("id", user.id).maybeSingle()
    : { data: null as any };

  const hasCompanySession = Boolean(user && profile?.role === "company");
  const primaryCtaHref = hasCompanySession ? "/company" : "/signup?mode=company";
  const primaryCtaLabel = hasCompanySession ? "Ir a mi panel de empresa" : "Crear cuenta empresa";
  const secondaryCtaHref = hasCompanySession ? "/company/requests" : "/precios";
  const secondaryCtaLabel = hasCompanySession ? "Ver solicitudes" : "Ver planes";

  let rows: any[] | null = null;
  let error: any = null;

  const primaryLookup = await admin
    .from("verification_requests")
    .select(
      "id,requested_by,company_name_target,external_token_expires_at,external_resolved,status,resolved_at,employment_record_id,request_context"
    )
    .eq("external_token", normalizedToken)
    .order("created_at", { ascending: false })
    .limit(1);

  rows = primaryLookup.data as any[] | null;
  error = primaryLookup.error;

  if (error && isMissingExternalResolvedColumn(error)) {
    const fallbackLookup = await admin
      .from("verification_requests")
      .select(
        "id,requested_by,company_name_target,external_token_expires_at,status,resolved_at,employment_record_id,request_context"
      )
      .eq("external_token", normalizedToken)
      .order("created_at", { ascending: false })
      .limit(1);
    rows = fallbackLookup.data as any[] | null;
    error = fallbackLookup.error;
  }

  if (error) {
    console.error("verification lookup error", error);
  }

  const requestRow = rows && rows.length > 0 ? rows[0] : null;

  if (!requestRow) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Enlace no disponible</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Este enlace ya no existe o no está disponible. Pide al candidato que genere una nueva solicitud.
          </p>
        </div>
      </main>
    );
  }

  const expiresAt = requestRow.external_token_expires_at
    ? new Date(requestRow.external_token_expires_at)
    : null;

  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">Enlace caducado</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Esta solicitud ya ha caducado. Pide al candidato que genere una nueva verificación.
          </p>
        </div>
      </main>
    );
  }

  if (isVerificationExternallyResolved(requestRow)) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Respuesta ya registrada</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Esta solicitud ya fue respondida anteriormente y ha quedado guardada en Verijob.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Si quieres gestionar este tipo de validaciones de forma continua, puedes hacerlo desde tu panel de empresa.
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={primaryCtaHref}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {primaryCtaLabel}
            </a>
            <a
              href={secondaryCtaHref}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {secondaryCtaLabel}
            </a>
          </div>
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

  const candidateName = String(candidateProfile?.full_name || "").trim() || "Candidato";
  const companyName = resolveCompanyDisplayName(
    requestRow.company_name_target || employment?.company_name_freeform || null,
    "Empresa",
  );
  const roleTitle =
    String((requestRow.request_context as any)?.position || employment?.position || "").trim() || "Puesto no especificado";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">VERIJOB</div>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">Validación de experiencia laboral</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            El candidato ha pedido confirmar si trabajó en esta experiencia. Tu respuesta quedará registrada como validación de esa experiencia concreta.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Resumen de la solicitud</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Candidato</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{candidateName}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Empresa</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{companyName}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-500">Puesto</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{roleTitle}</div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Tu respuesta valida esta experiencia laboral concreta. El sistema registrará también la empresa y el dominio desde el que se responde para calcular el nivel de confianza de la validación.
          </div>
        </section>

        <ResolveExperienceForm
          token={normalizedToken}
          primaryCtaHref={primaryCtaHref}
          primaryCtaLabel={primaryCtaLabel}
          secondaryCtaHref={secondaryCtaHref}
          secondaryCtaLabel={secondaryCtaLabel}
        />
      </div>
    </main>
  );
}
