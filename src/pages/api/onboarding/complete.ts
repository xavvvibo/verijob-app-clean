import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

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
    const body = typeof req.body === "object" && req.body ? req.body : {};
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
    const { data: profileBefore, error: profileReadErr } = await srv
      .from("profiles")
      .select("id,role")
      .eq("id", au.user.id)
      .maybeSingle();

    if (profileReadErr) {
      return json(res, 400, {
        error: "profiles_read_failed",
        route: "/pages/api/onboarding/complete",
        details: profileReadErr.message,
      });
    }

    if (String(profileBefore?.role || "").toLowerCase() === "company") {
      return json(res, 403, {
        error: "forbidden_role",
        route: "/pages/api/onboarding/complete",
      });
    }

    const requestedStep = String(body?.onboarding_step || "").trim().toLowerCase();
    const nextStep =
      requestedStep === "finish" || requestedStep === "verification" || requestedStep === "evidence" || requestedStep === "experience"
        ? requestedStep
        : "finish";

    const patch: Record<string, any> = {
      id: au.user.id,
      onboarding_completed: nextStep === "finish",
      onboarding_step: nextStep,
    };

    const allowedVisibility = new Set(["private", "public", "public_anonymous"]);
    const incomingVisibility = String(body?.profile_visibility || "").trim();
    if (allowedVisibility.has(incomingVisibility)) {
      patch.profile_visibility = incomingVisibility;
    }

    const boolFields = ["show_personal", "show_experience", "show_education", "show_achievements"] as const;
    for (const field of boolFields) {
      if (field in body) patch[field] = Boolean((body as any)[field]);
    }

    const { error } = await srv
      .from("profiles")
      .upsert(patch, { onConflict: "id" });

    if (error) {
      return json(res, 400, {
        error: "Bad request",
        route: "/pages/api/onboarding/complete",
        details: error.message,
      });
    }

    await trackEventAdmin({
      event_name: "onboarding_completed",
      user_id: au.user.id,
      entity_type: "profile",
      entity_id: au.user.id,
      metadata: {
        role: "candidate",
      },
    });

    return json(res, 200, { ok: true, route: "/pages/api/onboarding/complete" });
  } catch (e: any) {
    return json(res, 500, {
      error: "server_error",
      route: "/pages/api/onboarding/complete",
      details: String(e?.message || e),
    });
  }
}
