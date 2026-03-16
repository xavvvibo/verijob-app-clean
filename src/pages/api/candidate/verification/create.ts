import type { NextApiRequest, NextApiResponse } from "next";
import { createServiceRoleClient } from "@/utils/supabase/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createServiceRoleClient();

    const {
      employment_record_id,
      company_email,
      requested_by
    } = req.body;

    if (!employment_record_id || !company_email || !requested_by) {
      return res.status(400).json({ error: "missing_fields" });
    }

    const { data: existing } = await supabase
      .from("verification_requests")
      .select("id,status")
      .eq("employment_record_id", employment_record_id)
      .eq("company_email_target", company_email)
      .in("status", ["pending", "sent", "opened"])
      .maybeSingle();

    if (existing) {
      return res.status(200).json({
        already_exists: true,
        verification_id: existing.id
      });
    }

    const { data, error } = await supabase
      .from("verification_requests")
      .insert({
        employment_record_id,
        company_email_target: company_email,
        requested_by,
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      console.error("verification_create_error", error);
      return res.status(500).json({ error: "verification_create_failed" });
    }

    return res.status(200).json({
      success: true,
      verification_id: data.id
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  }
}
