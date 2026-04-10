import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import Link from "next/link";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";
import { buildCandidateExperienceTrustTimeline } from "@/lib/candidate/experience-trust";
import { readCandidateProfileCollections } from "@/lib/candidate/profile-collections";
import { readCandidateSkills } from "@/lib/candidate/profile-visibility";
import { getTrustBreakdownDisplayEntries, normalizeTrustBreakdown } from "@/lib/trust/trust-model";
import CandidateFormLayout from "@/components/candidate-v2/layouts/CandidateFormLayout";
import CandidatePageHeader from "@/components/candidate-v2/primitives/CandidatePageHeader";
import CandidateFormSection from "@/components/candidate-v2/forms/CandidateFormSection";
import CandidateSurface from "@/components/candidate-v2/primitives/CandidateSurface";
import CandidateProfileIdentityClient from "./CandidateProfileIdentityClient";
import CandidateProfileSkillsClient from "./CandidateProfileSkillsClient";

export const dynamic = "force-dynamic";

function formatMonthYear(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

function formatPeriod(start?: string | null, end?: string | null) {
  const startText = formatMonthYear(start);
  const endText = end ? formatMonthYear(end) : "Actualidad";
  return `${startText || "Inicio no definido"} · ${endText}`;
}

export default async function CandidateProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return <div className="p-6">No autorizado</div>;
  }

  const [
    { data: profile },
    { data: candidateProfile },
    { data: verifications },
    { count: experienceCount },
    { data: profileExperiences },
    { data: employmentRecords },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, title, location")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("candidate_profiles")
      .select("raw_cv_json,trust_score,trust_score_breakdown")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("verification_summary")
      .select("status, evidence_count", { count: "exact" })
      .eq("candidate_id", user.id),
    supabase
      .from("profile_experiences")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("profile_experiences")
      .select("id, role_title, company_name, start_date, end_date, description, matched_verification_id, created_at")
      .eq("user_id", user.id)
      .order("start_date", { ascending: false }),
    supabase
      .from("employment_records")
      .select("id, position, company_name_freeform, start_date, end_date, verification_status, last_verification_request_id")
      .eq("candidate_id", user.id)
      .order("start_date", { ascending: false }),
  ]);
  const admin = createServiceRoleClient();
  const collections = await readCandidateProfileCollections(admin, user.id, { candidateProfile });
  const importSummary = summarizeCompanyCvImportUpdates((candidateProfile as any)?.raw_cv_json);
  const manualSkills = readCandidateSkills(candidateProfile);
  const visibleSignalsCount =
    collections.languages.length + collections.certifications.length + collections.achievements.length;
  const trustScore = Number((candidateProfile as any)?.trust_score ?? 0);
  const trustBreakdown = normalizeTrustBreakdown((candidateProfile as any)?.trust_score_breakdown);
  const trustEntries = getTrustBreakdownDisplayEntries((candidateProfile as any)?.trust_score_breakdown);
  const verificationRows = Array.isArray(verifications) ? verifications : [];
  const verifiedCount = verificationRows.filter((row: any) => {
    const status = String(row?.status || "").toLowerCase();
    return status === "verified" || status === "approved";
  }).length;
  const inProcessCount = verificationRows.filter((row: any) => {
    const status = String(row?.status || "").toLowerCase();
    return status.includes("pending") || status.includes("review") || status.includes("requested");
  }).length;
  const evidenceCount = verificationRows.reduce((acc: number, row: any) => acc + Number(row?.evidence_count || 0), 0);
  const profileReady = Boolean((profile as any)?.full_name && (profile as any)?.title && (profile as any)?.location);
  const trustTitle =
    verifiedCount >= 2 || (verifiedCount >= 1 && evidenceCount >= 1)
      ? "Alta confianza"
      : verifiedCount >= 1 || inProcessCount >= 1 || evidenceCount >= 1 || profileReady
        ? "Confianza media"
        : "Sin validar todavía";
  const trustSummary =
    verifiedCount > 0
      ? "Tu perfil ya transmite más credibilidad. La siguiente validación puede convertir esa confianza en una decisión más rápida."
      : inProcessCount > 0
        ? "Ya tienes una verificación en proceso. Añadir evidencias mientras esperas acelera el impacto potencial sobre tu trust."
        : "Tu perfil ya está en marcha. Validar una experiencia es la acción que más puede mover tu trust score.";
  const nextActionHref =
    Number(experienceCount || 0) === 0
      ? "/candidate/experience?new=1#manual-experience"
      : verifiedCount === 0 && inProcessCount === 0
        ? "/candidate/verifications/new"
        : evidenceCount === 0
          ? "/candidate/evidence"
          : "/candidate/overview";
  const nextActionLabel =
    Number(experienceCount || 0) === 0
      ? "Añadir experiencia"
      : verifiedCount === 0 && inProcessCount === 0
        ? "Validar una experiencia"
        : evidenceCount === 0
          ? "Subir documentación"
          : "Ver mi resumen";
  const experienceTimeline = buildCandidateExperienceTrustTimeline({
    profileExperiences: (profileExperiences as any[]) || [],
    employmentRecords: (employmentRecords as any[]) || [],
    verificationSummaries: verificationRows as any[],
  });

  return (
    <CandidateFormLayout>
      <CandidatePageHeader
        eyebrow="Perfil candidato"
        title="Tu identidad profesional"
        description="Ordena tu identidad, resume tu señal real y deja lista la base profesional que verán las empresas."
        ctaLabel={nextActionLabel}
        ctaHref={nextActionHref}
        badges={[
          `${verifiedCount} ${verifiedCount === 1 ? "experiencia verificada" : "experiencias verificadas"}`,
          `${inProcessCount} ${inProcessCount === 1 ? "verificación en proceso" : "verificaciones en proceso"}`,
          `${evidenceCount} ${evidenceCount === 1 ? "documento subido" : "documentos subidos"}`,
          profileReady ? "Perfil completado" : "Perfil por completar",
        ]}
        variant="management"
      />

      <CandidateFormSection title="Confianza del perfil" description="La señal que hoy sostiene tu perfil y la acción con más impacto.">
        <CandidateSurface tone="subtle" className="overflow-hidden p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Lectura ejecutiva</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{trustTitle}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{trustSummary}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Trust score</div>
              <div className="mt-1 text-4xl font-semibold tracking-tight text-slate-950">{trustScore}</div>
              <div className="mt-2 text-xs text-slate-500">
                {verifiedCount} verificadas · {inProcessCount} en curso · {evidenceCount} evidencias
              </div>
            </div>
          </div>
        </CandidateSurface>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {trustEntries.map((entry) => (
            <div key={entry.key} className="rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2">
              <div className="text-xs text-slate-500">{entry.label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{entry.value}%</div>
            </div>
          ))}
        </div>
        {trustBreakdown.meta.updated_at ? <p className="text-xs text-slate-500">Actualizado {formatMonthYear(trustBreakdown.meta.updated_at)}</p> : null}
      </CandidateFormSection>

      {(importSummary.importedFromCompanyCv || importSummary.updatesCount > 0) ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Hay una importación o actualización de CV pendiente de tu revisión.</p>
          <p className="mt-1">
            No se ha aplicado automáticamente a tu perfil. Revísala antes de publicar cambios o continuar con verificaciones.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
              Pendientes: {importSummary.totalPendingItems || importSummary.updatesCount}
            </span>
            <Link href="/candidate/import-updates" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
              Revisar propuesta
            </Link>
          </div>
        </section>
      ) : null}

      <CandidateFormSection
        title="Idiomas y logros visibles"
        description="Todo lo que ya se haya importado correctamente desde tu CV o añadido después debe quedar visible aquí, sin desaparecer en segundo plano."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <CandidateSurface tone="subtle" className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Idiomas</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{collections.languages.length}</div>
            <p className="mt-1 text-sm text-slate-600">Idiomas visibles ahora mismo en tu perfil.</p>
          </CandidateSurface>
          <CandidateSurface tone="subtle" className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Certificaciones</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{collections.certifications.length}</div>
            <p className="mt-1 text-sm text-slate-600">Certificaciones detectadas o añadidas manualmente.</p>
          </CandidateSurface>
          <CandidateSurface tone="subtle" className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Logros</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{collections.achievements.length}</div>
            <p className="mt-1 text-sm text-slate-600">Logros y señales complementarias ya registradas.</p>
          </CandidateSurface>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href="/candidate/achievements" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
            Revisar idiomas y logros
          </Link>
          <p className="text-sm text-slate-600">
            {visibleSignalsCount > 0
              ? `Ya tienes ${visibleSignalsCount} señal${visibleSignalsCount === 1 ? "" : "es"} visible${visibleSignalsCount === 1 ? "" : "s"} en esta parte del perfil.`
              : "Si tu CV aporta idiomas, certificaciones o logros, aparecerán aquí cuando queden importados correctamente."}
          </p>
        </div>
      </CandidateFormSection>

      {experienceTimeline.length > 0 ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Confianza por experiencia</h2>
              <p className="mt-1 text-sm text-slate-600">Cada experiencia deja claro si ya ayuda a decidir o si aún necesita validación.</p>
            </div>
            <Link href="/candidate/experience" className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              Gestionar experiencias
            </Link>
          </div>

          <div className="space-y-5 border-t border-slate-100 pt-4">
            {experienceTimeline.map((item) => (
              <article key={item.id} className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{item.role_title || "Experiencia profesional"}</h3>
                    <p className="mt-1 text-sm text-slate-600">{item.company_name || "Empresa no definida"}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                      {formatPeriod(item.start_date, item.end_date)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.status_tone}`}>
                      {item.status_label}
                    </span>
                    {item.support_label ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                        {item.support_label}
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{item.explanation}</p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {item.next_action_label && item.next_action_href ? (
                    <Link href={item.next_action_href} className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                      {item.next_action_label}
                    </Link>
                  ) : item.next_action_label ? (
                    <span className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
                      {item.next_action_label}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <CandidateProfileIdentityClient
          initialProfile={{
            id: user.id,
            email: user.email ?? null,
            full_name: (profile as any)?.full_name ?? null,
            phone: (profile as any)?.phone ?? null,
            title: (profile as any)?.title ?? null,
            location: (profile as any)?.location ?? null,
            address_line1: null,
            address_line2: null,
            city: null,
            region: null,
            postal_code: null,
            country: null,
            identity_type: null,
            identity_masked: null,
            has_identity: false,
          }}
        />

        <CandidateProfileSkillsClient initialSkills={manualSkills} />
      </section>
    </CandidateFormLayout>
  );
}
