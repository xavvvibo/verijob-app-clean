type SupabaseLike = any;

const QA_CANDIDATE_RESET_EMAIL = "xavvvibo@gmail.com";
const CANDIDATE_AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "candidate-avatars";

function extractPathFromSupabasePublicUrl(urlRaw: unknown, bucket: string) {
  const url = String(urlRaw || "").trim();
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
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

function isMissingRelationError(error: any, relation: string) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes(relation.toLowerCase());
}

async function getTableColumns(admin: SupabaseLike, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (error || !Array.isArray(data)) return new Set<string>();
  return new Set(data.map((row: any) => String(row?.column_name || "")));
}

async function tableExists(admin: SupabaseLike, tableName: string) {
  const { data, error } = await admin
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName)
    .maybeSingle();
  return !error && Boolean(data?.table_name);
}

async function bestEffortDelete(builderPromise: Promise<any>, relationName: string) {
  const result = await builderPromise;
  if (result?.error && !isMissingRelationError(result.error, relationName)) {
    throw result.error;
  }
  return result;
}

async function bestEffortStorageRemove(admin: SupabaseLike, bucket: string, paths: string[]) {
  const clean = Array.from(new Set(paths.map((p) => String(p || "").trim()).filter(Boolean)));
  if (!clean.length) return 0;
  const { error } = await admin.storage.from(bucket).remove(clean);
  if (error && !String(error?.message || "").toLowerCase().includes("not found")) {
    throw error;
  }
  return clean.length;
}

async function deactivatePlanOverridesForQa(admin: SupabaseLike, userId: string, nowIso: string) {
  const payload = {
    is_active: false,
    metadata: {
      qa_reset: true,
      deactivated_at: nowIso,
      source: "self_service_qa_reset",
    },
  };
  const { error } = await admin.from("plan_overrides").update(payload).eq("user_id", userId).eq("is_active", true);
  if (error && !isMissingRelationError(error, "plan_overrides")) throw error;
}

