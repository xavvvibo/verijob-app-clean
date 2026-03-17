import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import {
  deriveCompanyDocumentVerificationState,
  finalizeCompanyDocumentsIfDue,
  resolveCompanyDocumentReviewPriority,
} from "@/lib/company/document-verification";
import { isCompanyLifecycleBlocked, readCompanyLifecycle } from "@/lib/company/lifecycle-guard";
import { readEffectiveCompanySubscriptionState } from "@/lib/billing/effectiveSubscription";

export const dynamic = "force-dynamic";

const ROUTE_VERSION = "company-profile-documents-v1";
const BUCKET = "evidences_company";
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const ALLOWED_DOCUMENT_TYPES = new Set(["modelo_036", "modelo_037", "cif_nif", "certificado_censal", "escritura", "otro"]);
const DOC_SELECT =
  "id,company_id,document_type,storage_bucket,storage_path,original_filename,mime_type,size_bytes,status,review_status,rejected_reason,review_notes,reviewed_at,lifecycle_status,deleted_at,deleted_by,replaced_by_document_id,extracted_json,extracted_at,import_status,imported_at,imported_by,import_notes,created_at,updated_at";

function isRelationMissingError(error: any, relationName: string) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (msg.includes("relation") && msg.includes(relationName.toLowerCase())) ||
    (msg.includes("could not find the table") && msg.includes(relationName.toLowerCase()))
  );
}

function isDocsSchemaDriftError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  return code === "42703" || (msg.includes("column") && msg.includes("does not exist"));
}

function json(status: number, body: any) {
  return NextResponse.json({ ...body, route_version: ROUTE_VERSION }, { status });
}

function docsMigrationPayload(code: "company_verification_documents_missing_migration" | "company_verification_documents_schema_drift") {
  if (code === "company_verification_documents_missing_migration") {
    return {
      status: "documents_table_missing",
      error: code,
      message: "El módulo documental aún no está activo.",
      user_message:
        "La base actual aún no tiene activado el módulo documental de empresa. Aplica las migraciones SQL para habilitar subida, histórico y revisión.",
      migration_files: [
        "scripts/sql/f31_company_verification_documents.sql",
        "scripts/sql/f34_company_verification_documents_lifecycle.sql",
      ],
    };
  }
  return {
    status: "documents_schema_drift",
    error: code,
    message: "El módulo documental necesita sincronizar su esquema antes de operar correctamente.",
    user_message:
      "La base tiene una versión parcial del módulo documental. Aplica las migraciones pendientes para activar lifecycle e importación.",
      migration_files: [
      "scripts/sql/f31_company_verification_documents.sql",
      "scripts/sql/f34_company_verification_documents_lifecycle.sql",
    ],
  };
}

async function readCompanyVerificationDocuments(admin: any, companyId: string) {
  let docsRes = await admin
    .from("company_verification_documents")
    .select(DOC_SELECT)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);

  let warningCode: "company_verification_documents_missing_migration" | "company_verification_documents_schema_drift" | null = null;
  if (docsRes.error) {
    if (isRelationMissingError(docsRes.error, "company_verification_documents")) {
      warningCode = "company_verification_documents_missing_migration";
      return {
        documents: [],
        warningCode,
        error: null,
      };
    }
    if (isDocsSchemaDriftError(docsRes.error)) {
      warningCode = "company_verification_documents_schema_drift";
      docsRes = await admin
        .from("company_verification_documents")
        .select("id,company_id,document_type,storage_bucket,storage_path,original_filename,mime_type,size_bytes,status,review_status,rejected_reason,review_notes,reviewed_at,created_at,updated_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(50);
    }
  }

  if (docsRes.error) {
    return {
      documents: [],
      warningCode,
      error: docsRes.error,
    };
  }

  return {
    documents: Array.isArray(docsRes.data) ? docsRes.data : [],
    warningCode,
    error: null,
  };
}

function safeFilename(name: string) {
  const base = name.split("/").pop()?.split("\\").pop() ?? "document";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 140);
  return cleaned || "document";
}

function extFromMime(mime: string, fallbackName: string) {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  const m = fallbackName.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return m?.[1] || "bin";
}

