import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const runtime = "nodejs";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

export async function POST() {
  try {
    const supa = await createServerSupabaseClient();
    const { data: au } = await supa.auth.getUser();
    if (!au.user) return json(401, { error: "Unauthorized" });

    const srv = createServiceRoleClient();

    // Upsert defensivo: si no existe profile, lo crea.
    const { error } = await srv
      .from("profiles")
      .upsert(
        {
          id: au.user.id,
          onboarding_completed: true,
        },
        { onConflict: "id" }
      );

    if (error) return json(400, { error: "Bad request" });

    return json(200, { ok: true });
  } catch {
    return json(400, { error: "Bad request" });
  }
}
