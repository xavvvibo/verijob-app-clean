import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

const ROUTE_VERSION = "company-profile-v1";

type CompanyProfileRow = {
  [k: string]: any;
  company_id: string;
  legal_name?: string | null;
  trade_name?: string | null;
  tax_id?: string | null;
  company_type?: string | null;
  founding_year?: number | null;
  website_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_person_name?: string | null;
  contact_person_role?: string | null;
  country?: string | null;
  region?: string | null;
  province?: string | null;
  city?: string | null;
  postal_code?: string | null;
  fiscal_address?: string | null;
  operating_address?: string | null;
  sector?: string | null;
  subsector?: string | null;
  business_description?: string | null;
  primary_activity?: string | null;
  business_model?: string | null;
  seasonal_business?: boolean | null;
  employee_count_range?: string | null;
  locations_count?: number | null;
  annual_hiring_volume_range?: string | null;
  has_internal_hr?: boolean | null;
  common_roles_hired?: string[] | null;
  common_contract_types?: string[] | null;
  common_workday_types?: string[] | null;
  common_languages_required?: string[] | null;
  hiring_zones?: string[] | null;
  company_verification_status?: string | null;
  verification_document_type?: string | null;
  verification_document_storage_path?: string | null;
  verification_document_uploaded_at?: string | null;
  verification_reviewed_at?: string | null;
  verification_notes?: string | null;
  lead_source?: string | null;
  crm_tags?: string[] | null;
  market_segment?: string | null;
  profile_completeness_score?: number | null;
  onboarding_completed_at?: string | null;
  updated_at?: string | null;
};

type CompanyVerificationDocumentRow = {
  id: string;
  company_id: string;
  document_type: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  original_filename: string | null;
  review_status: string | null;
  rejected_reason: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string | null;
};

const ARRAY_FIELDS = new Set([
  "common_roles_hired",
  "common_contract_types",
  "common_workday_types",
  "common_languages_required",
  "hiring_zones",
  "crm_tags",
]);

const BOOLEAN_FIELDS = new Set(["seasonal_business", "has_internal_hr"]);

const NUMBER_FIELDS = new Set(["founding_year", "locations_count", "profile_completeness_score"]);

const ALLOWED_PATCH_FIELDS = [
  "legal_name",
  "trade_name",
  "tax_id",
  "company_type",
  "founding_year",
  "website_url",
  "contact_email",
  "contact_phone",
  "contact_person_name",
  "contact_person_role",
  "country",
  "region",
  "province",
  "city",
  "postal_code",
  "fiscal_address",
  "operating_address",
  "sector",
  "subsector",
  "business_description",
  "primary_activity",
  "business_model",
  "seasonal_business",
  "employee_count_range",
  "locations_count",
  "annual_hiring_volume_range",
  "has_internal_hr",
  "common_roles_hired",
  "common_contract_types",
  "common_workday_types",
  "common_languages_required",
  "hiring_zones",
  "company_verification_status",
  "verification_document_type",
  "verification_document_storage_path",
  "verification_document_uploaded_at",
  "verification_reviewed_at",
  "verification_notes",
  "lead_source",
  "crm_tags",
  "market_segment",
  "onboarding_completed_at",
] as const;

function asTrimmedText(value: unknown) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 100);
}

