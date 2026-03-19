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
    const { employment_record_id, email } = req.body

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

    const { data, error } = await supabase
      .from("verification_requests")
      .insert({
        employment_record_id,
        verifier_email: email,
        status: "pending"
      })
      .select()
      .single()

    if (error) {
      return res.status(400).json({
        error: "verification_insert_failed",
        details: error.message
      })
    }

    return res.status(200).json({ ok: true, data })
  } catch (e: any) {
    return res.status(500).json({
      error: "internal_error",
      details: e.message
    })
  }
}
