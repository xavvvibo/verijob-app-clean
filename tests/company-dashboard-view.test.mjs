import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowCompanyNoActivityState } from "../src/lib/company-dashboard-kpis.js";

test("shouldShowCompanyNoActivityState devuelve true cuando no hay actividad", () => {
  assert.equal(
    shouldShowCompanyNoActivityState({
      pending_requests: 0,
      completed_requests: 0,
      reuse_events_total: 0,
    }),
    true
  );
});

test("shouldShowCompanyNoActivityState devuelve false con actividad parcial", () => {
  assert.equal(
    shouldShowCompanyNoActivityState({
      pending_requests: 1,
      completed_requests: 0,
      reuse_events_total: 0,
    }),
    false
  );
  assert.equal(
    shouldShowCompanyNoActivityState({
      pending_requests: 0,
      completed_requests: 2,
      reuse_events_total: 0,
    }),
    false
  );
  assert.equal(
    shouldShowCompanyNoActivityState({
      pending_requests: 0,
      completed_requests: 0,
      reuse_events_total: 4,
    }),
    false
  );
});

test("shouldShowCompanyNoActivityState no rompe con kpis null/undefined", () => {
  assert.equal(shouldShowCompanyNoActivityState(null), true);
  assert.equal(shouldShowCompanyNoActivityState(undefined), true);
});
