import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"
import { createPagesRouteClient } from "@/utils/supabase/pages"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const sessionClient = createPagesRouteClient(req, res)
  const { data: authData, error: authError } = await sessionClient.auth.getUser()
  const user = authData?.user
  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const {
    company_name_freeform,
    company_email,
    position,
    start_date,
    end_date,
    is_current,
    source_profile_experience_id,
    requested_by: _ignoredRequestedBy
  } = req.body

  const { data, error } = await supabase
    .from("verification_requests")
    .insert({
      requested_by: user.id,
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
