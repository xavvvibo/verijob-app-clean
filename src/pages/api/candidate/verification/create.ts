import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export default async function handler(req, res) {
  try {

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies }
    );

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { employment_record_id, company_id } = req.body;

    const { data, error } = await supabase
      .from("verification_requests")
      .insert({
        employment_record_id,
        company_id,
        requested_by: user.id,
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
