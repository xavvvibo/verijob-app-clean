export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CandidatePublicProfileRenderer } from "@/components/public/CandidatePublicProfileRenderer";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { getProfileAccessState } from "@/lib/company/profile-access";
import { resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";

type Ctx = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Perfil profesional verificable | Verijob",
  description:
    "Perfil profesional verificable con señales públicas de credibilidad laboral para evaluación empresarial.",
};

export default async function PublicCandidateProfilePage({
  params,
  searchParams,
}: Ctx & { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const qs = (await searchParams) || {};
  const printFlag = String(qs.print || qs.cv || "").toLowerCase();
  const printMode = printFlag === "1" || printFlag === "true" || printFlag === "pdf";
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  const base = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";

  const res = await fetch(`${base}/api/public/candidate/${token}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const unavailableReason =
      res.status === 410
        ? "Este enlace ha caducado y ya no está disponible."
        : "Este enlace no existe o no está disponible en este momento.";
    return (
      <main className="min-h-screen bg-blue-50/40 px-6 py-12">
        <section
          aria-labelledby="public-profile-unavailable-title"
          className="mx-auto max-w-3xl rounded-3xl border bg-white p-10 text-center shadow-sm"
        >
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Verijob</div>
          <h1 id="public-profile-unavailable-title" className="mt-3 text-3xl font-semibold text-slate-900">
            Perfil no disponible
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            {unavailableReason}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              className="inline-flex min-w-44 items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
              href="/login?mode=company"
              aria-label="Iniciar sesión como empresa en Verijob"
            >
              Iniciar sesión empresa
            </a>
            <a
              className="inline-flex min-w-44 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              href="/signup?mode=company"
              aria-label="Crear cuenta de empresa en Verijob"
            >
              Crear cuenta empresa
            </a>
          </div>
        </section>
      </main>
    );
  }

  const canDownloadCv = Boolean(body?.teaser?.cv_download_enabled);
  let companyViewer: {
    is_authenticated_company: boolean;
    available_accesses: number;
    already_unlocked: boolean;
    unlocked_at: string | null;
    unlocked_until: string | null;
  } | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      const { data: requesterProfile } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle();

      const activeCompanyId = String((requesterProfile as any)?.active_company_id || "").trim();

      if (activeCompanyId) {
        const service = createServiceRoleClient();
        const linkResolved = await resolveActiveCandidatePublicLink(service, token);
        if (linkResolved.ok && linkResolved.link?.candidate_id) {
          const accessState = await getProfileAccessState({
            service,
            company_id: activeCompanyId,
            candidate_id: String(linkResolved.link.candidate_id),
            viewer_user_id: user.id,
          });
          companyViewer = {
            is_authenticated_company: true,
            available_accesses: accessState.remaining_accesses,
            already_unlocked: accessState.is_unlocked,
            unlocked_at: accessState.unlocked_at,
            unlocked_until: accessState.unlocked_until,
          };
        }
      }
    }
  } catch {
    companyViewer = null;
  }

  return (
    <main className="min-h-screen bg-blue-50/40 px-5 py-10 sm:px-8 sm:py-14 xl:px-10">
      <div className="mx-auto max-w-[1480px]">
        <CandidatePublicProfileRenderer
          payload={{ ...body, token }}
          mode="public"
          companyAccess
          companyViewer={companyViewer}
          renderMode={printMode && canDownloadCv ? "print" : "screen"}
        />
      </div>
    </main>
  );
}
