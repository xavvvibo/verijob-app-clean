import test from "node:test";
import assert from "node:assert/strict";
import {
  containsSensitivePublicKeys,
  sanitizePublicCandidatePayload,
} from "../src/lib/public/public-profile-payload.js";

test("sanitizePublicCandidatePayload elimina ids internos del payload publico", () => {
  const payload = sanitizePublicCandidatePayload({
    token: "tok_publico",
    candidate_id: "cand_123",
    user_id: "user_123",
    teaser: { location: "Madrid" },
    candidate_public_profile: {
      identity: {
        candidate_id: "cand_123",
        full_name: "Ana P.",
      },
      location: "Madrid, Espana",
      experiences: [],
    },
    nested: {
      company_id: "company_1",
      storage_path: "bucket/private/file.pdf",
    },
  });

  assert.equal(payload.candidate_id, undefined);
  assert.equal(payload.user_id, undefined);
  assert.equal(payload.candidate_public_profile.identity.candidate_id, undefined);
  assert.equal(payload.candidate_public_profile.location, "Madrid");
  assert.equal(payload.nested.company_id, undefined);
  assert.equal(payload.nested.storage_path, undefined);
  assert.equal(containsSensitivePublicKeys(payload), false);
});

test("sanitizePublicCandidatePayload conserva ids en preview interna", () => {
  const payload = sanitizePublicCandidatePayload(
    {
      candidate_id: "cand_123",
      teaser: { location: "Madrid" },
      candidate_public_profile: {
        identity: {
          candidate_id: "cand_123",
          full_name: "Ana Perez",
        },
        location: "Madrid, Espana",
      },
    },
    { internalPreviewAllowed: true },
  );

  assert.equal(payload.candidate_id, "cand_123");
  assert.equal(payload.candidate_public_profile.identity.candidate_id, "cand_123");
});
