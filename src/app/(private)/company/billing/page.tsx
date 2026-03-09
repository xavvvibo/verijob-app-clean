import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

function planLabel(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("company_team")) return "Team";
  if (plan.includes("company_hiring")) return "Hiring";
  if (plan.includes("company_access")) return "Access";
  if (plan.includes("company_enterprise")) return "Enterprise";
  return "Free";
}

function formatDate(value?: string | null) {
  if (!value) return "No disponible";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No disponible";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function planFeatures(label: string) {
  if (label === "Team") return ["Mayor capacidad operativa", "Mayor volumen de revisión", "Escalado de equipo y trazabilidad"];
  if (label === "Hiring") return ["Más revisiones simultáneas", "Acceso ampliado a candidatos", "Mejor throughput de validación"];
  if (label === "Access") return ["Acceso básico a revisión", "Consulta de candidatos por token", "Gestión inicial de solicitudes"];
  if (label === "Enterprise") return ["Capacidad avanzada", "Operación a gran escala", "Acuerdos personalizados"];
  return ["Panel básico", "Solicitudes en modo limitado", "Visibilidad del valor premium para upgrade"];
}

function verificationStatusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "Empresa verificada por suscripción";
  if (status === "verified_document") return "Empresa verificada por documentación";
  return "Empresa no verificada";
}

function verificationStatusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "verified_document") return "border-blue-200 bg-blue-50 text-blue-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

async function resolveCompanyVerificationStatus(
  supabase: any,
  companyId: string,
  subscriptionStatusRaw: unknown
) {
  const subscriptionStatus = String(subscriptionStatusRaw || "").toLowerCase();
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") return "verified_paid";

  const companyRes = await supabase
    .from("companies")
    .select("company_verification_status")
    .eq("id", companyId)
    .maybeSingle();

  if (!companyRes.error && companyRes.data?.company_verification_status) {
    return String(companyRes.data.company_verification_status);
  }

  const profileRes = await supabase
    .from("company_profiles")
    .select("company_verification_status")
    .eq("company_id", companyId)
    .maybeSingle();

  if (!profileRes.error && profileRes.data?.company_verification_status) {
    return String(profileRes.data.company_verification_status);
  }

  return "unverified";
}

function computeProfileCompleteness(profile: any) {
  if (!profile) return 0;
  const checks = [
    Boolean(profile.legal_name),
    Boolean(profile.trade_name),
    Boolean(profile.tax_id),
    Boolean(profile.website_url),
    Boolean(profile.contact_email),
    Boolean(profile.contact_phone),
    Boolean(profile.country),
    Boolean(profile.province),
    Boolean(profile.city),
    Boolean(profile.fiscal_address),
    Boolean(profile.sector),
    Boolean(profile.subsector),
    Boolean(profile.primary_activity),
    Boolean(profile.employee_count_range),
    Boolean(profile.annual_hiring_volume_range),
    Array.isArray(profile.common_roles_hired) && profile.common_roles_hired.length > 0,
    Array.isArray(profile.common_contract_types) && profile.common_contract_types.length > 0,
    Array.isArray(profile.common_workday_types) && profile.common_workday_types.length > 0,
    Array.isArray(profile.common_languages_required) && profile.common_languages_required.length > 0,
    Array.isArray(profile.hiring_zones) && profile.hiring_zones.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default async function CompanyBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan,status,current_period_end,cancel_at_period_end")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();
  const { data: companyProfile } = profile?.active_company_id
    ? await supabase
        .from("company_profiles")
        .select("*")
        .eq("company_id", profile.active_company_id)
        .maybeSingle()
    : ({ data: null } as any);

  const label = planLabel(sub?.plan);
  const status = String(sub?.status || "free").toLowerCase();
  const isActive = status === "active" || status === "trialing";
  const features = planFeatures(label);
  const verificationStatus = profile?.active_company_id
    ? await resolveCompanyVerificationStatus(supabase, profile.active_company_id, status)
    : "unverified";
  const profileCompletenessScore = Number(
    companyProfile?.profile_completeness_score ?? computeProfileCompleteness(companyProfile)
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Suscripción de empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Consulta el estado de tu plan, límites operativos y opciones para ampliar capacidad de revisión.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Estado actual</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-semibold text-slate-900">{label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Estado</dt>
              <dd className="font-semibold text-slate-900">{isActive ? "Activo" : "Sin suscripción activa"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Próxima renovación</dt>
              <dd className="font-semibold text-slate-900">{formatDate(sub?.current_period_end || null)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Cancelación programada</dt>
              <dd className="font-semibold text-slate-900">{sub?.cancel_at_period_end ? "Sí" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Estado de empresa</dt>
              <dd>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${verificationStatusClass(verificationStatus)}`}>
                  {verificationStatusLabel(verificationStatus)}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Perfil de empresa</dt>
              <dd className="font-semibold text-slate-900">{profileCompletenessScore}% completado</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/company/upgrade" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">
              Mejorar plan
            </Link>
            <a href="/company" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
              Volver al dashboard
            </a>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            El portal de facturación Stripe para empresas se conecta en el siguiente bloque de monetización. Mientras tanto, el estado del plan se refleja aquí.
          </p>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold text-slate-900">Qué incluye tu nivel actual</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>

          {!isActive ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Activa un plan para ampliar candidatos consultables, ritmo de revisión y capacidad de equipo.
            </div>
          ) : null}
          {String(verificationStatus).toLowerCase() === "unverified" ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
              Verifica tu empresa para aumentar la credibilidad de tus verificaciones.
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Modelo de estados</p>
            <ul className="mt-2 space-y-1">
              <li>• Empresa free no verificada: acceso base, estado no verificado.</li>
              <li>• Empresa free verificada: credibilidad documental sin plan activo.</li>
              <li>• Empresa con plan activo: estado verificada por suscripción.</li>
            </ul>
          </div>
        </aside>
      </section>
    </div>
  );
}
