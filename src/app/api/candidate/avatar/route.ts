import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

const BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "candidate-avatars";
const MAX_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function fileExtFromName(name: string) {
  const clean = String(name || "").toLowerCase();
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "jpg";
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".webp")) return "webp";
  return "jpg";
}

async function ensureBucket(admin: any) {
  const listRes = await admin.storage.listBuckets();
  if (listRes.error) {
    throw new Error(`storage_list_buckets_failed:${listRes.error.message}`);
  }
  const exists = (listRes.data || []).some((b: any) => String(b?.name || "") === BUCKET);
  if (exists) return;
  const createRes = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_TYPES),
  });
  if (createRes.error) {
    throw new Error(`storage_create_bucket_failed:${createRes.error.message}`);
  }
}

function extractPathFromSupabasePublicUrl(urlRaw: unknown) {
  const url = String(urlRaw || "").trim();
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  const rawPath = url.slice(idx + marker.length);
  if (!rawPath) return null;
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) return json(400, { error: "auth_getUser_failed", details: userErr.message });
    if (!user) return json(401, { error: "unauthorized" });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json(400, { error: "file_required" });
    if (!ALLOWED_TYPES.has(file.type)) return json(400, { error: "invalid_file_type" });
    if (file.size <= 0 || file.size > MAX_SIZE_BYTES) return json(400, { error: "invalid_file_size" });

    await ensureBucket(admin);

    const ext = fileExtFromName(file.name);
    const storagePath = `${user.id}/avatar-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const uploadRes = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadRes.error) {
      return json(400, { error: "avatar_upload_failed", details: uploadRes.error.message });
    }

    const publicRes = admin.storage.from(BUCKET).getPublicUrl(storagePath);
    const avatarUrl = String(publicRes?.data?.publicUrl || "").trim();
    if (!avatarUrl) return json(500, { error: "avatar_url_generation_failed" });

    const { error: profileErr } = await admin
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);
    if (profileErr) return json(400, { error: "profiles_update_failed", details: profileErr.message });

    return json(200, { ok: true, avatar_url: avatarUrl, bucket: BUCKET, storage_path: storagePath });
  } catch (e: any) {
    return json(500, { error: "unhandled_exception", details: e?.message || String(e) });
  }
}

export async function DELETE() {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) return json(400, { error: "auth_getUser_failed", details: userErr.message });
    if (!user) return json(401, { error: "unauthorized" });

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) return json(400, { error: "profiles_read_failed", details: profileErr.message });

    const currentUrl = String((profile as any)?.avatar_url || "").trim();
    const currentPath = extractPathFromSupabasePublicUrl(currentUrl);

    const { error: clearErr } = await admin
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", user.id);
    if (clearErr) return json(400, { error: "profiles_clear_avatar_failed", details: clearErr.message });

    if (currentPath) {
      await admin.storage.from(BUCKET).remove([currentPath]);
    }

    return json(200, { ok: true, avatar_url: null });
  } catch (e: any) {
    return json(500, { error: "unhandled_exception", details: e?.message || String(e) });
  }
}

