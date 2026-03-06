import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(req: Request, ctx: any) {

  const { id } = ctx.params

  const supabase = createClient()

  const { data, error } = await supabase
    .from("candidate_cv_public")
    .select("*")
    .eq("candidate_id", id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: "candidate_not_found" },
      { status: 404 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: "candidate_not_found" },
      { status: 404 }
    )
  }

  const response = {
    route_version: "candidate-teaser-v1",

    candidate_id: id,

    experiences_total: data.experiences_total,
    education_total: data.education_total,
    achievements_total: data.achievements_total,

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
  }

  return NextResponse.json(response)
}
