import { NextResponse } from "next/server";
import { requireOwner } from "../../_lib";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: Request) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 50);

  if (!q) return json(200, { users: [] });

  const { data, error } = await owner.admin
    .from("profiles")
    .select("id,email,full_name,role,created_at")
    .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return json(400, { error: "owner_user_search_failed", details: error.message });

  return json(200, { users: data || [] });
}