function toNull(v: unknown) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function bestEffortExtractCompanyData(fileBuffer: Buffer) {
  // Best-effort parser: works only when textual content is present (no OCR).
  const text = fileBuffer
    .toString("utf8")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 150000);
  const upper = text.toUpperCase();

  const pick = (regex: RegExp) => {
    const m = text.match(regex);
    return m?.[1] ? String(m[1]).trim() : null;
  };
  const pickAny = (regex: RegExp) => {
    const m = text.match(regex);
    return m?.[0] ? String(m[0]).trim() : null;
  };

  const legalName =
    pick(/(?:RAZ[ÓO]N\s+SOCIAL|DENOMINACI[ÓO]N\s+SOCIAL)\s*[:\-]\s*([^.;,\n]{3,120})/i) ||
    pick(/(?:TITULAR|NOMBRE\s+O\s+RAZ[ÓO]N\s+SOCIAL)\s*[:\-]\s*([^.;,\n]{3,120})/i);
  const tradeName = pick(/(?:NOMBRE\s+COMERCIAL|MARCA\s+COMERCIAL)\s*[:\-]\s*([^.;,\n]{2,120})/i);
  const taxId =
    pickAny(/\b[A-HJNPQRSUVW]\d{7}[0-9A-J]\b/i) ||
    pickAny(/\b\d{8}[A-HJNP-TV-Z]\b/i) ||
    pick(/(?:CIF|NIF)\s*[:\-]\s*([A-Z0-9-]{8,16})/i);
  const postalCode = pickAny(/\b\d{5}\b/);
  const email = pickAny(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phone = pickAny(/(?:\+34\s*)?(?:6|7|8|9)\d{8}\b/);
  const fiscalAddress =
    pick(/(?:DOMICILIO\s+FISCAL|DIRECCI[ÓO]N\s+FISCAL)\s*[:\-]\s*([^.;\n]{8,180})/i) ||
    pick(/(?:DOMICILIO)\s*[:\-]\s*([^.;\n]{8,180})/i);
  const city = pick(/(?:MUNICIPIO|POBLACI[ÓO]N|LOCALIDAD)\s*[:\-]\s*([^.;,\n]{2,100})/i);
  const province = pick(/(?:PROVINCIA)\s*[:\-]\s*([^.;,\n]{2,100})/i);
  const country = upper.includes("ESPAÑA") ? "España" : null;
  const contactPerson =
    pick(/(?:REPRESENTANTE|ADMINISTRADOR|PERSONA\s+DE\s+CONTACTO)\s*[:\-]\s*([^.;,\n]{3,120})/i) || null;

  const detected = {
    legal_name: toNull(legalName),
    trade_name: toNull(tradeName),
    tax_id: toNull(taxId),
    fiscal_address: toNull(fiscalAddress),
    postal_code: toNull(postalCode),
    city: toNull(city),
    province: toNull(province),
    country: toNull(country),
    contact_person_name: toNull(contactPerson),
    contact_email: toNull(email),
    contact_phone: toNull(phone),
  };

  const detectedCount = Object.values(detected).filter(Boolean).length;
  const extracted = {
    parser: "company_doc_basic_v1",
    ocr_enabled: false,
    confidence: detectedCount >= 4 ? "medium" : detectedCount > 0 ? "low" : "none",
    detected_fields_count: detectedCount,
    detected,
  };

  return extracted;
}

async function resolveContext() {
  const supabase = await createRouteHandlerClient();
  const admin = createServiceRoleClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) return { error: json(400, { error: "auth_getUser_failed", details: userErr.message }) };
  if (!user) return { error: json(401, { error: "unauthorized" }) };

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) return { error: json(400, { error: "profiles_read_failed", details: profileErr.message }) };

  let companyId = profile?.active_company_id ? String(profile.active_company_id) : null;
  if (!companyId) {
    const { data: membershipRows, error: membershipErr } = await admin
      .from("company_members")
      .select("company_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (membershipErr) return { error: json(400, { error: "company_members_read_failed", details: membershipErr.message }) };
    companyId = membershipRows?.[0]?.company_id ? String(membershipRows[0].company_id) : null;
    if (companyId) {
      await admin.from("profiles").update({ active_company_id: companyId }).eq("id", user.id);
    }
  }

  if (!companyId) return { error: json(400, { error: "no_active_company" }) };

  const { data: membership, error: membershipErr } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipErr) return { error: json(400, { error: "company_membership_read_failed", details: membershipErr.message }) };
  if (!membership) return { error: json(403, { error: "company_membership_required" }) };

  return {
    user,
    companyId,
    membershipRole: String(membership.role || "reviewer").toLowerCase(),
    admin,
  };
}

