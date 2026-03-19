import { NextResponse } from "next/server";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";
import {
  isMissingExternalResolvedColumn,
  isVerificationExternallyResolved,
} from "@/lib/verification/external-resolution";

type ResolvePayload = {
  token?: string;
  decision?: "confirm" | "reject";
  comment?: string;
  verifier_name?: string;
  verifier_role?: string;
  company_name?: string;
};

const LEGACY_COMPANY_VERIFICATION_STATUSES = new Set(["unverified", "verified_document", "verified_paid"]);

function asText(value: unknown, max = 300) {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : null;
}

function normalizeCompanyVerificationStatusSnapshot(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  if (!status) return null;
  if (LEGACY_COMPANY_VERIFICATION_STATUSES.has(status)) return status;
  if (status === "registered_in_verijob") return "verified_paid";
  if (status === "unverified_external") return "unverified";
  return "unverified";
}

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ResolvePayload;
    const token = asText(body.token, 120);
    const decision = asText(body.decision, 20);
    const comment = asText(body.comment, 1200);
    const verifierName = asText(body.verifier_name, 120);
    const verifierRole = asText(body.verifier_role, 120);
    const companyNameInput = asText(body.company_name, 180);

    if (!token) return json(400, { error: "missing_token" });
    if (decision !== "confirm" && decision !== "reject") return json(400, { error: "invalid_decision" });
    if (!verifierName) return json(400, { error: "missing_verifier_name" });
    if (!verifierRole) return json(400, { error: "missing_verifier_role" });

    const admin = createServiceRoleClient();

    let requestRow: any = null;
    let requestErr: any = null;

    const primaryLookup = await admin
      .from("verification_requests")
      .select("id,requested_by,employment_record_id,company_id,status,resolved_at,external_token,external_token_expires_at,external_resolved,external_email_target,company_name_target,request_context")
      .eq("external_token", token)
      .maybeSingle();

    requestRow = primaryLookup.data;
    requestErr = primaryLookup.error;

    if (requestErr && isMissingExternalResolvedColumn(requestErr)) {
      const fallbackLookup = await admin
        .from("verification_requests")
        .select("id,requested_by,employment_record_id,company_id,status,resolved_at,external_token,external_token_expires_at,external_email_target,company_name_target,request_context")
        .eq("external_token", token)
        .maybeSingle();
      requestRow = fallbackLookup.data;
      requestErr = fallbackLookup.error;
    }

    if (requestErr || !requestRow) return json(404, { error: "not_found" });

    const expiresAt = requestRow.external_token_expires_at ? Date.parse(String(requestRow.external_token_expires_at)) : NaN;
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
      return json(410, { error: "token_expired" });
    }

    if (isVerificationExternallyResolved(requestRow)) {
      return json(409, { error: "already_resolved" });
    }

    let snapshotCompanyId: string | null = requestRow.company_id ? String(requestRow.company_id) : null;
    let snapshotCompanyName: string | null = companyNameInput || asText(requestRow.company_name_target, 180) || null;
    let snapshotCompanyVerificationStatus: string = "unverified";

    if (!snapshotCompanyId && requestRow.external_email_target) {
      const { data: matchedProfile } = await admin
        .from("profiles")
        .select("active_company_id")
        .eq("email", String(requestRow.external_email_target).toLowerCase())
        .eq("role", "company")
        .maybeSingle();

      if ((matchedProfile as any)?.active_company_id) {
        snapshotCompanyId = String((matchedProfile as any).active_company_id);
        snapshotCompanyVerificationStatus = "verified_paid";
      }
    }

    if (snapshotCompanyId) {
      snapshotCompanyVerificationStatus = "verified_paid";
      const { data: company } = await admin
        .from("companies")
        .select("name,company_verification_status")
        .eq("id", snapshotCompanyId)
        .maybeSingle();

      const { data: companyProfile } = await admin
        .from("company_profiles")
        .select("trade_name,legal_name")
        .eq("company_id", snapshotCompanyId)
        .maybeSingle();

      snapshotCompanyName =
        snapshotCompanyName ||
        resolveCompanyDisplayName({ ...(company || {}), ...(companyProfile || {}) } as any, "Tu empresa");

      const companyStatus = asText((company as any)?.company_verification_status, 60);
      if (companyStatus) snapshotCompanyVerificationStatus = normalizeCompanyVerificationStatusSnapshot(companyStatus) || "unverified";
    }

    const resolvedAt = new Date().toISOString();
    const nextStatus = decision === "confirm" ? "verified" : "rejected";
    const resolutionNotes = [
      `Resolución externa por enlace seguro`,
      `Nombre: ${verifierName}`,
      `Cargo: ${verifierRole}`,
      comment ? `Comentario: ${comment}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const requestContext = {
      ...(requestRow.request_context || {}),
      external_resolution: {
        resolved_at: resolvedAt,
        verifier_name: verifierName,
        verifier_role: verifierRole,
        comment: comment || null,
      },
    };

    const updatePayload: Record<string, any> = {
      status: nextStatus,
      external_resolved: true,
      resolved_at: resolvedAt,
      resolution_notes: resolutionNotes,
      company_id_snapshot: snapshotCompanyId,
      company_name_snapshot: snapshotCompanyName,
      company_verification_status_snapshot: normalizeCompanyVerificationStatusSnapshot(snapshotCompanyVerificationStatus),
      snapshot_at: resolvedAt,
      request_context: requestContext,
    };

    let updateRequestErr: any = null;
    const primaryUpdate = await admin
      .from("verification_requests")
      .update(updatePayload)
      .eq("id", requestRow.id);
    updateRequestErr = primaryUpdate.error;

    if (updateRequestErr && isMissingExternalResolvedColumn(updateRequestErr)) {
      delete updatePayload.external_resolved;
      const fallbackUpdate = await admin
        .from("verification_requests")
        .update(updatePayload)
        .eq("id", requestRow.id);
      updateRequestErr = fallbackUpdate.error;
    }

    if (updateRequestErr) return json(400, { error: "request_update_failed", detail: updateRequestErr.message });

    if (requestRow.employment_record_id) {
      const { error: updateEmploymentErr } = await admin
        .from("employment_records")
        .update({
          verification_status: nextStatus,
          verification_result: nextStatus,
          verification_resolved_at: resolvedAt,
          verified_by_company_id: snapshotCompanyId,
          company_verification_status_snapshot: normalizeCompanyVerificationStatusSnapshot(snapshotCompanyVerificationStatus),
          last_verification_request_id: requestRow.id,
        })
        .eq("id", requestRow.employment_record_id);

      if (updateEmploymentErr) {
        return json(400, { error: "employment_update_failed", detail: updateEmploymentErr.message });
      }
    }

    if (requestRow.requested_by) {
      await recalculateAndPersistCandidateTrustScore(String(requestRow.requested_by)).catch(() => {});
    }

    return json(200, {
      ok: true,
      status: nextStatus,
      request_id: requestRow.id,
      snapshot: {
        company_id: snapshotCompanyId,
        company_name: snapshotCompanyName,
        company_verification_status: snapshotCompanyVerificationStatus,
      },
    });
  } catch (error: any) {
    return json(500, { error: "server_error", detail: String(error?.message || error) });
  }
}
