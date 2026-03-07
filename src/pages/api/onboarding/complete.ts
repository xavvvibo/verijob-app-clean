import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesRouteClient } from "@/utils/supabase/pages";
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
    const supa = createPagesRouteClient(req, res);
    const { data: au, error: authErr } = await supa.auth.getUser();

    if (authErr || !au.user) {
      return json(res, 401, {
        error: "Unauthorized",
        route: "/pages/api/onboarding/complete",
        details: authErr?.message ?? null,
      });
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
      return json(res, 400, {
        error: "Bad request",
        route: "/pages/api/onboarding/complete",
        details: error.message,
      });
    }

    return json(res, 200, { ok: true, route: "/pages/api/onboarding/complete" });
  } catch (e: any) {
    return json(res, 500, {
      error: "server_error",
      route: "/pages/api/onboarding/complete",
      details: String(e?.message || e),
    });
  }
}
