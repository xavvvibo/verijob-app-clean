import Link from "next/link";
import { redirect } from "next/navigation";
import { readEffectiveSubscriptionState } from "@/lib/billing/effectiveSubscription";
import { companyVerificationMethodTone, deriveCompanyVerificationMethod } from "@/lib/company/verification-method";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import CompanyPlanActions from "./CompanyPlanActions";

export const dynamic = "force-dynamic";

function planLabel(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (!plan || plan === "company_free" || plan === "free") return "Free";
  if (plan.includes("company_access")) return "Access";
  if (plan.includes("company_hiring")) return "Hiring";
  if (plan.includes("company_team")) return "Team";
  if (plan.includes("company_enterprise")) return "Enterprise";
  return planRaw ? String(planRaw) : "Free";
}

function formatDate(value?: string | null) {
  if (!value) return "No aplica";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No aplica";
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function normalizeSubscriptionStatus(raw: unknown) {
  const s = String(raw || "").toLowerCase();
  if (!s || s === "free") return "free";
  if (s === "active") return "active";
  if (s === "trialing") return "trialing";
  if (s === "canceled" || s === "cancelled") return "canceled";
  if (s === "past_due") return "past_due";
  if (s === "unpaid") return "unpaid";
  if (s === "incomplete") return "incomplete";
  if (s === "incomplete_expired") return "incomplete_expired";
  return s;
}

function subscriptionStatusLabel(statusRaw: unknown) {
  const status = normalizeSubscriptionStatus(statusRaw);
  if (status === "free") return "Free / sin suscripción activa";
  if (status === "active") return "Activa";
  if (status === "trialing") return "Trial activo";
  if (status === "canceled") return "Cancelada";
  if (status === "past_due") return "Pendiente de pago";
  if (status === "unpaid") return "Impagada";
  if (status === "incomplete") return "Incompleta";
  if (status === "incomplete_expired") return "Incompleta expirada";
  return status;
}

function subscriptionStatusClass(statusRaw: unknown) {
  const status = normalizeSubscriptionStatus(statusRaw);
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "trialing") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "free" || status === "canceled") return "border-slate-200 bg-slate-100 text-slate-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function verificationStatusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "Empresa verificada por suscripción";
  if (status === "verified_document") return "Empresa verificada por documentación";
  if (status === "pending_review") return "Empresa pendiente de revisión documental";
  if (status === "rejected") return "Empresa rechazada en revisión documental";
  return "Empresa no verificada";
}

function verificationStatusClass(statusRaw: unknown) {
  const status = String(statusRaw || "").toLowerCase();
  if (status === "verified_paid") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "verified_document") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "pending_review") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function planFeatures(label: string) {
  if (label === "Enterprise") return ["Capacidad avanzada de revisión", "Cobertura multi-equipo", "Acuerdos personalizados"];
  if (label === "Team") return ["Mayor capacidad operativa", "Volumen ampliado de revisión", "Gestión de equipo extendida"];
  if (label === "Hiring") return ["Más verificaciones simultáneas", "Mayor throughput en procesos", "Mejor ritmo de contratación"];
  if (label === "Access") return ["Acceso ampliado a solicitudes", "Operación inicial de revisión", "Capacidad superior al plan Free"];
  return ["Acceso base al panel empresa", "Gestión de solicitudes en modo limitado", "Base operativa para activar upgrade"];
}

function isSubscriptionActive(statusRaw: unknown) {
  const status = normalizeSubscriptionStatus(statusRaw);
  return status === "active" || status === "trialing";
}

function isDocsSchemaError(error: any) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || code === "42703" || (msg.includes("column") && msg.includes("does not exist"));
}

