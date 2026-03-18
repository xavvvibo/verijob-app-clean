import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  classifyExperienceSuggestion,
  resolveSafeCandidateName,
  simulateAcceptancePersistence,
  simulateInviteCreation,
  simulatePersistImportedCandidateProfile,
} from "./helpers/company-candidate-import-harness.mjs";

function loadFixture(name) {
  const filePath = path.join(process.cwd(), "tests", "fixtures", "company-candidate-import", name);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("Caso A: candidato nuevo crea import preliminar sin publicación automática", () => {
  const fixture = loadFixture("new-candidate.json");

  const invite = simulateInviteCreation({
    candidateEmail: fixture.invite.candidate_email,
    existingCandidate: null,
  });

  assert.equal(invite.candidate_already_exists, false);
  assert.equal(invite.linked_user_id, null);
  assert.equal(invite.candidate_public_token, null);
  assert.equal(invite.status, "emailed");

  const persisted = simulatePersistImportedCandidateProfile({
    mode: "new_candidate",
    inviteId: fixture.invite.invite_id,
    companyName: fixture.invite.company_name,
    candidateEmail: fixture.invite.candidate_email,
    extracted: fixture.extracted,
    existingProfile: {},
    existingExperiences: [],
  });

  assert.equal(persisted.mode, "new_candidate");
  assert.equal(persisted.inserted_experiences.length, 0);
  assert.equal(persisted.suggestions.length, 2);
  assert.equal(persisted.profile_patch.email, fixture.invite.candidate_email);
  assert.equal(persisted.raw_cv_json.company_cv_import.mode, "new_candidate");
  assert.equal(persisted.raw_cv_json.company_cv_import.staged_only, true);
  assert.equal(persisted.raw_cv_json.company_cv_import_updates.length, 1);
  assert.ok(!("is_public" in persisted.profile_patch));
});

test("Caso B: candidato existente se marca explícitamente y recibe public token si faltaba", () => {
  const fixture = loadFixture("existing-candidate.json");

  const invite = simulateInviteCreation({
    candidateEmail: fixture.invite.candidate_email,
    existingCandidate: fixture.existing_candidate,
  });

  assert.equal(invite.candidate_already_exists, true);
  assert.equal(invite.linked_user_id, fixture.existing_candidate.id);
  assert.match(invite.candidate_public_token, /^[a-f0-9]{48}$/i);

  const persisted = simulatePersistImportedCandidateProfile({
    mode: "existing_candidate",
    inviteId: fixture.invite.invite_id,
    companyName: fixture.invite.company_name,
    candidateEmail: fixture.invite.candidate_email,
    extracted: fixture.extracted,
    existingProfile: fixture.existing_candidate,
    existingExperiences: fixture.existing_experiences,
    rawCvJson: {},
  });

  assert.equal(persisted.mode, "existing_candidate");
  assert.equal(persisted.inserted_experiences.length, 0);
  assert.equal(persisted.suggestions.length, 2);
  assert.equal(persisted.raw_cv_json.company_cv_import_updates.length, 1);
  assert.equal(persisted.raw_cv_json.company_cv_import_updates[0].company_name, fixture.invite.company_name);
  assert.equal(persisted.profile_patch.full_name, fixture.existing_candidate.full_name);
});

test("Caso C: clasifica experiencias en duplicate, update y new sin insertar duplicados automáticos", () => {
  const fixture = loadFixture("existing-candidate-duplicates.json");

  const persisted = simulatePersistImportedCandidateProfile({
    mode: "existing_candidate",
    inviteId: fixture.invite.invite_id,
    companyName: fixture.invite.company_name,
    candidateEmail: fixture.invite.candidate_email,
    extracted: fixture.extracted,
    existingProfile: fixture.existing_candidate,
    existingExperiences: fixture.existing_experiences,
    rawCvJson: {},
  });

  assert.equal(persisted.inserted_experiences.length, 0);

  const kinds = persisted.suggestions.map((item) => item.kind);
  assert.deepEqual(kinds, ["duplicate", "update", "new"]);

  const [duplicate, update, fresh] = persisted.suggestions;
  assert.equal(duplicate.matched_existing.id, "exp-201");
  assert.equal(update.matched_existing.id, "exp-202");
  assert.equal(fresh.matched_existing, null);
});

test("Caso C auxiliar: la clasificación individual mantiene criterio robusto por empresa, puesto, fechas y texto", () => {
  const fixture = loadFixture("existing-candidate-duplicates.json");
  const suggestions = fixture.extracted.experiences.map((experience, index) =>
    classifyExperienceSuggestion({
      extracted: experience,
      existingRows: fixture.existing_experiences,
      inviteId: fixture.invite.invite_id,
      index,
    })
  );

  assert.deepEqual(
    suggestions.map((item) => item.kind),
    ["duplicate", "update", "new"]
  );
});

test("Caso D: aceptación legal persiste trazabilidad mínima requerida", () => {
  const fixture = loadFixture("existing-candidate.json");

  const acceptance = simulateAcceptancePersistence({
    inviteId: fixture.invite.invite_id,
    companyId: fixture.invite.company_id,
    candidateEmail: fixture.invite.candidate_email,
    acceptedByUserId: fixture.existing_candidate.id,
  });

  assert.equal(acceptance.invite_id, fixture.invite.invite_id);
  assert.equal(acceptance.company_id, fixture.invite.company_id);
  assert.equal(acceptance.candidate_email, fixture.invite.candidate_email);
  assert.equal(acceptance.source_flow, "company_cv_import");
  assert.equal(acceptance.legal_text_version, "company_cv_import_v1_2026_03_13");
  assert.ok(acceptance.accepted_at);
  assert.equal(acceptance.accepted_ip, "127.0.0.1");
  assert.equal(acceptance.accepted_user_agent, "node-test-harness");
});

test("Caso E: nombre corrupto de PDF no se usa y cae a fallback por email", () => {
  const resolved = resolveSafeCandidateName("%PDF-1.7 obj xref endobj", "candidato.demo@verijob.test");
  assert.equal(resolved, "candidato.demo@verijob.test");
});

test("Caso F: merge de idiomas suma nuevos y conserva nombre válido existente", () => {
  const persisted = simulatePersistImportedCandidateProfile({
    mode: "existing_candidate",
    inviteId: "invite-merge-1",
    companyName: "Hotel Costa Centro",
    candidateEmail: "marta.gil@verijob.test",
    extracted: {
      full_name: "%PDF-1.7 corrupted",
      languages: [{ name: "Español" }, { name: "Inglés" }, { name: "Francés" }],
      experiences: [],
    },
    existingProfile: {
      full_name: "Marta Gil Ortega",
      email: "marta.gil@verijob.test",
      languages: ["Español", "Inglés"],
    },
    existingExperiences: [],
    rawCvJson: {},
  });

  const proposal = persisted.raw_cv_json.company_cv_import.profile_proposal;
  assert.equal(proposal.full_name, "Marta Gil Ortega");
  assert.deepEqual(proposal.merged_languages, ["Español", "Inglés", "Francés"]);
  assert.deepEqual(proposal.new_languages, ["Francés"]);
});
