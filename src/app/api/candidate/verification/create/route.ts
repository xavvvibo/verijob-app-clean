import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_VERSION = "candidate-verification-create-v3-companyid-fix";

function json(status: number, body: any) {
  const res = NextResponse.json({ ...body, route_version: ROUTE_VERSION }, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: au, error: auErr } = await supabase.auth.getUser();
  const user = au?.user;

  if (auErr || !user) return json(401, { error: "Unauthorized" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Body JSON inválido" });
  }

  const company_name_freeform = String(body?.company_name_freeform ?? "").trim();
  const position = String(body?.position ?? "").trim();
  const start_date = String(body?.start_date ?? "").trim();
  const end_date_raw = String(body?.end_date ?? "").trim();
  const is_current = Boolean(body?.is_current ?? false);

  if (!company_name_freeform) return json(400, { error: "Falta company_name_freeform" });
  if (!position) return json(400, { error: "Falta position" });
  if (!start_date) return json(400, { error: "Falta start_date" });

  const end_date = is_current ? null : (end_date_raw || null);

  // 1) Resolver company_id desde perfil (evita NOT NULL company_id en employment_records)
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) return json(400, { error: "Read profile failed", debug: pErr });
  if (!profile?.active_company_id) {
    return json(400, {
      error: "Missing active_company_id",
      message: "Tu usuario no tiene active_company_id. Entra en /company/reuse (o asigna empresa) y reintenta.",
    });
  }

  const company_id = profile.active_company_id;

  // 2) Insert employment_records
  const { data: er, error: erErr } = await supabase
    .from("employment_records")
    .insert({
      company_id,
      candidate_id: user.id,
      company_name_freeform,
      position,
      start_date,
      end_date,
    })
    .select("id, company_id")
    .single();

  if (erErr) {
    return json(400, { error: "Insert employment_records failed", debug: erErr });
  }

  // 3) Insert verification_requests
  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .insert({
      employment_record_id: er.id,
      requested_by: user.id,
      status: "pending",
    })
    .select("id")
    .single();

  if (vrErr) {
    return json(400, { error: "Insert verification_requests failed", debug: vrErr });
  }

  return json(200, { ok: true, verification_request_id: vr.id });
}
