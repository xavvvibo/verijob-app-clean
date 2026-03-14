import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { rateLimit } from "@/utils/rateLimit";
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";

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

function isHex48(token: unknown) {
  return /^[a-f0-9]{48}$/i.test(String(token || ""));
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
    const { data: profile } = await service
      .from("profiles")
      .select("lifecycle_status")
      .eq("id", user.id)
      .maybeSingle();
    if (isUnavailableLifecycleStatus((profile as any)?.lifecycle_status)) {
      return json(res, 423, {
        error: "profile_unavailable",
        route: "/pages/api/candidate/public-link",
        user_message: "Tu perfil esta desactivado o eliminado y no puede generar enlaces publicos.",
      });
    }

    const { data: activeRows, error: existingErr } = await service
      .from("candidate_public_links")
      .select("id, candidate_id, public_token, expires_at, is_active, created_at")
      .eq("candidate_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    if (existingErr) {
      return json(res, 400, {
        error: "Read failed",
        route: "/pages/api/candidate/public-link",
        details: existingErr.message,
      });
    }

    const rows = Array.isArray(activeRows) ? activeRows : [];
    const canonicalActive = rows.find((row: any) => isHex48(row?.public_token) && !isExpired(row?.expires_at));

    if (canonicalActive?.id && canonicalActive?.public_token) {
      // Normaliza posibles duplicados activos históricos sin romper el token canónico.
      const toDeactivate = rows
        .filter((row: any) => String(row?.id || "") && String(row?.id || "") !== String(canonicalActive.id))
        .map((row: any) => String(row.id));
      if (toDeactivate.length) {
        await service.from("candidate_public_links").update({ is_active: false }).in("id", toDeactivate);
      }
      return json(res, 200, {
        token: String(canonicalActive.public_token),
        route: "/pages/api/candidate/public-link",
      });
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const activeIds = rows.map((row: any) => String(row?.id || "")).filter(Boolean);
    if (activeIds.length) {
      await service.from("candidate_public_links").update({ is_active: false }).in("id", activeIds);
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
    const { data: persistedRows, error: persistedErr } = await service
      .from("candidate_public_links")
      .select("id, public_token, expires_at, is_active, created_at")
      .eq("candidate_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (persistedErr) {
      return json(res, 400, {
        error: "Read persisted link failed",
        route: "/pages/api/candidate/public-link",
        details: persistedErr.message,
      });
    }
    const persisted = Array.isArray(persistedRows) ? persistedRows[0] : null;
    if (!persisted?.public_token) {
      return json(res, 500, {
        error: "Persisted token not found",
        route: "/pages/api/candidate/public-link",
      });
    }

    return json(res, 200, { token: String(persisted.public_token), route: "/pages/api/candidate/public-link" });
  } catch (e: any) {
    return json(res, 500, {
      error: "server_error",
      route: "/pages/api/candidate/public-link",
      details: String(e?.message || e),
    });
  }
}
