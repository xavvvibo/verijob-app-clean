import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(req: Request, ctx: any) {
  const { id } = ctx.params

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

  return NextResponse.json({
    route_version: "candidate-teaser-v1",
    candidate_id: id,
    experiences_total: data.experiences_total ?? 0,
    education_total: data.education_total ?? 0,
    achievements_total: data.achievements_total ?? 0,
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
