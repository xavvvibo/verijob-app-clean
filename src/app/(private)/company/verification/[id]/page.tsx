import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CompanyVerificationDetail({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();

  const { data: au } = await supabase.auth.getUser();
  if (!au.user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();

  if (!profile?.active_company_id) notFound();

  const { data: summary, error } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", id)
    .maybeSingle();

  console.log("SUMMARY DEBUG:", summary);
  console.log("SUMMARY ERROR:", error);

  if (!summary) notFound();

  if (summary.company_id !== profile.active_company_id) {
    notFound();
  }

  return (
    <div style={{ padding: 40 }}>
      <pre>{JSON.stringify(summary, null, 2)}</pre>
      <Link href="/company/requests">Volver</Link>
    </div>
  );
}
