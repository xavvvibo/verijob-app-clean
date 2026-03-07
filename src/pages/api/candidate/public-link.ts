import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { rateLimit } from "@/utils/rateLimit";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed", route: "/pages/api/candidate/public-link" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user ?? null;

    if (authErr || !user) {
      return json(res, 401, {
        error: "Unauthorized",
        route: "/pages/api/candidate/public-link",
        details: authErr?.message ?? null,
      });
    }

    const rl = rateLimit(`create_candidate_public_link:${user.id}`, 30, 10 * 60 * 1000);
    if (!rl.ok) {
      return json(res, 429, { error: "Too Many Requests", route: "/pages/api/candidate/public-link" });
    }

    const service = createServiceRoleClient();

    const { data: existing, error: existingErr } = await service
      .from("candidate_public_links")
      .select("id, public_token, expires_at")
      .eq("candidate_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (existingErr) {
      return json(res, 400, {
        error: "Read failed",
        route: "/pages/api/candidate/public-link",
        details: existingErr.message,
      });
    }

    if (existing?.public_token && !isExpired(existing.expires_at)) {
      return json(res, 200, { token: existing.public_token, route: "/pages/api/candidate/public-link" });
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (existing?.id) {
      const { error } = await service
        .from("candidate_public_links")
        .update({
          public_token: token,
          expires_at: expiresAt,
          last_viewed_at: null,
          is_active: true,
          created_by: user.id,
        })
        .eq("id", existing.id);

      if (error) {
        return json(res, 400, {
          error: "Update failed",
          route: "/pages/api/candidate/public-link",
          details: error.message,
        });
      }

      return json(res, 200, { token, route: "/pages/api/candidate/public-link" });
    }

    const { error } = await service.from("candidate_public_links").insert({
      candidate_id: user.id,
      public_token: token,
      is_active: true,
      created_by: user.id,
      expires_at: expiresAt,
    });

    if (error) {
      return json(res, 400, {
        error: "Insert failed",
        route: "/pages/api/candidate/public-link",
        details: error.message,
      });
    }

    return json(res, 200, { token, route: "/pages/api/candidate/public-link" });
  } catch (e: any) {
    return json(res, 500, {
      error: "server_error",
      route: "/pages/api/candidate/public-link",
      details: String(e?.message || e),
    });
  }
}
