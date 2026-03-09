import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

const ROUTE_VERSION = "reuse-pages-api-v1";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ ...body, route_version: ROUTE_VERSION });
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { error: "method_not_allowed" });
    }

    const supabase = createPagesRouteClient(req, res);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    const user = auth?.user ?? null;

    if (authError || !user) {
      return json(res, 401, { error: "unauthorized", details: authError?.message ?? null });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("active_company_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile?.active_company_id) {
      return json(res, 400, { error: "no_active_company", details: profileError?.message ?? null });
    }

    const role = String(profile.role || "").toLowerCase();
    const allowed = new Set(["company", "recruiter", "viewer", "owner", "admin", "reviewer"]);
    if (!allowed.has(role)) {
      return json(res, 403, { error: "forbidden" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const token = String(body?.token || "").trim();
    const verificationIdInput = String(body?.verification_id || "").trim();

    if (!token && !verificationIdInput) {
      return json(res, 400, { error: "missing_token_or_verification_id" });
    }

    let verificationId = verificationIdInput;

    if (token) {
      const { data: link, error: linkErr } = await supabase
        .from("verification_public_links")
        .select("verification_id")
        .eq("public_token", token)
        .maybeSingle();

      if (linkErr || !link?.verification_id) {
        return json(res, 400, { error: "invalid_token", details: linkErr?.message ?? null });
      }
      verificationId = String(link.verification_id);
    }

    const { data: vr, error: vrErr } = await supabase
      .from("verification_requests")
      .select("id, company_id, revoked_at")
      .eq("id", verificationId)
      .maybeSingle();

    if (vrErr || !vr) {
      return json(res, 404, { error: "verification_not_found", details: vrErr?.message ?? null });
    }

    if (String(vr.company_id || "") !== String(profile.active_company_id || "")) {
      return json(res, 403, { error: "cross_company_access_denied" });
    }

    if (vr.revoked_at) {
      return json(res, 410, { error: "verification_revoked" });
    }

    const svc = admin();

    const { data: existing, error: existingErr } = await svc
      .from("verification_reuse_events")
      .select("*")
      .eq("company_id", profile.active_company_id)
      .eq("verification_id", verificationId)
      .maybeSingle();

    if (existingErr) {
      return json(res, 400, { error: "reuse_lookup_failed", details: existingErr.message });
    }

    if (existing) {
      return json(res, 200, { data: existing, idempotent: true });
    }

    const { data: inserted, error: insertErr } = await svc
      .from("verification_reuse_events")
      .insert({
        verification_id: verificationId,
        company_id: profile.active_company_id,
        reused_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select("*")
      .maybeSingle();

    if (insertErr) {
      const { data: again } = await svc
        .from("verification_reuse_events")
        .select("*")
        .eq("company_id", profile.active_company_id)
        .eq("verification_id", verificationId)
        .maybeSingle();

      if (again) {
        return json(res, 200, { data: again, idempotent: true });
      }

      return json(res, 400, { error: "reuse_insert_failed", details: insertErr.message });
    }

    const { data: requestOwner } = await svc
      .from("verification_requests")
      .select("requested_by")
      .eq("id", verificationId)
      .maybeSingle();
    const candidateId = String((requestOwner as any)?.requested_by || "").trim();
    if (candidateId) {
      await recalculateAndPersistCandidateTrustScore(candidateId).catch(() => {});
    }

    return json(res, 200, { data: inserted, idempotent: false });
  } catch (e: any) {
    return json(res, 500, { error: "internal_error", details: String(e?.message || e) });
  }
}
