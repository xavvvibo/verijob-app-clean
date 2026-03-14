import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

function fmtDate(value: unknown) {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES");
}

export default async function OwnerVerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/owner/verifications/${id}`);

  const { data: ownerProfile } = await sessionClient.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(ownerRole)) redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const verificationRes = await admin
    .from("verification_requests")
    .select("id,requested_by,company_id,employment_record_id,status,verification_channel,requested_at,created_at,updated_at,resolved_at,revoked_at,company_name_target,request_context,external_resolved")
    .eq("id", id)
    .maybeSingle();

  if (verificationRes.error || !verificationRes.data) notFound();
  const verification = verificationRes.data as any;

  const [candidateRes, companyRes, employmentRes, evidencesRes] = await Promise.all([
    verification.requested_by
      ? admin.from("profiles").select("id,full_name,email").eq("id", verification.requested_by).maybeSingle()
      : Promise.resolve({ data: null } as any),
    verification.company_id
      ? admin.from("companies").select("id,name,status").eq("id", verification.company_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    verification.employment_record_id
      ? admin.from("employment_records").select("id,position,company_name_freeform,start_date,end_date,verification_status").eq("id", verification.employment_record_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    admin
      .from("evidences")
      .select("id,evidence_type,document_type,validation_status,storage_path,created_at")
      .eq("verification_request_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const candidate = candidateRes.data as any;
  const company = companyRes.data as any;
  const employment = employmentRes.data as any;
  const evidences = Array.isArray(evidencesRes.data) ? evidencesRes.data : [];
  const requestContext = verification.request_context && typeof verification.request_context === "object" ? verification.request_context : {};

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Verificación {verification.id}</h1>
            <p className="mt-1 text-sm text-slate-600">Ficha owner mínima para trazabilidad, contexto y acceso rápido a evidencias y entidades relacionadas.</p>
          </div>
          <Link href="/owner/verifications" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
            Volver a verificaciones
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card label="Estado" value={String(verification.status || "—")} />
          <Card label="Método" value={String(verification.verification_channel || "email")} />
          <Card label="Candidato" value={candidate?.full_name || candidate?.email || "Sin candidato"} />
          <Card label="Empresa" value={company?.name || verification.company_name_target || "Empresa externa"} />
          <Card label="Experiencia" value={employment?.position || String((requestContext as any)?.role_title || "Experiencia no indicada")} />
          <Card label="Creada" value={fmtDate(verification.created_at || verification.requested_at)} />
          <Card label="Actualizada" value={fmtDate(verification.updated_at)} />
          <Card label="Resuelta" value={fmtDate(verification.resolved_at)} note={verification.revoked_at ? `Revocada: ${fmtDate(verification.revoked_at)}` : undefined} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          {candidate?.id ? (
            <Link href={`/owner/users/${candidate.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">
              Abrir candidato
            </Link>
          ) : null}
          {company?.id ? (
            <Link href={`/owner/companies/${company.id}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">
              Abrir empresa
            </Link>
          ) : null}
          <Link href="/owner/evidences?linked=linked" className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">
            Abrir evidencias
          </Link>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Contexto de experiencia</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Puesto</div>
              <div className="font-semibold text-slate-900">{employment?.position || String((requestContext as any)?.role_title || "No indicado")}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Empresa objetivo</div>
              <div className="font-semibold text-slate-900">{company?.name || verification.company_name_target || String((requestContext as any)?.company_name || "No indicada")}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Fechas</div>
              <div className="font-semibold text-slate-900">
                {employment?.start_date || "—"} · {employment?.end_date || "Actualidad"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Resolución externa</div>
              <div className="font-semibold text-slate-900">{verification.external_resolved ? "Sí" : "No / no disponible"}</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Evidencias asociadas</h2>
          {evidences.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No hay evidencias asociadas a esta verificación.</p>
          ) : (
            <div className="mt-4 overflow-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Tipo</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-3 py-3">Fecha</th>
                    <th className="px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {evidences.map((row: any) => (
                    <tr key={row.id} className="border-b border-slate-100 text-slate-800">
                      <td className="px-3 py-3 font-mono text-xs">{row.id}</td>
                      <td className="px-3 py-3">{row.document_type || row.evidence_type || "Documento"}</td>
                      <td className="px-3 py-3">{row.validation_status || "Sin estado"}</td>
                      <td className="px-3 py-3">{fmtDate(row.created_at)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/owner/evidences?linked=linked`} className="text-xs font-semibold text-slate-700 underline">
                            Ver en listado
                          </Link>
                          <Link href={`/owner/evidences/${row.id}/open`} target="_blank" className="text-xs font-semibold text-slate-700 underline">
                            Abrir documento
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value || "—"}</div>
      {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
    </article>
  );
}
