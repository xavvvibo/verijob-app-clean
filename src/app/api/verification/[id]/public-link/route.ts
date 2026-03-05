import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import crypto from "crypto"

function newToken() {
  return crypto.randomBytes(16).toString("hex") // 32 chars
}

export async function POST(req: Request, ctx: any) {
  const id = ctx?.params?.id as string | undefined
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 })

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // fetch verification_request
  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id, public_token, employment_record_id")
    .eq("id", id)
    .maybeSingle()

  if (vrErr) return NextResponse.json({ error: "vr_query_failed", details: vrErr.message }, { status: 400 })
  if (!vr) return NextResponse.json({ error: "not_found" }, { status: 404 })

  // ownership check (candidate must own employment_record)
  const { data: er, error: erErr } = await supabase
    .from("employment_records")
    .select("candidate_id")
    .eq("id", vr.employment_record_id)
    .maybeSingle()

  if (erErr) return NextResponse.json({ error: "er_query_failed", details: erErr.message }, { status: 400 })
  if (!er || er.candidate_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  let token = vr.public_token
  if (!token) {
    token = newToken()
    const { error: upErr } = await supabase
      .from("verification_requests")
      .update({ public_token: token })
      .eq("id", id)
    if (upErr) return NextResponse.json({ error: "token_update_failed", details: upErr.message }, { status: 400 })
  }

  const url = `https://app.verijob.es/v/${token}`
  return NextResponse.json({ url })
}
