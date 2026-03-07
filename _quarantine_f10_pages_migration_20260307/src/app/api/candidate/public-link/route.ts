import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { rateLimit } from "@/utils/rateLimit";

export const runtime = "nodejs";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json(401, { error: "Unauthorized" });

  const rl = rateLimit(`create_candidate_public_link:${user.id}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return json(429, { error: "Too Many Requests" });

  const service = createServiceRoleClient();

  const { data: existing } = await service
    .from("candidate_public_links")
    .select("id, public_token, expires_at")
    .eq("candidate_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (existing?.public_token && !isExpired(existing.expires_at)) {
    return json(200, { token: existing.public_token });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  if (existing?.id) {
    const { error } = await service
      .from("candidate_public_links")
      .update({
        public_token: token,
        expires_at: expiresAt,
        last_viewed_at: null,
        is_active: true,
        created_by: user.id,
      })
      .eq("id", existing.id);

    if (error) return json(400, { error: "Update failed" });
    return json(200, { token });
  }

  const { error } = await service.from("candidate_public_links").insert({
    candidate_id: user.id,
    public_token: token,
    is_active: true,
    created_by: user.id,
    expires_at: expiresAt,
  });

  if (error) return json(400, { error: "Insert failed" });

  return json(200, { token });
}
