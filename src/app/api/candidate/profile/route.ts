import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ profile: data })
}

export async function PUT(req: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const payload = {
    user_id: user.id,
    summary: typeof body?.summary === "string" ? body.summary : null,
    education: Array.isArray(body?.education) ? body.education : [],
    certifications: Array.isArray(body?.certifications) ? body.certifications : [],
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("candidate_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, profile: data })
}
