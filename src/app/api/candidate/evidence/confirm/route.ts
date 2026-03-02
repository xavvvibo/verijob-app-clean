import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

function isHexSha256(s?: string) {
  if (!s) return true; // opcional
  return /^[a-f0-9]{64}$/i.test(s);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) return jsonError(401, "No autenticado");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body JSON inválido");
  }

  const verification_request_id = String(body?.verification_request_id ?? "").trim();
  const storage_path = String(body?.storage_path ?? "").trim();
  const evidence_type = body?.evidence_type ? String(body.evidence_type).slice(0, 50) : null;
  const file_sha256 = body?.file_sha256 ? String(body.file_sha256).toLowerCase() : null;

  if (!verification_request_id) return jsonError(400, "Falta verification_request_id");
  if (!storage_path) return jsonError(400, "Falta storage_path");

  if (!isHexSha256(file_sha256 ?? undefined)) {
    return jsonError(400, "file_sha256 debe ser hex SHA-256 (64 chars) si se envía");
  }

  // Verifica acceso a la verification_request (vía RLS)
  const { data: vr, error: vrErr } = await supabase
    .from("verification_requests")
    .select("id")
    .eq("id", verification_request_id)
    .maybeSingle();

  if (vrErr) return jsonError(400, "Error consultando verification_requests", vrErr);
  if (!vr) return jsonError(404, "verification_request no encontrada o sin acceso");

  const row = {
    verification_request_id,
    storage_path,
    evidence_type,
    uploaded_by: auth.user.id,
    file_sha256,
  };

  const { data, error } = await supabase
    .from("evidences")
    .insert(row)
    .select("id, verification_request_id, storage_path, evidence_type, uploaded_by, created_at, file_sha256")
    .single();

  if (error) return jsonError(400, "No se pudo registrar la evidencia en DB", error);

  return NextResponse.json({ ok: true, evidence: data });
}
