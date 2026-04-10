import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { readCandidateProfileCollections } from "@/lib/candidate/profile-collections";
import CandidateOperationsLayout from "@/components/candidate-v2/layouts/CandidateOperationsLayout";
import CandidatePageHeader from "@/components/candidate-v2/primitives/CandidatePageHeader";
import LanguagesClient from "./LanguagesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const admin = createServiceRoleClient();
  const collections = await readCandidateProfileCollections(admin, au.user.id);
  const languages = collections.languages || [];
  const certifications = collections.certifications || [];
  const achievements = collections.achievements || [];

  function sourceLabel(source: string | null | undefined) {
    const value = String(source || "").trim().toLowerCase();
    if (value === "cv_parse") return "Detectado desde CV";
    if (value === "legacy") return "Migrado";
    if (value === "manual" || value === "self_declared") return "Añadido manualmente";
    return "Señal registrada";
  }

  return (
    <CandidateOperationsLayout>
      <CandidatePageHeader
        eyebrow="Idiomas y logros"
        title="Refuerza tu perfil global"
        description="Aquí se agrupan los idiomas, certificaciones y logros que ya forman parte de tu perfil para que no se pierdan después de importar tu CV."
        badges={[
          `${languages.length} ${languages.length === 1 ? "idioma visible" : "idiomas visibles"}`,
          `${certifications.length} ${certifications.length === 1 ? "certificación" : "certificaciones"}`,
          `${achievements.length} ${achievements.length === 1 ? "logro" : "logros"}`,
        ]}
      />

      <div className="space-y-8">
        <LanguagesClient initialItems={languages} />

        {certifications.length > 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Certificaciones visibles</h2>
                <p className="mt-1 text-sm text-slate-600">Si se han detectado o importado correctamente, quedan registradas aquí.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {certifications.length} {certifications.length === 1 ? "certificación" : "certificaciones"}
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {certifications.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-950">{item.name || "Certificación sin título"}</h3>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {sourceLabel(item.source)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {[item.issuer, item.issue_date].filter(Boolean).join(" · ") || "Sin emisor o fecha específica"}
                  </p>
                  {item.notes ? <p className="mt-2 text-sm text-slate-600">{item.notes}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {achievements.length > 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">Logros visibles</h2>
                <p className="mt-1 text-sm text-slate-600">Premios, hitos y otras señales complementarias que ya forman parte de tu perfil.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {achievements.length} {achievements.length === 1 ? "logro" : "logros"}
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {achievements.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-950">{item.title || "Logro detectado"}</h3>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {sourceLabel(item.source)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {[item.issuer, item.achieved_at].filter(Boolean).join(" · ") || "Sin detalle adicional"}
                  </p>
                  {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {languages.length === 0 && certifications.length === 0 && achievements.length === 0 ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Todavía no hay idiomas, certificaciones ni logros visibles. Cuando se importen correctamente desde tu CV o los añadas a mano, aparecerán aquí.
          </section>
        ) : null}
      </div>
    </CandidateOperationsLayout>
  );
}
