import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function pickUserId(req: Request, ctx: any): string | null {
  const fromParams = ctx?.params?.user_id ?? ctx?.params?.userId ?? null;
  if (fromParams && typeof fromParams === "string") return fromParams;

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

function getServiceKey(): string | null {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY ||
    null
  );
}

export async function GET(req: Request, ctx: any) {
  const userId = pickUserId(req, ctx);
  if (!userId) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = getServiceKey();

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        error: "missing_server_env",
        has_url: !!supabaseUrl,
        has_service_key: !!serviceKey
      },
      { status: 500 }
    );
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: trust, error: trustError } = await supabase
    .from("candidate_cv_trust_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (trustError) {
    return NextResponse.json(
      { error: "trust_score_query_failed", details: trustError.message },
      { status: 400 }
    );
  }

  const { data: experiences, error: expError } = await supabase
    .from("candidate_experience_scores")
    .select("experience_id,status_text,score,evidence_count,reuse_count")
    .eq("user_id", userId);

  if (expError) {
    return NextResponse.json(
      { error: "experiences_query_failed", details: expError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    route_version: "public-cv-v4-service-role",
    candidate_id: userId,
    trust_score: trust?.cv_trust_score ?? 0,
    experiences_total: trust?.experiences_total ?? 0,
    verified_experiences: trust?.verified_experiences ?? 0,
    evidences_total: trust?.evidences_total ?? 0,
    reuse_total: trust?.reuse_total ?? 0,
    experiences: experiences ?? []
  });
}
