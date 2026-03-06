import { NextResponse } from "next/server";

type Params = { token: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params;

  return NextResponse.json(
    {
      route_version: "public-candidate-token-debug-static-v2",
      ok: true,
      token,
      teaser: {
        title: "Bienvenido a Verijob",
        subtitle: "La verdad laboral verificada",
        description: "Debug API estática funcionando.",
        full_name: null,
        experiences_total: 0,
        education_total: 0,
        achievements_total: 0,
        profile_visibility: "private"
      },
      profile: {}
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
