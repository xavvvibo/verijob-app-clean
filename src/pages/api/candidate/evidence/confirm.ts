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

    // 🔐 sacar usuario del token
    const authHeader = req.headers.authorization

    if (!authHeader) {
      return res.status(401).json({ ok: false, stage: "no_auth_header" })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: userData } = await supabase.auth.getUser(token)

    const userId = userData?.user?.id

    if (!userId) {
      return res.status(401).json({ ok: false, stage: "invalid_user" })
    }

    // 🧱 INSERT CORRECTO
    const { data: inserted, error } = await supabase
      .from("evidences")
      .insert({
        verification_request_id,
        evidence_type,
        file_sha256,
        storage_path,
        uploaded_by: userId, // 🔥 FIX REAL
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
