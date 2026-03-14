import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

function Badge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{label}</span>;
}

function scoreLabel(score: number) {
  if (score >= 80) return "Completo";
  if (score >= 40) return "Parcial";
  return "Incompleto";
}

function normalizeCompanyStatus(companyStatus: unknown, profileStatus: unknown) {
  const c = String(companyStatus || "").toLowerCase();
  const p = String(profileStatus || "").toLowerCase();
  if (c === "verified" || c === "active") return "verified";
  if (p.includes("verified")) return "verified";
  if (c === "unverified" || c === "pending" || c === "draft") return "unverified";
  if (p.includes("unverified") || p.includes("pending")) return "unverified";
  return c || p || "pending_review";
}

function companyStatusLabel(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "verified" || s === "verified_document" || s === "verified_paid") return "Verificada";
  if (s === "unverified") return "Sin verificar";
  if (s === "pending" || s === "pending_review") return "Pendiente de revisión";
  if (s === "draft") return "En configuración";
  return "Pendiente de clasificación";
}

function activityBadge(activityState: string, completion: number, pending: number) {
  if (pending > 0) return "Con trabajo pendiente";
  if (activityState === "inactive" && completion < 80) return "Dormida e incompleta";
  if (activityState === "inactive") return "Dormida";
  if (completion >= 80) return "Operativa";
  return "Activa con perfil parcial";
}

