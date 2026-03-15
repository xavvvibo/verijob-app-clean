import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { effectivePlanDisplay, readEffectiveSubscriptionState } from "@/lib/billing/effectiveSubscription";
import { getCandidatePlanCapabilities, getCompanyPlanCapabilities } from "@/lib/billing/planCapabilities";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import OwnerUserActionsClient from "./OwnerUserActionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function getTableColumns(admin: any, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (error || !Array.isArray(data)) return new Set<string>();
  return new Set(data.map((r: any) => String(r.column_name || "")));
}

export default async function OwnerUserDetailPage({ params }: any) {
  const resolvedParams = await params;
  const targetUserId = String(resolvedParams?.id || "").trim();
  if (!isUuid(targetUserId)) notFound();

  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au?.user) redirect("/login?next=/owner/users");

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", au.user.id)
    .maybeSingle();

  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(ownerRole)) redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const profileColumns = await getTableColumns(admin, "profiles");
  const profileSelect = [
    "id",
    "email",
    "full_name",
    "role",
    "onboarding_completed",
    "active_company_id",
    "created_at",
    profileColumns.has("lifecycle_status") ? "lifecycle_status" : null,
    profileColumns.has("deleted_at") ? "deleted_at" : null,
    profileColumns.has("deletion_reason") ? "deletion_reason" : null,
  ]
    .filter(Boolean)
    .join(",");

  const [
    authUserRes,
    userRes,
    candidateProfileRes,
    experiencesRes,
    verificationsRes,
    evidencesRes,
    subscriptionsRes,
    actionsRes,
  ] = await Promise.all([
    admin.auth.admin.getUserById(targetUserId),
    admin
      .from("profiles")
      .select(profileSelect)
      .eq("id", targetUserId)
      .maybeSingle(),
    admin
      .from("candidate_profiles")
      .select("user_id,trust_score")
      .eq("user_id", targetUserId)
      .maybeSingle(),
    admin
      .from("employment_records")
      .select("id,position,company_name_freeform,start_date,end_date,verification_status", { count: "exact" })
      .eq("candidate_id", targetUserId)
      .order("start_date", { ascending: false })
      .limit(5),
    admin
      .from("verification_requests")
      .select("id,status,verification_channel,company_name_target,created_at,resolved_at", { count: "exact" })
      .eq("requested_by", targetUserId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("evidences")
      .select("id,evidence_type,document_type,validation_status,created_at", { count: "exact" })
      .eq("uploaded_by", targetUserId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("subscriptions")
      .select("id,plan,status,current_period_end,stripe_customer_id,stripe_subscription_id,created_at")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("owner_actions")
      .select("id,action_type,reason,created_at,owner_user_id")
      .eq("target_user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const authUser = (authUserRes as any)?.data?.user || null;
  if (!authUser) notFound();

  const profileUser = userRes.data as any;
  const user = {
    id: String(authUser.id || targetUserId),
    email: profileUser?.email || authUser.email || null,
    full_name: profileUser?.full_name || null,
    role: profileUser?.role || null,
    onboarding_completed: profileUser?.onboarding_completed ?? null,
    active_company_id: profileUser?.active_company_id || null,
    created_at: profileUser?.created_at || authUser.created_at || null,
    last_sign_in_at: authUser.last_sign_in_at ? String(authUser.last_sign_in_at) : null,
    lifecycle_status: String(profileUser?.lifecycle_status || "active").toLowerCase(),
    deleted_at: profileUser?.deleted_at ? String(profileUser.deleted_at) : null,
    deletion_reason: profileUser?.deletion_reason ? String(profileUser.deletion_reason) : null,
  };
  const latestSub = Array.isArray(subscriptionsRes.data) && subscriptionsRes.data.length > 0 ? subscriptionsRes.data[0] : null;
  const effectiveSubscription = await readEffectiveSubscriptionState(admin, targetUserId);
  const effectivePlan = effectivePlanDisplay(effectiveSubscription);

  let activeCompanyName: string | null = null;
  if (user.active_company_id) {
    const [{ data: company }, { data: companyProfile }] = await Promise.all([
      admin.from("companies").select("id,name").eq("id", user.active_company_id).maybeSingle(),
      admin.from("company_profiles").select("company_id,trade_name,legal_name").eq("company_id", user.active_company_id).maybeSingle(),
    ]);
    activeCompanyName = resolveCompanyDisplayName({ ...(company || {}), ...(companyProfile || {}) } as any, "Tu empresa");
  }

  const verifications = Array.isArray(verificationsRes.data) ? verificationsRes.data : [];
  const evidences = Array.isArray(evidencesRes.data) ? evidencesRes.data : [];
  const experiences = Array.isArray(experiencesRes.data) ? experiencesRes.data : [];
  const actions = Array.isArray(actionsRes.data) ? actionsRes.data : [];
  const trustScore = candidateProfileRes.data?.trust_score ?? null;
  const currentPlan = String(effectiveSubscription.plan || latestSub?.plan || "free");
  const candidatePlan = getCandidatePlanCapabilities(currentPlan);
  const companyPlan = getCompanyPlanCapabilities(currentPlan);

  const activityDates = [
    user.created_at,
    user.last_sign_in_at,
    ...experiences.map((row: any) => row?.start_date || row?.created_at || null),
    ...verifications.map((row: any) => row?.resolved_at || row?.created_at || null),
    ...evidences.map((row: any) => row?.created_at || null),
  ]
    .map((v) => String(v || ""))
    .filter(Boolean)
    .map((v) => ({ raw: v, ts: Date.parse(v) }))
    .filter((v) => Number.isFinite(v.ts))
    .sort((a, b) => b.ts - a.ts);
  const lastActivityAt = activityDates.length > 0 ? activityDates[0].raw : null;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Ficha owner de usuario</h1>
            <p className="mt-1 text-sm text-slate-600">Visión operativa para soporte, revisión manual y monetización.</p>
          </div>
          <Link href="/owner/users" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Volver a users
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Email</div>
            <div className="text-sm font-semibold text-slate-900 break-all">{user.email || "—"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Nombre</div>
            <div className="text-sm font-semibold text-slate-900">{user.full_name || "—"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Rol</div>
            <div className="text-sm font-semibold text-slate-900">{user.role || "Sin perfil"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">User ID</div>
            <div className="text-xs font-semibold text-slate-900 font-mono break-all">{user.id}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2 xl:col-span-2">
            <div className="text-xs text-slate-500">Empresa activa</div>
            <div className="text-sm font-semibold text-slate-900 font-mono">{user.active_company_id || "—"}</div>
            <div className="text-xs text-slate-500">{activeCompanyName || "Sin empresa activa"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Plan</div>
            <div className="text-sm font-semibold text-slate-900">{effectivePlan.planLabel}</div>
            <div className="text-xs text-slate-500">
              {effectiveSubscription.source === "override"
                ? "override manual owner activo"
                : latestSub?.status || "sin suscripción activa"}
            </div>
            {String(user.role || "").toLowerCase() === "candidate" ? (
              <div className="mt-1 text-xs text-slate-500">
                Verificaciones activas: {candidatePlan.activeVerificationsLabel} · QR: {candidatePlan.canShareByQr ? "sí" : "no"} · Descarga CV: {candidatePlan.canDownloadVerifiedCv ? "sí" : "no"}
              </div>
            ) : null}
            {String(user.role || "").toLowerCase() === "company" ? (
              <div className="mt-1 text-xs text-slate-500">
                Accesos/mes: {companyPlan.accessesIncludedMonthly ?? "personalizado"} · Panel RRHH: {companyPlan.rrhhPanel} · Selección: {companyPlan.includesSelection ? "sí" : "no"}
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Onboarding / perfil</div>
            <div className="text-sm font-semibold text-slate-900">
              {user.onboarding_completed == null ? "Sin perfil" : user.onboarding_completed ? "Completado" : "Pendiente"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Estado lifecycle</div>
            <div className="text-sm font-semibold text-slate-900">
              {user.lifecycle_status === "deleted" ? "Eliminado" : user.lifecycle_status === "disabled" ? "Deshabilitado" : "Activo"}
            </div>
            <div className="text-xs text-slate-500">{fmtDate(user.deleted_at)}</div>
            {user.deletion_reason ? <div className="text-xs text-slate-500 truncate" title={user.deletion_reason}>{user.deletion_reason}</div> : null}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Fecha de alta</div>
            <div className="text-sm font-semibold text-slate-900">{fmtDate(user.created_at)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Última actividad</div>
            <div className="text-sm font-semibold text-slate-900">{fmtDate(lastActivityAt)}</div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Actividad y perfil</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Experiencias</div>
            <div className="text-xl font-semibold text-slate-900">{experiencesRes.count || 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Verificaciones</div>
            <div className="text-xl font-semibold text-slate-900">{verificationsRes.count || 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Evidencias</div>
            <div className="text-xl font-semibold text-slate-900">{evidencesRes.count || 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Trust score</div>
            <div className="text-xl font-semibold text-slate-900">{trustScore ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Suscripción</div>
            <div className="text-xl font-semibold text-slate-900">{latestSub?.status || "free"}</div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">Últimas experiencias</div>
            {experiences.length === 0 ? (
              <div className="mt-2 text-sm text-slate-500">Sin experiencias registradas.</div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {experiences.map((row: any) => (
                  <li key={row.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                    {row.position || "Experiencia"} — {row.company_name_freeform || "Empresa"}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">Últimas verificaciones</div>
            {verifications.length === 0 ? (
              <div className="mt-2 text-sm text-slate-500">Sin verificaciones registradas.</div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {verifications.map((row: any) => (
                  <li key={row.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                    {row.company_name_target || "Empresa"} · {row.status || "—"} · {row.verification_channel || "email"}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">Últimas evidencias</div>
            {evidences.length === 0 ? (
              <div className="mt-2 text-sm text-slate-500">Sin evidencias registradas.</div>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {evidences.map((row: any) => (
                  <li key={row.id} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                    {row.document_type || row.evidence_type || "Documento"} · {row.validation_status || "pendiente de validación"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Suscripción / billing</h2>
        {latestSub ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Plan</div>
              <div className="font-semibold text-slate-900">{latestSub.plan || "—"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Estado</div>
              <div className="font-semibold text-slate-900">{latestSub.status || "—"}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Próxima renovación</div>
              <div className="font-semibold text-slate-900">{fmtDate(latestSub.current_period_end)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Stripe customer id</div>
              <div className="font-mono text-xs text-slate-700 break-all">{latestSub.stripe_customer_id || "—"}</div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Sin suscripción de pago activa para este usuario.
          </div>
        )}
      </section>

      <OwnerUserActionsClient
        targetUserId={targetUserId}
        role={String(user.role || "")}
        currentPlan={currentPlan}
        currentLifecycleStatus={String(user.lifecycle_status || "active")}
        isArchived={String(user.lifecycle_status || "active") === "deleted"}
        experiences={experiences.map((row: any) => ({
          id: String(row.id),
          label: `${row.position || "Experiencia"} — ${row.company_name_freeform || "Empresa"}`,
          status: String(row.verification_status || ""),
        }))}
        evidences={evidences.map((row: any) => ({
          id: String(row.id),
          label: `${row.document_type || row.evidence_type || "Documento"} · ${row.validation_status || "pendiente de validación"}`,
          status: String(row.validation_status || ""),
        }))}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Historial owner</h2>
        {actions.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">No hay acciones owner registradas para este usuario.</div>
        ) : (
          <div className="mt-3 overflow-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Owner</th>
                </tr>
              </thead>
              <tbody>
                {actions.map((action: any) => (
                  <tr key={action.id} className="border-b border-slate-100 text-slate-800">
                    <td className="px-3 py-2">{fmtDate(action.created_at)}</td>
                    <td className="px-3 py-2">{action.action_type}</td>
                    <td className="px-3 py-2">{action.reason || "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{action.owner_user_id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
