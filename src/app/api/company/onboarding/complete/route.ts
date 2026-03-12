import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST() {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) return json(400, { error: "auth_getUser_failed", details: userErr.message });
    if (!user) return json(401, { error: "unauthorized" });

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id,role,active_company_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) return json(400, { error: "profiles_read_failed", details: profileErr.message });
    if (String(profile?.role || "").toLowerCase() !== "company") return json(403, { error: "forbidden_role" });

    let companyId = profile?.active_company_id ? String(profile.active_company_id) : null;
    if (!companyId) {
      const { data: membership } = await admin
        .from("company_members")
        .select("company_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (membership?.company_id) {
        companyId = String(membership.company_id);
        await admin.from("profiles").update({ active_company_id: companyId }).eq("id", user.id);
      }
    }
    if (!companyId) return json(400, { error: "no_active_company" });

    const nowIso = new Date().toISOString();

    const { error: upErr } = await admin
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    if (upErr) return json(400, { error: "profiles_update_failed", details: upErr.message });

    await admin
      .from("company_profiles")
      .upsert(
        {
          company_id: companyId,
          onboarding_completed_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "company_id" },
      );

    return json(200, { ok: true, onboarding_completed: true });
  } catch (e: any) {
    return json(500, { error: "unhandled_exception", details: e?.message || String(e) });
  }
}
