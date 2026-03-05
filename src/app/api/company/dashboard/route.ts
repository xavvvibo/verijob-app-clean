import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // active_company_id desde profiles (modelo multi-tenant)
  const { data: p, error: pErr } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
  const companyId = (p as any)?.active_company_id;
  if (!companyId) return NextResponse.json({ error: "no_active_company" }, { status: 400 });

  const nowIso = new Date().toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // PENDIENTES / COLA
  const { count: pendingCount, error: pendErr } = await supabase
    .from("verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .in("status", ["pending", "reviewing"]);

  if (pendErr) return NextResponse.json({ error: pendErr.message }, { status: 400 });

  // VERIFICADAS (30D) — usamos verification_requests porque sabemos que tiene created_at
  const { count: verified30d, error: verErr } = await supabase
    .from("verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "approved")
    .gte("created_at", since30d);

  if (verErr) return NextResponse.json({ error: verErr.message }, { status: 400 });

  // REUSE EVENTS (30D) — si tu tabla no tiene created_at, cae a total
  let reuse30d = 0;
  let reuseTotal = 0;

  const { count: reTotal, error: reTotErr } = await supabase
    .from("verification_reuse_events")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  if (reTotErr) return NextResponse.json({ error: reTotErr.message }, { status: 400 });
  reuseTotal = reTotal || 0;

  const { count: re30, error: re30Err } = await supabase
    .from("verification_reuse_events")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", since30d);

  // si falla por columna created_at inexistente, no rompemos: usamos total
  reuse30d = re30Err ? reuseTotal : (re30 || 0);

  // RIESGO (señales/incidencias): revocadas (no públicas) en esa empresa
  const { count: revokedCount, error: revErr } = await supabase
    .from("verification_requests")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .not("revoked_at", "is", null);

  if (revErr) return NextResponse.json({ error: revErr.message }, { status: 400 });

  // REUSE RATE: proxy simple defendible (reuse30d / verified30d)
  const reuseRate = verified30d && verified30d > 0 ? Math.round((reuse30d / verified30d) * 100) : 0;

  return NextResponse.json({
    company_id: companyId,
    now: nowIso,
    since_30d: since30d,
    kpis: {
      pending_requests: pendingCount || 0,
      verified_30d: verified30d || 0,
      reuse_rate_pct: reuseRate,
      risk_signals: revokedCount || 0,
      reuse_events_30d: reuse30d,
      reuse_events_total: reuseTotal,
    }
  });
}
