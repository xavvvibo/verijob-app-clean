import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function userIdFromUrl(req: Request): string {
  try {
    const u = new URL(req.url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

export async function GET(req: Request, ctx: any) {
  // Next 16: ctx.params puede ser Promise; además hacemos fallback por URL
  let userId = "";

  try {
    const p = ctx?.params;
    const params = (p && typeof p.then === "function") ? await p : p;
    userId = String(params?.user_id || "");
  } catch {}

  if (!userId) userId = userIdFromUrl(req);
  if (!userId) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "missing_server_env", has_url: !!supabaseUrl, has_service_key: !!serviceKey },
      { status: 500 }
    );
  }

  const supabase: any = createSupabaseAdmin(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: trust, error: trustErr } = await supabase
    .from("candidate_cv_trust_scores")
    .select("cv_trust_score,experiences_total,verified_experiences,evidences_total,reuse_total")
    .eq("user_id", userId)
    .maybeSingle();

  if (trustErr) {
    return NextResponse.json(
      { route_version: "public-cv-v6", error: "trust_query_failed", details: trustErr.message },
      { status: 400 }
    );
  }

  const { data: exps, error: expErr } = await supabase
    .from("candidate_cv_experiences")
    .select("id,exp_index")
    .eq("user_id", userId)
    .order("exp_index", { ascending: true });

  if (expErr) {
    return NextResponse.json(
      { route_version: "public-cv-v6", error: "experiences_query_failed", details: expErr.message },
      { status: 400 }
    );
  }

  const expIds = Array.isArray(exps) ? exps.map((e: any) => e.id) : [];

  let scoresMap = new Map<string, any>();
  if (expIds.length > 0) {
    const { data: scores, error: scoreErr } = await supabase
      .from("candidate_experience_scores")
      .select("experience_id,status_text,score,evidence_count,reuse_count")
      .in("experience_id", expIds);

    if (scoreErr) {
      return NextResponse.json(
        { route_version: "public-cv-v6", error: "scores_query_failed", details: scoreErr.message },
        { status: 400 }
      );
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
      reuse_count: typeof s?.reuse_count === "number" ? s.reuse_count : 0
    };
  });

  // ✅ Analytics (best-effort) — contar vista pública
  trackEventAdmin({
    event_name: "public_cv_viewed",
    user_id: null,
    company_id: null,
    entity_type: "candidate",
    entity_id: userId,
    metadata: {
      route_version: "public-cv-v6",
      source: "api_public_cv",
    },
  }).catch(() => {});

  return NextResponse.json({
    route_version: "public-cv-v6",
    candidate_id: userId,
    trust_score: trust?.cv_trust_score ?? 0,
    experiences_total: trust?.experiences_total ?? experiences.length,
    verified_experiences: trust?.verified_experiences ?? 0,
    evidences_total: trust?.evidences_total ?? 0,
    reuse_total: trust?.reuse_total ?? 0,
    experiences
  });
}
