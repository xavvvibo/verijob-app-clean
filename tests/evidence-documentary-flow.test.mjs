import test from "node:test";
import assert from "node:assert/strict";
import { resolveEvidenceEmploymentRecordId } from "../src/lib/candidate/evidence-linkage.js";
import {
  buildDocumentaryVerificationInsert,
  buildEmploymentRecordDocumentaryPendingReviewUpdate,
  buildEmploymentRecordDocumentaryRequestedUpdate,
  buildEmploymentRecordDocumentaryResolvedUpdate,
  getActiveDocumentaryVerificationId,
} from "../src/lib/candidate/documentary-flow.js";

test("resolveEvidenceEmploymentRecordId usa heurística de filename y fallback seguro", () => {
  const options = [
    { id: "exp-1", label: "Frontend Developer — Acme Labs" },
    { id: "exp-2", label: "Analista — Kiosko Alfresko" },
  ];

  const auto = resolveEvidenceEmploymentRecordId({
    filename: "nomina_kiosko_marzo_2026.pdf",
    options,
    selectedExperienceId: "exp-1",
  });
  assert.equal(auto.guessedId, "exp-2");
  assert.equal(auto.employmentRecordId, "exp-2");

  const fallback = resolveEvidenceEmploymentRecordId({
    filename: "documento_generico.pdf",
    options,
    selectedExperienceId: "exp-1",
  });
  assert.equal(fallback.guessedId, null);
  assert.equal(fallback.employmentRecordId, "exp-1");
});

test("getActiveDocumentaryVerificationId reutiliza request activa si existe", () => {
  assert.equal(getActiveDocumentaryVerificationId([]), null);
  assert.equal(getActiveDocumentaryVerificationId([{ id: "vr-123" }]), "vr-123");
});

test("buildDocumentaryVerificationInsert deja payload coherente de flujo documental", () => {
  const payload = buildDocumentaryVerificationInsert({
    employmentRecordId: "er-1",
    userId: "user-1",
    companyName: "Kiosko Alfresko",
    position: "Dependiente",
    nowIso: "2026-03-11T10:00:00.000Z",
  });

  assert.equal(payload.verification_channel, "documentary");
  assert.equal(payload.status, "reviewing");
  assert.equal(payload.employment_record_id, "er-1");
  assert.equal(payload.requested_by, "user-1");
  assert.equal(payload.company_name_target, "Kiosko Alfresko");
  assert.equal(payload.request_context.source, "candidate_evidence_upload");
});

test("updates documentales marcan señal en employment_records", () => {
  const requested = buildEmploymentRecordDocumentaryRequestedUpdate({
    verificationRequestId: "vr-22",
    nowIso: "2026-03-11T11:00:00.000Z",
  });
  assert.equal(requested.verification_status, "reviewing");
  assert.equal(requested.last_verification_request_id, "vr-22");

  const resolved = buildEmploymentRecordDocumentaryResolvedUpdate({
    verificationRequestId: "vr-22",
    nowIso: "2026-03-11T11:20:00.000Z",
  });
  assert.equal(resolved.verification_status, "verified_document");
  assert.equal(resolved.last_verification_request_id, "vr-22");
  assert.equal(typeof resolved.verification_resolved_at, "string");

  const pending = buildEmploymentRecordDocumentaryPendingReviewUpdate({
    verificationRequestId: "vr-22",
    nowIso: "2026-03-11T11:40:00.000Z",
  });
  assert.equal(pending.verification_status, "reviewing");
  assert.equal(pending.last_verification_request_id, "vr-22");
});
