import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";
import { buildExternalExperienceVerificationEmail } from "@/lib/email/templates/externalExperienceVerification";

const ROUTE_VERSION = "candidate-verification-create-v6-experience-request-flow";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ ...body, route_version: ROUTE_VERSION, route: "/pages/api/candidate/verification/create" });
}

function normalizeDateInput(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (low.includes("actual") || low.includes("present")) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = raw.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
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
    const start_date_raw = String(body?.start_date ?? "").trim();
    const end_date_raw = String(body?.end_date ?? "").trim();
    const is_current = Boolean(body?.is_current ?? false);
    const source_profile_experience_id = String(body?.source_profile_experience_id ?? "").trim() || null;

    if (!company_name_freeform) return json(res, 400, { error: "Falta company_name_freeform" });
    if (!company_email || !company_email.includes("@")) return json(res, 400, { error: "Falta company_email válido" });
    if (!position) return json(res, 400, { error: "Falta position" });
    const start_date = normalizeDateInput(start_date_raw);
    if (!start_date) return json(res, 400, { error: "Falta start_date válido (YYYY-MM-DD o YYYY-MM)" });

    const end_date = is_current ? null : normalizeDateInput(end_date_raw);

    const requestedAtIso = new Date().toISOString();
    const externalToken = randomUUID();
    const externalTokenExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es";

    const { data: companyProfileByEmail } = await supabase
      .from("profiles")
      .select("id,active_company_id,role,email")
      .eq("email", company_email)
      .eq("role", "company")
      .limit(1)
      .maybeSingle();

    const targetCompanyId = (companyProfileByEmail as any)?.active_company_id
      ? String((companyProfileByEmail as any).active_company_id)
      : null;

    const requestStatus = targetCompanyId ? "requested" : "company_registered_pending";
    const baseRecord: Record<string, any> = {
      company_name_freeform,
      position,
      start_date,
      end_date,
      verification_status: requestStatus,
      last_verification_requested_at: requestedAtIso,
    };
    if (targetCompanyId) baseRecord.company_id = targetCompanyId;

    let er: any = null;
    let erErr: any = null;

    ({ data: er, error: erErr } = await supabase
      .from("employment_records")
      .insert({ ...baseRecord, candidate_id: user.id })
      .select("id, company_id")
      .single());

    if (erErr && String(erErr.message || "").toLowerCase().includes("candidate_id")) {
      ({ data: er, error: erErr } = await supabase
        .from("employment_records")
        .insert({ ...baseRecord, user_id: user.id })
        .select("id, company_id")
        .single());
    }

    if (erErr) return json(res, 400, { error: "Insert employment_records failed", details: erErr.message });

    const { data: vr, error: vrErr } = await supabase
      .from("verification_requests")
      .insert({
        employment_record_id: er.id,
        requested_by: user.id,
        company_id: targetCompanyId,
        status: requestStatus,
        company_email_target: company_email,
        company_name_target: company_name_freeform,
        verification_channel: "email",
        requested_at: requestedAtIso,
        external_token: targetCompanyId ? null : externalToken,
        external_email_target: company_email,
        external_token_expires_at: targetCompanyId ? null : externalTokenExpiresAt,
        external_resolved: false,
        request_context: {
          experience_scope: "employment_record",
          target_company_registered: Boolean(targetCompanyId),
        },
      })
      .select("id")
      .single();

    if (vrErr) return json(res, 400, { error: "Insert verification_requests failed", details: vrErr.message });

    await supabase
      .from("employment_records")
      .update({ last_verification_request_id: vr.id })
      .eq("id", er.id);

    if (source_profile_experience_id) {
      await supabase
        .from("profile_experiences")
        .update({ matched_verification_id: vr.id })
        .eq("id", source_profile_experience_id)
        .eq("user_id", user.id);
    }

    const externalVerificationLink = targetCompanyId ? null : `${appUrl}/verify-experience/${externalToken}`;
    const emailTemplate = externalVerificationLink
      ? buildExternalExperienceVerificationEmail({ link: externalVerificationLink })
      : null;

    trackEventAdmin({
      event_name: "verification_created",
      user_id: user.id,
      company_id: targetCompanyId,
      entity_type: "verification_request",
      entity_id: vr.id,
      metadata: {
        employment_record_id: er.id,
        experience_verification: true,
        company_name_freeform,
        company_email,
        position,
        start_date,
        end_date,
        is_current,
        source_profile_experience_id,
        company_registered: Boolean(targetCompanyId),
        external_verification_link: externalVerificationLink,
        route_version: ROUTE_VERSION,
      },
    }).catch(() => {});

    return json(res, 200, {
      ok: true,
      verification_request_id: vr.id,
      external_verification: targetCompanyId
        ? null
        : {
            link: externalVerificationLink,
            expires_at: externalTokenExpiresAt,
            email_template: emailTemplate,
          },
    });
  } catch (e: any) {
    return json(res, 500, { error: "server_error", details: String(e?.message || e) });
  }
}
