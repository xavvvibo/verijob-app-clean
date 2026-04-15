import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createRouteHandlerClient();
  const admin = createServiceRoleClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.json({ error: "auth_getUser_failed", details: userErr.message }, { status: 400 });
  }
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const companyId = String(body?.company_id || "").trim();
  const companyName = String(body?.company_name || "").trim() || "Empresa";
  const taxId = String(body?.tax_id || "").trim() || null;

  if (!companyId) {
    return NextResponse.json({ error: "missing_company_id" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("issue_reports")
    .insert({
      created_by: user.id,
      severity: "low",
      http_status: 0,
      error_code: "company_access_request",
      path: "/onboarding/company",
      message: `Solicitud de acceso al equipo para ${companyName}`,
      metadata: {
        company_id: companyId,
        company_name: companyName,
        tax_id: taxId,
        requester_email: user.email || null,
        request_type: "company_team_access_request",
      },
      status: "open",
    })
    .select("id,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "issue_reports_insert_failed", details: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, request_id: data.id, created_at: data.created_at }, { status: 201 });
}