function isUuid(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function makeFallbackCompanyName(emailRaw: unknown) {
  const email = String(emailRaw || "").trim().toLowerCase();
  const local = email.split("@")[0] || "empresa";
  return `Empresa ${local.slice(0, 40)}`;
}

function normalizeVerificationStatus(value: unknown) {
  const v = String(value || "").toLowerCase();
  if (v === "verified_document") return "verified_document";
  if (v === "verified_paid") return "verified_paid";
  return "unverified";
}

function normalizeDocumentReviewStatus(value: unknown) {
  const v = String(value || "").toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "pending_review";
}

function deriveCompanyVerificationReviewStatus(profileStatus: unknown, docs: CompanyVerificationDocumentRow[]) {
  const baseStatus = normalizeVerificationStatus(profileStatus);
  if (baseStatus === "verified_paid" || baseStatus === "verified_document") return "verified";
  if (!Array.isArray(docs) || docs.length === 0) return "unverified";

  const hasPending = docs.some((d) => normalizeDocumentReviewStatus(d.review_status) === "pending_review");
  if (hasPending) return "pending_review";

  const hasApproved = docs.some((d) => normalizeDocumentReviewStatus(d.review_status) === "approved");
  if (hasApproved) return "verified";

  const hasRejected = docs.some((d) => normalizeDocumentReviewStatus(d.review_status) === "rejected");
  if (hasRejected) return "rejected";

  return "unverified";
}

function isRelationMissingError(error: any, relationName: string) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (msg.includes(`relation`) && msg.includes(relationName.toLowerCase())) ||
    (msg.includes("could not find the table") && msg.includes(relationName.toLowerCase()))
  );
}

function isDocsSchemaDriftError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42703" || // undefined_column
    msg.includes("column") && msg.includes("does not exist")
  );
}

function computeCompleteness(profile: Partial<CompanyProfileRow>) {
  const checks: boolean[] = [
    !!asTrimmedText(profile.legal_name),
    !!asTrimmedText(profile.trade_name),
    !!asTrimmedText(profile.tax_id),
    !!asTrimmedText(profile.website_url),
    !!asTrimmedText(profile.contact_email),
    !!asTrimmedText(profile.contact_phone),
    !!asTrimmedText(profile.contact_person_name),
    !!asTrimmedText(profile.contact_person_role),
    !!asTrimmedText(profile.country),
    !!asTrimmedText(profile.province),
    !!asTrimmedText(profile.city),
    !!asTrimmedText(profile.fiscal_address),
    !!asTrimmedText(profile.sector),
    !!asTrimmedText(profile.subsector),
    !!asTrimmedText(profile.primary_activity),
    !!asTrimmedText(profile.employee_count_range),
    !!asTrimmedText(profile.annual_hiring_volume_range),
    (profile.common_roles_hired || []).length > 0,
    (profile.common_contract_types || []).length > 0,
    (profile.common_workday_types || []).length > 0,
    (profile.common_languages_required || []).length > 0,
    (profile.hiring_zones || []).length > 0,
    !!asTrimmedText(profile.market_segment),
    !!asTrimmedText(profile.business_description),
    Boolean(profile.verification_document_type),
    Boolean(profile.verification_document_uploaded_at),
  ];

  const total = checks.length;
  const completed = checks.filter(Boolean).length;
  return Math.round((completed / total) * 100);
}

