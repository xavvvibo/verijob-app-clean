export const dynamic = "force-dynamic";
export const revalidate = 0;
import { headers } from "next/headers";

type Ctx = { params: Promise<{ token: string }> };
type Availability = {
  job_search_status?: string | null;
  availability_start?: string | null;
  preferred_workday?: string | null;
  preferred_roles?: string[] | null;
  work_zones?: string | null;
  availability_schedule?: string[] | null;
};
type Credibility = {
  verified_work_count?: number | null;
  verified_education_count?: number | null;
  total_verifications?: number | null;
  evidences_count?: number | null;
  trust_score?: number | null;
  profile_status?: "reviewing" | "partially_verified" | "verified" | string | null;
};

async function fetchCompanyProfile(token: string) {
  const h = await headers();
  const forwardedProto = h.get("x-forwarded-proto") || "http";
  const forwardedHost = h.get("x-forwarded-host") || h.get("host");
  const base =
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const cookie = h.get("cookie") || "";

  const res = await fetch(`${base}/api/company/candidate/${token}`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export default async function CompanyCandidateTokenPage({ params }: Ctx) {
  const { token } = await params;
  const { ok, status, body } = await fetchCompanyProfile(token);

  if (!ok) {
    const msg =
      status === 401 ? "Necesitas iniciar sesión para acceder a esta vista privada." :
      status === 403 ? "Necesitas un contexto de empresa activo para acceder a esta vista." :
      status === 402 ? "Has agotado tus créditos. Sube de plan o compra un pack." :
      status === 410 ? "Este enlace ha caducado." :
      status === 429 ? "Demasiadas solicitudes. Inténtalo más tarde." :
      "No encontrado.";

    const upgradeUrl = body?.upgrade_url ?? "/company/upgrade";

    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold">Perfil (Empresa)</h1>
        <p className="mt-3 text-sm text-gray-600">{msg}</p>

        {status === 401 && (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/login?mode=company">
              Iniciar sesión
            </a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/signup?mode=company">
              Crear cuenta empresa
            </a>
          </div>
        )}

        {status === 403 && (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company">
              Cambiar a empresa
            </a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/dashboard">
              Ir al panel principal
            </a>
          </div>
        )}

        {status === 402 && (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href={upgradeUrl}>
              Ir a Upgrade
            </a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/requests">
              Volver
            </a>
          </div>
        )}
      </main>
    );
  }

  const profile = body?.profile ?? {};
  const gate = body?.gate ?? {};
  const contact = body?.contact ?? {};
  const availability: Availability = body?.availability ?? {};
  const credibility: Credibility = body?.credibility ?? {};
  const hasEmail = typeof contact?.email === "string" && contact.email.length > 0;
  const hasPhone = typeof contact?.phone === "string" && contact.phone.length > 0;
  const hasContact = hasEmail || hasPhone;
  const roles = Array.isArray(availability?.preferred_roles)
    ? Array.from(new Set(availability.preferred_roles.map((x) => mapRole(String(x))).filter(Boolean)))
    : [];
  const schedules = Array.isArray(availability?.availability_schedule)
    ? Array.from(new Set(availability.availability_schedule.map((x) => mapSchedule(String(x))).filter(Boolean)))
    : [];
  const hasAvailabilityData = Boolean(
    availability?.job_search_status ||
      availability?.availability_start ||
      availability?.preferred_workday ||
      (availability?.work_zones && String(availability.work_zones).trim()) ||
      roles.length ||
      schedules.length
  );
  const trustScore = Number(credibility?.trust_score ?? 0);
  const verifiedWork = Number(credibility?.verified_work_count ?? 0);
  const verifiedEducation = Number(credibility?.verified_education_count ?? 0);
  const totalVerifications = Number(credibility?.total_verifications ?? 0);
  const evidencesCount = Number(credibility?.evidences_count ?? 0);

  return (
    <main className="p-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">CV completo (Empresa)</h1>
          <p className="mt-1 text-sm text-gray-600">
            Has desbloqueado el perfil completo verificado del candidato para evaluación de contratación.
          </p>
        </div>

        {gate?.requires_overage ? (
          <span className="text-xs rounded-full border px-3 py-1">
            Enterprise: overage pendiente ({gate?.overage_price ?? "—"}€)
          </span>
        ) : (
          <span className="text-xs rounded-full border px-3 py-1">
            Créditos restantes: {gate?.credits_remaining ?? "—"}
          </span>
        )}
      </div>

      <section className="mt-6 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Señales de credibilidad del perfil</h2>
          <span className="rounded-full border px-3 py-1 text-xs">
            {mapProfileStatus(String(credibility?.profile_status || "reviewing"))}
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Trust Score" value={String(trustScore)} />
          <Field label="Experiencias verificadas" value={String(verifiedWork)} />
          <Field label="Formación verificada" value={String(verifiedEducation)} />
          <Field label="Total verificaciones" value={String(totalVerifications)} />
          <Field label="Evidencias registradas" value={String(evidencesCount)} />
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Cuantas más verificaciones reúne el candidato, mayor es la solidez de su perfil para la toma de decisión.
        </p>
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-base font-semibold text-gray-900">Contacto del candidato</h2>
        {hasContact ? (
          <div className="mt-3 space-y-3">
            {hasEmail ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="text-sm font-medium text-gray-900">{contact.email}</div>
                </div>
                <a
                  className="rounded-md border px-3 py-2 text-sm inline-block"
                  href={`mailto:${contact.email}`}
                >
                  Enviar email
                </a>
              </div>
            ) : null}

            {hasPhone ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                <div>
                  <div className="text-xs text-gray-500">Teléfono</div>
                  <div className="text-sm font-medium text-gray-900">{contact.phone}</div>
                </div>
                <a
                  className="rounded-md border px-3 py-2 text-sm inline-block"
                  href={`tel:${String(contact.phone).replace(/\s+/g, "")}`}
                >
                  Llamar
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            El candidato no ha habilitado métodos de contacto directo para empresas registradas.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-base font-semibold text-gray-900">Disponibilidad profesional</h2>

        {hasAvailabilityData ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Estado actual" value={mapJobSearchStatus(availability?.job_search_status)} />
            <Field label="Incorporación" value={mapAvailabilityStart(availability?.availability_start)} />
            <Field label="Tipo de jornada" value={mapWorkday(availability?.preferred_workday)} />
            <Field
              label="Áreas o funciones de interés"
              value={roles.length ? roles.join(", ") : "No especificado"}
            />
            <Field
              label="Zona o zonas preferidas"
              value={
                typeof availability?.work_zones === "string" && availability.work_zones.trim()
                  ? availability.work_zones
                  : "No especificado"
              }
            />
            <Field
              label="Disponibilidad horaria"
              value={schedules.length ? schedules.join(", ") : "No especificado"}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            El candidato todavía no ha completado su disponibilidad profesional.
          </p>
        )}
      </section>

      <div className="mt-6 rounded-lg border p-4">
        <div className="mb-2 text-sm font-semibold text-gray-900">Datos completos del perfil</div>
        <pre className="text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(profile, null, 2)}
        </pre>
      </div>

      <div className="mt-6 flex gap-3">
        <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/requests">
          Continuar evaluación en solicitudes
        </a>
        <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/candidates">
          Ver más candidatos
        </a>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function mapJobSearchStatus(v?: string | null) {
  if (v === "buscando_activamente") return "Buscando empleo activamente";
  if (v === "abierto_oportunidades") return "Abierto a oportunidades";
  if (v === "no_disponible") return "No disponible actualmente";
  return "No especificado";
}

function mapAvailabilityStart(v?: string | null) {
  if (v === "inmediata") return "Inmediata";
  if (v === "7_dias") return "En 7 días";
  if (v === "15_dias") return "En 15 días";
  if (v === "30_dias") return "En 30 días";
  if (v === "mas_adelante") return "Más adelante";
  return "No especificado";
}

function mapWorkday(v?: string | null) {
  if (v === "jornada_completa") return "Jornada completa";
  if (v === "media_jornada") return "Media jornada";
  if (v === "temporal_proyectos" || v === "extras_eventos" || v === "fines_semana") return "Temporal / por proyectos";
  if (v === "flexible") return "Flexible";
  return "No especificado";
}

function mapRole(v: string) {
  if (v === "atencion_cliente" || v === "sala" || v === "barra") return "Atención al cliente";
  if (v === "administracion" || v === "recepcion") return "Administración";
  if (v === "operaciones" || v === "limpieza" || v === "encargado_supervision") return "Operaciones";
  if (v === "ventas") return "Ventas";
  if (v === "produccion" || v === "cocina") return "Producción";
  if (v === "logistica") return "Logística";
  if (v === "soporte_tecnico") return "Soporte técnico";
  if (v === "otros") return "Otros";
  return "";
}

function mapSchedule(v: string) {
  if (v === "mananas") return "Mañanas";
  if (v === "tardes") return "Tardes";
  if (v === "noches") return "Noches";
  if (v === "horario_flexible" || v === "fines_semana") return "Horario flexible";
  if (v === "turnos_rotativos") return "Turnos rotativos";
  return "";
}

function mapProfileStatus(v: string) {
  if (v === "verified") return "Verificado";
  if (v === "partially_verified") return "Parcialmente verificado";
  return "En revisión";
}