async function resetLatestSubscriptionToFree(admin: SupabaseLike, userId: string, nowIso: string) {
  const columns = await getTableColumns(admin, "subscriptions");
  if (!columns.size) return false;
  const orderColumn = columns.has("updated_at") ? "updated_at" : columns.has("created_at") ? "created_at" : "id";

  const { data: latestSub, error: subReadErr } = await admin
    .from("subscriptions")
    .select("id,metadata")
    .eq("user_id", userId)
    .order(orderColumn, { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subReadErr && !isMissingRelationError(subReadErr, "subscriptions")) throw subReadErr;
  if (!latestSub?.id) return false;

  const patch: Record<string, any> = {
    plan: "free",
    status: "canceled",
    metadata: {
      ...(latestSub.metadata && typeof latestSub.metadata === "object" ? latestSub.metadata : {}),
      qa_reset: {
        at: nowIso,
        source: "self_service_qa_reset",
      },
    },
  };
  if (columns.has("current_period_end")) patch.current_period_end = nowIso;
  if (columns.has("cancel_at_period_end")) patch.cancel_at_period_end = false;

  const { error: subUpdateErr } = await admin.from("subscriptions").update(patch).eq("id", latestSub.id);
  if (subUpdateErr && !isMissingRelationError(subUpdateErr, "subscriptions")) throw subUpdateErr;
  return true;
}

export async function resetCandidateAccountForQa(args: {
  admin: SupabaseLike;
  userId: string;
  userEmail: string;
}) {
  const { admin, userId, userEmail } = args;
  if (String(userEmail || "").trim().toLowerCase() !== QA_CANDIDATE_RESET_EMAIL) {
    return {
      ok: false as const,
      error: "candidate_reset_forbidden",
      user_message: "Este reset de cuenta candidata de prueba no está disponible para este usuario.",
    };
  }

  const nowIso = new Date().toISOString();
  const profileColumns = await getTableColumns(admin, "profiles");
  const candidateProfileColumns = await getTableColumns(admin, "candidate_profiles");
  const [hasCvUploads, hasCvParseJobs, hasVerificationPublicLinks, hasExperiences] = await Promise.all([
    tableExists(admin, "cv_uploads"),
    tableExists(admin, "cv_parse_jobs"),
    tableExists(admin, "verification_public_links"),
    tableExists(admin, "experiences"),
  ]);

  const { data: profileRow, error: profileReadErr } = await admin
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (profileReadErr && !isMissingRelationError(profileReadErr, "profiles")) throw profileReadErr;

  const avatarPath = extractPathFromSupabasePublicUrl((profileRow as any)?.avatar_url, CANDIDATE_AVATAR_BUCKET);

  const evidenceStoragePaths: string[] = [];
  const cvStorageByBucket = new Map<string, string[]>();

  const { data: employmentRows, error: employmentErr } = await admin
    .from("employment_records")
    .select("id")
    .eq("candidate_id", userId);
  if (employmentErr && !isMissingRelationError(employmentErr, "employment_records")) throw employmentErr;
  const employmentIds = Array.from(new Set((Array.isArray(employmentRows) ? employmentRows : []).map((row: any) => String(row?.id || "")).filter(Boolean)));

  const verificationIdSet = new Set<string>();
  const verificationReadOps: Promise<any>[] = [
    admin.from("verification_requests").select("id").eq("requested_by", userId),
  ];
  if (employmentIds.length) {
    verificationReadOps.push(admin.from("verification_requests").select("id").in("employment_record_id", employmentIds));
  }
  for (const op of verificationReadOps) {
    const { data, error } = await op;
    if (error && !isMissingRelationError(error, "verification_requests")) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const id = String((row as any)?.id || "");
      if (id) verificationIdSet.add(id);
    }
  }
  const verificationIds = Array.from(verificationIdSet);

  if (await tableExists(admin, "evidences")) {
    const { data: evidenceRows, error: evidenceReadErr } = await admin
      .from("evidences")
      .select("storage_path")
      .eq("uploaded_by", userId);
    if (evidenceReadErr && !isMissingRelationError(evidenceReadErr, "evidences")) throw evidenceReadErr;
    for (const row of Array.isArray(evidenceRows) ? evidenceRows : []) {
      const path = String((row as any)?.storage_path || "").trim();
      if (path) evidenceStoragePaths.push(path);
    }
    if (verificationIds.length) {
      await bestEffortDelete(admin.from("evidences").delete().in("verification_request_id", verificationIds), "evidences");
    }
    await bestEffortDelete(admin.from("evidences").delete().eq("uploaded_by", userId), "evidences");
  }

  if (await tableExists(admin, "candidate_public_links")) {
    await bestEffortDelete(admin.from("candidate_public_links").delete().eq("candidate_id", userId), "candidate_public_links");
  }

  if (hasVerificationPublicLinks && verificationIds.length) {
    await bestEffortDelete(admin.from("verification_public_links").delete().in("verification_id", verificationIds), "verification_public_links");
  }

  if (await tableExists(admin, "profile_view_consumptions")) {
    await bestEffortDelete(admin.from("profile_view_consumptions").delete().eq("candidate_id", userId), "profile_view_consumptions");
  }

  if (hasCvUploads) {
    const { data: cvUploads, error: cvUploadsErr } = await admin
      .from("cv_uploads")
      .select("id,storage_bucket,storage_path")
      .eq("user_id", userId);
    if (cvUploadsErr && !isMissingRelationError(cvUploadsErr, "cv_uploads")) throw cvUploadsErr;
    const cvUploadIds = (Array.isArray(cvUploads) ? cvUploads : [])
      .map((row: any) => String(row?.id || ""))
      .filter(Boolean);
    for (const row of Array.isArray(cvUploads) ? cvUploads : []) {
      const bucket = String((row as any)?.storage_bucket || "candidate-cv").trim();
      const storagePath = String((row as any)?.storage_path || "").trim();
      if (!storagePath) continue;
      const bucketPaths = cvStorageByBucket.get(bucket) || [];
      bucketPaths.push(storagePath);
      cvStorageByBucket.set(bucket, bucketPaths);
    }
    if (hasCvParseJobs && cvUploadIds.length) {
      await bestEffortDelete(admin.from("cv_parse_jobs").delete().in("cv_upload_id", cvUploadIds), "cv_parse_jobs");
    } else if (hasCvParseJobs) {
      await bestEffortDelete(admin.from("cv_parse_jobs").delete().eq("user_id", userId), "cv_parse_jobs");
    }
    if (cvUploadIds.length) {
      await bestEffortDelete(admin.from("cv_uploads").delete().in("id", cvUploadIds), "cv_uploads");
    }
  } else if (hasCvParseJobs) {
    await bestEffortDelete(admin.from("cv_parse_jobs").delete().eq("user_id", userId), "cv_parse_jobs");
  }

  if (verificationIds.length) {
    await bestEffortDelete(admin.from("verification_requests").delete().in("id", verificationIds), "verification_requests");
  }
  if (employmentIds.length) {
    await bestEffortDelete(admin.from("employment_records").delete().in("id", employmentIds), "employment_records");
  }
  await bestEffortDelete(admin.from("profile_experiences").delete().eq("user_id", userId), "profile_experiences");
  if (hasExperiences) {
    await bestEffortDelete(admin.from("experiences").delete().eq("user_id", userId), "experiences");
  }

  if (candidateProfileColumns.size) {
    const candidatePatch: Record<string, any> = {};
    const nullFields = [
      "summary",
      "work_zones",
      "job_search_status",
      "availability_start",
      "preferred_workday",
      "raw_cv_json",
      "trust_score",
      "trust_score_breakdown",
      "other_achievements",
      "headline",
      "location",
      "phone",
      "portfolio_url",
      "linkedin_url",
      "website_url",
    ];
    const emptyArrayFields = [
      "education",
      "achievements",
      "certifications",
      "preferred_roles",
      "availability_schedule",
    ];
    const falseFields = [
      "allow_company_email_contact",
      "allow_company_phone_contact",
      "show_trust_score",
      "show_verification_counts",
      "show_verified_timeline",
    ];
    for (const field of nullFields) {
      if (candidateProfileColumns.has(field)) candidatePatch[field] = null;
    }
    for (const field of emptyArrayFields) {
      if (candidateProfileColumns.has(field)) candidatePatch[field] = [];
    }
    for (const field of falseFields) {
      if (candidateProfileColumns.has(field)) candidatePatch[field] = false;
    }
    if (candidateProfileColumns.has("updated_at")) candidatePatch.updated_at = nowIso;

    const { error: candidateProfileUpdateErr } = await admin.from("candidate_profiles").update(candidatePatch).eq("user_id", userId);
    if (candidateProfileUpdateErr && !isMissingRelationError(candidateProfileUpdateErr, "candidate_profiles")) throw candidateProfileUpdateErr;
  }

  await deactivatePlanOverridesForQa(admin, userId, nowIso);
  const subscriptionReset = await resetLatestSubscriptionToFree(admin, userId, nowIso);

  const profilePatch: Record<string, any> = {
    onboarding_completed: false,
    active_company_id: null,
  };
  if (profileColumns.has("onboarding_step")) profilePatch.onboarding_step = "cv";
  if (profileColumns.has("lifecycle_status")) profilePatch.lifecycle_status = "active";
  if (profileColumns.has("deleted_at")) profilePatch.deleted_at = null;
  if (profileColumns.has("deletion_requested_at")) profilePatch.deletion_requested_at = null;
  if (profileColumns.has("deletion_mode")) profilePatch.deletion_mode = null;
  if (profileColumns.has("full_name")) profilePatch.full_name = null;
  if (profileColumns.has("phone")) profilePatch.phone = null;
  if (profileColumns.has("title")) profilePatch.title = null;
  if (profileColumns.has("location")) profilePatch.location = null;
  if (profileColumns.has("address_line1")) profilePatch.address_line1 = null;
  if (profileColumns.has("address_line2")) profilePatch.address_line2 = null;
  if (profileColumns.has("city")) profilePatch.city = null;
  if (profileColumns.has("region")) profilePatch.region = null;
  if (profileColumns.has("postal_code")) profilePatch.postal_code = null;
  if (profileColumns.has("country")) profilePatch.country = null;
  if (profileColumns.has("identity_type")) profilePatch.identity_type = null;
  if (profileColumns.has("identity_masked")) profilePatch.identity_masked = null;
  if (profileColumns.has("identity_hash")) profilePatch.identity_hash = null;
  if (profileColumns.has("avatar_url")) profilePatch.avatar_url = null;
  if (profileColumns.has("languages")) profilePatch.languages = [];
  if (profileColumns.has("cv_consistency_score")) profilePatch.cv_consistency_score = 0;
  if (profileColumns.has("profile_visibility")) profilePatch.profile_visibility = "private";
  if (profileColumns.has("show_personal")) profilePatch.show_personal = true;
  if (profileColumns.has("show_experience")) profilePatch.show_experience = true;
  if (profileColumns.has("show_education")) profilePatch.show_education = true;
  if (profileColumns.has("show_achievements")) profilePatch.show_achievements = true;

  const { error: profileUpdateErr } = await admin.from("profiles").update(profilePatch).eq("id", userId);
  if (profileUpdateErr) throw profileUpdateErr;

  if (avatarPath) {
    await bestEffortStorageRemove(admin, CANDIDATE_AVATAR_BUCKET, [avatarPath]);
  }
  if (evidenceStoragePaths.length) {
    await bestEffortStorageRemove(admin, "evidence", evidenceStoragePaths);
  }
  for (const [bucket, paths] of cvStorageByBucket.entries()) {
    await bestEffortStorageRemove(admin, bucket, paths);
  }

  const trustResult = await import("@/server/trustScore/calculateTrustScore").then((mod) =>
    mod.recalculateAndPersistCandidateTrustScore(userId),
  );

  const [postProfileRes, postCandidateProfileRes, postExperiencesRes, postEvidencesRes] = await Promise.all([
    admin.from("profiles").select("avatar_url,onboarding_completed").eq("id", userId).maybeSingle(),
    admin
      .from("candidate_profiles")
      .select("education,other_achievements,certifications,trust_score")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("profile_experiences").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin.from("evidences").select("id", { count: "exact", head: true }).eq("uploaded_by", userId),
  ]);

  const postCandidateProfile = postCandidateProfileRes.data || {};
  const educationCount = Array.isArray((postCandidateProfile as any)?.education) ? (postCandidateProfile as any).education.length : 0;
  const achievementsRaw = Array.isArray((postCandidateProfile as any)?.other_achievements) ? (postCandidateProfile as any).other_achievements : [];
  const certificationsRaw = Array.isArray((postCandidateProfile as any)?.certifications) ? (postCandidateProfile as any).certifications : [];
  const achievementsCount = achievementsRaw.length + certificationsRaw.length;

  try {
    await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
  } catch {}

  return {
    ok: true as const,
    cleaned: {
      avatar_deleted: Boolean(avatarPath),
      cv_uploads_deleted: Array.from(cvStorageByBucket.values()).reduce((acc, rows) => acc + rows.length, 0),
      evidences_deleted: evidenceStoragePaths.length,
      profile_experiences_deleted: true,
      employment_records_deleted: employmentIds.length,
      verification_requests_deleted: verificationIds.length,
      candidate_profile_cleared: Boolean(candidateProfileColumns.size),
      public_links_deleted: true,
      subscription_reset: subscriptionReset,
      trust_score_recalculated: true,
      trust_score: trustResult.score,
    },
    validation: {
      experience_count: Number(postExperiencesRes.count || 0),
      education_count: educationCount,
      achievements_count: achievementsCount,
      avatar_url: (postProfileRes.data as any)?.avatar_url || null,
      evidences_count: Number(postEvidencesRes.count || 0),
      onboarding_completed: Boolean((postProfileRes.data as any)?.onboarding_completed),
      trust_score: Number((postCandidateProfile as any)?.trust_score ?? trustResult.score ?? 0),
    },
  };
}

