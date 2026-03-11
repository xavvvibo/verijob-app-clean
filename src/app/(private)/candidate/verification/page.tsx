import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pickParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

export default async function CandidateVerificationEntryPage(props: PageProps) {
  const searchParams = (await props.searchParams) || {};
  const fromUrl = pickParam(searchParams.id) || pickParam(searchParams.verification_request_id);

  if (fromUrl) redirect(`/candidate/verification/${encodeURIComponent(fromUrl)}`);

  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login?next=/candidate/verifications");

  const { data: latest } = await supabase
    .from("verification_requests")
    .select("id,created_at")
    .eq("requested_by", au.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest?.id) redirect(`/candidate/verification/${encodeURIComponent(latest.id)}`);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Detalle de verificación</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        No tienes verificaciones disponibles para mostrar.
        <div className="mt-3">
          <Link href="/candidate/verifications" className="font-semibold text-blue-700 hover:underline">
            Ir al listado de verificaciones
          </Link>
        </div>
      </div>
    </div>
  );
}
