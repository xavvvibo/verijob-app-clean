import { redirect } from "next/navigation";
import Link from "next/link";
import DashboardShell from  "@/app/_components/DashboardShell";
import { Card, CardTitle } from  "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import CvUploadAndParse from "@/components/candidate/profile/CvUploadAndParse";
import ExperienceQuickAddClient from "./ExperienceQuickAddClient";
import ExperienceListClient from "./ExperienceListClient";

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

  const { data: importedRows } = await supabase
    .from("experiences")
    .select("title,company_name,start_date,end_date")
    .eq("user_id", au.user.id);

  const verificationIds = (rows || []).map((x: any) => x.matched_verification_id).filter(Boolean);
  const verificationMap = new Map<string, { status: string | null; is_revoked: boolean | null; requested_at?: string | null; resolved_at?: string | null }>();
  if (verificationIds.length > 0) {
    const [{ data: linkedRows }, { data: requestRows }] = await Promise.all([
      supabase
      .from("verification_summary")
      .select("verification_id,status,is_revoked")
      .in("verification_id", verificationIds as string[]),
      supabase
      .from("verification_requests")
      .select("id,status,requested_at,resolved_at")
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
      });
    }
  }

  function norm(v: any) {
    return String(v || "").trim().toLowerCase();
  }

  const importedSet = new Set(
    (importedRows || []).map((r: any) => `${norm(r?.title)}|${norm(r?.company_name)}|${norm(r?.start_date)}|${norm(r?.end_date)}`)
  );

  function resolveStatus(row: any): "Importado" | "Sin verificar" | "En verificación" | "Verificado" | "Revocado" {
    const linkedId = row?.matched_verification_id as string | null;
    if (!linkedId) {
      const sig = `${norm(row?.role_title)}|${norm(row?.company_name)}|${norm(row?.start_date)}|${norm(row?.end_date)}`;
      return importedSet.has(sig) ? "Importado" : "Sin verificar";
    }
    const linked = verificationMap.get(linkedId);
    if (!linked) return "En verificación";
    if (linked.is_revoked) return "Revocado";
    const status = String(linked.status || "").toLowerCase();
    if (status === "verified" || status === "approved") return "Verificado";
    if (status === "revoked") return "Revocado";
    if (status === "rejected") return "Sin verificar";
    return "En verificación";
  }

  function lastActionLabel(row: any) {
    const linkedId = row?.matched_verification_id as string | null;
    if (!linkedId) return "Sin solicitudes enviadas";
    const linked = verificationMap.get(linkedId);
    if (!linked) return "Solicitud enviada";
    if (linked.resolved_at) return `Resuelta: ${linked.resolved_at}`;
    if (linked.requested_at) return `Enviada: ${linked.requested_at}`;
    return "Solicitud en curso";
  }

  const normalizedRows = (rows || []).map((r: any) => ({
    id: String(r.id),
    role_title: r.role_title ?? null,
    company_name: r.company_name ?? null,
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    description: r.description ?? null,
    status: resolveStatus(r),
    last_action: lastActionLabel(r),
  }));

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
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Subir CV
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
              Sube tu CV y Verijob extraerá automáticamente tu historial laboral para poder verificar cada experiencia.
            </div>
            <div className="mt-3">
              <CvUploadAndParse />
            </div>
          </div>

          <div id="manual-experience">
            <ExperienceQuickAddClient />
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
            Estado de experiencia: <span className="font-semibold">Importado</span>, <span className="font-semibold">Sin verificar</span>, <span className="font-semibold">En verificación</span>, <span className="font-semibold">Verificado</span> o <span className="font-semibold">Revocado</span>.
            Solo una validación real convierte una experiencia en verificada.
          </div>

          <div className="mt-4">
            <ExperienceListClient initialRows={normalizedRows as any} />
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
