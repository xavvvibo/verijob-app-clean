import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = createServerSupabaseClient({ req, res });

  const {
    company_name_freeform,
    company_email,
    position,
    start_date,
    end_date,
    is_current,
    source_profile_experience_id
  } = req.body;

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const requested_by = user.id;

  const { data, error } = await supabase
    .from("verification_requests")
    .insert({
      requested_by,
      verification_type: "employment",
      company_name_target: company_name_freeform,
      company_email_target: company_email,
      request_context: {
        position,
        start_date,
        end_date,
        is_current,
        source_profile_experience_id
      },
      status: "pending_company",
      requested_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("Insert verification_requests failed", error);
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({
    ok: true,
    verification_request: data
  });
}
