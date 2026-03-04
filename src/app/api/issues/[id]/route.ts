import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isOwner(role: any) {
  return role === "owner";
}

export async function PATCH(req: Request, ctx: any) {
  const id = ctx?.params?.id as string;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!isOwner(profile?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const status = (body?.status ?? null) as string | null;
  const notes = (body?.notes ?? null) as string | null;

  const patch: any = {};
  if (status) patch.status = status;
  if (notes !== null) patch.notes = notes;

  if (status === "resolved") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = user.id;
  }

  const { data, error } = await supabase
    .from("issue_reports")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, item: data }, { status: 200 });
}