async function resolveCompanyContext(admin: any, userId: string) {
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("active_company_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) return { error: profileErr.message };

  let companyId = profile?.active_company_id ? String(profile.active_company_id) : null;

  if (!companyId) {
    const { data: membershipRows, error: membershipErr } = await admin
      .from("company_members")
      .select("company_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (membershipErr) return { error: membershipErr.message };
    companyId = membershipRows?.[0]?.company_id ? String(membershipRows[0].company_id) : null;
    if (companyId) {
      await admin.from("profiles").update({ active_company_id: companyId }).eq("id", userId);
    }
  }

  if (!companyId) return { error: "no_active_company" };

  const { data: membership } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    companyId,
    membershipRole: String(membership?.role || "reviewer").toLowerCase(),
  };
}

export default async function CompanySubscriptionPage() {
  const sessionClient = await createServerSupabaseClient();
  const admin = createServiceRoleClient();

  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/company/subscription");

  const ctx = await resolveCompanyContext(admin, auth.user.id);
  if ((ctx as any).error === "no_active_company") redirect("/company/candidates");
  if ((ctx as any).error) redirect("/company?error=subscription_context");

  const companyId = (ctx as any).companyId as string;

  const [subscriptionRes, companyProfileRes, companyRes, docsRes] = await Promise.all([
    admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,cancel_at_period_end,metadata,created_at,updated_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("company_profiles")
      .select("company_verification_status,profile_completeness_score,contact_email,website_url")
      .eq("company_id", companyId)
      .maybeSingle(),
    admin
      .from("companies")
      .select("name,company_verification_status")
      .eq("id", companyId)
      .maybeSingle(),
    admin
      .from("company_verification_documents")
      .select("review_status,lifecycle_status")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const effectiveSubscription = await readEffectiveSubscriptionState(admin, auth.user.id);
  const sub = effectiveSubscription.subscription || subscriptionRes.data;
  const plan = String(effectiveSubscription.plan || sub?.plan || "company_free");
  const status = normalizeSubscriptionStatus(effectiveSubscription.status || sub?.status || "free");
  const label = planLabel(plan);
  const features = planFeatures(label);
  const active = isSubscriptionActive(status);

  let companyVerificationStatus = active ? "verified_paid" : "unverified";
  if (!active) {
    if (!docsRes.error && Array.isArray(docsRes.data)) {
      const activeDocs = docsRes.data.filter((d: any) => String(d?.lifecycle_status || "active").toLowerCase() !== "deleted");
      const hasApproved = activeDocs.some((d: any) => String(d?.review_status || "").toLowerCase() === "approved");
      companyVerificationStatus = hasApproved ? "verified_document" : "unverified";
    } else if (isDocsSchemaError(docsRes.error)) {
      companyVerificationStatus = String(
        companyProfileRes.data?.company_verification_status ||
          companyRes.data?.company_verification_status ||
          "unverified",
      );
    }
  }
  const completeness = Number(companyProfileRes.data?.profile_completeness_score || 0);
  const approvedDocs = !docsRes.error && Array.isArray(docsRes.data)
    ? docsRes.data
        .filter((d: any) => String(d?.lifecycle_status || "active").toLowerCase() !== "deleted")
        .some((d: any) => String(d?.review_status || "").toLowerCase() === "approved")
    : false;
  const verificationMethod = deriveCompanyVerificationMethod({
    contactEmail: companyProfileRes.data?.contact_email,
    websiteUrl: companyProfileRes.data?.website_url,
    hasApprovedDocuments: approvedDocs,
  });

  const ownerOverride = effectiveSubscription.metadata && typeof effectiveSubscription.metadata === "object" ? (effectiveSubscription.metadata as any)?.owner_override : null;
  const isManualOverride = Boolean(ownerOverride?.type) || effectiveSubscription.source === "override";
  const renewalText = status === "free" ? "No aplica" : formatDate(effectiveSubscription.current_period_end || sub?.current_period_end || null);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Suscripción de empresa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Estado real del plan, capacidad operativa y camino claro para ampliar o gestionar la suscripción.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Plan actual</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-semibold text-slate-900">{label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Estado de suscripción</dt>
              <dd>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${subscriptionStatusClass(status)}`}>
                  {subscriptionStatusLabel(status)}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{status === "trialing" ? "Trial activo hasta" : "Próxima renovación"}</dt>
              <dd className="font-semibold text-slate-900">{renewalText}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Cancelación programada</dt>
              <dd className="font-semibold text-slate-900">{sub?.cancel_at_period_end ? "Sí" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Método de verificación</dt>
              <dd className="text-right">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${companyVerificationMethodTone(verificationMethod.method)}`}>
                  {verificationMethod.label}
                </span>
                {verificationMethod.detail ? <div className="mt-1 text-xs text-slate-500">{verificationMethod.detail}</div> : null}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Verificación de empresa</dt>
              <dd>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${verificationStatusClass(companyVerificationStatus)}`}>
                  {verificationStatusLabel(companyVerificationStatus)}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Completitud perfil empresa</dt>
              <dd className="font-semibold text-slate-900">{completeness}%</dd>
            </div>
          </dl>

          {isManualOverride ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Plan aplicado mediante override interno owner.
              {ownerOverride?.reason ? ` Nota administrativa: ${ownerOverride.reason}` : ""}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/company/upgrade" className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black transition">
              Ver y contratar planes
            </Link>
            <Link href="/company/profile" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
              Revisar perfil empresa
            </Link>
            <Link href="/company" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition">
              Volver al dashboard
            </Link>
          </div>
        </article>

        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-base font-semibold text-slate-900">Incluye tu plan</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {features.map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
          </ul>

          {!active ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Tu empresa opera en modo Free o sin suscripción activa. Puedes mantener operación básica o activar upgrade.
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Coherencia de estado</p>
            <ul className="mt-2 space-y-1">
              <li>• Fuente plan/estado: suscripción real o override manual owner activo.</li>
              <li>• Verificación empresa: suscripción activa o estado documental.</li>
              <li>• Upgrade y cobro: checkout real desde <span className="font-semibold">/company/upgrade</span> cuando Stripe está configurado.</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Contratar o gestionar plan</h2>
            <p className="mt-1 text-sm text-slate-600">
              Compara el siguiente plan útil para tu operación y abre checkout o portal de pago según corresponda.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <CompanyPlanActions currentPlanLabel={label} currentPlanCode={plan} hasActiveSubscription={active} />
        </div>
      </section>
    </div>
  );
}
