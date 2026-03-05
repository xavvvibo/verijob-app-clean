import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: p, error: pErr } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) return NextResponse.json({ error: "profile_failed", details: pErr.message }, { status: 400 });
  const companyId = (p as any)?.active_company_id;
  if (!companyId) return NextResponse.json({ error: "no_active_company" }, { status: 400 });

  const { data, error } = await supabase
    .from("company_settings")
    .select("show_risk_panel,show_reuse_hints")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "read_failed", details: error.message }, { status: 400 });

  return NextResponse.json({
    company_id: companyId,
    settings: data || { show_risk_panel: true, show_reuse_hints: true }
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: p } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  const companyId = (p as any)?.active_company_id;
  if (!companyId) return NextResponse.json({ error: "no_active_company" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  const patch = {
    company_id: companyId,
    show_risk_panel: typeof body.show_risk_panel === "boolean" ? body.show_risk_panel : true,
    show_reuse_hints: typeof body.show_reuse_hints === "boolean" ? body.show_reuse_hints : true,
    updated_at: new Date().toISOString(),
  };

  // upsert (requiere policy insert/update)
  const { error } = await supabase
    .from("company_settings")
    .upsert(patch, { onConflict: "company_id" });

  if (error) return NextResponse.json({ error: "upsert_failed", details: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
