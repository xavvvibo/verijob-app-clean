import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CompanyVerificationDetail({ params }: PageProps) {
  const { id } = await params;

  // ✅ Next 16: cookies() es async
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  if (!accessToken) notFound();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active_company_id) notFound();

  const { data: summary } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", id)
    .maybeSingle();

  if (!summary) notFound();

  if (summary.company_id !== profile.active_company_id) {
    notFound();
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Detalle verificación</h1>
      <pre>{JSON.stringify(summary, null, 2)}</pre>
      <Link href="/company/requests">Volver</Link>
    </div>
  );
}
