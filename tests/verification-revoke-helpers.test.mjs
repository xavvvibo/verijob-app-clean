import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVerificationRevokeRequest,
  getVerificationRevokeEndpoint,
  getVerificationRevokeErrorMessage,
} from "../src/lib/candidate/verification-revoke.js";

test("helpers de revoke construyen endpoint y payload esperados", () => {
  const endpoint = getVerificationRevokeEndpoint("abc-123");
  assert.equal(endpoint, "/api/verification/abc-123/revoke");

  const req = buildVerificationRevokeRequest("Eliminada por el candidato");
  assert.equal(req.method, "POST");
  assert.equal(req.credentials, "include");
  assert.equal(req.headers["content-type"], "application/json");
  assert.equal(JSON.parse(req.body).reason, "Eliminada por el candidato");
});

test("getVerificationRevokeErrorMessage maneja éxito y error sin romper flujo", () => {
  assert.equal(getVerificationRevokeErrorMessage({ responseOk: true, payload: {}, fallback: "x" }), null);
  assert.equal(
    getVerificationRevokeErrorMessage({ responseOk: false, payload: { error: "forbidden" }, fallback: "x" }),
    "forbidden"
  );
  assert.equal(
    getVerificationRevokeErrorMessage({ responseOk: false, payload: {}, fallback: "No se pudo" }),
    "No se pudo"
  );
});
