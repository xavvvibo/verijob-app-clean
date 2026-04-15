import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  asTrimmedText,
  buildCompanyProfileCompletionModel,
  resolveCompanyDisplayName,
} from "@/lib/company/company-profile";
import {
  type CompanyDocumentRow,
  deriveCompanyDocumentVerificationState,
  finalizeCompanyDocumentsIfDue,
} from "@/lib/company/document-verification";
import { deriveCompanyVerificationMethod } from "@/lib/company/verification-method";
import { isCompanyLifecycleBlocked, readCompanyLifecycle } from "@/lib/company/lifecycle-guard";
import { readEffectiveCompanySubscriptionState } from "@/lib/billing/effectiveSubscription";
import { findCompanyByNormalizedTaxId, normalizeCompanyTaxId } from "@/lib/company/tax-id";

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

type CompanyVerificationDocumentRow = CompanyDocumentRow & {
  company_id?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  original_filename?: string | null;
  extracted_at?: string | null;
  import_status?: string | null;
  imported_at?: string | null;
  imported_by?: string | null;
  import_notes?: string | null;
  deleted_at?: string | null;
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
  "verification_reviewed_at",
  "verification_notes",
  "lead_source",
  "crm_tags",
  "market_segment",
  "onboarding_completed_at",
] as const;

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

