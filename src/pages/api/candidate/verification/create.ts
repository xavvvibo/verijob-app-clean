import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { employment_record_id, email } = req.body ?? {}

    // 🔴 USER REAL (CLAVE)
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return res.status(401).json({
        error: "unauthorized",
        diagnostic_code: "no_user"
      })
    }

    if (!employment_record_id) {
      return res.status(400).json({
        error: "missing_employment_record_id"
      })
    }

    if (!email) {
      return res.status(400).json({
        error: "missing_email"
      })
    }

    const insertPayload = {
      employment_record_id,
      external_email_target: email,
      verification_channel: "email",
      status: "pending_company",
      requested_by: user.id // 🔴 FIX CLAVE
    }

    const { data, error } = await supabase
      .from("verification_requests")
      .insert(insertPayload)
      .select("*")
      .single()

    if (error) {
      return res.status(400).json({
        error: "verification_insert_failed",
        details: error.message,
        code: error.code,
        payload: insertPayload
      })
    }

    return res.status(200).json({
      ok: true,
      verification_request_id: data.id
    })
  } catch (e: any) {
    return res.status(500).json({
      error: "internal_error",
      details: e.message
    })
  }
}
