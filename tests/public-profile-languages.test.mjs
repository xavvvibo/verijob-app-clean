import test from "node:test";
import assert from "node:assert/strict";
import { normalizePublicLanguages } from "../src/lib/public/profile-languages.js";

test("normalizePublicLanguages expone idiomas válidos cuando hay payload", () => {
  assert.deepEqual(normalizePublicLanguages(["Español", " Inglés ", ""]), ["Español", "Inglés"]);
  assert.deepEqual(normalizePublicLanguages("Español, Inglés, Francés"), ["Español", "Inglés", "Francés"]);
});

test("normalizePublicLanguages no rompe con payload vacío/undefined", () => {
  assert.deepEqual(normalizePublicLanguages(undefined), []);
  assert.deepEqual(normalizePublicLanguages(null), []);
  assert.deepEqual(normalizePublicLanguages(""), []);
});
