import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { rateLimit } from "@/utils/rateLimit";

export const runtime = "nodejs";

type Params = { id: string };

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isUuid(v: string) {
  return /^[0-9a-f-]{36}$/i.test(v);
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;
  if (!id || !isUuid(id)) return json(404, { error: "Not found" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { error: "Unauthorized" });

  const rl = rateLimit(`create_public_link:${user.id}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return json(429, { error: "Too Many Requests" });

  const service = createServiceRoleClient();

  const { data: vr } = await service
    .from("verification_requests")
    .select("id, employment_record_id, requested_by")
    .eq("id", id)
    .maybeSingle();

  if (!vr) return json(404, { error: "Not found" });

  const { data: er } = await service
    .from("employment_records")
    .select("company_id")
    .eq("id", vr.employment_record_id)
    .maybeSingle();

  const companyId: string | null = er?.company_id ?? null;

  let allowed = vr.requested_by === user.id;

  if (!allowed && companyId) {
    const { data: member } = await service
      .from("company_members")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (member) allowed = true;
  }

  if (!allowed) return json(403, { error: "Forbidden" });

  const { data: existing } = await service
    .from("verification_public_links")
    .select("id, public_token, expires_at")
    .eq("verification_id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (existing?.public_token && !isExpired(existing.expires_at)) {
    return json(200, { token: existing.public_token });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (existing?.id) {
    await service
      .from("verification_public_links")
      .update({
        public_token: token,
        expires_at: expiresAt,
        is_active: true,
        company_id: companyId,
        created_by: user.id,
      })
      .eq("id", existing.id);

    return json(200, { token });
  }

  await service.from("verification_public_links").insert({
    verification_id: id,
    company_id: companyId,
    public_token: token,
    is_active: true,
    created_by: user.id,
    expires_at: expiresAt,
  });

  return json(200, { token });
}
