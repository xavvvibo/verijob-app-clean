import { NextResponse } from "next/server";
import { requireOwner } from "@/app/api/internal/owner/_lib";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_BUCKET = "evidences_company";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function normalizeStorageLocation(input: { bucket?: unknown; path?: unknown; profileStoragePath?: unknown }) {
  const bucket = String(input.bucket || "").trim();
  const path = String(input.path || "").trim();
  if (bucket && path) return { bucket, path };

  const combined = String(input.profileStoragePath || "").trim();
  if (!combined) return { bucket: "", path: "" };

  const normalized = combined.replace(/^\/+/, "");
  const slash = normalized.indexOf("/");
  if (slash <= 0) return { bucket: DEFAULT_BUCKET, path: normalized };
  return {
    bucket: normalized.slice(0, slash),
    path: normalized.slice(slash + 1),
  };
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const params = await ctx.params;
  const documentId = String(params?.id || "").trim();
  if (!isUuid(documentId)) return json(400, { error: "invalid_document_id" });

  const { data: document, error } = await owner.admin
    .from("company_verification_documents")
    .select("id,company_id,storage_bucket,storage_path,original_filename,lifecycle_status")
    .eq("id", documentId)
    .maybeSingle();

  if (error) return json(400, { error: "document_read_failed", details: error.message });
  if (!document) return json(404, { error: "document_not_found" });
  if (String(document.lifecycle_status || "active").toLowerCase() === "deleted") {
    return json(409, { error: "document_deleted" });
  }

  let profileStoragePath: string | null = null;
  if (!document.storage_path) {
    const profileRes = await owner.admin
      .from("company_profiles")
      .select("verification_document_storage_path")
      .eq("company_id", String(document.company_id || ""))
      .maybeSingle();
    profileStoragePath = String((profileRes.data as any)?.verification_document_storage_path || "").trim() || null;
  }

  const storage = normalizeStorageLocation({
    bucket: document.storage_bucket,
    path: document.storage_path,
    profileStoragePath,
  });

  if (!storage.bucket || !storage.path) {
    return json(409, { error: "document_storage_missing" });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get("download") === "1";
  const signed = await owner.admin.storage.from(storage.bucket).createSignedUrl(storage.path, 60 * 5, {
    download: download ? String(document.original_filename || "documento-empresa") : undefined,
  });

  if (signed.error || !signed.data?.signedUrl) {
    return json(400, { error: "signed_url_failed", details: signed.error?.message || "signed_url_missing" });
  }

  return NextResponse.redirect(signed.data.signedUrl, { status: 307 });
}
