import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { sanitizePublic } from "@/utils/sanitizePublic";

type Params = { token: string };

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isHex48(token: string) {
  return /^[a-f0-9]{48}$/i.test(token);
}

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params;

  if (!token || !isHex48(token)) return json(404, { error: "Not found" });

  // Auth (empresa logueada)
  const supabase = await createClient();
  const { data: au, error: auErr } = await supabase.auth.getUser();
  if (auErr || !au?.user) return json(401, { error: "Unauthorized" });

  // Resolver token con service role (no dependemos de RLS del link)
  const service = createServiceRoleClient();

  const { data: link } = await service
    .from("candidate_public_links")
    .select("id, candidate_id, expires_at")
    .eq("public_token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (!link) return json(404, { error: "Not found" });
  if (isExpired(link.expires_at)) return json(410, { error: "Link expired" });

  // Consumo de crédito (idempotente por company+candidato+periodo)
  const { data: gate, error: gateErr } = await supabase.rpc("vj_consume_company_profile_view", {
    p_candidate_id: link.candidate_id,
  });

  if (gateErr) return json(500, { error: "Gate failed", debug: gateErr });

  // Si no hay créditos (Pro/Scale/Starter): bloquea
  if (!gate?.allowed) {
    return json(402, {
      error: "No credits",
      reason: gate?.reason ?? "no_credits",
      credits_remaining: gate?.credits_remaining ?? null,
      upgrade_url: "/company/upgrade",
    });
  }

  // Perfil (por ahora igual que público, pero en ruta privada + gating ya aplicado)
  const { data: profile } = await service
    .from("profiles")
    .select("*")
    .eq("id", link.candidate_id)
    .maybeSingle();

  if (!profile) return json(404, { error: "Not found" });

  await service
    .from("candidate_public_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", link.id);

  const safe = sanitizePublic(profile);

  return json(200, {
    candidate_id: link.candidate_id,
    profile: safe,
    gate: {
      allowed: true,
      consumed: !!gate?.consumed,
      requires_overage: !!gate?.requires_overage, // Enterprise sin créditos -> true
      overage_price: gate?.overage_price ?? null,
      credits_remaining: gate?.credits_remaining ?? null,
      period_start: gate?.period_start ?? null,
    },
  });
}
