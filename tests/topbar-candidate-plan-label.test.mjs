import test from "node:test";
import assert from "node:assert/strict";
import { getCandidatePlanLabel } from "../src/lib/candidate/plan-label.js";

test("getCandidatePlanLabel mapea FREE / PRO / PRO+ y fallback", () => {
  assert.equal(getCandidatePlanLabel(null), "CANDIDATO FREE");
  assert.equal(getCandidatePlanLabel("free"), "CANDIDATO FREE");
  assert.equal(getCandidatePlanLabel("pro_monthly"), "CANDIDATO PRO");
  assert.equal(getCandidatePlanLabel("candidate_proplus_annual"), "CANDIDATO PRO+");
  assert.equal(getCandidatePlanLabel("unknown_plan"), "CANDIDATO FREE");
});
