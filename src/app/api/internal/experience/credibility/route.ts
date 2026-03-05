import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const BodySchema = z.object({
  experience_id: z.string().uuid(),
});

function requireInternal(req: Request) {
  const token = req.headers.get("x-verijob-internal") || "";
  const expected = process.env.INTERNAL_JOB_TOKEN || "";
  if (!expected || token !== expected) return false;
  return true;
}

export async function POST(req: Request) {
  if (!requireInternal(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.rpc("compute_experience_credibility_v1", {
    p_experience_id: parsed.data.experience_id,
  });

  if (error) {
    return NextResponse.json({ error: "rpc_failed", details: error.message }, { status: 400 });
  }

  // rpc devuelve array con 1 fila (table return)
  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json(
    {
      route_version: "f14-credibility-v1-3signals",
      result: row ?? null,
    },
    { status: 200 }
  );
}
