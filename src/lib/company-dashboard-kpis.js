function safeDateParse(input) {
  const ts = Date.parse(String(input || ""));
  return Number.isFinite(ts) ? ts : null;
}

export function computeCompanyKpiFallback({ requests = [], reuseEvents = [], nowMs = Date.now() }) {
  const last30d = nowMs - 30 * 24 * 60 * 60 * 1000;

  const pendingRequests = requests.filter((r) => {
    const s = String(r?.status || "").toLowerCase();
    return s === "pending_company" || s === "reviewing";
  }).length;

  const completedRows = requests.filter((r) => {
    const s = String(r?.status || "").toLowerCase();
    return s === "verified" || s === "rejected" || s === "revoked";
  });

  const verifiedRows = requests.filter((r) => String(r?.status || "").toLowerCase() === "verified");

  const verified30d = verifiedRows.filter((r) => {
    const ts = safeDateParse(r?.resolved_at || r?.requested_at || r?.created_at);
    return ts !== null && ts >= last30d;
  }).length;

  const verifiedCandidates = new Set(
    verifiedRows.map((r) => String(r?.requested_by || "")).filter(Boolean)
  ).size;

  const resolutionHours = completedRows
    .map((r) => {
      const start = safeDateParse(r?.requested_at || r?.created_at);
      const end = safeDateParse(r?.resolved_at);
      if (start === null || end === null || end <= start) return null;
      return (end - start) / (1000 * 60 * 60);
    })
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  const avgResolutionHours =
    resolutionHours.length > 0
      ? Math.round((resolutionHours.reduce((acc, v) => acc + v, 0) / resolutionHours.length) * 10) / 10
      : null;

  const riskSignals = requests.filter((r) => {
    const s = String(r?.status || "").toLowerCase();
    return s === "rejected" || s === "revoked";
  }).length;

  const reuseEvents30d = reuseEvents.filter((row) => {
    const ts = safeDateParse(row?.reused_at);
    return ts !== null && ts >= last30d;
  }).length;

  const reuseRatePct = verifiedRows.length > 0 ? Math.round((reuseEvents.length / verifiedRows.length) * 100) : 0;

  return {
    pending_requests: pendingRequests,
    verified_30d: verified30d,
    reuse_rate_pct: reuseRatePct,
    risk_signals: riskSignals,
    reuse_events_30d: reuseEvents30d,
    reuse_events_total: reuseEvents.length,
    completed_requests: completedRows.length,
    avg_resolution_hours: avgResolutionHours,
    verified_candidates: verifiedCandidates,
  };
}

export function mergeCompanyKpis(rpcKpis, fallbackKpis) {
  const rpc = rpcKpis && typeof rpcKpis === "object" ? rpcKpis : {};
  return {
    pending_requests: Number(rpc.pending_requests ?? fallbackKpis.pending_requests),
    verified_30d: Number(rpc.verified_30d ?? fallbackKpis.verified_30d),
    reuse_rate_pct: Number(rpc.reuse_rate_pct ?? fallbackKpis.reuse_rate_pct),
    risk_signals: Number(rpc.risk_signals ?? fallbackKpis.risk_signals),
    reuse_events_30d: Number(rpc.reuse_events_30d ?? fallbackKpis.reuse_events_30d),
    reuse_events_total: Number(rpc.reuse_events_total ?? fallbackKpis.reuse_events_total),
    completed_requests: Number(rpc.completed_requests ?? fallbackKpis.completed_requests),
    avg_resolution_hours:
      rpc.avg_resolution_hours === undefined || rpc.avg_resolution_hours === null
        ? fallbackKpis.avg_resolution_hours
        : Number(rpc.avg_resolution_hours),
    verified_candidates: Number(rpc.verified_candidates ?? fallbackKpis.verified_candidates),
  };
}

export function shouldShowCompanyNoActivityState(kpis) {
  if (!kpis || typeof kpis !== "object") return true;
  return (
    Number(kpis.pending_requests || 0) === 0 &&
    Number(kpis.completed_requests || 0) === 0 &&
    Number(kpis.reuse_events_total || 0) === 0
  );
}
