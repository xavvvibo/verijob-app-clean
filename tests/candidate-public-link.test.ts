import test from "node:test";
import assert from "node:assert/strict";
import {
  isCandidatePublicTokenFormat,
  normalizeCandidatePublicToken,
} from "../src/lib/public/candidate-public-link.ts";

const token = "9948f6924fc2553c546a81be805f00867832606bd5984f02";

test("normalizeCandidatePublicToken mantiene token puro", () => {
  assert.equal(normalizeCandidatePublicToken(token), token);
});

test("normalizeCandidatePublicToken extrae el token desde URL pública completa", () => {
  assert.equal(
    normalizeCandidatePublicToken(`https://app.verijob.es/p/${token}`),
    token,
  );
});

test("normalizeCandidatePublicToken extrae el token desde texto pegado con URL", () => {
  assert.equal(
    normalizeCandidatePublicToken(`Perfil compartido: https://app.verijob.es/p/${token}?utm=share`),
    token,
  );
});

test("normalizeCandidatePublicToken extrae el token desde URL de vista empresa", () => {
  assert.equal(
    normalizeCandidatePublicToken(`https://app.verijob.es/company/candidate/${token}?view=full`),
    token,
  );
});

test("isCandidatePublicTokenFormat rechaza valores no válidos", () => {
  assert.equal(isCandidatePublicTokenFormat("token-corto"), false);
  assert.equal(isCandidatePublicTokenFormat(token), true);
});
