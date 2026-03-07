import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {

  const body = await req.json()

  const {
    user_id,
    structured_cv
  } = body

  if (!user_id || !structured_cv) {
    return NextResponse.json({ error: "missing payload" }, { status: 400 })
  }

  await supabase
    .from("profiles")
    .update({
      structured_cv_json: structured_cv
    })
    .eq("id", user_id)

  await supabase
    .from("profile_experiences")
    .delete()
    .eq("user_id", user_id)

  const experiences = structured_cv.experiences || []

  if (experiences.length > 0) {

    const rows = experiences.map((exp: any) => ({
      user_id: user_id,
      company_name: exp.company,
      role_title: exp.title,
      start_date: exp.start_date || null,
      end_date: exp.end_date || null,
      description: exp.description || null,
      confidence: exp.confidence || null
    }))

    await supabase
      .from("profile_experiences")
      .insert(rows)

  }

  await supabase.rpc(
    "run_cv_consistency_pipeline",
    { p_user: user_id }
  )

  return NextResponse.json({
    status: "cv_processed"
  })

}
