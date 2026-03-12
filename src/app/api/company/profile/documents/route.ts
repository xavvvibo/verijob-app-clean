import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

const ROUTE_VERSION = "company-profile-documents-v1";
const BUCKET = "evidence";
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp"]);
const ALLOWED_DOCUMENT_TYPES = new Set(["modelo_036", "modelo_037", "cif_nif", "certificado_censal", "escritura", "otro"]);

function isRelationMissingError(error: any, relationName: string) {
  const msg = String(error?.message || "").toLowerCase();
  return String(error?.code || "") === "42P01" || (msg.includes("relation") && msg.includes(relationName.toLowerCase()));
}

function json(status: number, body: any) {
  return NextResponse.json({ ...body, route_version: ROUTE_VERSION }, { status });
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
    const { companyId, admin } = ctx as any;

    const docsRes = await admin
      .from("company_verification_documents")
      .select("id,company_id,document_type,storage_bucket,storage_path,original_filename,mime_type,size_bytes,review_status,rejected_reason,review_notes,reviewed_at,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (docsRes.error) {
      if (isRelationMissingError(docsRes.error, "company_verification_documents")) {
        return json(200, { documents: [], warning: "company_verification_documents_missing_migration" });
      }
      return json(400, { error: "company_verification_documents_read_failed", details: docsRes.error.message });
    }

    return json(200, { documents: Array.isArray(docsRes.data) ? docsRes.data : [] });
  } catch (e: any) {
    return json(500, { error: "unhandled_exception", details: e?.message || String(e) });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { user, companyId, membershipRole, admin } = ctx as any;

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
      created_at: nowIso,
      updated_at: nowIso,
    };

    const docsInsert = await admin
      .from("company_verification_documents")
      .insert(insertPayload)
      .select("id,company_id,document_type,storage_bucket,storage_path,original_filename,mime_type,size_bytes,review_status,rejected_reason,review_notes,reviewed_at,created_at")
      .single();

    if (docsInsert.error) {
      if (isRelationMissingError(docsInsert.error, "company_verification_documents")) {
        return json(400, {
          error: "company_verification_documents_missing_migration",
          details: "Ejecuta scripts/sql/f31_company_verification_documents.sql antes de subir documentos.",
        });
      }
      return json(400, { error: "company_verification_documents_insert_failed", details: docsInsert.error.message });
    }

    await admin
      .from("company_profiles")
      .upsert(
        {
          company_id: companyId,
          verification_document_type: documentType,
          verification_document_storage_path: `${BUCKET}/${storagePath}`,
          verification_document_uploaded_at: nowIso,
          verification_notes: null,
          updated_at: nowIso,
        },
        { onConflict: "company_id" },
      );

    return json(200, { ok: true, document: docsInsert.data });
  } catch (e: any) {
    return json(500, { error: "unhandled_exception", details: e?.message || String(e) });
  }
}

