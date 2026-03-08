import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardShell from  "@/app/_components/DashboardShell";
import { Card, CardTitle, Badge } from  "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CandidateExperiencePage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, onboarding_completed")
    .eq("id", au.user.id)
    .single();
  if (!profile || !profile.onboarding_completed) redirect("/onboarding");

  const { data: rows } = await supabase
    .from("profile_experiences")
    .select("id, role_title, company_name, start_date, end_date, description, matched_verification_id, confidence, created_at")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell title="Experiencia">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Mis experiencias</CardTitle>
              <div className="mt-2 text-sm text-gray-600">
                Mantén aquí tu historial profesional estructurado y alineado con tus verificaciones.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/candidate/profile"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Subir CV
              </Link>
              <Link
                href="/candidate/profile"
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Añadir experiencia
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            Las experiencias <span className="font-semibold">sin verificación</span> se pueden editar.
            Las experiencias <span className="font-semibold">verificadas</span> no se modifican directamente:
            si cambian fechas, puesto o datos clave, crea una nueva experiencia o nueva verificación.
          </div>

          <div className="mt-4 space-y-2">
            {(rows || []).length === 0 ? (
              <div className="text-sm text-gray-600">
                Aún no hay experiencias en tu historial. Puedes subir tu CV o añadir una experiencia manualmente.
              </div>
            ) : (
              (rows || []).map((r: any) => (
                <div key={r.id} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">Puesto: {r.role_title || "No especificado"}</div>
                        <Badge>Empresa: {r.company_name || "No especificada"}</Badge>
                        {r.matched_verification_id ? (
                          <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                            Estado: verificada
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                            Estado: no verificada
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        {r.start_date || "¿inicio?"} — {r.end_date || "Actualidad"}
                      </div>
                    </div>
                    {!r.matched_verification_id ? (
                      <Link
                        href="/candidate/profile"
                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                    ) : null}
                  </div>
                  {r.description ? <div className="mt-3 text-sm text-gray-700">{r.description}</div> : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/candidate/verifications/new?company=${encodeURIComponent(r.company_name || "")}&position=${encodeURIComponent(r.role_title || "")}&start=${encodeURIComponent(r.start_date || "")}&end=${encodeURIComponent(r.end_date || "")}`}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Request company verification
                    </Link>
                    <Link
                      href={`/candidate/evidence?experience_id=${encodeURIComponent(r.id)}&company=${encodeURIComponent(r.company_name || "")}&position=${encodeURIComponent(r.role_title || "")}`}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                    >
                      Verify with documents
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
