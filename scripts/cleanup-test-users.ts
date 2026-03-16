import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "javier@verijob.es";
const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "candidate-avatars";
const CHUNK_SIZE = 200;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return String(value).trim();
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function log(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(message, meta);
    return;
  }
  console.log(message);
}

function asText(value: unknown) {
  return String(value || "").trim();
}

function isMissingRelationError(error: any, relation: string) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes(relation.toLowerCase());
}

function chunk<T>(items: T[], size = CHUNK_SIZE) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function tableExists(tableName: string) {
  const { data, error } = await supabase
    .from("information_schema.tables")
    .select("table_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName)
    .maybeSingle();
  return !error && Boolean(data?.table_name);
}

async function getTableColumns(tableName: string) {
  const { data, error } = await supabase
    .from("information_schema.columns")
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", tableName);
  if (error || !Array.isArray(data)) return new Set<string>();
  return new Set(data.map((row: any) => String(row?.column_name || "")));
}

async function deleteByEq(tableName: string, column: string, value: string) {
  if (!(await tableExists(tableName))) return 0;
  const { error } = await supabase.from(tableName).delete().eq(column, value);
  if (error && !isMissingRelationError(error, tableName)) throw error;
  return error ? 0 : 1;
}

async function deleteByIn(tableName: string, column: string, values: string[]) {
  if (!values.length) return 0;
  if (!(await tableExists(tableName))) return 0;
  let total = 0;
  for (const group of chunk(Array.from(new Set(values)))) {
    const { error } = await supabase.from(tableName).delete().in(column, group);
    if (error && !isMissingRelationError(error, tableName)) throw error;
    if (!error) total += group.length;
  }
  return total;
}

async function selectIds(tableName: string, idColumn: string, filters: Array<{ column: string; op: "eq" | "in"; value: string | string[] }>) {
  if (!(await tableExists(tableName))) return [] as string[];
  let query = supabase.from(tableName).select(idColumn);
  for (const filter of filters) {
    query = filter.op === "eq"
      ? query.eq(filter.column, filter.value as string)
      : query.in(filter.column, filter.value as string[]);
  }
  const { data, error } = await query;
  if (error && !isMissingRelationError(error, tableName)) throw error;
  return Array.from(new Set((Array.isArray(data) ? data : []).map((row: any) => asText(row?.[idColumn])).filter(Boolean)));
}

function extractPathFromSupabasePublicUrl(urlRaw: unknown, bucket: string) {
  const url = asText(urlRaw);
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

async function removeStoragePaths(bucket: string, paths: string[]) {
  const clean = Array.from(new Set(paths.map(asText).filter(Boolean)));
  if (!clean.length) return 0;
  const { error } = await supabase.storage.from(bucket).remove(clean);
  if (error && !String(error?.message || "").toLowerCase().includes("not found")) {
    throw error;
  }
  return clean.length;
}

async function listAllUsers() {
  const users: Array<{ id: string; email: string | null }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const batch = Array.isArray(data?.users) ? data.users : [];
    for (const user of batch as any[]) {
      users.push({
        id: asText(user?.id),
        email: user?.email ? asText(user.email).toLowerCase() : null,
      });
    }
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
}

async function resolveOwnerId() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", OWNER_EMAIL)
    .maybeSingle();
  if (error) throw error;
  const ownerId = asText((data as any)?.id);
  if (!ownerId) {
    throw new Error(`Owner profile not found for ${OWNER_EMAIL}`);
  }
  return ownerId;
}

async function getProfilesByIds(userIds: string[]) {
  if (!userIds.length) return [] as any[];
  const rows: any[] = [];
  for (const group of chunk(userIds)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,role,active_company_id,avatar_url")
      .in("id", group);
    if (error && !isMissingRelationError(error, "profiles")) throw error;
    rows.push(...(Array.isArray(data) ? data : []));
  }
  return rows;
}

async function cleanupStorageForUsers(userIds: string[]) {
  const removed = {
    avatars: 0,
    evidences: 0,
    cvs: 0,
  };

  if (await tableExists("profiles")) {
    const profiles = await getProfilesByIds(userIds);
    const avatarPaths = profiles
      .map((row) => extractPathFromSupabasePublicUrl(row?.avatar_url, AVATAR_BUCKET))
      .filter(Boolean) as string[];
    removed.avatars = await removeStoragePaths(AVATAR_BUCKET, avatarPaths);
  }

  if (await tableExists("evidences")) {
    const evidencePaths: string[] = [];
    for (const group of chunk(userIds)) {
      const { data, error } = await supabase
        .from("evidences")
        .select("storage_path")
        .in("uploaded_by", group);
      if (error && !isMissingRelationError(error, "evidences")) throw error;
      for (const row of Array.isArray(data) ? data : []) {
        const path = asText((row as any)?.storage_path);
        if (path) evidencePaths.push(path);
      }
    }
    removed.evidences = await removeStoragePaths("evidence", evidencePaths);
  }

  if (await tableExists("cv_uploads")) {
    const cvPathsByBucket = new Map<string, string[]>();
    for (const group of chunk(userIds)) {
      const { data, error } = await supabase
        .from("cv_uploads")
        .select("storage_bucket,storage_path")
        .in("user_id", group);
      if (error && !isMissingRelationError(error, "cv_uploads")) throw error;
      for (const row of Array.isArray(data) ? data : []) {
        const bucket = asText((row as any)?.storage_bucket) || "candidate-cv";
        const path = asText((row as any)?.storage_path);
        if (!path) continue;
        const current = cvPathsByBucket.get(bucket) || [];
        current.push(path);
        cvPathsByBucket.set(bucket, current);
      }
    }
    for (const [bucket, paths] of cvPathsByBucket.entries()) {
      removed.cvs += await removeStoragePaths(bucket, paths);
    }
  }

  return removed;
}

async function cleanupUsers() {
  const ownerId = await resolveOwnerId();
  const authUsers = await listAllUsers();
  const usersToDelete = authUsers.filter((user) => user.id && user.id !== ownerId);
  const userIds = usersToDelete.map((user) => user.id);

  log(`Owner preserved: ${OWNER_EMAIL}`, { ownerId });
  log(`Users scheduled for deletion: ${usersToDelete.length}`);

  if (!usersToDelete.length) {
    log("No users to delete.");
    return;
  }

  const profileRows = await getProfilesByIds(userIds);
  const profileById = new Map(profileRows.map((row) => [asText(row.id), row]));

  const companyMembershipRows = (await Promise.all(
    chunk(userIds).map(async (group) => {
      if (!(await tableExists("company_members"))) return [] as any[];
      const { data, error } = await supabase
        .from("company_members")
        .select("company_id,user_id")
        .in("user_id", group);
      if (error && !isMissingRelationError(error, "company_members")) throw error;
      return Array.isArray(data) ? data : [];
    })
  )).flat();

  const companyIds = Array.from(
    new Set(
      [
        ...profileRows.map((row) => asText(row?.active_company_id)),
        ...companyMembershipRows.map((row: any) => asText(row?.company_id)),
      ].filter(Boolean)
    )
  );

  const employmentIds = await selectIds("employment_records", "id", [{ column: "candidate_id", op: "in", value: userIds }]);

  const verificationIds = Array.from(
    new Set([
      ...(await selectIds("verification_requests", "id", [{ column: "requested_by", op: "in", value: userIds }])),
      ...(employmentIds.length
        ? await selectIds("verification_requests", "id", [{ column: "employment_record_id", op: "in", value: employmentIds }])
        : []),
      ...(companyIds.length
        ? await selectIds("verification_requests", "id", [{ column: "company_id", op: "in", value: companyIds }])
        : []),
    ])
  );

  const cvUploadIds = await selectIds("cv_uploads", "id", [{ column: "user_id", op: "in", value: userIds }]);

  const storageRemoved = await cleanupStorageForUsers(userIds);

  if (cvUploadIds.length && (await tableExists("cv_parse_jobs"))) {
    await deleteByIn("cv_parse_jobs", "cv_upload_id", cvUploadIds);
  }
  if (await tableExists("cv_parse_jobs")) {
    await deleteByIn("cv_parse_jobs", "user_id", userIds);
  }

  if (verificationIds.length && (await tableExists("verification_public_links"))) {
    await deleteByIn("verification_public_links", "verification_id", verificationIds);
  }

  if (await tableExists("evidences")) {
    if (verificationIds.length) await deleteByIn("evidences", "verification_request_id", verificationIds);
    await deleteByIn("evidences", "uploaded_by", userIds);
  }

  if (await tableExists("candidate_public_links")) {
    await deleteByIn("candidate_public_links", "candidate_id", userIds);
  }

  if (await tableExists("profile_view_consumptions")) {
    await deleteByIn("profile_view_consumptions", "candidate_id", userIds);
    await deleteByIn("profile_view_consumptions", "viewer_user_id", userIds);
    if (companyIds.length) await deleteByIn("profile_view_consumptions", "company_id", companyIds);
  }

  if (await tableExists("company_candidate_import_invites")) {
    await deleteByIn("company_candidate_import_invites", "invited_by_user_id", userIds);
    await deleteByIn("company_candidate_import_invites", "linked_user_id", userIds);
    if (companyIds.length) await deleteByIn("company_candidate_import_invites", "company_id", companyIds);
  }

  if (await tableExists("company_team_invitations")) {
    await deleteByIn("company_team_invitations", "invited_by_user_id", userIds);
    await deleteByIn("company_team_invitations", "accepted_by_user_id", userIds);
    if (companyIds.length) await deleteByIn("company_team_invitations", "company_id", companyIds);
  }

  if (verificationIds.length) {
    await deleteByIn("verification_requests", "id", verificationIds);
  }

  if (employmentIds.length) {
    await deleteByIn("employment_records", "id", employmentIds);
  }

  await deleteByIn("profile_experiences", "user_id", userIds);
  await deleteByIn("experiences", "user_id", userIds);
  await deleteByIn("candidate_profiles", "user_id", userIds);
  await deleteByIn("cv_uploads", "id", cvUploadIds);

  await deleteByIn("plan_overrides", "user_id", userIds);
  await deleteByIn("manual_grants", "user_id", userIds);
  await deleteByIn("promo_code_redemptions", "user_id", userIds);
  await deleteByIn("owner_actions", "target_user_id", userIds);
  await deleteByIn("owner_actions", "owner_user_id", userIds);

  if (await tableExists("credit_grants")) {
    await deleteByIn("credit_grants", "user_id", userIds);
    const { data, error } = await supabase.from("credit_grants").select("id,metadata");
    if (error && !isMissingRelationError(error, "credit_grants")) throw error;
    const companyGrantIds = (Array.isArray(data) ? data : [])
      .filter((row: any) => companyIds.includes(asText(row?.metadata?.company_id)))
      .map((row: any) => asText(row?.id))
      .filter(Boolean);
    if (companyGrantIds.length) await deleteByIn("credit_grants", "id", companyGrantIds);
  }

  if (await tableExists("stripe_oneoff_purchases")) {
    await deleteByIn("stripe_oneoff_purchases", "buyer_user_id", userIds);
    if (companyIds.length) await deleteByIn("stripe_oneoff_purchases", "company_id", companyIds);
  }

  if (await tableExists("subscriptions")) {
    const subscriptionColumns = await getTableColumns("subscriptions");
    await deleteByIn("subscriptions", "user_id", userIds);
    if (subscriptionColumns.has("company_id") && companyIds.length) {
      await deleteByIn("subscriptions", "company_id", companyIds);
    }
  }

  await deleteByIn("company_memberships", "user_id", userIds);
  await deleteByIn("company_members", "user_id", userIds);

  if (await tableExists("company_verification_documents") && companyIds.length) {
    await deleteByIn("company_verification_documents", "company_id", companyIds);
  }
  if (await tableExists("company_profiles") && companyIds.length) {
    await deleteByIn("company_profiles", "company_id", companyIds);
  }

  if (companyIds.length && (await tableExists("companies"))) {
    for (const companyId of companyIds) {
      let remainingMembers = 0;
      if (await tableExists("company_members")) {
        const { count, error } = await supabase
          .from("company_members")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId);
        if (error && !isMissingRelationError(error, "company_members")) throw error;
        remainingMembers = Number(count || 0);
      }
      if (remainingMembers > 0) {
        log(`Skipping company delete because members remain`, { companyId, remainingMembers });
        continue;
      }
      const { error } = await supabase.from("companies").delete().eq("id", companyId);
      if (error && !isMissingRelationError(error, "companies")) throw error;
    }
  }

  await deleteByIn("profiles", "id", userIds);

  for (const user of usersToDelete) {
    const email = user.email || profileById.get(user.id)?.email || user.id;
    try {
      log(`Deleting user: ${email}`);
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw error;
      log(`Deleted successfully: ${email}`);
    } catch (error: any) {
      log(`Error deleting: ${email}`, { error: error?.message || String(error) });
    }
  }

  log("Cleanup finished.", {
    ownerKept: OWNER_EMAIL,
    deletedUsers: usersToDelete.length,
    companiesTouched: companyIds.length,
    storageRemoved,
  });
}

cleanupUsers().catch((error) => {
  console.error("cleanup:test-users failed", error);
  process.exitCode = 1;
});
