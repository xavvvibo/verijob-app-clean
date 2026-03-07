import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireActiveSubscription } from "@/utils/billing/requireActiveSubscription";
import { rateLimit } from "@/utils/rateLimit";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

const ROUTE_VERSION = "reuse-direct-sql-v4-idempotent";

export async function POST(req: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized", route_version: ROUTE_VERSION }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_company_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.active_company_id) {
    return NextResponse.json({ error: "No active company", route_version: ROUTE_VERSION }, { status: 400 });
  }

  const role = String(profile.role || "").toLowerCase();
  const isCompany = role === "company" || role === "recruiter" || role === "viewer" || role === "owner";
  if (!isCompany) {
    return NextResponse.json({ error: "Forbidden", route_version: ROUTE_VERSION }, { status: 403 });
  }

  await requireActiveSubscription(supabase, user.id, { redirectTo: "/company/upgrade" });

  const hit = await rateLimit(`company_reuse:${user.id}`, 60, 10 * 60 * 1000);
  if (!hit.ok) {
    return NextResponse.json({ error: "Rate limit exceeded", route_version: ROUTE_VERSION }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token || "").trim();
  const verificationIdInput = String(body?.verification_id || "").trim();

  if (!token && !verificationIdInput) {
    return NextResponse.json({ error: "Missing token or verification_id", route_version: ROUTE_VERSION }, { status: 400 });
  }

  let verificationId = verificationIdInput;

  if (token) {
    const { data: link } = await supabase
      .from("verification_public_links")
      .select("verification_id")
      .eq("public_token", token)
      .maybeSingle();

    if (!link?.verification_id) {
      return NextResponse.json({ error: "Invalid token", route_version: ROUTE_VERSION }, { status: 400 });
    }
    verificationId = link.verification_id;
  }

  // Fuente de verdad: verification_requests
  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id, company_id, revoked_at")
    .eq("id", verificationId)
    .maybeSingle();

  if (vrErr || !vr) {
    return NextResponse.json({ error: "Verification not found", route_version: ROUTE_VERSION }, { status: 404 });
  }

  if (vr.company_id !== profile.active_company_id) {
    return NextResponse.json({ error: "Cross-company access denied", route_version: ROUTE_VERSION }, { status: 403 });
  }

  if (vr.revoked_at) {
    return NextResponse.json({ error: "Verification revoked", route_version: ROUTE_VERSION }, { status: 410 });
  }

  // ✅ Idempotencia: si ya existe, devolverlo (NO contamos como nuevo evento)
  const { data: existing } = await supabase
    .from("verification_reuse_events")
    .select("*")
    .eq("company_id", profile.active_company_id)
    .eq("verification_id", verificationId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ data: existing, route_version: ROUTE_VERSION, idempotent: true });
  }

  // Insert reuse event
  const { data: inserted, error: insertErr } = await supabase
    .from("verification_reuse_events")
    .insert({
      verification_id: verificationId,
      company_id: profile.active_company_id,
      reused_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .maybeSingle();

  if (insertErr) {
    // fallback: por si hubo carrera, re-leer
    const { data: again } = await supabase
      .from("verification_reuse_events")
      .select("*")
      .eq("company_id", profile.active_company_id)
      .eq("verification_id", verificationId)
      .maybeSingle();

    if (again) {
      return NextResponse.json({ data: again, route_version: ROUTE_VERSION, idempotent: true });
    }

    return NextResponse.json({ error: insertErr.message, route_version: ROUTE_VERSION }, { status: 400 });
  }

  // ✅ Analytics (best-effort) — SOLO cuando es nuevo (idempotent false)
  trackEventAdmin({
    event_name: "verification_reused",
    user_id: user.id,
    company_id: profile.active_company_id,
    entity_type: "verification_request",
    entity_id: verificationId,
    metadata: {
      route_version: ROUTE_VERSION,
      source: token ? "token" : "verification_id",
    },
  }).catch(() => {});

  return NextResponse.json({ data: inserted, route_version: ROUTE_VERSION, idempotent: false });
}
