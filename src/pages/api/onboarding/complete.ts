import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed", route: "/pages/api/onboarding/complete" });
  }

  try {
    const supa = await createServerSupabaseClient();
    const { data: au } = await supa.auth.getUser();

    if (!au.user) {
      return json(res, 401, { error: "Unauthorized", route: "/pages/api/onboarding/complete" });
    }

    const srv = createServiceRoleClient();

    const { error } = await srv
      .from("profiles")
      .upsert(
        {
          id: au.user.id,
          onboarding_completed: true,
        },
        { onConflict: "id" }
      );

    if (error) {
      return json(res, 400, { error: "Bad request", route: "/pages/api/onboarding/complete" });
    }

    return json(res, 200, { ok: true, route: "/pages/api/onboarding/complete" });
  } catch {
    return json(res, 400, { error: "Bad request", route: "/pages/api/onboarding/complete" });
  }
}
