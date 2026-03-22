import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  deleteCandidateCollectionItems,
  readCandidateProfileCollections,
  replaceCandidateAchievementsCollection,
} from "@/lib/candidate/profile-collections";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user || null;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createServiceRoleClient();
  const collections = await readCandidateProfileCollections(admin, user.id);
  return NextResponse.json({ items: collections.achievements, support: collections.support.achievements });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin = createServiceRoleClient();
  try {
    await replaceCandidateAchievementsCollection(admin, user.id, Array.isArray(body?.items) ? body.items : [], "manual");
    const collections = await readCandidateProfileCollections(admin, user.id);
    return NextResponse.json({ ok: true, items: collections.achievements });
  } catch (error: any) {
    return NextResponse.json({ error: "candidate_achievements_write_failed", details: String(error?.message || error) }, { status: 400 });
  }
}

export const PUT = POST;

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids)
    ? body.ids.map((id: unknown) => String(id || "").trim()).filter(Boolean)
    : [String(body?.id || "").trim()].filter(Boolean);
  const admin = createServiceRoleClient();
  try {
    await deleteCandidateCollectionItems(admin, "candidate_achievements", user.id, ids);
    const collections = await readCandidateProfileCollections(admin, user.id);
    return NextResponse.json({ ok: true, items: collections.achievements });
  } catch (error: any) {
    return NextResponse.json({ error: "candidate_achievements_delete_failed", details: String(error?.message || error) }, { status: 400 });
  }
}
