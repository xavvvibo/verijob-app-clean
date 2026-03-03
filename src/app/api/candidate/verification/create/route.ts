import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function s(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: au } = await supabase.auth.getUser();
  const user = au.user;
  if (!user) return json(401, { error: "Unauthorized" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body JSON inválido" });
  }

  const company_name_freeform = s(body?.company_name_freeform);
  const position = s(body?.position);
  const start_date = s(body?.start_date); // YYYY-MM-DD
  const end_date_raw = s(body?.end_date); // YYYY-MM-DD o ""
  const is_current = Boolean(body?.is_current);

  const end_date = is_current ? null : (end_date_raw || null);

  if (!company_name_freeform) return json(400, { error: "Falta company_name_freeform" });
  if (!position) return json(400, { error: "Falta position" });
  if (!start_date) return json(400, { error: "Falta start_date" });

  // Service-role para evitar sorpresas de RLS (guardado por auth en API)
  const service = createServiceRoleClient();

  // 1) employment_records
  const { data: er, error: erErr } = await service
    .from("employment_records")
    .insert({
      candidate_id: user.id,
      company_name_freeform,
      position,
      start_date,
      end_date,
    })
    .select("id")
    .single();

  if (erErr) return json(400, { error: "Insert employment_records failed", details: erErr });

  // 2) verification_requests
  const { data: vr, error: vrErr } = await service
    .from("verification_requests")
    .insert({
      employment_record_id: er.id,
      requested_by: user.id,
      status: "pending",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (vrErr) return json(400, { error: "Insert verification_requests failed", details: vrErr });

  return json(200, { ok: true, verification_id: vr.id, employment_record_id: er.id });
}
