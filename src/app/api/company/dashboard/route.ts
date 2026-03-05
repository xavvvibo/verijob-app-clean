import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: uErr } = await supabase.auth.getUser();
    if (uErr) return NextResponse.json({ error: "auth_getUser_failed", details: uErr.message }, { status: 400 });
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data, error } = await supabase.rpc("company_dashboard_kpis_v2");
    if (error) return NextResponse.json({ error: "rpc_failed", details: error.message }, { status: 400 });

    if ((data as any)?.error) return NextResponse.json(data, { status: 400 });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: "unhandled_exception", details: e?.message || String(e) }, { status: 500 });
  }
}
