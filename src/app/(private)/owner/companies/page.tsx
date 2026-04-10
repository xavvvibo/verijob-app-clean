import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { companyVerificationMethodTone, deriveCompanyVerificationMethod } from "@/lib/company/verification-method";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import OwnerCompanyDocumentReviewActions from "./[id]/OwnerCompanyDocumentReviewActions";

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

function documentTypeLabel(raw: unknown) {
  const value = String(raw || "").toLowerCase();
  if (value === "modelo_036") return "Modelo 036";
  if (value === "modelo_037") return "Modelo 037";
  if (value === "cif_nif") return "CIF / NIF empresa";
  if (value === "certificado_censal") return "Certificado censal / AEAT";
  if (value === "escritura") return "Escritura o documento equivalente";
  if (value === "otro") return "Otro documento";
  return String(raw || "Documento");
}

function documentReviewLabel(raw: unknown) {
  const value = String(raw || "").toLowerCase();
  if (value === "approved") return "Aprobado";
  if (value === "rejected") return "Rechazado";
  if (value === "uploaded") return "Recibido";
  return "Pendiente de revisión";
}

function documentReviewClass(raw: unknown) {
  const value = String(raw || "").toLowerCase();
  if (value === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
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
    .select("id,name,created_at,updated_at,status")
    .order("created_at", { ascending: false })
    .limit(250);

  if (companiesWithStatus.error) {
    const fallbackCompanies = await supabase
      .from("companies")
      .select("id,name,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(250);
    companies = Array.isArray(fallbackCompanies.data) ? fallbackCompanies.data : [];
  } else {
    companies = Array.isArray(companiesWithStatus.data) ? companiesWithStatus.data : [];
  }

  const rows = Array.isArray(companies) ? companies : [];
  const companyIds = rows.map((r: any) => r.id).filter(Boolean);

  const [membershipsRes, requestsRes, profilesRes, docsRes] = await Promise.all([
    companyIds.length
      ? supabase.from("company_members").select("company_id,user_id,role").in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
    companyIds.length
      ? supabase.from("verification_requests").select("company_id,status,requested_at").in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
    companyIds.length
      ? supabase
          .from("company_profiles")
          .select("company_id,trade_name,legal_name,contact_email,website_url,company_verification_status,profile_completeness_score")
          .in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
    companyIds.length
      ? supabase
          .from("company_verification_documents")
          .select("id,company_id,document_type,review_status,lifecycle_status,created_at,uploaded_by")
          .in("company_id", companyIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const memberships = Array.isArray(membershipsRes.data) ? membershipsRes.data : [];
  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const profiles = Array.isArray(profilesRes.data) ? profilesRes.data : [];
  const docs = Array.isArray(docsRes.data) ? docsRes.data : [];
  const uploaderIds = Array.from(new Set(docs.map((doc: any) => String(doc?.uploaded_by || "")).filter(Boolean)));

  const uploaderProfilesRes = uploaderIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", uploaderIds)
    : ({ data: [] as any[] } as any);
  const uploaderProfilesById = new Map((Array.isArray(uploaderProfilesRes.data) ? uploaderProfilesRes.data : []).map((row: any) => [String(row.id), row]));

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
  const docsByCompany = new Map<string, any[]>();
  for (const doc of docs as any[]) {
    const key = String(doc.company_id || "");
    docsByCompany.set(key, [...(docsByCompany.get(key) || []), doc]);
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
    const approvedDocs = (docsByCompany.get(id) || [])
      .filter((doc: any) => String(doc?.lifecycle_status || "active").toLowerCase() !== "deleted")
      .some((doc: any) => String(doc?.review_status || "").toLowerCase() === "approved");
    const verificationMethod = deriveCompanyVerificationMethod({
      contactEmail: profile?.contact_email,
      websiteUrl: profile?.website_url,
      hasApprovedDocuments: approvedDocs,
    });
    return {
      row,
      id,
      displayName: resolveCompanyDisplayName({ ...(row || {}), ...(profile || {}) }, "Tu empresa"),
      status,
      verificationMethod,
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
  const pendingDocumentQueue = docs
    .filter((doc: any) => {
      const lifecycle = String(doc?.lifecycle_status || "active").toLowerCase();
      const review = String(doc?.review_status || "").toLowerCase();
      return lifecycle !== "deleted" && (review === "pending_review" || review === "uploaded");
    })
    .filter((doc: any) => normalized.some((entry) => entry.id === String(doc.company_id || "")))
    .sort((a: any, b: any) => Date.parse(String(b?.created_at || "")) - Date.parse(String(a?.created_at || "")))
    .slice(0, 12);

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
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Cola documental pendiente</h2>
            <p className="mt-1 text-sm text-slate-600">
              Documentos empresa pendientes de revisión manual owner. Cada fila enlaza a la ficha de empresa para aprobar o rechazar.
            </p>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            Pendientes: {pendingDocumentQueue.length}
          </span>
        </div>
        {pendingDocumentQueue.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            No hay documentos empresa pendientes de revisión manual.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {pendingDocumentQueue.map((doc: any) => {
              const company = normalized.find((entry) => entry.id === String(doc.company_id || ""));
              if (!company) return null;
              const uploader = uploaderProfilesById.get(String(doc.uploaded_by || "")) as any;
              return (
                <article key={String(doc.id)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/owner/companies/${doc.company_id}`} className="text-base font-semibold text-slate-900 underline">
                        {company.displayName}
                      </Link>
                      <p className="mt-1 text-sm text-slate-700">{documentTypeLabel(doc.document_type)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Subido {doc.created_at ? new Date(String(doc.created_at)).toLocaleDateString("es-ES") : "—"} · {uploader?.full_name || uploader?.email || "Uploader no identificado"}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${documentReviewClass(doc.review_status)}`}>
                      {documentReviewLabel(doc.review_status)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/api/internal/owner/company-documents/${encodeURIComponent(String(doc.id))}/open`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir documento
                    </a>
                    <a
                      href={`/api/internal/owner/company-documents/${encodeURIComponent(String(doc.id))}/open?download=1`}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                    >
                      Descargar
                    </a>
                    <Link href={`/owner/companies/${doc.company_id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      Abrir ficha empresa
                    </Link>
                  </div>
                  <OwnerCompanyDocumentReviewActions
                    documentId={String(doc.id)}
                    currentStatus={String(doc.review_status || "pending_review")}
                  />
                </article>
              );
            })}
          </div>
        )}
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
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <Badge label={companyStatusLabel(entry.status)} />
                        <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${companyVerificationMethodTone(entry.verificationMethod.method)}`}>
                          {entry.verificationMethod.method === "both"
                            ? "Dominio + docs"
                            : entry.verificationMethod.method === "domain"
                              ? "Dominio"
                              : entry.verificationMethod.method === "documents"
                                ? "Documentos"
                                : "Sin verificar"}
                        </span>
                      </div>
                    </td>
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