function normalizeDocumentReviewStatus(value: unknown) {
  const v = String(value || "").toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  return "pending_review";
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

function isFilledArray(value: unknown) {
  return Array.isArray(value) && value.map((x) => String(x || "").trim()).filter(Boolean).length > 0;
}

function humanizeDocumentsWarning(code: string | null) {
  if (!code) return null;
  if (code === "company_verification_documents_missing_migration") {
    return {
      code,
      title: "La verificación documental aún no está activada en esta base",
      message:
        "El perfil empresa está listo, pero falta aplicar las migraciones SQL del módulo documental para poder subir y gestionar documentos.",
      migration_files: [
        "scripts/sql/f31_company_verification_documents.sql",
        "scripts/sql/f34_company_verification_documents_lifecycle.sql",
      ],
    };
  }
  if (code === "company_verification_documents_schema_drift") {
    return {
      code,
      title: "La base tiene una versión parcial del módulo documental",
      message:
        "La UI se degrada de forma segura. Aplica las migraciones pendientes para activar lifecycle, histórico e importación documental.",
      migration_files: [
        "scripts/sql/f31_company_verification_documents.sql",
        "scripts/sql/f34_company_verification_documents_lifecycle.sql",
      ],
    };
  }
  return null;
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

  if (!companyId) {
    return {
      user,
      companyId: null,
      membershipRole: profileRole === "company" ? "admin" : "reviewer",
      profileRole,
      onboardingCompleted,
    };
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
    profileRole,
    onboardingCompleted,
  };
}

export async function GET() {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();
    const ctx = await resolveContext(supabase, admin);
    if ((ctx as any).error) return (ctx as any).error;

    const { user, companyId } = ctx as any;

    if (!companyId) {
      return NextResponse.json({
        profile: {
          company_id: null,
          legal_name: "",
          trade_name: "",
          tax_id: "",
          contact_email: user.email || "",
          contact_phone: "",
          contact_person_name: "",
          contact_person_role: "",
          sector: "",
          subsector: "",
          business_model: "",
          market_segment: "",
          operating_address: "",
          company_verification_status: "unverified",
          profile_completeness_score: 0,
        },
        verification_documents: [],
        verification_documents_active_count: 0,
        verification_documents_warning: null,
        verification_documents_meta: null,
        profile_completion: {
          score: 0,
          completed_count: 0,
          total_count: 0,
          missing_fields: [],
          completed_fields: [],
        },
        membership_role: (ctx as any).membershipRole,
        route_version: ROUTE_VERSION,
      });
    }

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
    let verificationDocumentsWarningCode: string | null = null;
    let docsRes = await admin
      .from("company_verification_documents")
      .select(
        "id,company_id,document_type,storage_bucket,storage_path,original_filename,mime_type,size_bytes,review_status,rejected_reason,review_notes,reviewed_at,lifecycle_status,deleted_at,extracted_json,extracted_at,import_status,imported_at,imported_by,import_notes,created_at",
      )
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
      verificationDocumentsWarningCode = isRelationMissingError(docsRes.error, "company_verification_documents")
        ? "company_verification_documents_missing_migration"
        : "company_verification_documents_schema_drift";
      if (verificationDocumentsWarningCode === "company_verification_documents_schema_drift") {
        const legacyDocsRes = await admin
          .from("company_verification_documents")
          .select("id,company_id,document_type,storage_bucket,storage_path,original_filename,mime_type,size_bytes,status,review_status,rejected_reason,review_notes,reviewed_at,created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(50);
        if (!legacyDocsRes.error) {
          verificationDocuments = Array.isArray(legacyDocsRes.data) ? (legacyDocsRes.data as any) : [];
        }
      }
    } else {
      verificationDocuments = Array.isArray(docsRes.data) ? (docsRes.data as any) : [];
    }

    const effectiveSubscription = await readEffectiveCompanySubscriptionState(admin, {
      userId: user.id,
      companyId,
    });
    verificationDocuments = await finalizeCompanyDocumentsIfDue({
      admin,
      docs: verificationDocuments,
      companyProfile: {
        tax_id: baseProfile.tax_id,
        legal_name: baseProfile.legal_name,
        trade_name: baseProfile.trade_name,
        contact_email: baseProfile.contact_email,
        website_url: baseProfile.website_url,
      },
      planRaw: effectiveSubscription.plan,
    });

    const activeDocuments = verificationDocuments.filter(
      (d) => String(d?.lifecycle_status || "active").toLowerCase() !== "deleted",
    );
    const legacyHasDocument = Boolean(baseProfile.verification_document_type || baseProfile.verification_document_uploaded_at);
    const { count: membersCount } = await admin
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    const completion = buildCompanyProfileCompletionModel({
      profile: baseProfile,
      activeDocumentsCount: activeDocuments.length,
      memberCount: Number(membersCount || 0),
    });
    const documentVerification = deriveCompanyDocumentVerificationState({
      docs: verificationDocuments,
      legacyHasDocument,
      planRaw: effectiveSubscription.plan,
    });
    const latestRejected = activeDocuments.find((d) => normalizeDocumentReviewStatus(d.review_status) === "rejected") || null;
    const latestReviewed = activeDocuments.find((d) => d.reviewed_at) || null;
    const verificationMethod = deriveCompanyVerificationMethod({
      contactEmail: baseProfile.contact_email,
      websiteUrl: baseProfile.website_url,
      hasApprovedDocuments: activeDocuments.some((d) => normalizeDocumentReviewStatus(d.review_status) === "approved"),
    });

    return NextResponse.json({
      profile: {
        ...baseProfile,
        display_name: resolveCompanyDisplayName(baseProfile),
        company_verification_status: documentVerification.status,
        company_verification_method: verificationMethod.method,
        company_verification_method_label: verificationMethod.label,
        company_verification_method_detail: verificationMethod.detail,
        company_verified_domain: verificationMethod.domain,
        profile_completeness_score: completion.score,
        company_verification_review_status: documentVerification.status,
        company_document_verification_status: documentVerification.status,
        company_document_verification_label: documentVerification.label,
        company_document_verification_detail: documentVerification.detail,
        company_document_last_submitted_at: documentVerification.submitted_at,
        company_document_last_reviewed_at: documentVerification.reviewed_at,
        company_document_review_eta_at: documentVerification.review_eta_at,
        company_document_review_eta_label: documentVerification.review_eta_label,
        company_document_review_priority_label: documentVerification.priority_label,
        company_document_latest_document_type: documentVerification.latest_document_type,
        company_document_rejection_reason: documentVerification.rejection_reason,
        verification_last_reviewed_at: documentVerification.reviewed_at || latestReviewed?.reviewed_at || null,
        verification_rejection_reason: documentVerification.rejection_reason || latestRejected?.rejected_reason || latestRejected?.review_notes || null,
      },
      verification_documents: verificationDocuments,
      verification_documents_active_count: activeDocuments.length,
      verification_documents_warning: verificationDocumentsWarningCode,
      verification_documents_meta: humanizeDocumentsWarning(verificationDocumentsWarningCode),
      profile_completion: completion,
      membership_role: (ctx as any).membershipRole,
      route_version: ROUTE_VERSION,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "unhandled_exception",
        user_message: "No se pudo cargar el perfil de empresa. Inténtalo de nuevo en unos minutos.",
        route_version: ROUTE_VERSION,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();
    const ctx = await resolveContext(supabase, admin);
    if ((ctx as any).error) return (ctx as any).error;

    const { user, companyId: initialCompanyId, membershipRole, profileRole } = ctx as any;

    const body = await request.json().catch(() => ({}));
    const patch: Record<string, any> = { company_id: initialCompanyId };

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
      } else {
        patch[key] = asTrimmedText(incoming);
      }
    }

    const normalizedTaxId = normalizeCompanyTaxId(patch.tax_id);
    const existingCompanyByTax = normalizedTaxId
      ? await findCompanyByNormalizedTaxId(admin, normalizedTaxId)
      : { normalizedTaxId, company: null };

    let companyId = initialCompanyId ? String(initialCompanyId) : null;
    let effectiveMembershipRole = membershipRole;

    if (existingCompanyByTax.company && (!companyId || existingCompanyByTax.company.company_id !== companyId)) {
      const existingCompanyId = String(existingCompanyByTax.company.company_id);
      const { data: existingMembership } = await admin
        .from("company_members")
        .select("role")
        .eq("company_id", existingCompanyId)
        .eq("user_id", user.id)
        .maybeSingle();

      const alreadyMember = Boolean(existingMembership);
      if (alreadyMember) {
        companyId = existingCompanyId;
        effectiveMembershipRole = String((existingMembership as any)?.role || "reviewer").toLowerCase();
        await admin
          .from("profiles")
          .update({ active_company_id: companyId, role: "company" })
          .eq("id", user.id);
      } else {
        return NextResponse.json(
          {
            error: "company_already_registered",
            company_exists_by_tax_id: true,
            already_member: false,
            existing_company_id: existingCompanyId,
            existing_company_name:
              existingCompanyByTax.company.trade_name ||
              existingCompanyByTax.company.legal_name ||
              "Empresa",
            normalized_tax_id: normalizedTaxId,
            route_version: ROUTE_VERSION,
          },
          { status: 409 },
        );
      }
    }

    if (!companyId) {
      const companyName =
        String(patch.legal_name || "").trim() ||
        String(patch.trade_name || "").trim() ||
        makeFallbackCompanyName(user.email);

      const { data: createdCompany, error: createCompanyErr } = await admin
        .from("companies")
        .insert({ name: companyName })
        .select("id")
        .single();
      if (createCompanyErr || !createdCompany?.id) {
        return NextResponse.json(
          { error: "companies_create_failed", details: createCompanyErr?.message || null, route_version: ROUTE_VERSION },
          { status: 400 }
        );
      }

      companyId = String(createdCompany.id);
      effectiveMembershipRole = "admin";
      const { error: memberInsertErr } = await admin.from("company_members").insert({
        company_id: companyId,
        user_id: user.id,
        role: "admin",
      });
      if (memberInsertErr) {
        return NextResponse.json(
          { error: "company_members_insert_failed", details: memberInsertErr.message, route_version: ROUTE_VERSION },
          { status: 400 }
        );
      }
      await admin
        .from("profiles")
        .update({ active_company_id: companyId, onboarding_completed: false, role: profileRole === "company" ? "company" : "company" })
        .eq("id", user.id);
    }

    if (!companyId) {
      return NextResponse.json({ error: "no_active_company", route_version: ROUTE_VERSION }, { status: 400 });
    }

    patch.company_id = companyId;
    patch.tax_id = normalizedTaxId || null;

    const companyLifecycle = await readCompanyLifecycle(admin, companyId);
    if (!companyLifecycle.ok) {
      return NextResponse.json({ error: "company_read_failed", details: companyLifecycle.error.message, route_version: ROUTE_VERSION }, { status: 400 });
    }
    if (isCompanyLifecycleBlocked(companyLifecycle.lifecycleStatus)) {
      return NextResponse.json(
        {
          error: "company_inactive",
          user_message: "La empresa está desactivada o cerrada. Reactívala desde ajustes antes de editar el perfil.",
          route_version: ROUTE_VERSION,
        },
        { status: 423 },
      );
    }
    if (effectiveMembershipRole !== "admin") {
      return NextResponse.json({ error: "forbidden", details: "Solo administradores pueden editar el perfil de empresa." }, { status: 403 });
    }

    const candidateProfile = {
      ...patch,
      profile_completeness_score: 0,
    };

    let docsForStatus: CompanyVerificationDocumentRow[] = [];
    const docsRes = await admin
      .from("company_verification_documents")
      .select("review_status,lifecycle_status")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!docsRes.error) {
      docsForStatus = Array.isArray(docsRes.data) ? (docsRes.data as any) : [];
    } else if (!isRelationMissingError(docsRes.error, "company_verification_documents") && !isDocsSchemaDriftError(docsRes.error)) {
      return NextResponse.json(
        { error: "company_verification_documents_read_failed", details: docsRes.error.message, route_version: ROUTE_VERSION },
        { status: 400 },
      );
    }

    const { count: membersCount } = await admin
      .from("company_members")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    const completion = buildCompanyProfileCompletionModel({
      profile: candidateProfile as any,
      activeDocumentsCount: docsForStatus.filter((d) => String((d as any)?.lifecycle_status || "active").toLowerCase() !== "deleted").length,
      memberCount: Number(membersCount || 0),
    });
    const computedScore = completion.score;
    patch.profile_completeness_score = computedScore;
    patch.updated_at = new Date().toISOString();

    const effectiveSubscription = await readEffectiveCompanySubscriptionState(admin, {
      userId: user.id,
      companyId,
    });
    const documentVerification = deriveCompanyDocumentVerificationState({
      docs: docsForStatus,
      legacyHasDocument: Boolean(patch.verification_document_type || patch.verification_document_uploaded_at),
      planRaw: effectiveSubscription.plan,
    });
    patch.company_verification_status = documentVerification.status === "verified" ? "verified_document" : "unverified";

    const { data, error } = await admin
      .from("company_profiles")
      .upsert(patch, { onConflict: "company_id" })
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "company_profiles_upsert_failed", details: error.message, route_version: ROUTE_VERSION }, { status: 400 });
    }
    const verificationMethod = deriveCompanyVerificationMethod({
      contactEmail: (data || patch as any)?.contact_email,
      websiteUrl: (data || patch as any)?.website_url,
      hasApprovedDocuments: docsForStatus
        .filter((d) => String((d as any)?.lifecycle_status || "active").toLowerCase() !== "deleted")
        .some((d) => String((d as any)?.review_status || "").toLowerCase() === "approved"),
    });

    return NextResponse.json({
      ok: true,
      profile: {
        ...(data || patch),
        display_name: resolveCompanyDisplayName((data || patch) as any),
        company_verification_status: documentVerification.status,
        company_verification_method: verificationMethod.method,
        company_verification_method_label: verificationMethod.label,
        company_verification_method_detail: verificationMethod.detail,
        company_verified_domain: verificationMethod.domain,
        profile_completeness_score: computedScore,
        company_document_verification_status: documentVerification.status,
        company_document_verification_label: documentVerification.label,
        company_document_verification_detail: documentVerification.detail,
        company_document_last_submitted_at: documentVerification.submitted_at,
        company_document_last_reviewed_at: documentVerification.reviewed_at,
        company_document_review_eta_at: documentVerification.review_eta_at,
        company_document_review_eta_label: documentVerification.review_eta_label,
        company_document_review_priority_label: documentVerification.priority_label,
        company_document_latest_document_type: documentVerification.latest_document_type,
        company_document_rejection_reason: documentVerification.rejection_reason,
      },
      profile_completion: completion,
      company_exists_by_tax_id: Boolean(existingCompanyByTax.company),
      already_member: Boolean(existingCompanyByTax.company),
      existing_company_id: companyId,
      route_version: ROUTE_VERSION,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "unhandled_exception",
        user_message: "No se pudo guardar el perfil de empresa. Inténtalo de nuevo en unos minutos.",
        route_version: ROUTE_VERSION,
      },
      { status: 500 }
    );
  }
}
