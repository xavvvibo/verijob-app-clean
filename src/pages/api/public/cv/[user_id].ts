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

  // Legacy support: keep old metrics table for backward-compatible counters.
  const { data: trustLegacy, error: trustErr } = await supabase
    .from("candidate_cv_trust_scores")
    .select("cv_trust_score,experiences_total,verified_experiences,evidences_total,reuse_total")
    .eq("user_id", userId)
    .maybeSingle();

  if (trustErr) {
    return res.status(400).json({
      route_version: "public-cv-v6-pages",
      route: "/pages/api/public/cv/[user_id]",
      error: "trust_query_failed",
      details: trustErr.message,
    });
  }

  const { data: exps, error: expErr } = await supabase
    .from("candidate_cv_experiences")
    .select("id,exp_index")
    .eq("user_id", userId)
    .order("exp_index", { ascending: true });

  if (expErr) {
    return res.status(400).json({
      route_version: "public-cv-v6-pages",
      route: "/pages/api/public/cv/[user_id]",
      error: "experiences_query_failed",
      details: expErr.message,
    });
  }

  const expIds = Array.isArray(exps) ? exps.map((e: any) => e.id) : [];

  let scoresMap = new Map<string, any>();
  if (expIds.length > 0) {
    const { data: scores, error: scoreErr } = await supabase
      .from("candidate_experience_scores")
      .select("experience_id,status_text,score,evidence_count,reuse_count")
      .in("experience_id", expIds);

    if (scoreErr) {
      return res.status(400).json({
        route_version: "public-cv-v6-pages",
        route: "/pages/api/public/cv/[user_id]",
        error: "scores_query_failed",
        details: scoreErr.message,
      });
    }

    if (Array.isArray(scores)) {
      for (const s of scores) scoresMap.set(String(s.experience_id), s);
    }
  }

  const experiences = (Array.isArray(exps) ? exps : []).map((e: any) => {
    const s = scoresMap.get(String(e.id));
    return {
      experience_id: e.id,
      status_text: s?.status_text ?? "none",
      score: typeof s?.score === "number" ? s.score : 0,
      evidence_count: typeof s?.evidence_count === "number" ? s.evidence_count : 0,
      reuse_count: typeof s?.reuse_count === "number" ? s.reuse_count : 0,
    };
  });

  trackEventAdmin({
    event_name: "public_cv_viewed",
    user_id: null,
    company_id: null,
    entity_type: "candidate",
    entity_id: userId,
    metadata: {
      route_version: "public-cv-v6-pages",
      experiences_total: trustLegacy?.experiences_total ?? 0,
      verified_experiences: trustLegacy?.verified_experiences ?? 0,
      evidences_total: trustLegacy?.evidences_total ?? 0,
      reuse_total: trustLegacy?.reuse_total ?? 0,
      cv_trust_score: trustLegacy?.cv_trust_score ?? 0,
    },
  }).catch(() => {});

  const { data: canonical, error: canonicalErr } = await supabase
    .from("candidate_profiles")
    .select("trust_score,trust_score_breakdown")
    .eq("user_id", userId)
    .maybeSingle();

  if (canonicalErr) {
    return res.status(400).json({
      route_version: "public-cv-v6-pages",
      route: "/pages/api/public/cv/[user_id]",
      error: "canonical_trust_query_failed",
      details: canonicalErr.message,
    });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    route_version: "public-cv-v6-pages",
    route: "/pages/api/public/cv/[user_id]",
    candidate_id: userId,
    trust_score: Number((canonical as any)?.trust_score ?? trustLegacy?.cv_trust_score ?? 0),
    experiences_total: Number((canonical as any)?.trust_score_breakdown?.total ?? trustLegacy?.experiences_total ?? 0),
    verified_experiences: Number((canonical as any)?.trust_score_breakdown?.approved ?? trustLegacy?.verified_experiences ?? 0),
    evidences_total: Number((canonical as any)?.trust_score_breakdown?.evidences ?? trustLegacy?.evidences_total ?? 0),
    reuse_total: Number((canonical as any)?.trust_score_breakdown?.reuseEvents ?? trustLegacy?.reuse_total ?? 0),
    source_of_truth: "candidate_profiles.trust_score",
    legacy_metrics_table_used: Boolean(trustLegacy),
    experiences,
  });
}