async function resolveContext(supabase: any, admin: any) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr) {
    return { error: NextResponse.json({ error: "auth_getUser_failed", details: userErr.message }, { status: 400 }) };
  }
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("active_company_id,role,onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    return { error: NextResponse.json({ error: "profiles_read_failed", details: profileErr.message }, { status: 400 }) };
  }

  const profileRole = String((profile as any)?.role || "").toLowerCase();
  const onboardingCompleted = Boolean((profile as any)?.onboarding_completed);

  const { data: latestMembership } = await admin
    .from("company_members")
    .select("company_id,role,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const activeCompanyIdRaw = (profile as any)?.active_company_id;
  const activeCompanyId = isUuid(activeCompanyIdRaw) ? String(activeCompanyIdRaw) : null;

  let companyId: string | null = null;
  let membershipRole = "reviewer";

  if (activeCompanyId) {
    const { data: activeMembership } = await admin
      .from("company_members")
      .select("role")
      .eq("company_id", activeCompanyId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (activeMembership) {
      companyId = activeCompanyId;
      membershipRole = String((activeMembership as any)?.role || "reviewer").toLowerCase();
    }
  }

  if (!companyId) {
    const membershipCompanyId = isUuid(latestMembership?.company_id) ? String(latestMembership?.company_id) : null;
    if (membershipCompanyId) {
      companyId = membershipCompanyId;
      membershipRole = String((latestMembership as any)?.role || "reviewer").toLowerCase();
      await admin.from("profiles").update({ active_company_id: companyId }).eq("id", user.id);
    }
  }

  if (!companyId && profileRole === "company") {
    const { data: createdCompany, error: createCompanyErr } = await admin
      .from("companies")
      .insert({ name: makeFallbackCompanyName(user.email) })
      .select("id")
      .single();
    if (createCompanyErr || !createdCompany?.id) {
      return {
        error: NextResponse.json(
          { error: "companies_create_failed", details: createCompanyErr?.message || null },
          { status: 400 }
        ),
      };
    }
    companyId = String(createdCompany.id);
    membershipRole = "admin";
    const { error: memberInsertErr } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: user.id,
      role: "admin",
    });
    if (memberInsertErr) {
      return {
        error: NextResponse.json(
          { error: "company_members_insert_failed", details: memberInsertErr.message },
          { status: 400 }
        ),
      };
    }
    await admin.from("profiles").update({ active_company_id: companyId, onboarding_completed: false }).eq("id", user.id);
  }

  if (!companyId) {
    return { error: NextResponse.json({ error: "no_active_company" }, { status: 400 }) };
  }

  const { data: companyRow } = await admin.from("companies").select("id").eq("id", companyId).maybeSingle();
  if (!companyRow?.id) {
    return { error: NextResponse.json({ error: "company_not_found" }, { status: 400 }) };
  }

  const { data: membership, error: membershipErr } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipErr) {
    return { error: NextResponse.json({ error: "company_members_read_failed", details: membershipErr.message }, { status: 400 }) };
  }
  if (!membership && profileRole === "company") {
    const { error: insertMembershipErr } = await admin.from("company_members").insert({
      company_id: companyId,
      user_id: user.id,
      role: "admin",
    });
    if (insertMembershipErr) {
      return {
        error: NextResponse.json(
          { error: "company_membership_repair_failed", details: insertMembershipErr.message },
          { status: 400 }
        ),
      };
    }
    membershipRole = "admin";
  } else if (!membership) {
    return { error: NextResponse.json({ error: "company_membership_required" }, { status: 403 }) };
  } else {
    membershipRole = String((membership as any)?.role || "reviewer").toLowerCase();
  }

  if (membershipRole !== "admin" && profileRole === "company" && !onboardingCompleted) {
    const { error: roleUpdateErr } = await admin
      .from("company_members")
      .update({ role: "admin" })
      .eq("company_id", companyId)
      .eq("user_id", user.id);
    if (!roleUpdateErr) membershipRole = "admin";
  }

  await admin
    .from("company_profiles")
    .upsert(
      {
        company_id: companyId,
        contact_email: user.email || null,
      },
      { onConflict: "company_id" }
    );

  return {
    user,
    companyId: String(companyId),
    membershipRole,
  };
}

