import { NextResponse } from "next/server";
import { addDaysIso, parseDurationDays, requireOwner } from "../../_lib";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function mapGrantTypeToPlanKey(grantType: string, grantValue: string | null) {
  if (grantType === "upgrade" && grantValue === "pro") return "candidate_pro_monthly";
  if (grantType === "upgrade" && grantValue === "proplus") return "candidate_proplus_monthly";
  if (grantType === "upgrade" && grantValue === "company_access") return "company_access_monthly";
  if (grantType === "upgrade" && grantValue === "company_hiring") return "company_hiring_monthly";
  if (grantType === "upgrade" && grantValue === "company_team") return "company_team_monthly";
  return null;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const { data, error } = await owner.admin
    .from("manual_grants")
    .select("id,user_id,grant_type,grant_value,reason,starts_at,expires_at,status,created_at,metadata")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return json(400, { error: "manual_grants_query_failed", details: error.message });
  return json(200, { manual_grants: data || [] });
}

export async function POST(req: Request) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const body = await req.json().catch(() => ({}));

  const user_id = String(body?.user_id || "").trim();
  const grant_type = String(body?.grant_type || "").trim();
  const grant_value = String(body?.grant_value || "").trim() || null;
  const reason = String(body?.reason || "").trim();
  const duration_option = String(body?.duration_option || "").trim();

  if (!user_id || !grant_type || !reason) {
    return json(400, { error: "missing_required_fields" });
  }

  const durationDays = parseDurationDays(duration_option);
  const startsAt = new Date().toISOString();
  const expiresAt = duration_option === "sin_caducidad" ? null : addDaysIso(durationDays);

  const { data: grant, error: grantErr } = await owner.admin
    .from("manual_grants")
    .insert({
      user_id,
      grant_type,
      grant_value,
      reason,
      starts_at: startsAt,
      expires_at: expiresAt,
      granted_by: owner.ownerId,
      status: "active",
      metadata: {
        source: "owner_manual_grant",
      },
    })
    .select("*")
    .single();

  if (grantErr) return json(400, { error: "manual_grant_create_failed", details: grantErr.message });

  const planKey = mapGrantTypeToPlanKey(grant_type, grant_value);
  if (planKey) {
    const { error: overrideErr } = await owner.admin
      .from("plan_overrides")
      .insert({
        user_id,
        plan_key: planKey,
        source_type: "manual_grant",
        source_id: grant.id,
        starts_at: startsAt,
        expires_at: expiresAt,
        is_active: true,
        metadata: {
          reason,
        },
      });

    if (overrideErr) {
      return json(400, { error: "plan_override_create_failed", details: overrideErr.message, manual_grant: grant });
    }
  }

  if (grant_type === "credits") {
    const credits = Number(grant_value || 0);
    if (Number.isFinite(credits) && credits > 0) {
      await owner.admin.from("credit_grants").insert({
        user_id,
        credits,
        source_type: "manual_grant",
        source_id: grant.id,
        starts_at: startsAt,
        expires_at: expiresAt,
        is_active: true,
        granted_by: owner.ownerId,
        metadata: {
          reason,
        },
      });
    }
  }

  return json(200, { manual_grant: grant, override_applied: Boolean(planKey) });
}
