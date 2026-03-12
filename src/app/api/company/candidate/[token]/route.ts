import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { sanitizePublic } from "@/utils/sanitizePublic";
import { resolveActiveCandidatePublicLink } from "@/lib/public/candidate-public-link";

type Params = { token: string };

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { token: tokenParam } = await ctx.params;

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

  const linkResolved = await resolveActiveCandidatePublicLink(service, tokenParam);
  if (linkResolved.ok === false) {
    if (linkResolved.reason === "expired") return json(410, { error: "Link expired" });
    return json(404, { error: "Not found" });
  }
  const link = linkResolved.link;

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
    .select("*,lifecycle_status,deleted_at")
    .eq("id", link.candidate_id)
    .maybeSingle();

  if (!profile) return json(404, { error: "Not found" });
  const lifecycleStatus = String((profile as any)?.lifecycle_status || "active").toLowerCase();
  if (lifecycleStatus === "deleted" || lifecycleStatus === "disabled") {
    return json(410, { error: "Profile unavailable" });
  }

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
  const breakdownRaw = (candidateProfile as any)?.trust_score_breakdown || {};
  const experiencesBase = Math.max(1, verificationRows.length || 0);
  const trustComponents = {
    verification: Number.isFinite(Number(breakdownRaw?.verification))
      ? clampPercent(Number(breakdownRaw.verification))
      : clampPercent((verifiedRows.length / experiencesBase) * 100),
    evidence: Number.isFinite(Number(breakdownRaw?.evidence))
      ? clampPercent(Number(breakdownRaw.evidence))
      : clampPercent((evidencesCount / Math.max(1, experiencesBase * 2)) * 100),
    consistency: Number.isFinite(Number(breakdownRaw?.consistency))
      ? clampPercent(Number(breakdownRaw.consistency))
      : clampPercent(
          ((Number(Boolean((safe as any)?.title)) + Number(Boolean((safe as any)?.location)) + Number(!!(candidateProfile as any)?.job_search_status)) / 3) * 100
        ),
    reuse: Number.isFinite(Number(breakdownRaw?.reuse))
      ? clampPercent(Number(breakdownRaw.reuse))
      : clampPercent(
          (verificationRows.reduce((acc: number, r: any) => acc + Number(r?.reuse_count ?? 0), 0) / experiencesBase) * 100
        ),
  };
  const verificationTimeline = verificationRows
    .map((row: any) => ({
      verification_id: String(row?.verification_id || ""),
      position: row?.position || null,
      company_name: row?.company_name || row?.company_name_target || null,
      status: String(row?.status_effective || row?.status || "unknown"),
      evidence_count: Number(row?.evidence_count ?? row?.evidences_count ?? 0),
      reuse_count: Number(row?.reuse_count ?? 0),
      start_date: row?.start_date || null,
      end_date: row?.end_date || null,
      created_at: row?.created_at || null,
      resolved_at: row?.resolved_at || null,
    }))
    .sort((a, b) => {
      const ta = Date.parse(String(a.resolved_at || a.created_at || 0));
      const tb = Date.parse(String(b.resolved_at || b.created_at || 0));
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    })
    .slice(0, 12);

  return json(200, {
    candidate_id: link.candidate_id,
    profile: safe,
    contact,
    availability,
    credibility,
    trust_components: trustComponents,
    verification_timeline: verificationTimeline,
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
