import type { NextApiRequest, NextApiResponse } from "next"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false })
  }

  try {
    const {
      verification_request_id,
      evidence_type,
      file_sha256,
      storage_path,
    } = req.body

    // 🔥 FIX: obtener usuario desde verification_request
    const { data: vr, error: vrError } = await supabase
      .from("verification_requests")
      .select("requested_by")
      .eq("id", verification_request_id)
      .maybeSingle()

    if (vrError || !vr?.requested_by) {
      return res.status(400).json({
        ok: false,
        stage: "vr_lookup_failed",
        vrError,
      })
    }

    const uploaded_by = vr.requested_by

    // 🧱 INSERT
    const { data: inserted, error } = await supabase
      .from("evidences")
      .insert({
        verification_request_id,
        evidence_type,
        file_sha256,
        storage_path,
        uploaded_by, // 🔥 ya siempre válido
      })
      .select("id")
      .maybeSingle()

    if (error) {
      return res.status(500).json({
        ok: false,
        stage: "insert_evidence",
        error,
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
      message: e?.message || "unknown",
    })
  }
}
