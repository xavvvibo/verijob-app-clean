import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCompanyKpiFallback,
  mergeCompanyKpis,
} from "../src/lib/company-dashboard-kpis.js";

test("computeCompanyKpiFallback calcula métricas base con datos reales", () => {
  const nowMs = Date.parse("2026-03-11T10:00:00.000Z");
  const requests = [
    {
      status: "pending_company",
      requested_at: "2026-03-11T09:00:00.000Z",
      requested_by: "u1",
    },
    {
      status: "verified",
      requested_at: "2026-03-10T08:00:00.000Z",
      resolved_at: "2026-03-10T10:00:00.000Z",
      requested_by: "u2",
    },
    {
      status: "rejected",
      requested_at: "2026-03-09T08:00:00.000Z",
      resolved_at: "2026-03-09T11:00:00.000Z",
      requested_by: "u3",
    },
  ];
  const reuseEvents = [{ reused_at: "2026-03-10T12:00:00.000Z" }];

  const kpis = computeCompanyKpiFallback({ requests, reuseEvents, nowMs });

  assert.equal(kpis.pending_requests, 1);
  assert.equal(kpis.completed_requests, 2);
  assert.equal(kpis.verified_30d, 1);
  assert.equal(kpis.verified_candidates, 1);
  assert.equal(kpis.risk_signals, 1);
  assert.equal(kpis.reuse_events_total, 1);
  assert.equal(kpis.reuse_events_30d, 1);
  assert.equal(kpis.reuse_rate_pct, 100);
  assert.equal(kpis.avg_resolution_hours, 2.5);
});

test("mergeCompanyKpis prioriza RPC y mantiene fallback para campos faltantes", () => {
  const fallback = {
    pending_requests: 2,
    verified_30d: 3,
    reuse_rate_pct: 50,
    risk_signals: 1,
    reuse_events_30d: 2,
    reuse_events_total: 4,
    completed_requests: 10,
    avg_resolution_hours: 12.5,
    verified_candidates: 8,
  };

  const merged = mergeCompanyKpis(
    {
      pending_requests: 9,
      verified_30d: 7,
      reuse_rate_pct: 33,
      risk_signals: 0,
      completed_requests: 99,
    },
    fallback
  );

  assert.equal(merged.pending_requests, 9);
  assert.equal(merged.verified_30d, 7);
  assert.equal(merged.reuse_rate_pct, 33);
  assert.equal(merged.risk_signals, 0);
  assert.equal(merged.completed_requests, 99);
  assert.equal(merged.reuse_events_total, 4);
  assert.equal(merged.avg_resolution_hours, 12.5);
  assert.equal(merged.verified_candidates, 8);
});
