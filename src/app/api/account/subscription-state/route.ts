import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { readEffectiveSubscriptionState } from "@/lib/billing/effectiveSubscription";

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
  const state = await readEffectiveSubscriptionState(admin, user.id);
  return NextResponse.json({ subscription: state }, { status: 200 });
}
