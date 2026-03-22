import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  try {
    const {
      verification_request_id,
      evidence_type,
      file_sha256,
      storage_path,
    } = req.body

    // 🔎 CHECK VR EXISTE
    const { data: vrCheck, error: vrError } = await supabase
      .from("verification_requests")
      .select("id")
      .eq("id", verification_request_id)
      .maybeSingle()

    if (vrError) {
      return res.status(500).json({
        ok: false,
        stage: "vr_check_error",
        error: vrError,
      })
    }

    if (!vrCheck) {
      return res.status(400).json({
        ok: false,
        stage: "verification_request_not_found",
        verification_request_id,
      })
    }

    // 🧱 INSERT MINIMAL (SIN CAMPOS OPCIONALES)
    const { data: inserted, error: insertError } = await supabase
      .from("evidences")
      .insert({
        verification_request_id,
        evidence_type,
        file_sha256,
        storage_path,
      })
      .select("id")
      .maybeSingle()

    if (insertError) {
      return res.status(500).json({
        ok: false,
        stage: "insert_evidence",
        error: insertError,
      })
    }

    return res.status(200).json({
      ok: true,
      evidence_id: inserted?.id || null,
    })
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      stage: "unexpected_exception",
      message: e?.message || "unknown_error",
    })
  }
}
