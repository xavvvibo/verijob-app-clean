import { redirect } from "next/navigation";
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
    .from("experiences")
    .select("id, title, company_name, start_date, end_date, is_current, description, created_at")
    .eq("user_id", au.user.id)
    .order("created_at", { ascending: false });

  return (
    <DashboardShell title="Experiencia">
      <div className="space-y-4">
        <Card>
          <CardTitle>Mis experiencias</CardTitle>
          <div className="mt-3 space-y-2">
            {(rows || []).length === 0 ? (
              <div className="text-sm text-gray-600">No hay experiencias.</div>
            ) : (
              (rows || []).map((r: any) => (
                <div key={r.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium">{r.title}</div>
                    <Badge>{r.company_name}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {r.start_date || ""} — {r.is_current ? "Actual" : (r.end_date || "")}
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
