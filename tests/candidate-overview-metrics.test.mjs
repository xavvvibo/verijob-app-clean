import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidateOverviewNextActions,
  computeCandidateOverviewMetrics,
  resolveCandidateOverviewStatus,
} from "../src/lib/candidate/overview-metrics.js";

test("candidate overview usa employment_records verificados como source of truth visible", () => {
  const metrics = computeCandidateOverviewMetrics({
    verifications: [{ status: "verified", company_confirmed: true, evidence_count: 1 }],
    employmentRecords: [{ verification_status: "verified" }],
    experienceCount: 2,
    trustScore: 78,
  });

  assert.equal(metrics.verified, 1);
  assert.equal(metrics.inProcess, 0);
  assert.equal(metrics.score, 78);
  assert.equal(resolveCandidateOverviewStatus({ experienceCount: 2, metrics }), "Perfil listo para empresas");
});

test("candidate overview no muestra verificacion en curso solo por tener experiencias", () => {
  const metrics = computeCandidateOverviewMetrics({
    verifications: [],
    employmentRecords: [{ verification_status: null }, { verification_status: "unverified" }],
    experienceCount: 2,
    trustScore: null,
  });

  assert.equal(metrics.total, 0);
  assert.equal(metrics.inProcess, 0);
  assert.equal(resolveCandidateOverviewStatus({ experienceCount: 2, metrics }), "Perfil iniciado");

  const actions = buildCandidateOverviewNextActions({
    experienceCount: 2,
    metrics,
    profileCompletionScore: 40,
  });

  assert.deepEqual(actions.map((item) => item.label), ["Enviar una verificacion", "Completar tu perfil"]);
});
