import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient as createSbAdmin } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

function extractIdFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p === "verification");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return null;
  } catch {
    return null;
  }
}

const ROUTE_VERSION = "revoke-v17-direct-vr+er-guard-no-requested_by";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // 1) Auth via SSR cookies
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized", route_version: ROUTE_VERSION }, { status: 401 });
  }

  // 2) Resolve verification id
  const params = await context.params;
  const idFromParams = params?.id ? String(params.id) : "";
  const idFromUrl = extractIdFromUrl(request) || "";
  const verificationId = (idFromParams || idFromUrl).trim();

  if (!verificationId) {
    return NextResponse.json({ error: "Missing verification id", route_version: ROUTE_VERSION }, { status: 400 });
  }

  // 3) Body
  const body = await request.json().catch(() => null);
  const reason = String(body?.reason || "").trim();
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: "Missing reason", route_version: ROUTE_VERSION }, { status: 400 });
  }

  // 4) Admin client (service role) - bypass RLS
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL", route_version: ROUTE_VERSION },
      { status: 500 }
    );
  }

  const admin = createSbAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 5) Load verification_request (NO requested_by, NO views)
  const { data: vr, error: vrErr } = await admin
    .from("verification_requests")
    .select("id, employment_record_id, revoked_at, revoked_by, revoked_reason")
    .eq("id", verificationId)
    .maybeSingle();

  if (vrErr) {
    return NextResponse.json({ error: String(vrErr.message || "Query error"), route_version: ROUTE_VERSION }, { status: 400 });
  }
  if (!vr) {
    return NextResponse.json({ error: "Verification not found", route_version: ROUTE_VERSION }, { status: 404 });
  }

  // 6) Idempotencia: si ya está revocada => ok
  if ((vr as any).revoked_at) {
    return NextResponse.json(
      { ok: true, already_revoked: true, verification_id: verificationId, data: vr, route_version: ROUTE_VERSION },
      { status: 200 }
    );
  }

  // 7) Guard: candidate dueño via employment_records.candidate_id
  const employmentRecordId = String((vr as any).employment_record_id || "");
  if (!employmentRecordId) {
    return NextResponse.json({ error: "Invalid verification: missing employment_record_id", route_version: ROUTE_VERSION }, { status: 400 });
  }

  const { data: er, error: erErr } = await admin
    .from("employment_records")
    .select("id, candidate_id")
    .eq("id", employmentRecordId)
    .maybeSingle();

  if (erErr) {
    return NextResponse.json({ error: String(erErr.message || "Query error"), route_version: ROUTE_VERSION }, { status: 400 });
  }
  if (!er) {
    return NextResponse.json({ error: "Employment record not found", route_version: ROUTE_VERSION }, { status: 404 });
  }

  if (String((er as any).candidate_id) !== String(user.id)) {
    return NextResponse.json({ error: "Forbidden", route_version: ROUTE_VERSION }, { status: 403 });
  }

  // 8) Update directo
  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await admin
    .from("verification_requests")
    .update({
      revoked_at: nowIso,
      revoked_by: user.id,
      revoked_reason: reason,
      // si usas también revocation_reason, lo mantenemos en sync
      revocation_reason: reason,
      updated_at: nowIso,
    })
    .eq("id", verificationId)
    .select("id, revoked_at, revoked_by, revoked_reason, revocation_reason, updated_at")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: String(updErr.message || "Update error"), route_version: ROUTE_VERSION }, { status: 400 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Verification not found", route_version: ROUTE_VERSION }, { status: 404 });
  }

  await recalculateAndPersistCandidateTrustScore(String(user.id)).catch(() => {});

  return NextResponse.json({ ok: true, data: updated, route_version: ROUTE_VERSION }, { status: 200 });
}
