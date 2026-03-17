import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { companyVerificationMethodTone, deriveCompanyVerificationMethod } from "@/lib/company/verification-method";
import { effectivePlanDisplay, readEffectiveCompanySubscriptionState } from "@/lib/billing/effectiveSubscription";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

function fmtDate(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES");
}

function verificationLabel(raw: unknown) {
  const value = String(raw || "").toLowerCase();
  if (value === "verified" || value === "active") return "Verificada";
  if (value === "unverified") return "Sin verificar";
  if (value === "draft") return "En configuración";
  if (value === "pending" || value === "pending_review") return "Pendiente de revisión";
  return "Pendiente de clasificación";
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

export default async function OwnerCompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/owner/companies/${id}`);

  const { data: ownerProfile } = await sessionClient.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(ownerRole)) redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const companyRes = await admin
    .from("companies")
    .select("id,name,status,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (companyRes.error || !companyRes.data) notFound();
  const company = companyRes.data as any;

  const [profileRes, membersRes, requestsRes, docsRes] = await Promise.all([
    admin
      .from("company_profiles")
      .select("company_id,trade_name,legal_name,contact_email,website_url,company_verification_status,profile_completeness_score")
      .eq("company_id", id)
      .maybeSingle(),
    admin
      .from("company_members")
      .select("company_id,user_id,role")
      .eq("company_id", id),
    admin
      .from("verification_requests")
      .select("id,status,requested_at,created_at,updated_at,resolved_at,requested_by,verification_channel")
      .eq("company_id", id)
      .order("requested_at", { ascending: false })
      .limit(20),
    admin
      .from("company_verification_documents")
      .select("id,document_type,original_filename,uploaded_by,review_status,rejected_reason,review_notes,reviewed_by,reviewed_at,lifecycle_status,created_at,updated_at,extracted_json,import_status,imported_at")
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const members = Array.isArray(membersRes.data) ? membersRes.data : [];
  const requests = Array.isArray(requestsRes.data) ? requestsRes.data : [];
  const memberIds = members.map((row: any) => String(row.user_id || "")).filter(Boolean);

  const docActors = Array.from(
    new Set(
      (Array.isArray(docsRes.data) ? docsRes.data : [])
        .flatMap((row: any) => [String(row?.uploaded_by || "").trim(), String(row?.reviewed_by || "").trim()])
        .filter(Boolean)
    )
  );

  const [profilesRes, companyAdminRes, docActorProfilesRes] = await Promise.all([
    memberIds.length
      ? admin.from("profiles").select("id,full_name,email,last_activity_at").in("id", memberIds)
      : Promise.resolve({ data: [] } as any),
    members.length
      ? admin.from("company_members").select("user_id,role").eq("company_id", id).limit(1).maybeSingle()
      : Promise.resolve({ data: null } as any),
    docActors.length
      ? admin.from("profiles").select("id,full_name,email").in("id", docActors)
      : Promise.resolve({ data: [] } as any),
  ]);

  const profilesById = new Map((Array.isArray(profilesRes.data) ? profilesRes.data : []).map((row: any) => [String(row.id), row]));
  const docActorById = new Map((Array.isArray(docActorProfilesRes.data) ? docActorProfilesRes.data : []).map((row: any) => [String(row.id), row]));
  const companyAdminUserId = String((companyAdminRes.data as any)?.user_id || "").trim() || memberIds[0] || null;
  const effectiveSubscription = companyAdminUserId
    ? await readEffectiveCompanySubscriptionState(admin, {
        userId: companyAdminUserId,
        companyId: String(id),
      })
    : null;
  const companyPlan = effectiveSubscription
    ? {
        plan: effectivePlanDisplay(effectiveSubscription).planLabel,
        status: effectiveSubscription.status,
      }
    : null;

  const pendingRequests = requests.filter((row: any) => {
    const status = String(row.status || "").toLowerCase();
    return status === "draft" || status === "pending_company" || status === "reviewing";
  }).length;
  const lastActivity =
    requests
      .map((row: any) => String(row.updated_at || row.requested_at || row.created_at || ""))
      .filter(Boolean)
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ||
    company.updated_at ||
    company.created_at;

  const completion = Number((profileRes.data as any)?.profile_completeness_score || 0);
  const verificationStatus = String((profileRes.data as any)?.company_verification_status || company.status || "");
  const activeDocs = !docsRes.error && Array.isArray(docsRes.data)
    ? docsRes.data.filter((doc: any) => String(doc?.lifecycle_status || "active").toLowerCase() !== "deleted")
    : [];
  const approvedDocs = activeDocs.some((doc: any) => String(doc?.review_status || "").toLowerCase() === "approved");
  const pendingDocs = activeDocs.filter((doc: any) => {
    const value = String(doc?.review_status || "").toLowerCase();
    return value === "pending_review" || value === "uploaded";
  }).length;
  const rejectedDocs = activeDocs.filter((doc: any) => String(doc?.review_status || "").toLowerCase() === "rejected").length;
  const verificationMethod = deriveCompanyVerificationMethod({
    contactEmail: (profileRes.data as any)?.contact_email,
    websiteUrl: (profileRes.data as any)?.website_url,
    hasApprovedDocuments: approvedDocs,
  });
  const companyDisplayName = resolveCompanyDisplayName({ ...(company || {}), ...((profileRes.data as any) || {}) }, "Tu empresa");

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{companyDisplayName}</h1>
            <p className="mt-1 text-sm text-slate-600">Ficha owner mínima de empresa para operación, seguimiento y navegación cruzada.</p>
          </div>
          <Link href="/owner/companies" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Volver a empresas
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card
            label="Estado"
            value={verificationLabel(verificationStatus)}
            note={
              pendingDocs > 0
                ? `${verificationMethod.label} · ${pendingDocs} documento${pendingDocs === 1 ? "" : "s"} pendiente${pendingDocs === 1 ? "" : "s"}`
                : rejectedDocs > 0
                  ? `${verificationMethod.label} · ${rejectedDocs} rechazo${rejectedDocs === 1 ? "" : "s"} documental${rejectedDocs === 1 ? "" : "es"}`
                  : verificationMethod.label
            }
          />
          <Card label="Perfil empresa" value={`${completion}%`} note={completion >= 80 ? "Completo" : completion >= 40 ? "Parcial" : "Incompleto"} />
          <Card label="Miembros" value={String(members.length)} />
          <Card label="Solicitudes" value={String(requests.length)} note={`${pendingRequests} pendientes`} />
          <Card label="Plan" value={companyPlan?.plan || "Sin plan company"} note={companyPlan?.status || "Sin suscripción detectada"} />
          <Card label="Creación" value={fmtDate(company.created_at)} />
          <Card label="Última actividad" value={fmtDate(lastActivity)} />
          <Card label="Company ID" value={company.id} mono />
        </div>
        {verificationMethod.detail ? (
          <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${companyVerificationMethodTone(verificationMethod.method)}`}>
            {verificationMethod.detail}
          </div>
        ) : null}
        {pendingDocs > 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Hay {pendingDocs} documento{pendingDocs === 1 ? "" : "s"} de empresa pendiente{pendingDocs === 1 ? "" : "s"} de revisión manual.
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link href={`/owner/verifications?company=${encodeURIComponent(companyDisplayName)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">
            Abrir verificaciones
          </Link>
          <Link href="/owner/users?quick=with_company" className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">
            Abrir usuarios empresa
          </Link>
          <Link href="/owner/monetization" className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">
            Abrir monetización
          </Link>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Miembros</h2>
          {members.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No hay miembros asociados en `company_members`.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {members.map((member: any) => {
                const profile = profilesById.get(String(member.user_id || "")) as any;
                return (
                  <article key={`${member.company_id}-${member.user_id}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{profile?.full_name || profile?.email || "Usuario"}</p>
                        <p className="text-xs text-slate-500">{profile?.email || "Sin email"} · {member.role || "sin rol"}</p>
                        <p className="mt-1 text-xs text-slate-500">Última actividad: {fmtDate(profile?.last_activity_at)}</p>
                      </div>
                      <Link href={`/owner/users/${member.user_id}`} className="text-xs font-semibold text-slate-700 underline">
                        Abrir usuario
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Documentos de empresa</h2>
          <p className="mt-1 text-sm text-slate-600">
            Trazabilidad documental interna por empresa. Aquí ves archivo recibido, tipo declarado, datos detectados, revisión registrada y notas internas disponibles.
          </p>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Estado actual del módulo owner: esta vista expone trazabilidad y contexto real. La decisión manual owner todavía no tiene acción dedicada en esta pantalla; hoy el `review_status` se resuelve por el flujo interno existente.
          </div>
          {!activeDocs.length ? (
            <p className="mt-3 text-sm text-slate-600">No hay documentos activos registrados para esta empresa.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {activeDocs.map((doc: any) => {
                const uploader = docActorById.get(String(doc.uploaded_by || "")) as any;
                const reviewer = docActorById.get(String(doc.reviewed_by || "")) as any;
                const detectedCount = Number(doc?.extracted_json?.detected_fields_count || 0);
                const importStatus = String(doc?.import_status || "not_imported");
                return (
                  <article key={String(doc.id)} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{documentTypeLabel(doc.document_type)}</p>
                        <p className="mt-1 text-xs text-slate-500">{doc.original_filename || "Sin nombre de archivo"} · subido {fmtDate(doc.created_at)}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${documentReviewClass(doc.review_status)}`}>
                        {documentReviewLabel(doc.review_status)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Uploader</div>
                        <div className="mt-1 text-slate-900">{uploader?.full_name || uploader?.email || doc.uploaded_by || "No registrado"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Reviewer</div>
                        <div className="mt-1 text-slate-900">{reviewer?.full_name || reviewer?.email || doc.reviewed_by || "Sin reviewer registrado"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Datos detectados</div>
                        <div className="mt-1 text-slate-900">{detectedCount} campo{detectedCount === 1 ? "" : "s"}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500">Import al perfil</div>
                        <div className="mt-1 text-slate-900">{importStatus}</div>
                      </div>
                    </div>
                    {doc.reviewed_at ? (
                      <p className="mt-3 text-xs text-slate-500">Revisado el {fmtDate(doc.reviewed_at)}</p>
                    ) : null}
                    {doc.review_notes ? (
                      <p className="mt-2 text-xs text-slate-700">Notas internas: {String(doc.review_notes)}</p>
                    ) : null}
                    {doc.rejected_reason ? (
                      <p className="mt-2 text-xs text-rose-700">Motivo de rechazo: {String(doc.rejected_reason)}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Verificaciones recientes</h2>
          {requests.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No hay verificaciones asociadas todavía.</p>
          ) : (
            <div className="mt-4 overflow-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Método</th>
                    <th className="px-3 py-3">Candidato</th>
                    <th className="px-3 py-3">Solicitada</th>
                    <th className="px-3 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((row: any) => {
                    const candidate = profilesById.get(String(row.requested_by || "")) as any;
                    return (
                      <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                        <td className="px-3 py-3 font-mono text-xs">{row.id}</td>
                        <td className="px-3 py-3">{String(row.status || "—")}</td>
                        <td className="px-3 py-3">{String(row.verification_channel || "email")}</td>
                        <td className="px-3 py-3">{candidate?.full_name || candidate?.email || "Candidato"}</td>
                        <td className="px-3 py-3">{fmtDate(row.requested_at || row.created_at)}</td>
                        <td className="px-3 py-3">
                          <Link href={`/owner/verifications/${row.id}`} className="text-xs font-semibold text-slate-700 underline">
                            Abrir verificación
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function Card({ label, value, note, mono = false }: { label: string; value: string; note?: string; mono?: boolean }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "font-mono break-all" : ""}`}>{value || "—"}</div>
      {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
    </article>
  );
}
