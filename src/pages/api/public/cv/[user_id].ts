import type { NextApiRequest, NextApiResponse } from "next";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

function getServiceKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    null
  );
}

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

function getAppOrigin(req: NextApiRequest) {
  const envBase = process.env.NEXT_PUBLIC_APP_URL;
  if (envBase) return String(envBase).replace(/\/$/, "");
  const protocol = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "app.verijob.es");
  return `${protocol}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed", route: "/pages/api/public/cv/[user_id]" });
  }

  const userId = String(req.query.user_id || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "missing_user_id", route: "/pages/api/public/cv/[user_id]" });
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceKey();

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      error: "missing_server_env",
      has_url: !!supabaseUrl,
      has_service_key: !!serviceKey,
      route: "/pages/api/public/cv/[user_id]",
    });
  }

  const supabase: any = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: links, error: linkErr } = await supabase
    .from("candidate_public_links")
    .select("public_token,expires_at,is_active,created_at")
    .eq("candidate_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (linkErr) {
    return res.status(400).json({
      error: "public_link_query_failed",
      details: linkErr.message,
      route: "/pages/api/public/cv/[user_id]",
    });
  }

  const activeLink = (Array.isArray(links) ? links : []).find((row: any) => !isExpired(row?.expires_at));
  const token = String(activeLink?.public_token || "");
  if (!token) {
    return res.status(404).json({
      error: "no_active_public_token",
      route: "/pages/api/public/cv/[user_id]",
    });
  }

  const appOrigin = getAppOrigin(req);
  const canonicalRes = await fetch(`${appOrigin}/api/public/candidate/${token}`, {
    method: "GET",
    headers: { "x-vercel-protection-bypass": String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "") },
    cache: "no-store",
  });
  const canonicalBody = await canonicalRes.json().catch(() => ({}));
  if (!canonicalRes.ok) {
    return res.status(canonicalRes.status).json({
      error: "canonical_public_candidate_failed",
      details: canonicalBody?.error || null,
      route: "/pages/api/public/cv/[user_id]",
      token,
    });
  }

  const teaser = canonicalBody?.teaser || {};
  trackEventAdmin({
    event_name: "public_cv_viewed",
    user_id: null,
    company_id: null,
    entity_type: "candidate",
    entity_id: userId,
    metadata: {
      route_version: "public-cv-v7-canonical-token",
      token,
      experiences_total: Number(teaser?.experiences_total ?? 0),
      verified_experiences: Number(teaser?.verified_experiences ?? 0),
      evidences_total: Number(teaser?.evidences_total ?? teaser?.evidences_count ?? 0),
      reuse_total: Number(teaser?.reuse_total ?? 0),
      trust_score: Number(teaser?.trust_score ?? 0),
    },
  }).catch(() => {});

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    ...canonicalBody,
    route_version: "public-cv-v7-canonical-token",
    route: "/pages/api/public/cv/[user_id]",
    source_of_truth: "/api/public/candidate/[token]",
    candidate_id: canonicalBody?.candidate_id || userId,
    token,
    trust_score: Number(teaser?.trust_score ?? 0),
    experiences_total: Number(teaser?.experiences_total ?? 0),
    verified_experiences: Number(teaser?.verified_experiences ?? 0),
    evidences_total: Number(teaser?.evidences_total ?? teaser?.evidences_count ?? 0),
    reuse_total: Number(teaser?.reuse_total ?? 0),
  });
}
