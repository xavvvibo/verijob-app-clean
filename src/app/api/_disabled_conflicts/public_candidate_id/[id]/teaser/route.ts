import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(req: Request, ctx: any) {
  const p = ctx?.params
  const params = p && typeof p.then === "function" ? await p : p
  const id = String(params?.id || "")

  if (!id) {
    return NextResponse.json(
      { error: "missing_candidate_id" },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("candidate_cv_public")
    .select("*")
    .eq("candidate_id", id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: "candidate_not_found" },
      { status: 404 }
    )
  }

  const experiencesTotal = Number(data.experiences_total ?? 0)
  const educationTotal = Number(data.education_total ?? 0)
  const achievementsTotal = Number(data.achievements_total ?? 0)

  const showEducation = educationTotal > 0
  const showAchievements = achievementsTotal > 0

  return NextResponse.json({
    route_version: "candidate-teaser-v2-clean-sections",
    candidate_id: id,
    experiences_total: experiencesTotal,
    education_total: educationTotal,
    achievements_total: achievementsTotal,
    show_education: showEducation,
    show_achievements: showAchievements,
    message: {
      title: "Bienvenido a Verijob",
      subtitle: "La verdad laboral verificada",
      description:
        "Este candidato tiene información laboral registrada y verificable en Verijob. Regístrate o inicia sesión para ver el CV verificado completo."
    },
    cta: {
      signup: "https://app.verijob.es/signup",
      login: "https://app.verijob.es/login"
    }
  })
}
