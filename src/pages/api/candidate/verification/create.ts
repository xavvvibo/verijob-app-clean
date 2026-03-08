import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

const ROUTE_VERSION = "candidate-verification-create-v5-companyid-on-vr-pages";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ ...body, route_version: ROUTE_VERSION, route: "/pages/api/candidate/verification/create" });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
    const { data: au, error: auErr } = await supabase.auth.getUser();
    const user = au?.user;

    if (auErr || !user) {
      return json(res, 401, { error: "Unauthorized", details: auErr?.message ?? null });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const company_name_freeform = String(body?.company_name_freeform ?? "").trim();
    const company_email = String(body?.company_email ?? "").trim().toLowerCase();
    const position = String(body?.position ?? "").trim();
    const start_date = String(body?.start_date ?? "").trim();
    const end_date_raw = String(body?.end_date ?? "").trim();
    const is_current = Boolean(body?.is_current ?? false);

    if (!company_name_freeform) return json(res, 400, { error: "Falta company_name_freeform" });
    if (!company_email || !company_email.includes("@")) return json(res, 400, { error: "Falta company_email válido" });
    if (!position) return json(res, 400, { error: "Falta position" });
    if (!start_date) return json(res, 400, { error: "Falta start_date" });

    const end_date = is_current ? null : (end_date_raw || null);

    const { data: er, error: erErr } = await supabase
      .from("employment_records")
      .insert({
        candidate_id: user.id,
        company_name_freeform,
        position,
        start_date,
        end_date,
      })
      .select("id, company_id")
      .single();

    if (erErr) return json(res, 400, { error: "Insert employment_records failed", details: erErr.message });

    const { data: vr, error: vrErr } = await supabase
      .from("verification_requests")
      .insert({
        employment_record_id: er.id,
        requested_by: user.id,
      })
      .select("id")
      .single();

    if (vrErr) return json(res, 400, { error: "Insert verification_requests failed", details: vrErr.message });

    trackEventAdmin({
      event_name: "verification_created",
      user_id: user.id,
      company_id: null,
      entity_type: "verification_request",
      entity_id: vr.id,
      metadata: {
        employment_record_id: er.id,
        company_name_freeform,
        company_email,
        position,
        start_date,
        end_date,
        is_current,
        route_version: ROUTE_VERSION,
      },
    }).catch(() => {});

    return json(res, 200, { ok: true, verification_request_id: vr.id });
  } catch (e: any) {
    return json(res, 500, { error: "server_error", details: String(e?.message || e) });
  }
}
