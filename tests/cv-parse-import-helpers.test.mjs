import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCvLanguages,
  selectLanguagesPersistenceTarget,
  shouldApplyParsedResultOnce,
  shouldImportEducationRow,
} from "../src/lib/candidate/cv-parse-normalize.js";

test("normalizeCvLanguages admite languages y normaliza trim/empty/max", () => {
  const out = normalizeCvLanguages([" Español ", "", null, "Inglés", "  "], 3);
  assert.deepEqual(out, ["Español", "Inglés"]);
});

test("shouldImportEducationRow no descarta entradas válidas por descripción", () => {
  assert.equal(shouldImportEducationRow({ title: "", institution: "", description: "Bootcamp intensivo" }), true);
  assert.equal(shouldImportEducationRow({ title: "Grado en Derecho", institution: "", description: "" }), true);
  assert.equal(shouldImportEducationRow({ title: "", institution: "", description: "" }), false);
});

test("selectLanguagesPersistenceTarget prioriza profiles.languages y solo hace fallback a columnas reales", () => {
  assert.equal(selectLanguagesPersistenceTarget(new Set(["id", "languages"]), new Set(["id", "achievements"])), "profiles.languages");
  assert.equal(selectLanguagesPersistenceTarget(new Set(["id", "full_name"]), new Set(["id", "achievements"])), "candidate_profiles.achievements");
  assert.equal(selectLanguagesPersistenceTarget(new Set(["id", "full_name"]), new Set(["id", "other_achievements"])), "candidate_profiles.other_achievements");
  assert.equal(selectLanguagesPersistenceTarget(new Set(["id", "full_name"]), new Set(["id"])), "skip");
});

test("shouldApplyParsedResultOnce evita reaplicar polling sobre mismo jobId", () => {
  assert.equal(shouldApplyParsedResultOnce({ nextJobId: "job-1", lastAppliedJobId: null }), true);
  assert.equal(shouldApplyParsedResultOnce({ nextJobId: "job-1", lastAppliedJobId: "job-1" }), false);
  assert.equal(shouldApplyParsedResultOnce({ nextJobId: "job-2", lastAppliedJobId: "job-1" }), true);
});
