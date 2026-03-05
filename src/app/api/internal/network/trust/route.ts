import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const BodySchema = z.object({ verification_id: z.string().uuid() });

function requireInternal(req: Request) {
  const token = req.headers.get("x-verijob-internal") || "";
  const expected = process.env.INTERNAL_JOB_TOKEN || "";
  return !!expected && token === expected;
}

export async function POST(req: Request) {
  if (!requireInternal(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("compute_network_trust", {
    p_verification_id: parsed.data.verification_id,
  });

  if (error) return NextResponse.json({ error: "rpc_failed", details: error.message }, { status: 400 });

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ route_version: "f14-network-trust-v1", result: row ?? null });
}
