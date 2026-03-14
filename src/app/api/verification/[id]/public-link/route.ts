import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import crypto from "crypto"
import { isUnavailableLifecycleStatus } from "@/lib/account/lifecycle";

function newToken() {
  return crypto.randomBytes(16).toString("hex")
}

export async function POST(req: Request, ctx: any) {
  const params = await ctx?.params
  const id = params?.id as string | undefined
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 })

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("lifecycle_status")
    .eq("id", user.id)
    .maybeSingle()
  if (isUnavailableLifecycleStatus((profile as any)?.lifecycle_status)) {
    return NextResponse.json(
      {
        error: "profile_unavailable",
        user_message: "Tu perfil esta desactivado o eliminado. Reactivalo antes de compartir credenciales.",
      },
      { status: 423 }
    )
  }

  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id, public_token, requested_by")
    .eq("id", id)
    .maybeSingle()

  if (vrErr) return NextResponse.json({ error: "vr_query_failed", details: vrErr.message }, { status: 400 })
  if (!vr) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (vr.requested_by !== user.id) {
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

  return NextResponse.json({ url: `https://app.verijob.es/v/${token}` })
}