export async function GET() {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { companyId, admin, user } = ctx as any;

    const docsState = await readCompanyVerificationDocuments(admin, companyId);

    if (docsState.error) {
      return json(400, { error: "company_verification_documents_read_failed", details: docsState.error.message });
    }

    if (docsState.warningCode === "company_verification_documents_missing_migration") {
      return json(200, {
        documents: [],
        warning: "company_verification_documents_missing_migration",
        ...docsMigrationPayload("company_verification_documents_missing_migration"),
      });
    }

    const { data: companyProfile } = await admin
      .from("company_profiles")
      .select("tax_id,legal_name,trade_name,contact_email,website_url,verification_document_type,verification_document_uploaded_at")
      .eq("company_id", companyId)
      .maybeSingle();
    const effectiveSubscription = await readEffectiveCompanySubscriptionState(admin, {
      userId: user.id,
      companyId,
    });
    const finalizedDocs = await finalizeCompanyDocumentsIfDue({
      admin,
      docs: docsState.documents,
      companyProfile: companyProfile || {},
      planRaw: effectiveSubscription.plan,
    });
    const documentaryState = deriveCompanyDocumentVerificationState({
      docs: finalizedDocs,
      legacyHasDocument: Boolean(companyProfile?.verification_document_type || companyProfile?.verification_document_uploaded_at),
      planRaw: effectiveSubscription.plan,
    });

    return json(200, {
      documents: finalizedDocs,
      documentary_status: documentaryState.status,
      documentary_label: documentaryState.label,
      documentary_detail: documentaryState.detail,
      review_eta_at: documentaryState.review_eta_at,
      review_eta_label: documentaryState.review_eta_label,
      review_priority_label: documentaryState.priority_label,
      ...(docsState.warningCode ? { warning: docsState.warningCode, ...docsMigrationPayload(docsState.warningCode) } : {}),
    });
  } catch {
    return json(500, {
      error: "unhandled_exception",
      user_message: "No se pudo cargar la documentación de empresa. Inténtalo de nuevo en unos minutos.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { user, companyId, membershipRole, admin } = ctx as any;
    const companyLifecycle = await readCompanyLifecycle(admin, companyId);
    if (!companyLifecycle.ok) {
      return json(400, { error: "company_read_failed", details: companyLifecycle.error.message });
    }
    if (isCompanyLifecycleBlocked(companyLifecycle.lifecycleStatus)) {
      return json(423, {
        error: "company_inactive",
        status: "company_inactive",
        message: "La empresa está desactivada o cerrada. Reactívala desde ajustes antes de subir nuevos documentos.",
      });
    }

    if (membershipRole !== "admin") {
      return json(403, { error: "forbidden", details: "Solo administradores de empresa pueden subir documentación." });
    }

    const form = await request.formData();
    const documentType = String(form.get("document_type") || "").trim().toLowerCase();
    const file = form.get("file");

    if (!ALLOWED_DOCUMENT_TYPES.has(documentType)) {
      return json(400, { error: "invalid_document_type" });
    }
    if (!(file instanceof File)) {
      return json(400, { error: "file_required" });
    }
    if (!ALLOWED_MIME.has(file.type || "")) {
      return json(400, { error: "invalid_mime_type", mime: file.type || null });
    }
    if (!file.size || file.size <= 0 || file.size > MAX_SIZE_BYTES) {
      return json(400, { error: "invalid_file_size", max_size_bytes: MAX_SIZE_BYTES });
    }

    const originalFilename = safeFilename(file.name || "document");
    const ext = extFromMime(file.type, originalFilename);
    const storagePath = `company-verification/${companyId}/${Date.now()}-${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const uploadRes = await admin.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadRes.error) {
      return json(400, { error: "storage_upload_failed", details: uploadRes.error.message });
    }

    const nowIso = new Date().toISOString();
    const effectiveSubscription = await readEffectiveCompanySubscriptionState(admin, {
      userId: user.id,
      companyId,
    });
    const reviewPriority = resolveCompanyDocumentReviewPriority(effectiveSubscription.plan);
    const extracted = bestEffortExtractCompanyData(bytes);
    const insertPayload = {
      company_id: companyId,
      uploaded_by: user.id,
      document_type: documentType,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      original_filename: originalFilename,
      mime_type: file.type,
      size_bytes: file.size,
      review_status: "pending_review",
      status: "pending_review",
      lifecycle_status: "active",
      extracted_json: extracted,
      extracted_at: nowIso,
      import_status: "not_imported",
      created_at: nowIso,
      updated_at: nowIso,
    };

    let docsInsert = await admin
      .from("company_verification_documents")
      .insert(insertPayload)
      .select(DOC_SELECT)
      .single();

    if (docsInsert.error) {
      if (isRelationMissingError(docsInsert.error, "company_verification_documents")) {
        await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
        return json(503, {
          error: "company_verification_documents_missing_migration",
          user_message: "No se pudo registrar el documento porque el módulo documental aún no está activo en esta base.",
          documents: [],
          ...docsMigrationPayload("company_verification_documents_missing_migration"),
        });
      }
      if (isDocsSchemaDriftError(docsInsert.error)) {
        const legacyInsertPayload = {
          company_id: companyId,
          uploaded_by: user.id,
          document_type: documentType,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          original_filename: originalFilename,
          mime_type: file.type,
          size_bytes: file.size,
          status: "pending_review",
          review_status: "pending_review",
          created_at: nowIso,
          updated_at: nowIso,
        };
        docsInsert = await admin
          .from("company_verification_documents")
          .insert(legacyInsertPayload)
          .select("id,company_id,document_type,storage_bucket,storage_path,original_filename,mime_type,size_bytes,review_status,rejected_reason,review_notes,reviewed_at,created_at")
          .single();
      }
    }

    if (docsInsert.error) {
      await admin.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return json(400, {
        error: "company_verification_documents_insert_failed",
        user_message: "El archivo se recibió, pero no se pudo registrar el documento de verificación.",
        details: docsInsert.error.message,
      });
    }

    const profileUpdateRes = await admin
      .from("company_profiles")
      .upsert(
        {
          company_id: companyId,
          verification_document_type: documentType,
          verification_document_storage_path: `${BUCKET}/${storagePath}`,
          verification_document_uploaded_at: nowIso,
          verification_notes: null,
          // Upload alone does not auto-verify company. Keep explicit unverified lifecycle.
          company_verification_status: "unverified",
          updated_at: nowIso,
        },
        { onConflict: "company_id" },
      );

    const docsState = await readCompanyVerificationDocuments(admin, companyId);
    if (docsState.error) {
      return json(200, {
        ok: true,
        document: docsInsert.data,
        user_message: "Archivo recibido para revisión documental. No se pudo refrescar el histórico automáticamente.",
        documents: [docsInsert.data].filter(Boolean),
        profile_update_warning: profileUpdateRes.error ? "company_profile_document_sync_failed" : null,
        documentary_status: "under_review",
        review_eta_label: reviewPriority.etaLabel,
        review_priority_label: reviewPriority.label,
      });
    }

    const { data: companyProfile } = await admin
      .from("company_profiles")
      .select("tax_id,legal_name,trade_name,contact_email,website_url,verification_document_type,verification_document_uploaded_at")
      .eq("company_id", companyId)
      .maybeSingle();
    const finalizedDocs = await finalizeCompanyDocumentsIfDue({
      admin,
      docs: docsState.documents,
      companyProfile: companyProfile || {},
      planRaw: effectiveSubscription.plan,
    });
    const documentaryState = deriveCompanyDocumentVerificationState({
      docs: finalizedDocs,
      legacyHasDocument: true,
      planRaw: effectiveSubscription.plan,
    });

    return json(200, {
      ok: true,
      document: docsInsert.data,
      documents: finalizedDocs,
      user_message: "Archivo recibido para revisión documental. Estamos revisándolo.",
      documentary_status: documentaryState.status,
      documentary_label: documentaryState.label,
      documentary_detail: documentaryState.detail,
      review_eta_at: documentaryState.review_eta_at,
      review_eta_label: documentaryState.review_eta_label,
      review_priority_label: documentaryState.priority_label,
      ...(docsState.warningCode ? { warning: docsState.warningCode, ...docsMigrationPayload(docsState.warningCode) } : {}),
      ...(profileUpdateRes.error
        ? {
            profile_update_warning: "company_profile_document_sync_failed",
            profile_update_message: "El documento quedó registrado, pero no se pudo actualizar la ficha auxiliar del perfil empresa.",
          }
        : {}),
    });
  } catch {
    return json(500, {
      error: "unhandled_exception",
      user_message: "No se pudo subir el documento. Inténtalo de nuevo en unos minutos.",
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { user, companyId, membershipRole, admin } = ctx as any;
    const companyLifecycle = await readCompanyLifecycle(admin, companyId);
    if (!companyLifecycle.ok) {
      return json(400, { error: "company_read_failed", details: companyLifecycle.error.message });
    }
    if (isCompanyLifecycleBlocked(companyLifecycle.lifecycleStatus)) {
      return json(423, {
        error: "company_inactive",
        status: "company_inactive",
        message: "La empresa está desactivada o cerrada. Reactívala desde ajustes antes de modificar documentos.",
      });
    }

    if (membershipRole !== "admin") {
      return json(403, { error: "forbidden", details: "Solo administradores de empresa pueden gestionar documentación." });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const documentId = String(body?.document_id || "").trim();
    if (!documentId) return json(400, { error: "document_id_required" });

    const { data: document, error: docErr } = await admin
      .from("company_verification_documents")
      .select(DOC_SELECT)
      .eq("id", documentId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (docErr) {
      if (isRelationMissingError(docErr, "company_verification_documents")) {
        return json(200, { documents: [], ...docsMigrationPayload("company_verification_documents_missing_migration") });
      }
      if (isDocsSchemaDriftError(docErr)) {
        return json(200, { documents: [], ...docsMigrationPayload("company_verification_documents_schema_drift") });
      }
      return json(400, { error: "document_read_failed", details: docErr.message });
    }
    if (!document?.id) return json(404, { error: "document_not_found" });

    if (action === "delete") {
      if (String(document.lifecycle_status || "active").toLowerCase() === "deleted") {
        return json(200, { ok: true, document });
      }
      const nowIso = new Date().toISOString();
      const { data: updated, error: updErr } = await admin
        .from("company_verification_documents")
        .update({
          status: "deleted",
          lifecycle_status: "deleted",
          deleted_at: nowIso,
          deleted_by: user.id,
          updated_at: nowIso,
        })
        .eq("id", documentId)
        .eq("company_id", companyId)
        .select(DOC_SELECT)
        .single();
      if (updErr) return json(400, { error: "document_delete_failed", details: updErr.message });
      return json(200, { ok: true, document: updated });
    }

    if (action === "import_to_profile") {
      const overwrite = Boolean(body?.overwrite);
      const extracted = (document as any)?.extracted_json?.detected || {};
      const allowedFields = [
        "legal_name",
        "trade_name",
        "tax_id",
        "fiscal_address",
        "postal_code",
        "city",
        "province",
        "country",
        "contact_person_name",
        "contact_email",
        "contact_phone",
      ];

      const { data: profile, error: profileErr } = await admin
        .from("company_profiles")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (profileErr) return json(400, { error: "company_profile_read_failed", details: profileErr.message });

      const patch: Record<string, any> = { company_id: companyId, updated_at: new Date().toISOString() };
      let importedFields = 0;
      const importedFieldNames: string[] = [];
      const detectedFieldNames: string[] = [];
      const skippedFieldNames: string[] = [];
      for (const field of allowedFields) {
        const incoming = toNull((extracted as any)?.[field]);
        if (!incoming) continue;
        detectedFieldNames.push(field);
        const current = toNull((profile as any)?.[field]);
        if (!current || overwrite) {
          patch[field] = incoming;
          importedFields += 1;
          importedFieldNames.push(field);
        } else {
          skippedFieldNames.push(field);
        }
      }

      if (importedFields > 0) {
        const { error: upsertErr } = await admin.from("company_profiles").upsert(patch, { onConflict: "company_id" });
        if (upsertErr) return json(400, { error: "company_profile_import_failed", details: upsertErr.message });
      }

      const nowIso = new Date().toISOString();
      const { data: updatedDoc, error: docUpdErr } = await admin
        .from("company_verification_documents")
        .update({
          import_status: importedFields > 0 ? "imported" : "no_changes",
          imported_at: nowIso,
          imported_by: user.id,
          import_notes: importedFields > 0 ? `Campos importados: ${importedFields}` : "Sin cambios para importar",
          updated_at: nowIso,
        })
        .eq("id", documentId)
        .eq("company_id", companyId)
        .select(DOC_SELECT)
        .single();
      if (docUpdErr) return json(400, { error: "document_import_status_update_failed", details: docUpdErr.message });

      return json(200, {
        ok: true,
        imported_fields: importedFields,
        imported_field_names: importedFieldNames,
        detected_field_names: detectedFieldNames,
        skipped_field_names: skippedFieldNames,
        document: updatedDoc,
      });
    }

    return json(400, { error: "unsupported_action" });
  } catch {
    return json(500, {
      error: "unhandled_exception",
      user_message: "No se pudo actualizar el estado del documento. Inténtalo de nuevo en unos minutos.",
    });
  }
}