export default async function OwnerCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = String(sp.status || "all").toLowerCase();
  const activityFilter = String(sp.activity || "all").toLowerCase();
  const profileFilter = String(sp.profile || "all").toLowerCase();
  const q = String(sp.q || "").trim().toLowerCase();

  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/owner/companies");
  const { data: ownerProfile } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (ownerRole !== "owner" && ownerRole !== "admin") redirect("/dashboard?forbidden=1&from=owner");

  const supabase = createServiceRoleClient();

  let companies: any[] = [];
  const companiesWithStatus = await supabase
    .from("companies")
    .select("id,name,trade_name,legal_name,created_at,updated_at,status")
    .order("created_at", { ascending: false })
    .limit(250);

  if (companiesWithStatus.error) {
    const fallbackCompanies = await supabase
      .from("companies")
      .select("id,name,trade_name,legal_name,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(250);
    companies = Array.isArray(fallbackCompanies.data) ? fallbackCompanies.data : [];
  } else {
    companies = Array.isArray(companiesWithStatus.data) ? companiesWithStatus.data : [];
  }

  const rows = Array.isArray(companies) ? companies : [];
  const companyIds = rows.map((r: any) => r.id).filter(Boolean);

  const [membershipsRes, requestsRes, profilesRes] = await Promise.all([
    companyIds.length
      ? supabase.from("company_members").select("company_id,user_id,role").in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
    companyIds.length
      ? supabase.from("verification_requests").select("company_id,status,requested_at").in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
    companyIds.length
      ? supabase
          .from("company_profiles")
          .select("company_id,company_verification_status,profile_completeness_score")
          .in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const memberships = Array.isArray(membershipsRes.data) ? membershipsRes.data : [];
  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const profiles = Array.isArray(profilesRes.data) ? profilesRes.data : [];

  const membersByCompany = new Map<string, number>();
  for (const m of memberships as any[]) {
    const key = String(m.company_id || "");
    membersByCompany.set(key, (membersByCompany.get(key) || 0) + 1);
  }

  const requestsByCompany = new Map<string, number>();
  const pendingByCompany = new Map<string, number>();
  const lastActivityByCompany = new Map<string, string>();
  for (const r of requests as any[]) {
    const key = String(r.company_id || "");
    requestsByCompany.set(key, (requestsByCompany.get(key) || 0) + 1);
    const status = String(r.status || "").toLowerCase();
    if (status.includes("request") || status.includes("pending")) {
      pendingByCompany.set(key, (pendingByCompany.get(key) || 0) + 1);
    }
    const requestedAt = String(r.requested_at || "");
    if (requestedAt) {
      const current = lastActivityByCompany.get(key);
      if (!current || new Date(requestedAt).getTime() > new Date(current).getTime()) {
        lastActivityByCompany.set(key, requestedAt);
      }
    }
  }

  const profileByCompany = new Map<string, any>();
  for (const p of profiles as any[]) {
    profileByCompany.set(String(p.company_id || ""), p);
  }

  const normalized = rows.map((row: any) => {
    const id = String(row.id || "");
    const profile = profileByCompany.get(id);
    const status = normalizeCompanyStatus(row.status, profile?.company_verification_status);
    const completion = Number(profile?.profile_completeness_score || 0);
    const reqCount = requestsByCompany.get(id) || 0;
    const pending = pendingByCompany.get(id) || 0;
    const lastActivity = lastActivityByCompany.get(id) || row.updated_at || row.created_at || null;
    const activityState = reqCount > 0 ? "active" : "inactive";
    return {
      row,
      id,
      displayName: resolveCompanyDisplayName(row, "Tu empresa"),
      status,
      completion,
      reqCount,
      pending,
      members: membersByCompany.get(id) || 0,
      lastActivity,
      activityState,
      profileState: scoreLabel(completion).toLowerCase(),
    };
  });

  const filtered = normalized.filter((entry) => {
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (activityFilter !== "all" && entry.activityState !== activityFilter) return false;
    if (profileFilter !== "all") {
      if (profileFilter === "completo" && entry.completion < 80) return false;
      if (profileFilter === "incompleto" && entry.completion >= 80) return false;
    }
    if (q && !entry.displayName.toLowerCase().includes(q)) return false;
    return true;
  });

  const totalInactive = normalized.filter((x) => x.activityState === "inactive").length;
  const totalPending = normalized.reduce((acc, x) => acc + x.pending, 0);
  const incomplete = normalized.filter((x) => x.completion < 80).length;
  const highUsage = normalized.filter((x) => x.reqCount >= 10).length;
  const verifiedByStatus =
    rows.filter((r: any) => String(r.status || "").toLowerCase() === "verified").length ||
    normalized.filter((x) => x.status === "verified_document" || x.status === "verified_paid").length;
  const unverifiedByStatus =
    rows.filter((r: any) => String(r.status || "").toLowerCase() === "unverified").length ||
    normalized.filter((x) => x.status === "unverified").length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Empresas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vista operativa para detectar actividad, estado del perfil y cargas pendientes por empresa.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="text-xs text-slate-500">Total empresas</div>
            <div className="text-xl font-semibold text-slate-900">{rows.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="text-xs text-slate-500">Verificadas</div>
            <div className="text-xl font-semibold text-slate-900">{verifiedByStatus}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="text-xs text-slate-500">No verificadas</div>
            <div className="text-xl font-semibold text-slate-900">{unverifiedByStatus}</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Actividad: {rows.length - totalInactive} activas · {totalInactive} inactivas · {totalPending} pendientes · {incomplete} con perfil incompleto · {highUsage} con uso alto.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <form className="grid gap-3 md:grid-cols-4">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar empresa"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select name="status" defaultValue={statusFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Estado: todos</option>
            <option value="unverified">No verificada</option>
            <option value="verified">Verificada</option>
          </select>
          <select name="activity" defaultValue={activityFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Actividad: todas</option>
            <option value="active">Activas</option>
            <option value="inactive">Sin actividad</option>
          </select>
          <select name="profile" defaultValue={profileFilter} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="all">Perfil: todos</option>
            <option value="completo">Completo</option>
            <option value="incompleto">Incompleto</option>
          </select>
          <div className="md:col-span-4 flex gap-2">
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Aplicar filtros</button>
            <Link href="/owner/companies" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-600">
            No hay empresas que cumplan los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Empresa</th>
                  <th className="px-3 py-3">Estado</th>
                  <th className="px-3 py-3">Miembros</th>
                  <th className="px-3 py-3">Solicitudes</th>
                  <th className="px-3 py-3">Pendientes</th>
                  <th className="px-3 py-3">Perfil</th>
                  <th className="px-3 py-3">Señal owner</th>
                  <th className="px-3 py-3">Última actividad</th>
                  <th className="px-3 py-3">Creación</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 text-slate-800">
                    <td className="px-3 py-3">
                      <Link href={`/owner/companies/${entry.id}`} className="font-semibold text-slate-900 underline">
                        {entry.displayName}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <Link href={`/owner/verifications?company=${encodeURIComponent(entry.displayName)}`} className="font-semibold text-slate-700 underline">
                          Ver solicitudes
                        </Link>
                        <Link href="/owner/users?quick=with_company" className="font-semibold text-slate-700 underline">
                          Ver usuarios empresa
                        </Link>
                        <Link href={`/owner/companies/${entry.id}`} className="font-semibold text-slate-700 underline">
                          Abrir ficha
                        </Link>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Badge label={companyStatusLabel(entry.status)} /></td>
                    <td className="px-3 py-3">{entry.members}</td>
                    <td className="px-3 py-3">{entry.reqCount}</td>
                    <td className="px-3 py-3">{entry.pending}</td>
                    <td className="px-3 py-3">
                      <span className="font-semibold text-slate-900">{entry.completion}%</span>
                      <span className="ml-2 text-xs text-slate-500">{scoreLabel(entry.completion)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold text-slate-700">{activityBadge(entry.activityState, entry.completion, entry.pending)}</span>
                    </td>
                    <td className="px-3 py-3">{entry.lastActivity ? new Date(entry.lastActivity).toLocaleDateString("es-ES") : "Sin actividad"}</td>
                    <td className="px-3 py-3">{entry.row.created_at ? new Date(entry.row.created_at).toLocaleDateString("es-ES") : "—"}</td>
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
