import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardShell from  "@/app/_components/DashboardShell";
import { Card, CardTitle, Badge } from  "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import CvUploadAndParse from "@/components/candidate/profile/CvUploadAndParse";
import ExperienceQuickAddClient from "./ExperienceQuickAddClient";

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

  const verificationIds = (rows || []).map((x: any) => x.matched_verification_id).filter(Boolean);
  const verificationMap = new Map<string, { status: string | null; is_revoked: boolean | null }>();
  if (verificationIds.length > 0) {
    const { data: linkedRows } = await supabase
      .from("verification_summary")
      .select("verification_id,status,is_revoked")
      .in("verification_id", verificationIds as string[]);
    for (const row of linkedRows || []) {
      verificationMap.set((row as any).verification_id, {
        status: (row as any).status ?? null,
        is_revoked: (row as any).is_revoked ?? false,
      });
    }
  }

  function resolveStatus(row: any) {
    const linkedId = row?.matched_verification_id as string | null;
    if (!linkedId) return "Sin verificar";
    const linked = verificationMap.get(linkedId);
    if (!linked) return "Pendiente de verificación";
    if (linked.is_revoked) return "Revocada";
    const status = String(linked.status || "").toLowerCase();
    if (status === "verified" || status === "approved") return "Verificada";
    if (status.includes("rejected")) return "Rechazada";
    return "Pendiente de verificación";
  }

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
                href="#cv-upload"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Subir CV
              </Link>
              <Link
                href="#manual-experience"
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Añadir experiencia
              </Link>
            </div>
          </div>

          <div id="cv-upload" className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Importar desde CV</div>
            <div className="mt-1 text-xs text-gray-600">
              Sube tu CV para extraer experiencias y formación. Las experiencias importadas quedan sin verificar hasta validación real.
            </div>
            <div className="mt-3">
              <CvUploadAndParse />
            </div>
          </div>

          <div id="manual-experience">
            <ExperienceQuickAddClient />
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            Las experiencias importadas desde CV se registran como <span className="font-semibold">sin verificar</span>.
            Solo cambian a <span className="font-semibold">verificada</span> cuando existe una verificación real vinculada.
            Si una experiencia ya está verificada, no se edita directamente: crea una nueva entrada si necesitas corregir datos sustanciales.
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
                        <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-700">
                          Estado: {resolveStatus(r)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Fechas: {r.start_date || "¿inicio?"} — {r.end_date || "Actualidad"}
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Email de verificación de la empresa: se solicitará en el flujo de solicitud.
                      </div>
                    </div>
                    {resolveStatus(r) !== "Verificada" ? (
                      <Link
                        href="/candidate/profile"
                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        Editar
                      </Link>
                    ) : null}
                  </div>
                  {r.description ? <div className="mt-3 text-sm text-gray-700">{r.description}</div> : null}

                  <div className="mt-4 space-y-3">
                    <form action="/candidate/verifications/new" method="get" className="rounded-xl border border-gray-200 p-3">
                      <input type="hidden" name="company" value={r.company_name || ""} />
                      <input type="hidden" name="position" value={r.role_title || ""} />
                      <input type="hidden" name="start" value={r.start_date || ""} />
                      <input type="hidden" name="end" value={r.end_date || ""} />
                      <label className="block">
                        <div className="text-xs font-semibold text-gray-900">Email de verificación de la empresa</div>
                        <input
                          type="email"
                          name="company_email"
                          placeholder="Indica el email al que quieres enviar esta solicitud"
                          required
                          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900"
                        />
                      </label>
                      <button
                        type="submit"
                        className="mt-3 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                      >
                        Solicitar verificación a empresa
                      </button>
                    </form>

                    <Link
                      href={`/candidate/evidence?experience_id=${encodeURIComponent(r.id)}&company=${encodeURIComponent(r.company_name || "")}&position=${encodeURIComponent(r.role_title || "")}`}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                    >
                      Verificar documentalmente
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