export async function resetCompanyWorkspaceForQa(args: {
  admin: SupabaseLike;
  userId: string;
  companyId: string;
}) {
  const { admin, userId, companyId } = args;
  const nowIso = new Date().toISOString();
  const [profileColumns, companyColumns] = await Promise.all([
    getTableColumns(admin, "profiles"),
    getTableColumns(admin, "companies"),
  ]);

  const { count: membersCount, error: membersCountErr } = await admin
    .from("company_members")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (membersCountErr && !isMissingRelationError(membersCountErr, "company_members")) throw membersCountErr;
  if ((membersCount || 0) > 1) {
    return {
      ok: false as const,
      error: "company_reset_multiple_members",
      user_message: "No se puede resetear esta empresa porque todavía tiene más de una persona asociada.",
    };
  }

  if (await tableExists(admin, "company_candidate_import_invites")) {
    await bestEffortDelete(admin.from("company_candidate_import_invites").delete().eq("company_id", companyId), "company_candidate_import_invites");
  }

  if (await tableExists(admin, "company_verification_documents")) {
    await bestEffortDelete(admin.from("company_verification_documents").delete().eq("company_id", companyId), "company_verification_documents");
  }

  if (await tableExists(admin, "company_profiles")) {
    await bestEffortDelete(admin.from("company_profiles").delete().eq("company_id", companyId), "company_profiles");
  }

  if (await tableExists(admin, "profile_view_consumptions")) {
    await bestEffortDelete(admin.from("profile_view_consumptions").delete().eq("company_id", companyId), "profile_view_consumptions");
  }

  if (await tableExists(admin, "credit_grants")) {
    const { data: grants, error: grantsReadErr } = await admin
      .from("credit_grants")
      .select("id,metadata,user_id")
      .eq("user_id", userId);
    if (grantsReadErr && !isMissingRelationError(grantsReadErr, "credit_grants")) throw grantsReadErr;
    const grantIds = (Array.isArray(grants) ? grants : [])
      .filter((row: any) => String(row?.metadata?.company_id || "").trim() === companyId)
      .map((row: any) => String(row?.id || ""))
      .filter(Boolean);
    if (grantIds.length) {
      await bestEffortDelete(admin.from("credit_grants").delete().in("id", grantIds), "credit_grants");
    }
  }

  await deactivatePlanOverridesForQa(admin, userId, nowIso);
  const subscriptionReset = await resetLatestSubscriptionToFree(admin, userId, nowIso);

  const profilePatch: Record<string, any> = {
    active_company_id: null,
    onboarding_completed: false,
  };
  if (profileColumns.has("lifecycle_status")) profilePatch.lifecycle_status = "active";
  if (profileColumns.has("deleted_at")) profilePatch.deleted_at = null;
  if (profileColumns.has("deletion_requested_at")) profilePatch.deletion_requested_at = null;
  if (profileColumns.has("deletion_mode")) profilePatch.deletion_mode = null;
  const { error: profileUpdateErr } = await admin.from("profiles").update(profilePatch).eq("id", userId);
  if (profileUpdateErr) throw profileUpdateErr;

  await bestEffortDelete(admin.from("company_members").delete().eq("company_id", companyId), "company_members");

  const companyPatch: Record<string, any> = {};
  if (companyColumns.has("lifecycle_status")) companyPatch.lifecycle_status = "deleted";
  if (companyColumns.has("deletion_requested_at")) companyPatch.deletion_requested_at = nowIso;
  if (companyColumns.has("deleted_at")) companyPatch.deleted_at = nowIso;
  if (companyColumns.has("identity_type")) companyPatch.identity_type = null;
  if (companyColumns.has("identity_masked")) companyPatch.identity_masked = null;
  if (companyColumns.has("identity_hash")) companyPatch.identity_hash = null;
  if (Object.keys(companyPatch).length) {
    const { error: companyUpdateErr } = await admin.from("companies").update(companyPatch).eq("id", companyId);
    if (companyUpdateErr && !isMissingRelationError(companyUpdateErr, "companies")) throw companyUpdateErr;
  }

  return {
    ok: true as const,
    cleaned: {
      company_members_deleted: membersCount || 0,
      company_profile_deleted: true,
      company_documents_deleted: true,
      candidate_import_invites_deleted: true,
      profile_view_consumptions_deleted: true,
      subscription_reset: subscriptionReset,
    },
  };
}
