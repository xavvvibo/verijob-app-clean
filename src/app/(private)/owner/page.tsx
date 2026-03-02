import { redirect } from "next/navigation";
import DashboardShell from  "@/app/_components/DashboardShell";
import { Card, CardMeta, CardTitle, Badge } from  "@/app/_components/ui";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function toneForStatus(s?: string) {
  const v = (s || "").toLowerCase();
  if (v.includes("approved") || v.includes("verified")) return "ok";
  if (v.includes("rejected")) return "err";
  if (v.includes("pending") || v.includes("review")) return "warn";
  return "neutral";
}

export default async function OwnerHome() {
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
    .from("verification_requests")
    .select("id, status, submitted_at, created_at, revoked_at, revoked_reason")
    .order("created_at", { ascending: false })
    .limit(10);

  const items = (rows || []).map((r: any) => ({ ...r, tone: toneForStatus((r as any).revoked_at ? "revoked" : r.status) }));

  return (
    <DashboardShell title="Owner">
      <div className="space-y-4">
        <Card>
          <CardTitle>Últimas solicitudes</CardTitle>
          <CardMeta>Vista global (owner)</CardMeta>
          <div className="mt-3 space-y-2">
            {items.length === 0 ? (
              <div className="text-sm text-gray-600">No hay solicitudes.</div>
            ) : (
              items.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="text-sm font-medium">{it.id}</div>
                  <Badge>{(it as any).revoked_at ? "revoked" : it.status}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
