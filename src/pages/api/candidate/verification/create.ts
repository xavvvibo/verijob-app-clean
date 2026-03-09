import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";
import { buildExternalExperienceVerificationEmail } from "@/lib/email/templates/externalExperienceVerification";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

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
  const dmy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = raw.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

function companyPlaceholderName(companyName: string) {
  return `Pendiente de registro · ${companyName}`;
}

async function findCompanyByName(supabase: any, companyName: string): Promise<string | null> {
  const name = String(companyName || "").trim();
  if (!name) return null;

  const probes: Array<Promise<any>> = [
    supabase.from("companies").select("id").ilike("name", name).limit(1).maybeSingle(),
    supabase.from("companies").select("id").ilike("trade_name", name).limit(1).maybeSingle(),
    supabase.from("companies").select("id").ilike("legal_name", name).limit(1).maybeSingle(),
  ];

  for (const probe of probes) {
    const { data, error } = await probe;
    if (error) continue;
    if (data?.id) return String(data.id);
  }
  return null;
}

async function ensurePlaceholderCompany(supabase: any, companyName: string): Promise<{ id: string | null; error?: string }> {
  const normalized = String(companyName || "").trim();
  if (!normalized) return { id: null, error: "company_name_freeform vacío" };

  const placeholderName = companyPlaceholderName(normalized);
  const existingByName = await findCompanyByName(supabase, placeholderName);
  if (existingByName) return { id: existingByName };

  const metadata = {
    is_placeholder: true,
    source: "verification_request",
    source_version: ROUTE_VERSION,
    original_company_name: normalized,
  };

  const seedPayloads: Array<Record<string, any>> = [
    { name: placeholderName, company_verification_status: "unverified", metadata },
    { name: placeholderName, metadata },
    { legal_name: placeholderName, trade_name: normalized, metadata },
    { name: placeholderName },
    { legal_name: placeholderName, trade_name: normalized },
  ];

  const parseMissingColumn = (message: string): string | null => {
    const full = message.match(/column\s+"([^"]+)"\s+of relation\s+"companies"\s+does not exist/i);
    if (full?.[1]) return full[1];
    const short = message.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
    return short?.[1] || null;
  };

  let lastError: any = null;
  for (const seed of seedPayloads) {
    let payload = { ...seed };
    for (let i = 0; i < 8; i += 1) {
      const { data, error } = await supabase.from("companies").insert(payload).select("id").single();
      if (!error && data?.id) return { id: String(data.id) };
      lastError = error;
      const message = String(error?.message || "");
      const missing = parseMissingColumn(message);
      if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
        const { [missing]: _drop, ...rest } = payload;
        payload = rest;
        continue;
      }
      break;
    }
  }

  const finalTry = await findCompanyByName(supabase, placeholderName);
  if (finalTry) return { id: finalTry };

  return { id: null, error: String(lastError?.message || "No se pudo resolver placeholder company_id") };
}

async function tryInsertEmploymentRecord(
  supabase: any,
  baseRecord: Record<string, any>,
  userId: string
) {
  const variants: Array<Record<string, any>> = [
    { ...baseRecord, candidate_id: userId, user_id: userId },
    { ...baseRecord, candidate_id: userId },
    { ...baseRecord, user_id: userId },
    { ...baseRecord },
  ];

  const parseMissingColumn = (message: string): string | null => {
    const full = message.match(/column\s+"([^"]+)"\s+of relation\s+"employment_records"\s+does not exist/i);
    if (full?.[1]) return full[1];
    const short = message.match(/column\s+([a-zA-Z0-9_]+)\s+does not exist/i);
    return short?.[1] || null;
  };

  let lastError: any = null;

  for (const seedPayload of variants) {
    let payload: Record<string, any> = { ...seedPayload };

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data, error } = await supabase
        .from("employment_records")
        .insert(payload)
        .select("id, company_id")
        .single();

      if (!error) return { data, error: null };
      lastError = error;

      const message = String(error?.message || "");
      const lower = message.toLowerCase();

      // Legacy schemas can miss recently added columns. Remove unknown columns and retry.
      const missingColumn = parseMissingColumn(message);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        const { [missingColumn]: _drop, ...rest } = payload;
        payload = rest;
        continue;
      }

      // Some legacy schemas require end_date to be non-null.
      if (lower.includes("null value in column") && lower.includes("end_date") && !payload.end_date) {
        payload = { ...payload, end_date: payload.start_date || new Date().toISOString().slice(0, 10) };
        continue;
      }

      // If RLS expects candidate ownership, ensure candidate_id exists in payload.
      if (lower.includes("row-level security") && !payload.candidate_id) {
        payload = { ...payload, candidate_id: userId };
        continue;
      }

      break;
    }
  }

  return { data: null, error: lastError };
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

    const companyIdFromEmailProfile = (companyProfileByEmail as any)?.active_company_id
      ? String((companyProfileByEmail as any).active_company_id)
      : null;

    const companyIdFromName = await findCompanyByName(supabase, company_name_freeform);
    let targetCompanyId = companyIdFromEmailProfile || companyIdFromName;

    if (!targetCompanyId) {
      const placeholder = await ensurePlaceholderCompany(supabase, company_name_freeform);
      if (!placeholder.id) {
        return json(res, 400, {
          error: "Resolve company_id failed",
          details: placeholder.error || "No se pudo encontrar o crear company_id placeholder.",
        });
      }
      targetCompanyId = placeholder.id;
    }

    const hasRegisteredReceiver = Boolean(companyIdFromEmailProfile);
    const requestStatus = hasRegisteredReceiver ? "requested" : "company_registered_pending";
    const baseRecord: Record<string, any> = {
      candidate_id: user.id,
      company_id: targetCompanyId,
      company_name_freeform,
      position,
      start_date,
      end_date,
      verification_status: requestStatus,
      last_verification_requested_at: requestedAtIso,
    };

    let er: any = null;
    let erErr: any = null;
    ({ data: er, error: erErr } = await tryInsertEmploymentRecord(supabase, baseRecord, user.id));

    if (erErr) {
      return json(res, 400, {
        error: "Insert employment_records failed",
        details: erErr.message,
        hint: "Revisa columnas requeridas de employment_records y formato de fechas.",
      });
    }

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
        external_token: hasRegisteredReceiver ? null : externalToken,
        external_email_target: company_email,
        external_token_expires_at: hasRegisteredReceiver ? null : externalTokenExpiresAt,
        external_resolved: false,
        request_context: {
          experience_scope: "employment_record",
          target_company_registered: hasRegisteredReceiver,
          company_id_resolution: {
            from_profile_email: Boolean(companyIdFromEmailProfile),
            from_company_name: Boolean(companyIdFromName),
            placeholder_used: !companyIdFromEmailProfile && !companyIdFromName,
          },
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

    const externalVerificationLink = hasRegisteredReceiver ? null : `${appUrl}/verify-experience/${externalToken}`;
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
        company_registered: hasRegisteredReceiver,
        company_id_resolution: {
          from_profile_email: Boolean(companyIdFromEmailProfile),
          from_company_name: Boolean(companyIdFromName),
          placeholder_used: !companyIdFromEmailProfile && !companyIdFromName,
        },
        external_verification_link: externalVerificationLink,
        route_version: ROUTE_VERSION,
      },
    }).catch(() => {});

    await recalculateAndPersistCandidateTrustScore(user.id).catch(() => {});

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
