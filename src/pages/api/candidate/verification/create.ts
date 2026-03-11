import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { buildExternalExperienceVerificationEmail } from "@/lib/email/templates/externalExperienceVerification";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendVerificationEmail(params: { to: string; link: string }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "").trim();
  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email provider no configurado (faltan RESEND_API_KEY y/o RESEND_FROM_EMAIL|EMAIL_FROM)",
    };
  }

  try {
    const tpl = buildExternalExperienceVerificationEmail({ verificationLink: params.link });
    const payload = {
      from,
      to: [params.to],
      subject: tpl.subject,
      html: tpl.html || "",
      text: tpl.text || tpl.body || "",
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    if (!response.ok) {
      const error = new Error(`Resend API error ${response.status}: ${body}`);
      console.error("Send verification email failed", error);
      return {
        ok: false,
        error: error.message,
      };
    }

    return { ok: true, error: null as string | null };
  } catch (error: any) {
    console.error("Send verification email failed", error);
    return {
      ok: false,
      error: String(error?.message || "unknown_send_error"),
    };
  }
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

async function resolveOrCreateEmploymentRecordId(params: {
  userId: string;
  employmentRecordIdRaw: string;
  sourceProfileExperienceId: string | null;
  companyName: string;
  position: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
}) {
  const {
    userId,
    employmentRecordIdRaw,
    sourceProfileExperienceId,
    companyName,
    position,
    startDate,
    endDate,
    isCurrent,
  } = params;

  const explicitId = String(employmentRecordIdRaw || "").trim();

  if (explicitId) {
    const { data: existing } = await supabase
      .from("employment_records")
      .select("id,candidate_id")
      .eq("id", explicitId)
      .maybeSingle();

    if (existing?.id) {
      if (String((existing as any).candidate_id || "") !== userId) {
        return { id: null as string | null, error: "employment_record_id no pertenece al usuario autenticado" };
      }
      return { id: String(existing.id), error: null as string | null };
    }
  }

  if (!sourceProfileExperienceId) {
    return {
      id: null as string | null,
      error: "employment_record_id inválido y sin source_profile_experience_id para crear registro",
    };
  }

  const { data: profileExperience } = await supabase
    .from("profile_experiences")
    .select("id,user_id,company_name,role_title,start_date,end_date,description")
    .eq("id", sourceProfileExperienceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileExperience?.id) {
    return {
      id: null as string | null,
      error: "source_profile_experience_id no encontrado para el usuario autenticado",
    };
  }

  const resolvedCompany = String((profileExperience as any).company_name || companyName || "").trim();
  const resolvedPosition = String((profileExperience as any).role_title || position || "").trim();
  const resolvedStart = normalizeDateInput((profileExperience as any).start_date || startDate);
  const resolvedEnd = isCurrent ? null : normalizeDateInput((profileExperience as any).end_date || endDate);

  if (!resolvedCompany || !resolvedPosition || !resolvedStart) {
    return {
      id: null as string | null,
      error: "No se pudo derivar un employment_record válido desde source_profile_experience_id",
    };
  }

  const { data: created, error: createErr } = await supabase
    .from("employment_records")
    .insert({
      candidate_id: userId,
      company_id: null,
      company_name_freeform: resolvedCompany,
      position: resolvedPosition,
      start_date: resolvedStart,
      end_date: resolvedEnd,
      verification_status: "pending_company",
      last_verification_requested_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createErr || !created?.id) {
    return {
      id: null as string | null,
      error: `No se pudo crear employment_record: ${String(createErr?.message || "unknown_error")}`,
    };
  }

  return { id: String(created.id), error: null as string | null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sessionClient = createPagesRouteClient(req, res);
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  const user = authData?.user;
  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    company_name_freeform,
    company_email,
    position,
    start_date,
    end_date,
    is_current,
    source_profile_experience_id,
    employment_record_id,
    requested_by: _ignoredRequestedBy,
  } = req.body || {};

  const companyName = String(company_name_freeform || "").trim();
  const companyEmail = String(company_email || "").trim().toLowerCase();
  const role = String(position || "").trim();
  const startDate = normalizeDateInput(start_date);
  const endDate = Boolean(is_current) ? null : normalizeDateInput(end_date);
  const sourceProfileExperienceId = String(source_profile_experience_id || "").trim() || null;
  const employmentRecordIdRaw = String(employment_record_id || "").trim();
  const externalToken = crypto.randomUUID().replace(/-/g, "");
  const externalTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es").replace(/\/$/, "");
  const verificationLink = `${appUrl}/verify-experience/${externalToken}`;

  if (!companyName) return res.status(400).json({ error: "company_name_freeform required" });
  if (!companyEmail || !companyEmail.includes("@")) return res.status(400).json({ error: "company_email required" });
  if (!role) return res.status(400).json({ error: "position required" });
  if (!startDate) return res.status(400).json({ error: "start_date inválido" });
  if (!employmentRecordIdRaw && !sourceProfileExperienceId) {
    return res.status(400).json({ error: "employment_record_id required" });
  }

  const resolvedEmployment = await resolveOrCreateEmploymentRecordId({
    userId: user.id,
    employmentRecordIdRaw,
    sourceProfileExperienceId,
    companyName,
    position: role,
    startDate,
    endDate,
    isCurrent: Boolean(is_current),
  });

  if (!resolvedEmployment.id) {
    return res.status(400).json({ error: resolvedEmployment.error || "employment_record_id inválido" });
  }

  const { data, error } = await supabase
    .from("verification_requests")
    .insert({
      employment_record_id: resolvedEmployment.id,
      requested_by: user.id,
      verification_type: "employment",
      company_name_target: companyName,
      company_email_target: companyEmail,
      external_email_target: companyEmail,
      external_token: externalToken,
      external_token_expires_at: externalTokenExpiresAt,
      verification_channel: "email",
      status: "pending_company",
      requested_at: new Date().toISOString(),
      request_context: {
        position: role,
        start_date: startDate,
        end_date: endDate,
        is_current: Boolean(is_current),
        source_profile_experience_id: sourceProfileExperienceId,
      },
    })
    .select()
    .single();

  if (error) {
    console.error("Insert verification_requests failed", error);
    return res.status(400).json({
      error: `Insert verification_requests failed: ${String(error.message || "unknown_error")}`,
      details: {
        code: (error as any)?.code || null,
        hint: (error as any)?.hint || null,
        pg_details: (error as any)?.details || null,
        employment_record_id: resolvedEmployment.id,
      },
    });
  }

  const emailResult = await sendVerificationEmail({
    to: companyEmail,
    link: verificationLink,
  });

  if (!emailResult.ok) {
    console.error("Send verification email failed", {
      verification_request_id: data?.id || null,
      company_email_target: companyEmail,
      error: emailResult.error,
    });
    return res.status(502).json({
      error: `Verification request creada pero fallo al enviar email: ${emailResult.error}`,
      verification_request_id: data?.id || null,
      email_sent: false,
    });
  }

  return res.status(200).json({
    ok: true,
    verification_request: data,
    verification_request_id: data?.id || null,
    employment_record_id: resolvedEmployment.id,
    email_sent: true,
  });
}
