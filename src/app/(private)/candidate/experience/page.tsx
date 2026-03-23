import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardShell from  "@/app/_components/DashboardShell";
import { Card, CardTitle } from  "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import CvUploadAndParse from "@/components/candidate/profile/CvUploadAndParse";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";
import ExperienceQuickAddClient from "./ExperienceQuickAddClient";
import ExperienceListClient from "./ExperienceListClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isDocumentaryOfficialVerification(row: any) {
  const channel = String(row?.verification_channel || "").trim().toLowerCase();
  const requestContext = row?.request_context && typeof row.request_context === "object" ? row.request_context : {};
  const source = String(requestContext?.verification_source || requestContext?.documentary_processing?.verification_source || "").trim().toLowerCase();
  const method = String(requestContext?.verification_method || requestContext?.documentary_processing?.verification_method || "").trim().toLowerCase();
  const reason = String(requestContext?.verification_reason || requestContext?.documentary_processing?.verification_reason || "").trim().toLowerCase();
  return channel === "documentary" && (
    source === "documentary_official" ||
    method === "official_document_auto" ||
    reason === "vida_laboral_linked_high_confidence" ||
    reason === "vida_laboral_cea_verified_signal"
  );
}

export default async function CandidateExperiencePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, onboarding_completed")
    .eq("id", au.user.id)
    .single();
  if (!profile) redirect("/onboarding");

  const [{ data: rows }, { data: importedRows }, { data: candidateProfile }, { data: employmentRows }] = await Promise.all([
    supabase
      .from("profile_experiences")
      .select("id, role_title, company_name, start_date, end_date, description, matched_verification_id, confidence, created_at")
      .eq("user_id", au.user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("experiences")
      .select("title,company_name,start_date,end_date")
      .eq("user_id", au.user.id),
    supabase
      .from("candidate_profiles")
      .select("raw_cv_json")
      .eq("user_id", au.user.id)
      .maybeSingle(),
    supabase
      .from("employment_records")
      .select("id, source_experience_id, position, company_name_freeform, start_date, end_date, verification_status, last_verification_request_id")
      .eq("candidate_id", au.user.id),
  ]);

  const verificationIds = Array.from(
    new Set(
      [...(rows || []).map((x: any) => x.matched_verification_id), ...(employmentRows || []).map((x: any) => x.last_verification_request_id)].filter(Boolean),
    ),
  );
  const verificationMap = new Map<string, {
    status: string | null;
    is_revoked: boolean | null;
    requested_at?: string | null;
    resolved_at?: string | null;
    verification_channel?: string | null;
    request_context?: any;
  }>();
  if (verificationIds.length > 0) {
    const [{ data: linkedRows }, { data: requestRows }] = await Promise.all([
      supabase
      .from("verification_summary")
      .select("verification_id,status,is_revoked")
      .in("verification_id", verificationIds as string[]),
      supabase
      .from("verification_requests")
      .select("id,status,requested_at,resolved_at,verification_channel,request_context")
      .in("id", verificationIds as string[]),
    ]);
    for (const row of linkedRows || []) {
      verificationMap.set((row as any).verification_id, {
        status: (row as any).status ?? null,
        is_revoked: (row as any).is_revoked ?? false,
      });
    }
    for (const row of requestRows || []) {
      const existing = verificationMap.get((row as any).id) || { status: null, is_revoked: false };
      verificationMap.set((row as any).id, {
        ...existing,
        status: (row as any).status ?? existing.status,
        requested_at: (row as any).requested_at ?? null,
        resolved_at: (row as any).resolved_at ?? null,
        verification_channel: (row as any).verification_channel ?? null,
        request_context: (row as any).request_context ?? null,
      });
    }
  }

  function norm(v: any) {
    return String(v || "").trim().toLowerCase();
  }

  function experienceMatchKey(input: any) {
    return [
      norm(input?.role_title ?? input?.position),
      norm(input?.company_name ?? input?.company_name_freeform),
      norm(input?.start_date),
      norm(input?.end_date),
    ].join("|");
  }

  const importedSet = new Set(
    (importedRows || []).map((r: any) => `${norm(r?.title)}|${norm(r?.company_name)}|${norm(r?.start_date)}|${norm(r?.end_date)}`)
  );

  const employmentBySignature = new Map<string, any>();
  const employmentBySourceExperienceId = new Map<string, any>();
  for (const row of employmentRows || []) {
    const key = experienceMatchKey(row);
    if (key && !employmentBySignature.has(key)) {
      employmentBySignature.set(key, row);
    }
    const sourceExperienceId = String((row as any)?.source_experience_id || "").trim();
    if (sourceExperienceId && !employmentBySourceExperienceId.has(sourceExperienceId)) {
      employmentBySourceExperienceId.set(sourceExperienceId, row);
    }
  }

  function resolveLinkedVerification(row: any) {
    const employmentRecord =
      employmentBySourceExperienceId.get(String(row?.id || "").trim()) ||
      employmentBySignature.get(experienceMatchKey(row)) ||
      null;
    const linkedId = String(row?.matched_verification_id || employmentRecord?.last_verification_request_id || "").trim();
    const verification = linkedId ? verificationMap.get(linkedId) || null : null;
    return { employmentRecord, linkedId, verification };
  }

  const normalizedRows = (rows || []).map((r: any) => ({
    id: String(r.id),
    profile_experience_id: String(r.id),
    employment_record_id: String((employmentBySignature.get(experienceMatchKey(r)) as any)?.id || ""),
    role_title: r.role_title ?? null,
    company_name: r.company_name ?? null,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    description: r.description ?? null,
    status: (() => {
      const { employmentRecord, linkedId, verification } = resolveLinkedVerification(r);
      if (!linkedId) return "Sin verificar";
      if (verification?.is_revoked) return "Revocada";
      const status = String(verification?.status || employmentRecord?.verification_status || "").toLowerCase();
      if (status === "verified" || status === "approved" || status === "verified_document") return "Verificada";
      if (status === "revoked") return "Revocada";
      if (status === "reviewing" || status === "in_review") return "En revisión";
      if (status === "rejected") return "Sin verificar";
      return "Verificación solicitada";
    })(),
    last_action: (() => {
      const sig = `${norm(r?.role_title)}|${norm(r?.company_name)}|${norm(r?.start_date)}|${norm(r?.end_date)}`;
      const importedFromCv = importedSet.has(sig);
      const { employmentRecord, linkedId, verification } = resolveLinkedVerification(r);
      if (!linkedId) {
        return importedFromCv
          ? "Importada desde tu CV. Revísala, corrígela si hace falta y luego solicita verificación o sube evidencia."
          : "Sin solicitudes enviadas";
      }
      if (isDocumentaryOfficialVerification(verification) && String(employmentRecord?.verification_status || "").trim()) {
        return "Verificada automáticamente por vida laboral.";
      }
      if (!verification) return "Solicitud de verificación enviada";
      if (verification.resolved_at) return `Resuelta: ${verification.resolved_at}`;
      if (verification.requested_at) return `Enviada: ${verification.requested_at}`;
      return "Solicitud en curso";
    })(),
    source_label: (() => {
      const sig = `${norm(r?.role_title)}|${norm(r?.company_name)}|${norm(r?.start_date)}|${norm(r?.end_date)}`;
      const importedFromCv = importedSet.has(sig);
      const { employmentRecord, verification } = resolveLinkedVerification(r);
      const status = String(verification?.status || employmentRecord?.verification_status || "").trim().toLowerCase();
      if (isDocumentaryOfficialVerification(verification)) return "Verificada por documento";
      if (
        String(verification?.verification_channel || "").trim().toLowerCase() === "email" &&
        (status === "verified" || status === "approved")
      ) {
        return "Verificada por empresa";
      }
      return importedFromCv ? "Importada desde CV" : null;
    })(),
  }));

  const companyCvImportFlag = Array.isArray(resolvedSearchParams?.company_cv_import)
    ? resolvedSearchParams.company_cv_import[0]
    : resolvedSearchParams?.company_cv_import;
  const onboardingFlag = Array.isArray(resolvedSearchParams?.onboarding)
    ? resolvedSearchParams.onboarding[0]
    : resolvedSearchParams?.onboarding;
  const importSummary = summarizeCompanyCvImportUpdates((candidateProfile as any)?.raw_cv_json);

  return (
    <DashboardShell title="Experiencia">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Mis experiencias</CardTitle>
              <div className="mt-2 text-sm text-gray-600">
                Revisa tu historial profesional una por una. Puedes editar, eliminar, solicitar verificación o vincular documentación desde cada experiencia.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="#cv-upload"
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Extraer perfil desde CV
              </Link>
              <Link
                href="/candidate/experience?new=1#manual-experience"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Añadir experiencia manual
              </Link>
            </div>
          </div>

          <div id="cv-upload" className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Importa tu experiencia desde tu CV</div>
            <div className="mt-1 text-xs text-gray-600">
              Sube tu CV y revisa después cada experiencia detectada. También importaremos la formación, los idiomas y los logros que se reconozcan correctamente.
            </div>
            <div className="mt-3">
              <CvUploadAndParse />
            </div>
          </div>

          <div id="manual-experience">
            <ExperienceQuickAddClient />
          </div>

          {String(onboardingFlag || "") === "1" ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-semibold">Paso 2 de 4 · Revisa tus experiencias antes de verificarlas.</p>
              <p className="mt-1">
                Edita o elimina cualquier experiencia antes de continuar. Si una experiencia está duplicada o es incorrecta, puedes borrarla sin fricción.
              </p>
            </div>
          ) : null}

          {String(companyCvImportFlag || "") === "1" ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Hemos cargado la información detectada en tu CV importado por empresa. Revisa ahora cada experiencia, corrige lo que haga falta y luego solicita verificación o vincula evidencia documental.
            </div>
          ) : null}

          {(importSummary.importedFromCompanyCv || importSummary.updatesCount > 0) ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Tienes una importación o actualización pendiente procedente de empresa.</p>
              <p className="mt-1">
                No se ha aplicado automáticamente. Revisa la propuesta antes de validar experiencias o pedir verificaciones nuevas.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                  Pendientes: {importSummary.totalPendingItems || importSummary.updatesCount}
                </span>
                <Link href="/candidate/import-updates" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
                  Revisar propuesta
                </Link>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            Estados visibles por experiencia: <span className="font-semibold">Sin verificar</span>, <span className="font-semibold">Verificación solicitada</span>, <span className="font-semibold">En revisión</span>, <span className="font-semibold">Verificada</span> o <span className="font-semibold">Revocada</span>.
            La fe de vida laboral se gestiona como evidencia global y puede reforzar varias experiencias.
          </div>

          <div className="mt-4">
            <ExperienceListClient initialRows={normalizedRows as any} />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
