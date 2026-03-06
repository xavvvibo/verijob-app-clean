import { NextResponse } from "next/server";

type Params = { token: string };

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { token } = await ctx.params;

  return NextResponse.json(
    {
      route_version: "public-candidate-debug-static-v1",
      ok: true,
      token,
      message: "debug static response",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