async function getEffectiveVerificationStatus(supabase: any, userId: string, profileStatus: unknown) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status = String(sub?.status || "").toLowerCase();
  if (status === "active" || status === "trialing") return "verified_paid";
  return normalizeVerificationStatus(profileStatus);
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();
    const ctx = await resolveContext(supabase, admin);
    if ((ctx as any).error) return (ctx as any).error;

    const { user, companyId } = ctx as any;

    const { data, error } = await admin
      .from("company_profiles")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "company_profiles_read_failed", details: error.message, route_version: ROUTE_VERSION }, { status: 400 });
    }

    const baseProfile: CompanyProfileRow = data
      ? ({ ...data } as any)
      : ({
          company_id: companyId,
          common_roles_hired: [],
          common_contract_types: [],
          common_workday_types: [],
          common_languages_required: [],
          hiring_zones: [],
          crm_tags: [],
          company_verification_status: "unverified",
          seasonal_business: false,
          has_internal_hr: false,
        } as any);

    let verificationDocuments: CompanyVerificationDocumentRow[] = [];
    let verificationDocumentsWarning: string | null = null;
    const docsRes = await admin
      .from("company_verification_documents")
      .select("id,company_id,document_type,storage_bucket,storage_path,original_filename,review_status,rejected_reason,review_notes,reviewed_at,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (docsRes.error) {
      if (
        !isRelationMissingError(docsRes.error, "company_verification_documents") &&
        !isDocsSchemaDriftError(docsRes.error)
      ) {
        return NextResponse.json(
          { error: "company_verification_documents_read_failed", details: docsRes.error.message, route_version: ROUTE_VERSION },
          { status: 400 },
        );
      }
      verificationDocumentsWarning = "company_verification_documents_schema_drift";
    } else {
      verificationDocuments = Array.isArray(docsRes.data) ? (docsRes.data as any) : [];
    }

    const profileCompletenessScore = computeCompleteness(baseProfile);
    const effectiveVerificationStatus = await getEffectiveVerificationStatus(
      admin,
      user.id,
      baseProfile.company_verification_status
    );
    const reviewStatus = deriveCompanyVerificationReviewStatus(effectiveVerificationStatus, verificationDocuments);
    const latestRejected = verificationDocuments.find((d) => normalizeDocumentReviewStatus(d.review_status) === "rejected") || null;
    const latestReviewed = verificationDocuments.find((d) => d.reviewed_at) || null;

    return NextResponse.json({
      profile: {
        ...baseProfile,
        company_verification_status: effectiveVerificationStatus,
        profile_completeness_score: profileCompletenessScore,
        company_verification_review_status: reviewStatus,
        verification_last_reviewed_at: latestReviewed?.reviewed_at || null,
        verification_rejection_reason: latestRejected?.rejected_reason || latestRejected?.review_notes || null,
      },
      verification_documents: verificationDocuments,
      verification_documents_warning: verificationDocumentsWarning,
      membership_role: (ctx as any).membershipRole,
      route_version: ROUTE_VERSION,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "unhandled_exception", details: e?.message || String(e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();
    const ctx = await resolveContext(supabase, admin);
    if ((ctx as any).error) return (ctx as any).error;

    const { user, companyId, membershipRole } = ctx as any;
    if (membershipRole !== "admin") {
      return NextResponse.json({ error: "forbidden", details: "Solo administradores pueden editar el perfil de empresa." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, any> = { company_id: companyId };

    for (const key of ALLOWED_PATCH_FIELDS) {
      if (!(key in body)) continue;

      const incoming = (body as any)[key];
      if (ARRAY_FIELDS.has(key)) {
        patch[key] = asStringArray(incoming);
      } else if (BOOLEAN_FIELDS.has(key)) {
        patch[key] = Boolean(incoming);
      } else if (NUMBER_FIELDS.has(key)) {
        if (incoming === null || incoming === undefined || incoming === "") patch[key] = null;
        else {
          const n = Number(incoming);
          patch[key] = Number.isFinite(n) ? Math.trunc(n) : null;
        }
      } else if (key === "company_verification_status") {
        patch[key] = normalizeVerificationStatus(incoming);
      } else {
        patch[key] = asTrimmedText(incoming);
      }
    }

    if (patch.verification_document_type && patch.verification_document_storage_path && !patch.verification_document_uploaded_at) {
      patch.verification_document_uploaded_at = new Date().toISOString();
    }

    const candidateProfile = {
      ...patch,
      profile_completeness_score: 0,
    };

    const computedScore = computeCompleteness(candidateProfile as any);
    patch.profile_completeness_score = computedScore;
    patch.updated_at = new Date().toISOString();

    const effectiveVerificationStatus = await getEffectiveVerificationStatus(
      admin,
      user.id,
      patch.company_verification_status
    );
    patch.company_verification_status = effectiveVerificationStatus;

    const { data, error } = await admin
      .from("company_profiles")
      .upsert(patch, { onConflict: "company_id" })
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "company_profiles_upsert_failed", details: error.message, route_version: ROUTE_VERSION }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      profile: {
        ...(data || patch),
        company_verification_status: effectiveVerificationStatus,
        profile_completeness_score: computedScore,
      },
      route_version: ROUTE_VERSION,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "unhandled_exception", details: e?.message || String(e), route_version: ROUTE_VERSION }, { status: 500 });
  }
}
