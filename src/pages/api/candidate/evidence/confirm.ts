import type { NextApiRequest, NextApiResponse } from "next";
import { createPagesRouteClient } from "@/utils/supabase/pages";
import { trackEventAdmin } from "@/utils/analytics/trackEventAdmin";

function json(res: NextApiResponse, status: number, body: any) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function isHexSha256(s?: string) {
  if (!s) return true;
  return /^[a-f0-9]{64}$/i.test(s);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method Not Allowed", route: "/pages/api/candidate/evidence/confirm" });
  }

  try {
    const supabase = createPagesRouteClient(req, res);
    const { data: auth, error: authErr } = await supabase.auth.getUser();

    if (authErr || !auth?.user) {
      return json(res, 401, {
        error: "No autenticado",
        route: "/pages/api/candidate/evidence/confirm",
        details: authErr?.message ?? null,
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const verification_request_id = String(body?.verification_request_id ?? "").trim();
    const storage_path = String(body?.storage_path ?? "").trim();
    const evidence_type = body?.evidence_type ? String(body.evidence_type).slice(0, 50) : null;
    const file_sha256 = body?.file_sha256 ? String(body.file_sha256).toLowerCase() : null;

    if (!verification_request_id) {
      return json(res, 400, { error: "Falta verification_request_id", route: "/pages/api/candidate/evidence/confirm" });
    }
    if (!storage_path) {
      return json(res, 400, { error: "Falta storage_path", route: "/pages/api/candidate/evidence/confirm" });
    }
    if (!isHexSha256(file_sha256 ?? undefined)) {
      return json(res, 400, {
        error: "file_sha256 debe ser hex SHA-256 (64 chars) si se envía",
        route: "/pages/api/candidate/evidence/confirm",
      });
    }

    const { data: vr, error: vrErr } = await supabase
      .from("verification_requests")
      .select("id, company_id")
      .eq("id", verification_request_id)
      .maybeSingle();

    if (vrErr) {
      return json(res, 400, {
        error: "Error consultando verification_requests",
        route: "/pages/api/candidate/evidence/confirm",
        details: vrErr.message,
      });
    }
    if (!vr) {
      return json(res, 404, {
        error: "verification_request no encontrada o sin acceso",
        route: "/pages/api/candidate/evidence/confirm",
      });
    }

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

    if (error) {
      return json(res, 400, {
        error: "No se pudo registrar la evidencia en DB",
        route: "/pages/api/candidate/evidence/confirm",
        details: error.message,
      });
    }

    trackEventAdmin({
      event_name: "evidence_uploaded",
      user_id: auth.user.id,
      company_id: vr.company_id ?? null,
      entity_type: "evidence",
      entity_id: data.id,
      metadata: {
        verification_request_id,
        storage_path,
        evidence_type,
        file_sha256,
      },
    }).catch(() => {});

    return json(res, 200, { ok: true, evidence: data, route: "/pages/api/candidate/evidence/confirm" });
  } catch (e: any) {
    return json(res, 500, {
      error: "server_error",
      route: "/pages/api/candidate/evidence/confirm",
      details: String(e?.message || e),
    });
  }
}
