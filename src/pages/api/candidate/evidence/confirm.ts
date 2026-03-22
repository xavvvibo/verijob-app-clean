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

    // 🔐 obtener usuario real desde auth header (si existe)
    const authHeader = req.headers.authorization
    let uploaded_by = null

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "")
      const { data } = await supabase.auth.getUser(token)
      uploaded_by = data?.user?.id || null
    }

    if (!uploaded_by) {
      return res.status(401).json({
        ok: false,
        stage: "missing_user",
      })
    }

    // 🔎 CHECK VR EXISTE
    const { data: vrCheck } = await supabase
      .from("verification_requests")
      .select("id")
      .eq("id", verification_request_id)
      .maybeSingle()

    if (!vrCheck) {
      return res.status(400).json({
        ok: false,
        stage: "verification_request_not_found",
      })
    }

    // 🧱 INSERT CON uploaded_by (FIX)
    const { data: inserted, error } = await supabase
      .from("evidences")
      .insert({
        verification_request_id,
        evidence_type,
        file_sha256,
        storage_path,
        uploaded_by, // 🔥 FIX CLAVE
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
      message: e?.message || "unknown_error",
    })
  }
}
