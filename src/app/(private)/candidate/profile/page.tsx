import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";
import CandidateProfileIdentityClient from "./CandidateProfileIdentityClient";

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return <div className="p-6">No autorizado</div>;
  }

  const [{ data: profile }, { data: candidateProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, title, location")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("candidate_profiles")
      .select("raw_cv_json")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const importSummary = summarizeCompanyCvImportUpdates((candidateProfile as any)?.raw_cv_json);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Perfil</h1>
        <p className="text-sm text-slate-600">Gestiona tus datos personales y de cuenta.</p>
      </div>

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
    </div>
  );
}
