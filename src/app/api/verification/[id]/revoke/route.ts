import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { applyVerificationRemovalImpact, collectVerificationAffectedExperiences } from "@/lib/verification/verification-impact";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function extractIdFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.findIndex((part) => part === "verification");
    if (index >= 0 && parts[index + 1]) return parts[index + 1];
    return null;
  } catch {
    return null;
  }
}

const ROUTE_VERSION = "revoke-v18-impact-preview";

async function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error("missing_service_role");
  }

  return createSbAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadOwnedVerification(params: {
  admin: any;
  verificationId: string;
  userId: string;
}) {
  const { admin, verificationId, userId } = params;
  const { data: verification, error: verificationErr } = await admin
    .from("verification_requests")
    .select("id,requested_by,employment_record_id,status,request_context,revoked_at,revoked_by,revoked_reason")
    .eq("id", verificationId)
    .maybeSingle();

  if (verificationErr) {
    return { error: { error: String(verificationErr.message || "Query error"), status: 400 }, verification: null };
  }
  if (!verification) {
    return { error: { error: "Verification not found", status: 404 }, verification: null };
  }

  const directOwner = String((verification as any)?.requested_by || "").trim();
  if (directOwner && directOwner === userId) {
    return { error: null, verification };
  }

  const employmentRecordId = String((verification as any)?.employment_record_id || "").trim();
  if (!employmentRecordId) {
    return { error: { error: "Invalid verification: missing employment_record_id", status: 400 }, verification: null };
  }

  const { data: employmentRecord, error: employmentErr } = await admin
    .from("employment_records")
    .select("id,candidate_id")
    .eq("id", employmentRecordId)
    .maybeSingle();

  if (employmentErr) {
    return { error: { error: String(employmentErr.message || "Query error"), status: 400 }, verification: null };
  }
  if (!employmentRecord) {
    return { error: { error: "Employment record not found", status: 404 }, verification: null };
  }
  if (String((employmentRecord as any)?.candidate_id || "") !== userId) {
    return { error: { error: "Forbidden", status: 403 }, verification: null };
  }

  return { error: null, verification };
}

async function handlePreview(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return json(401, { error: "Unauthorized", route_version: ROUTE_VERSION });
  }

  const params = await context.params;
  const verificationId = String(params?.id || extractIdFromUrl(request) || "").trim();
  if (!verificationId) {
    return json(400, { error: "Missing verification id", route_version: ROUTE_VERSION });
  }

  try {
    const admin = await createAdminClient();
    const loaded = await loadOwnedVerification({ admin, verificationId, userId: String(user.id) });
    if (loaded.error) {
      return json(loaded.error.status, { error: loaded.error.error, route_version: ROUTE_VERSION });
    }

    if ((loaded.verification as any)?.revoked_at) {
      return json(200, {
        ok: true,
        already_revoked: true,
        affected_experiences: [],
        route_version: ROUTE_VERSION,
      });
    }

    const impact = await collectVerificationAffectedExperiences({
      admin,
      verificationId,
      candidateId: String(user.id),
    });
    if (impact.error) {
      return json(400, {
        error: String(impact.error.message || "impact_preview_failed"),
        route_version: ROUTE_VERSION,
      });
    }

    return json(200, {
      ok: true,
      affected_experiences: (impact.affected || []).filter((item: any) => item?.loses_verification),
      route_version: ROUTE_VERSION,
    });
  } catch (error: any) {
    return json(500, {
      error: String(error?.message || "Server misconfigured"),
      route_version: ROUTE_VERSION,
    });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (new URL(request.url).searchParams.get("preview") !== "1") {
    return json(405, { error: "Method not allowed", route_version: ROUTE_VERSION });
  }
  return handlePreview(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return json(401, { error: "Unauthorized", route_version: ROUTE_VERSION });
  }

  const params = await context.params;
  const verificationId = String(params?.id || extractIdFromUrl(request) || "").trim();
  if (!verificationId) {
    return json(400, { error: "Missing verification id", route_version: ROUTE_VERSION });
  }

  const body = await request.json().catch(() => null);
  const reason = String(body?.reason || "").trim();
  if (!reason || reason.length < 5) {
    return json(400, { error: "Missing reason", route_version: ROUTE_VERSION });
  }

  try {
    const admin = await createAdminClient();
    const loaded = await loadOwnedVerification({ admin, verificationId, userId: String(user.id) });
    if (loaded.error) {
      return json(loaded.error.status, { error: loaded.error.error, route_version: ROUTE_VERSION });
    }

    if ((loaded.verification as any)?.revoked_at) {
      return json(200, {
        ok: true,
        already_revoked: true,
        verification_id: verificationId,
        affected_experiences: [],
        route_version: ROUTE_VERSION,
      });
    }

    const impact = await applyVerificationRemovalImpact({
      admin,
      verificationId,
      candidateId: String(user.id),
    });
    if (impact.error) {
      return json(400, {
        error: String(impact.error.message || "verification_impact_failed"),
        route_version: ROUTE_VERSION,
      });
    }

    const nowIso = new Date().toISOString();
    const currentContext =
      loaded.verification?.request_context && typeof loaded.verification.request_context === "object"
        ? { ...(loaded.verification.request_context as any) }
        : {};
    currentContext.verification_source = null;
    currentContext.verification_method = null;
    currentContext.verification_reason = null;
    currentContext.verification_removed = true;
    currentContext.verification_removed_at = nowIso;

    const { data: updated, error: updateErr } = await admin
      .from("verification_requests")
      .update({
        status: "revoked",
        revoked_at: nowIso,
        revoked_by: user.id,
        revoked_reason: reason,
        revocation_reason: reason,
        request_context: currentContext,
      })
      .eq("id", verificationId)
      .select("id, revoked_at, revoked_by, revoked_reason, revocation_reason")
      .maybeSingle();

    if (updateErr) {
      return json(400, { error: String(updateErr.message || "Update error"), route_version: ROUTE_VERSION });
    }

    await recalculateAndPersistCandidateTrustScore(String(user.id)).catch(() => {});

    return json(200, {
      ok: true,
      data: updated,
      affected_experiences: (impact.affected || []).filter((item: any) => item?.loses_verification),
      route_version: ROUTE_VERSION,
    });
  } catch (error: any) {
    return json(500, {
      error: String(error?.message || "Server misconfigured"),
      route_version: ROUTE_VERSION,
    });
  }
}
