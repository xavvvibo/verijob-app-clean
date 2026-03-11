import { notFound } from "next/navigation";
import ResolveExperienceForm from "./ResolveExperienceForm";
import { createClient } from "@/utils/supabase/service";

type PageProps = {
  params: {
    token: string;
  };
};

export default async function VerifyExperiencePage({ params }: PageProps) {
  const rawToken = params?.token || "";

  const normalizedToken = decodeURIComponent(String(rawToken))
    .trim()
    .replace(/\s+/g, "");

  const admin = createClient();

  const { data: rows, error } = await admin
    .from("verification_requests")
    .select(
      "id, requested_by, company_name_target, external_token_expires_at, external_resolved, employment_record_id"
    )
    .eq("external_token", normalizedToken)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("verification lookup error", error);
  }

  const requestRow = rows && rows.length > 0 ? rows[0] : null;

  if (!requestRow) {
    return (
      <main style={{ padding: "40px", maxWidth: 600, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid #f5c26b",
            background: "#fff8e6",
            padding: "24px",
            borderRadius: 8,
          }}
        >
          <h2>Enlace no encontrado</h2>
          <p>
            Este enlace de verificación no existe o ya no está disponible.
            Solicita al candidato que genere un nuevo enlace.
          </p>
        </div>
      </main>
    );
  }

  const expiresAt = requestRow.external_token_expires_at
    ? new Date(requestRow.external_token_expires_at)
    : null;

  if (expiresAt && expiresAt.getTime() < Date.now()) {
    return (
      <main style={{ padding: "40px", maxWidth: 600, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid #f5c26b",
            background: "#fff8e6",
            padding: "24px",
            borderRadius: 8,
          }}
        >
          <h2>Enlace caducado</h2>
          <p>
            Este enlace de verificación ha caducado. Solicita al candidato que
            genere una nueva solicitud de verificación.
          </p>
        </div>
      </main>
    );
  }

  if (requestRow.external_resolved) {
    return (
      <main style={{ padding: "40px", maxWidth: 600, margin: "0 auto" }}>
        <div
          style={{
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            padding: "24px",
            borderRadius: 8,
          }}
        >
          <h2>Solicitud ya respondida</h2>
          <p>
            Esta solicitud de verificación ya ha sido respondida previamente.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "40px", maxWidth: 600, margin: "0 auto" }}>
      <h1>Verificación de experiencia laboral</h1>
      <p>
        Un candidato ha solicitado verificar una experiencia laboral asociada a
        su empresa.
      </p>

      <ResolveExperienceForm requestId={requestRow.id} />
    </main>
  );
}
