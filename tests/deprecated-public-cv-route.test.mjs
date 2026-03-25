import test from "node:test";
import assert from "node:assert/strict";
import { buildDeprecatedPublicCvResponse } from "../src/lib/public/deprecated-public-cv-response.js";

test("deprecated public cv route no filtra ids internos", () => {
  const payload = buildDeprecatedPublicCvResponse();

  assert.equal(payload.error, "route_deprecated");
  assert.equal("candidate_id" in payload, false);
  assert.equal("user_id" in payload, false);
  assert.equal("company_id" in payload, false);
  assert.equal("storage_path" in payload, false);
});
