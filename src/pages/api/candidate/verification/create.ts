import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const {
    company_name_freeform,
    company_email,
    position,
    start_date,
    end_date,
    is_current,
    source_profile_experience_id,
    requested_by
  } = req.body

  if (!requested_by) {
    return res.status(400).json({ error: "requested_by required" })
  }

  const { data, error } = await supabase
    .from("verification_requests")
    .insert({
      requested_by,
      verification_type: "employment",
      company_name_target: company_name_freeform,
      company_email_target: company_email,
      status: "pending_company",
      requested_at: new Date().toISOString(),
      request_context: {
        position,
        start_date,
        end_date,
        is_current,
        source_profile_experience_id
      }
    })
    .select()
    .single()

  if (error) {
    console.error("Insert verification_requests failed", error)
    return res.status(400).json({ error: error.message })
  }

  return res.status(200).json({
    ok: true,
    verification_request: data
  })
}
