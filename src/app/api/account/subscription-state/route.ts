import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  readEffectiveCompanySubscriptionState,
  readEffectiveSubscriptionState,
} from "@/lib/billing/effectiveSubscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ error: "auth_getUser_failed" }, { status: 400 });
  }
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role,active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = String((profile as any)?.role || "").toLowerCase();
  const activeCompanyId = String((profile as any)?.active_company_id || "").trim();
  const state =
    role === "company" && activeCompanyId
      ? await readEffectiveCompanySubscriptionState(admin, { userId: user.id, companyId: activeCompanyId })
      : await readEffectiveSubscriptionState(admin, user.id);

  return NextResponse.json({ subscription: state }, { status: 200 });
}
