import { createAdminSupabaseClient } from "@/utils/supabase/admin";
import {
  getEvidenceTypeWeight,
  normalizeEvidenceType,
  normalizeValidationStatus,
  EVIDENCE_VALIDATION_INTERNAL,
} from "@/lib/candidate/evidence-types";
import { resolveDocumentaryMatchLevel } from "@/lib/candidate/documentary-processing";
import { isVerifiedEmploymentRecordStatus } from "@/lib/verification/employment-record-verification-status";
import { verificationTrustWeightForSignal } from "@/lib/verification/verifier-email-signal";

type TrustBreakdown = {
  verification: number;
  evidence: number;
  consistency: number;
  reuse: number;
  approved: number;
  confirmed: number;
  evidences: number;
  evidence_points_raw: number;
  evidence_points_capped: number;
  evidence_types: string[];
  evidence_match_levels?: Record<string, string>;
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

function calculateEvidenceScore(rows: any[]) {
  const usableEvidences = rows.filter((row: any) => {
    const status = normalizeValidationStatus(row?.validation_status);
    return status !== EVIDENCE_VALIDATION_INTERNAL.REJECTED;
  });
  return { usableEvidences };
}

function evidenceMatchMultiplier(level: string) {
  if (level === "high") return 1;
  if (level === "medium") return 0.7;
  if (level === "low") return 0.35;
  if (level === "conflict") return 0;
  return 0.15;
}

function calculateWeightedEvidenceScore(rows: any[], verificationById: Map<string, any>) {
  const { usableEvidences } = calculateEvidenceScore(rows);
  const bestByType = new Map<string, { adjusted: number; level: string; base: number }>();

  for (const row of usableEvidences) {
    const type = normalizeEvidenceType(row?.evidence_type || row?.document_type);
    if (!type) continue;
    const basePoints = Number(getEvidenceTypeWeight(type) || row?.trust_weight || 0);
    const verification = verificationById.get(String(row?.verification_request_id || ""));
    const processing = verification?.request_context?.documentary_processing || {};
    const level = resolveDocumentaryMatchLevel({
      matching: processing?.matching || {
        overall_match_level: processing?.overall_match_level,
        overall_match_score: processing?.overall_match_score,
        final_score: processing?.overall_match_score,
      },
      processingStatus: processing?.processing_status || processing?.status,
      validationStatus: row?.validation_status,
      inconsistencyReason: row?.inconsistency_reason || processing?.inconsistency_reason,
    });
    const adjusted = Number((basePoints * evidenceMatchMultiplier(level)).toFixed(2));
    const previous = bestByType.get(type);
    if (!previous || adjusted > previous.adjusted) {
      bestByType.set(type, { adjusted, level, base: basePoints });
    }
  }

  const uniqueEvidenceTypes = Array.from(bestByType.keys());
  const rawPoints = Array.from(bestByType.values()).reduce((acc, item) => acc + item.adjusted, 0);
  const cappedPoints = Math.min(30, rawPoints);

  return {
    usableEvidences,
    uniqueEvidenceTypes,
    rawPoints,
    cappedPoints,
    matchLevels: Object.fromEntries(Array.from(bestByType.entries()).map(([type, item]) => [type, item.level])),
  };
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
      .select("id,status,requested_by,employment_record_id,request_context,resolved_at,created_at")
      .eq("requested_by", candidateId),
    admin
      .from("evidences")
      .select("id,evidence_type,document_type,document_scope,trust_weight,validation_status,inconsistency_reason,uploaded_by,verification_request_id")
      .eq("uploaded_by", candidateId),
  ]);

  const employment = Array.isArray(employmentRows) ? employmentRows : [];
  const verifications = Array.isArray(verificationRows) ? verificationRows : [];
  const evidences = Array.isArray(evidenceRows) ? evidenceRows : [];

  const verificationByEmployment = new Map<string, any[]>();
  const verificationById = new Map<string, any>();
  for (const row of verifications) {
    const verificationId = String((row as any)?.id || "").trim();
    if (verificationId) verificationById.set(verificationId, row);
    const employmentRecordId = String((row as any)?.employment_record_id || "").trim();
    if (!employmentRecordId) continue;
    verificationByEmployment.set(employmentRecordId, [...(verificationByEmployment.get(employmentRecordId) || []), row]);
  }

  const weightedVerifiedEmployment = employment.reduce((acc, row: any) => {
    if (!isVerifiedEmploymentRecordStatus(row?.verification_status)) return acc;

    const related = (verificationByEmployment.get(String(row?.id || "")) || []).slice().sort((a: any, b: any) => {
      const aTs = Date.parse(String(a?.resolved_at || a?.created_at || "")) || 0;
      const bTs = Date.parse(String(b?.resolved_at || b?.created_at || "")) || 0;
      return bTs - aTs;
    });
    const verifiedRequest = related.find((item: any) => String(item?.status || "").toLowerCase() === "verified");
    const signal =
      verifiedRequest?.request_context && typeof verifiedRequest.request_context === "object"
        ? (verifiedRequest.request_context as any)?.verifier_email_signal || null
        : null;
    const weight = signal ? verificationTrustWeightForSignal(signal) : 1;
    return acc + weight;
  }, 0);

  const rejectedVerificationCount = verifications.filter((row: any) => String(row?.status || "").toLowerCase() === "rejected").length;
  const explicitAwardedTrustFloor = verifications.reduce((acc, row: any) => {
    if (String(row?.status || "").toLowerCase() !== "verified") return acc;
    return Math.max(acc, Number((row as any)?.trust_score_awarded ?? 0) || 0);
  }, 0);

  const verificationBlockBase =
    weightedVerifiedEmployment >= 3 ? 40 : weightedVerifiedEmployment >= 2 ? 30 : weightedVerifiedEmployment >= 1 ? 20 : weightedVerifiedEmployment > 0 ? 10 : 0;
  const verificationBlock = Math.max(0, verificationBlockBase - Math.min(10, rejectedVerificationCount * 5));

  const evidenceScore = calculateWeightedEvidenceScore(evidences, verificationById);
  const evidenceBlock = evidenceScore.cappedPoints;

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

  const score = clamp(Math.max(Math.round(verificationBlock + evidenceBlock + consistencyBlock + reuseBlock), explicitAwardedTrustFloor));

  return {
    score,
    breakdown: {
      verification: verificationBlock,
      evidence: evidenceBlock,
      consistency: consistencyBlock,
      reuse: reuseBlock,
      approved: Number(weightedVerifiedEmployment.toFixed(2)),
      confirmed: verifications.filter((row: any) => normalizeText(row?.status) === "verified").length,
      evidences: evidenceScore.usableEvidences.length,
      evidence_points_raw: evidenceScore.rawPoints,
      evidence_points_capped: evidenceScore.cappedPoints,
      evidence_types: evidenceScore.uniqueEvidenceTypes,
      evidence_match_levels: evidenceScore.matchLevels as any,
      reuseEvents,
      reuseCompanies,
      model: "trust_mvp_f28_v3_document_evidence_points",
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
