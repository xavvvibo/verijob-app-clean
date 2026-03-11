import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const {
      employment_record_id,
      company_id,
      requested_by
    } = req.body;

    if (!requested_by) {
      return res.status(400).json({ error: "requested_by required" });
    }

    const { data, error } = await supabase
      .from("verification_requests")
      .insert({
        employment_record_id,
        company_id,
        requested_by,
        status: "pending_company",
        verification_type: "employment"
      })
      .select()
      .single();

    if (error) {
      console.error("Insert verification_requests failed:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
