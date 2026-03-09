import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function DELETE(_req: Request, ctx: any) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "unauthorized" });

  const id = String(ctx?.params?.id || "").trim();
  if (!id) return json(400, { error: "missing_id" });

  const { data: row, error: rowErr } = await supabase
    .from("evidences")
    .select("id")
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .maybeSingle();

  if (rowErr) return json(400, { error: "lookup_failed", details: rowErr.message });
  if (!row) return json(404, { error: "not_found" });

  const { error: delErr } = await supabase.from("evidences").delete().eq("id", id).eq("uploaded_by", user.id);
  if (delErr) return json(400, { error: "delete_failed", details: delErr.message });

  await recalculateAndPersistCandidateTrustScore(user.id).catch(() => {});

  return json(200, { ok: true, id });
}
