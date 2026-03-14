import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import ShareLinkButton from "./ShareLinkButton";

type Summary = {
  verification_id: string;
  company_id: string | null;
  candidate_id: string | null;
  employment_record_id: string;
  requested_by: string;
  status: string;
  company_name_freeform: string | null;
  position: string | null;
  start_date: string | null;
  end_date: string | null;
  evidence_count: number;
  actions_count: number;
  company_confirmed: boolean;
  verification_level: "verified" | "in_review" | "rejected" | "partial" | string;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function labelForLevel(level: string) {
  switch (level) {
    case "verified":
      return { title: "Verificada", hint: "Resultado con alta confianza" };
    case "in_review":
      return { title: "En revisión", hint: "La verificación se está procesando" };
    case "rejected":
      return { title: "Rechazada", hint: "La verificación no superó la validación" };
    case "partial":
    default:
      return { title: "Parcial", hint: "Algunos elementos están verificados y otros pendientes" };
  }
}

export default async function CandidateVerificationReportPage({
  params,
}: {
  params: any;
}) {
  const resolvedParams = await params;
  const verificationId = resolvedParams?.id as string | undefined;

  if (!verificationId || verificationId === "undefined" || !isUuid(verificationId)) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>ID de verificación no válido</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          Recibido: <code>{String(verificationId ?? null)}</code>
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/candidate/verification" style={{ textDecoration: "underline" }}>
            Volver
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>No autorizado</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>Inicia sesión de nuevo.</div>
        <div style={{ marginTop: 16 }}>
          <Link href="/login" style={{ textDecoration: "underline" }}>
            Ir a login
          </Link>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("verification_summary")
    .select("*")
    .eq("verification_id", verificationId)
    .maybeSingle();

  if (error) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Error</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>{error.message}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>No encontrado</h1>
        <div style={{ marginTop: 10, opacity: 0.85 }}>
          Esta verificación no existe o no tienes acceso.
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/candidate/verification" style={{ textDecoration: "underline" }}>
            Volver
          </Link>
        </div>
      </div>
    );
  }

  const s = data as Summary;
  const level = labelForLevel(s.verification_level);

  const companyLabel =
    String(s.company_name_freeform || "").trim() || "Empresa";

  const dateRange =
    s.start_date && s.end_date
      ? `${s.start_date} → ${s.end_date}`
      : s.start_date && !s.end_date
      ? `${s.start_date} → Actualidad`
      : "Fechas no informadas";

  const whatIsVerified =
    s.verification_level === "verified"
      ? ["Relación laboral confirmada", "Evidencias aceptadas"]
      : s.verification_level === "partial"
      ? ["Evidencias recibidas", "Datos básicos registrados"]
      : s.verification_level === "in_review"
      ? ["Evidencias recibidas", "En espera de revisión"]
      : ["Resultado registrado"];

  const whatIsMissing =
    s.verification_level === "partial"
      ? [
          "Puede requerirse evidencia adicional para alcanzar nivel verificado",
          "Puede requerirse confirmación de la empresa según el caso",
        ]
      : s.verification_level === "in_review"
      ? ["Pendiente de finalización de revisión"]
      : s.verification_level === "verified"
      ? []
      : [];

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Informe de verificación</div>
          <h1 style={{ margin: "8px 0 0", fontSize: 28 }}>{level.title}</h1>
          <div style={{ marginTop: 6, opacity: 0.8 }}>{level.hint}</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <ShareLinkButton verificationId={verificationId} />
          <Link href="/candidate/verification" style={{ textDecoration: "underline" }}>
            Volver
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 18, padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Puesto</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>{s.position ?? "No especificado"}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Empresa</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>{companyLabel}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Fechas</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>{dateRange}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Evidencias</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>
              {s.evidence_count} documento(s) • {s.actions_count} evento(s)
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Confirmación de empresa</div>
            <div style={{ marginTop: 6, fontSize: 16 }}>
              {s.company_confirmed ? "Sí" : "Aún no"}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>ID de verificación</div>
            <div style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>{s.verification_id}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Qué está verificado</div>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {whatIsVerified.map((x) => (
              <li key={x} style={{ marginBottom: 6 }}>{x}</li>
            ))}
          </ul>
        </div>

        <div style={{ padding: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Qué falta / próximos pasos</div>
          {whatIsMissing.length === 0 ? (
            <div style={{ marginTop: 10, opacity: 0.85 }}>No hay pendientes.</div>
          ) : (
            <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {whatIsMissing.map((x) => (
                <li key={x} style={{ marginBottom: 6 }}>{x}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
