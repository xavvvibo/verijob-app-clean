import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  buildExperienceVisibilityKey,
  mergeCandidateRawConfig,
  readPublicProfileSettings,
} from "@/lib/candidate/profile-visibility";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function getTableColumns(admin: any, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (!error && Array.isArray(data) && data.length > 0) {
    return new Set(data.map((row: any) => String(row?.column_name || "")));
  }
  return new Set<string>();
}

export async function POST(req: Request) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => ({}));
  const experienceId = String(body?.experienceId || "").trim();
  if (!experienceId) return json(400, { error: "missing_experience_id" });

  const visible = body?.visible !== false;
  const featured = body?.featured === true;
  const key = buildExperienceVisibilityKey({ profileExperienceId: experienceId });
  if (!key) return json(400, { error: "invalid_experience_key" });

  const admin = createServiceRoleClient();
  const [{ data: candidateProfile }, profileExperienceColumns] = await Promise.all([
    admin.from("candidate_profiles").select("id,user_id,raw_cv_json").eq("user_id", user.id).maybeSingle(),
    getTableColumns(admin, "profile_experiences"),
  ]);

  if (!candidateProfile?.id) return json(404, { error: "candidate_profile_not_found" });

  const currentSettings = readPublicProfileSettings(candidateProfile);
  const nextSettings = {
    experiences: {
      ...currentSettings.experiences,
      [key]: {
        visible,
        featured: featured && visible,
      },
    },
  };

  const rawCvJson = mergeCandidateRawConfig(candidateProfile, {
    public_profile_settings: nextSettings,
  });

  const updateProfile = await admin
    .from("candidate_profiles")
    .update({ raw_cv_json: rawCvJson })
    .eq("id", candidateProfile.id)
    .eq("user_id", user.id)
    .select("id,raw_cv_json")
    .single();

  if (updateProfile.error) {
    return json(400, { error: "candidate_visibility_update_failed", details: updateProfile.error.message });
  }

  if (profileExperienceColumns.has("visible") || profileExperienceColumns.has("featured")) {
    const patch: Record<string, any> = {};
    if (profileExperienceColumns.has("visible")) patch.visible = visible;
    if (profileExperienceColumns.has("featured")) patch.featured = featured && visible;
    if (Object.keys(patch).length > 0) {
      await admin.from("profile_experiences").update(patch).eq("id", experienceId).eq("user_id", user.id);
    }
  }

  return json(200, {
    success: true,
    experienceId,
    visible,
    featured: featured && visible,
    settings: nextSettings,
  });
}
