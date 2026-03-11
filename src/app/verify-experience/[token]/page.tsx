import ResolveExperienceForm from "./ResolveExperienceForm";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { createServerSupabaseClient } from "@/utils/supabase/server";

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
  const primaryCtaLabel = hasCompanySession ? "Ir a mi panel empresa" : "Crear cuenta empresa Free";
  const secondaryCtaHref = hasCompanySession ? "/company/upgrade" : "/pricing";
  const secondaryCtaLabel = "Ver ventajas del plan Pro";

  const { data: rows, error } = await admin
    .from("verification_requests")
    .select(
      "id,requested_by,company_name_target,external_token_expires_at,external_resolved,employment_record_id,request_context"
    )
    .eq("external_token", normalizedToken)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("verification lookup error", error);
  }

  const requestRow = rows && rows.length > 0 ? rows[0] : null;

  if (!requestRow) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Enlace no encontrado</h2>
          <p className="mt-2 text-sm text-slate-600">
            Este enlace de verificación no existe o ya no está disponible.
            Solicita al candidato que genere un nuevo enlace.
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
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Enlace caducado</h2>
          <p className="mt-2 text-sm text-slate-600">
            Este enlace de verificación ha caducado. Solicita al candidato que
            genere una nueva solicitud de verificación.
          </p>
        </div>
      </main>
    );
  }

  if (requestRow.external_resolved) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Respuesta registrada</h2>
            <p className="mt-2 text-sm text-slate-600">
            Esta solicitud de verificación ya ha sido respondida previamente.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Si necesitas gestionar verificaciones de forma continuada, puedes crear tu cuenta de empresa en Verijob.
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={primaryCtaHref}
              className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
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
  const companyName = String(requestRow.company_name_target || employment?.company_name_freeform || "").trim() || "Empresa no especificada";
  const roleTitle =
    String((requestRow.request_context as any)?.position || employment?.position || "").trim() || "Puesto no especificado";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">VERIJOB</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Verificación de experiencia laboral</h1>
          <p className="mt-2 text-sm text-slate-600">
            Un candidato ha solicitado verificar esta experiencia laboral.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Detalle de la solicitud</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidato</dt>
              <dd className="mt-1 text-sm text-slate-900">{candidateName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Empresa</dt>
              <dd className="mt-1 text-sm text-slate-900">{companyName}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puesto</dt>
              <dd className="mt-1 text-sm text-slate-900">{roleTitle}</dd>
            </div>
          </dl>
        </section>

        <ResolveExperienceForm
          token={normalizedToken}
          primaryCtaHref={primaryCtaHref}
          primaryCtaLabel={primaryCtaLabel}
          secondaryCtaHref={secondaryCtaHref}
          secondaryCtaLabel={secondaryCtaLabel}
        />

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h3 className="text-sm font-semibold text-blue-900">Gestiona verificaciones en Verijob</h3>
          <p className="mt-2 text-sm text-blue-800">
            Gestiona verificaciones y accede a más funcionalidades creando tu cuenta de empresa en Verijob.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/signup?mode=company"
              className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Crear cuenta empresa Free
            </a>
            <a
              href="/pricing"
              className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50"
            >
              Conocer ventajas del plan Pro
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
