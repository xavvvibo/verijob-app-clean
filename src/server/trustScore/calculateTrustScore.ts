import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import {
  getEvidenceTypeWeight,
  normalizeEvidenceType,
  normalizeValidationStatus,
  EVIDENCE_VALIDATION_INTERNAL,
} from "@/lib/candidate/evidence-types";
import { isVerifiedEmploymentRecordStatus } from "@/lib/verification/employment-record-verification-status";

type TrustBreakdown = {
  verification: number;
  evidence: number;
  consistency: number;
  reuse: number;
  approved: number;
  confirmed: number;
  evidences: number;
  reuseEvents: number;
  reuseCompanies: number;
  model: string;
};

type TrustResult = {
  score: number;
  breakdown: TrustBreakdown;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function monthIndex(value: unknown): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return Number(iso[1]) * 12 + (Number(iso[2]) - 1);
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return Number(ym[1]) * 12 + (Number(ym[2]) - 1);
  const y = raw.match(/^(\d{4})$/);
  if (y) return Number(y[1]) * 12;
  return null;
}

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function consistencyBlockFromEmployment(rows: any[]): number {
  if (!rows.length) return 0;

  const ranges: Array<{ start: number; end: number }> = [];
  let missingStart = 0;
  let inverted = 0;

  for (const row of rows) {
    const start = monthIndex(row?.start_date);
    const end = monthIndex(row?.end_date);
    if (start == null) {
      missingStart += 1;
      continue;
    }
    const effectiveEnd = end ?? monthIndex(new Date().toISOString().slice(0, 10)) ?? start;
    if (effectiveEnd < start) inverted += 1;
    ranges.push({ start, end: Math.max(effectiveEnd, start) });
  }

  if (!ranges.length) return 0;
  ranges.sort((a, b) => a.start - b.start);

  let gapMonths = 0;
  for (let i = 1; i < ranges.length; i += 1) {
    const prev = ranges[i - 1];
    const cur = ranges[i];
    const gap = cur.start - prev.end;
    if (gap > 2) gapMonths += gap - 2;
  }

  if (missingStart === 0 && inverted === 0 && gapMonths <= 3) return 15;
  if (inverted <= 1 && gapMonths <= 12) return 10;
  return 0;
}

export async function calculateTrustScore(candidateId: string): Promise<TrustResult> {
  const admin = createAdminSupabaseClient();

  const [{ data: employmentRows }, { data: verificationRows }, { data: evidenceRows }] = await Promise.all([
    admin
      .from("employment_records")
      .select("id,start_date,end_date,verification_status")
      .eq("candidate_id", candidateId),
    admin
      .from("verification_requests")
      .select("id,status,requested_by")
      .eq("requested_by", candidateId),
    admin
      .from("evidences")
      .select("id,evidence_type,document_type,document_scope,trust_weight,validation_status,inconsistency_reason,uploaded_by,verification_request_id")
      .eq("uploaded_by", candidateId),
  ]);

  const employment = Array.isArray(employmentRows) ? employmentRows : [];
  const verifications = Array.isArray(verificationRows) ? verificationRows : [];
  const evidences = Array.isArray(evidenceRows) ? evidenceRows : [];

  const verifiedEmploymentCount = employment.filter((row: any) => {
    return isVerifiedEmploymentRecordStatus(row?.verification_status);
  }).length;

  const verificationBlock =
    verifiedEmploymentCount >= 3 ? 40 : verifiedEmploymentCount === 2 ? 30 : verifiedEmploymentCount === 1 ? 20 : 0;

  const usableEvidences = evidences.filter((row: any) => {
    const status = normalizeValidationStatus(row?.validation_status);
    return status !== EVIDENCE_VALIDATION_INTERNAL.REJECTED;
  });
  const uniqueEvidenceTypes = new Set(
    usableEvidences
      .map((row: any) => normalizeEvidenceType(row?.document_type || row?.evidence_type))
      .filter(Boolean)
  );
  const evidenceWeightSum = Array.from(uniqueEvidenceTypes).reduce(
    (acc, type) => {
      const row = usableEvidences.find(
        (e: any) => normalizeEvidenceType(e?.document_type || e?.evidence_type) === type
      );
      const persistedWeight = Number((row as any)?.trust_weight ?? 0);
      const baseWeight = Number(getEvidenceTypeWeight(type) || 0);
      const finalWeight = persistedWeight > 0 ? persistedWeight : baseWeight;
      return acc + finalWeight;
    },
    0
  );
  const maxWeightSum = 1 + 0.85 + 0.8 + 0.65 + 0.35; // vida laboral + certificado + contrato + nómina + otro
  const weightedEvidenceRatio = maxWeightSum > 0 ? evidenceWeightSum / maxWeightSum : 0;
  const evidenceBlock = Math.min(30, Math.round(weightedEvidenceRatio * 30));

  const consistencyBlock = consistencyBlockFromEmployment(employment);

  const verificationIds = verifications.map((row: any) => row?.id).filter(Boolean);
  let reuseEvents = 0;
  let reuseCompanies = 0;
  if (verificationIds.length) {
    const { data: reuseRows } = await admin
      .from("verification_reuse_events")
      .select("verification_id,company_id")
      .in("verification_id", verificationIds);
    const reuse = Array.isArray(reuseRows) ? reuseRows : [];
    reuseEvents = reuse.length;
    reuseCompanies = new Set(reuse.map((row: any) => row?.company_id).filter(Boolean)).size;
  }

  const reuseBlock = reuseEvents >= 4 ? 15 : reuseEvents >= 2 ? 10 : reuseEvents >= 1 ? 5 : 0;

  const score = clamp(Math.round(verificationBlock + evidenceBlock + consistencyBlock + reuseBlock));

  return {
    score,
    breakdown: {
      verification: verificationBlock,
      evidence: evidenceBlock,
      consistency: consistencyBlock,
      reuse: reuseBlock,
      approved: verifiedEmploymentCount,
      confirmed: verifications.filter((row: any) => normalizeText(row?.status) === "verified").length,
      evidences: usableEvidences.length,
      reuseEvents,
      reuseCompanies,
      model: "trust_mvp_f28_v2_weighted_evidence",
    },
  };
}

export async function recalculateAndPersistCandidateTrustScore(candidateId: string): Promise<TrustResult> {
  const admin = createAdminSupabaseClient();
  const result = await calculateTrustScore(candidateId);

  const patch = {
    user_id: candidateId,
    trust_score: result.score,
    trust_score_breakdown: result.breakdown,
  };

  const { error: updateErr, data: updatedRows } = await admin
    .from("candidate_profiles")
    .update({ trust_score: patch.trust_score, trust_score_breakdown: patch.trust_score_breakdown })
    .eq("user_id", candidateId)
    .select("user_id");

  if (updateErr) throw updateErr;

  if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
    const { error: insertErr } = await admin.from("candidate_profiles").insert(patch);
    if (insertErr) throw insertErr;
  }

  return result;
}
