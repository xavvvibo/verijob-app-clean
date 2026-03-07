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

function isVerifiedStatus(status: any) {
  const s = String(status || "").toLowerCase();
  return s === "approved" || s === "verified";
}

function isEducationVerification(row: any) {
  const candidates = [
    row?.verification_type,
    row?.type,
    row?.category,
    row?.kind,
    row?.request_type,
    row?.entity_type,
    row?.title,
    row?.position,
    row?.institution,
    row?.school,
    row?.degree,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  const joined = candidates.join(" ");
  return /(educ|academ|formaci|study|degree|univers|school|curso|master|fp|bachiller)/i.test(joined);
}

function resolveProfileStatus(args: { totalVerifications: number; evidencesCount: number; trustScore: number }) {
  if (args.totalVerifications === 0 && args.evidencesCount === 0) return "reviewing";
  if (args.totalVerifications >= 3 || args.trustScore >= 80) return "verified";
  return "partially_verified";
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params;

  if (!token || !isHex48(token)) return json(404, { error: "Not found" });

  // Auth (empresa logueada)
  const supabase = await createClient();
  const { data: au, error: auErr } = await supabase.auth.getUser();
  if (auErr || !au?.user) return json(401, { error: "Unauthorized" });

  // Guard estricto: solo contexto empresa autenticada
  const { data: requesterProfile, error: requesterErr } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", au.user.id)
    .maybeSingle();
  if (requesterErr) return json(400, { error: "Profile read failed", details: requesterErr.message });
  if (!(requesterProfile as any)?.active_company_id) return json(403, { error: "Company context required" });

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

  const { data: candidateProfile } = await service
    .from("candidate_profiles")
    .select("allow_company_email_contact,allow_company_phone_contact,job_search_status,availability_start,preferred_workday,preferred_roles,work_zones,availability_schedule,trust_score,trust_score_breakdown,education")
    .eq("user_id", link.candidate_id)
    .maybeSingle();

  const { data: verifications } = await service
    .from("verification_summary")
    .select("*")
    .eq("candidate_id", link.candidate_id);

  await service
    .from("candidate_public_links")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", link.id);

  const safe = sanitizePublic(profile);
  const rawEmail =
    typeof (profile as any)?.email === "string" && (profile as any).email.trim()
      ? String((profile as any).email).trim()
      : null;
  const rawPhone = [
    (profile as any)?.phone,
    (profile as any)?.phone_number,
    (profile as any)?.mobile,
    (profile as any)?.telefono,
    (profile as any)?.tel,
  ]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .find((v) => !!v) || null;

  const allowEmail = !!(candidateProfile as any)?.allow_company_email_contact;
  const allowPhone = !!(candidateProfile as any)?.allow_company_phone_contact;
  const contact = {
    email: allowEmail ? rawEmail : null,
    phone: allowPhone ? rawPhone : null,
    permissions: {
      allow_company_email_contact: allowEmail,
      allow_company_phone_contact: allowPhone,
    },
  };
  const availability = {
    job_search_status: (candidateProfile as any)?.job_search_status ?? null,
    availability_start: (candidateProfile as any)?.availability_start ?? null,
    preferred_workday: (candidateProfile as any)?.preferred_workday ?? null,
    preferred_roles: Array.isArray((candidateProfile as any)?.preferred_roles)
      ? (candidateProfile as any).preferred_roles
      : [],
    work_zones: (candidateProfile as any)?.work_zones ?? null,
    availability_schedule: Array.isArray((candidateProfile as any)?.availability_schedule)
      ? (candidateProfile as any).availability_schedule
      : [],
  };
  const verificationRows = Array.isArray(verifications) ? verifications : [];
  const verifiedRows = verificationRows.filter((r: any) => isVerifiedStatus(r?.status));
  const verifiedWorkCount = verifiedRows.filter((r: any) => !isEducationVerification(r)).length;
  const verifiedEducationCount = verifiedRows.filter((r: any) => isEducationVerification(r)).length;
  const totalVerifications = verifiedWorkCount + verifiedEducationCount;
  const evidencesCount = verificationRows.reduce(
    (acc: number, r: any) => acc + Number(r?.evidence_count ?? r?.evidences_count ?? 0),
    0
  );
  const trustScore = Number((candidateProfile as any)?.trust_score ?? 0);
  const profileStatus = resolveProfileStatus({
    totalVerifications,
    evidencesCount,
    trustScore,
  });
  const credibility = {
    verified_work_count: verifiedWorkCount,
    verified_education_count: verifiedEducationCount,
    total_verifications: totalVerifications,
    evidences_count: evidencesCount,
    trust_score: trustScore,
    profile_status: profileStatus,
  };

  return json(200, {
    candidate_id: link.candidate_id,
    profile: safe,
    contact,
    availability,
    credibility,
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
