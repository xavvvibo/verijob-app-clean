import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" })
  }

  try {
    const { employment_record_id, email } = req.body ?? {}

    if (!employment_record_id) {
      return res.status(400).json({
        error: "missing_employment_record_id",
        diagnostic_code: "missing_employment_record_id",
      })
    }

    if (!email) {
      return res.status(400).json({
        error: "missing_email",
        diagnostic_code: "missing_email",
      })
    }

    const variants = [
      {
        employment_record_id,
        company_email: email,
        status: "pending",
      },
      {
        employment_record_id,
        verifier_email: email,
        status: "pending",
      },
      {
        employment_record_id,
        email,
        status: "pending",
      },
    ]

    let lastError: any = null

    for (const insertPayload of variants) {
      const { data, error } = await supabase
        .from("verification_requests")
        .insert(insertPayload)
        .select("*")
        .single()

      if (!error) {
        return res.status(200).json({
          ok: true,
          diagnostic_code: "verification_created",
          verification_request_id: data?.id ?? null,
          data,
          insertPayload,
        })
      }

      lastError = error
      console.error("VERIFICATION_CREATE_VARIANT_FAILED", {
        insertPayload,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
    }

    return res.status(400).json({
      error: "verification_insert_failed",
      diagnostic_code: "verification_insert_compat_failed",
      details: lastError?.message ?? "unknown_insert_error",
      db_details: lastError?.details ?? null,
      db_hint: lastError?.hint ?? null,
      db_code: lastError?.code ?? null,
    })
  } catch (e: any) {
    console.error("VERIFICATION_CREATE_EXCEPTION", e)

    return res.status(500).json({
      error: "internal_error",
      diagnostic_code: "internal_error",
      details: e?.message ?? "unknown_error",
    })
  }
}
