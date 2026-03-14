export const dynamic = "force-dynamic";
export const revalidate = 0;
import { headers } from "next/headers";
import ProfileViewCheckoutButtons from "./ProfileViewCheckoutButtons";

type Ctx = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ view?: string; checkout?: string }>;
};

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

type TrustComponents = {
  verification?: number | null;
  evidence?: number | null;
  consistency?: number | null;
  reuse?: number | null;
};

type TimelineRow = {
  verification_id?: string | null;
  position?: string | null;
  company_name?: string | null;
  status?: string | null;
  evidence_count?: number | null;
  reuse_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
  resolved_at?: string | null;
};

type PreviewSnapshot = {
  experiences_detected?: number | null;
  total_verifications?: number | null;
  approved_verifications?: number | null;
  verification_types?: string[] | null;
  languages_detected?: string[] | null;
  trust_score?: number | null;
  onboarding_completion?: number | null;
  onboarding_status?: string | null;
  verification_breakdown?: {
    email_or_company?: number | null;
    documental?: number | null;
  } | null;
  profile_state?: string | null;
  last_activity_at?: string | null;
};

async function fetchCompanyProfile(token: string, view: "preview" | "full") {
  const h = await headers();
  const forwardedProto = h.get("x-forwarded-proto") || "http";
  const forwardedHost = h.get("x-forwarded-host") || h.get("host");
  const base =
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const cookie = h.get("cookie") || "";
  const url = new URL(`${base}/api/company/candidate/${token}`);
  url.searchParams.set("mode", view);

  const res = await fetch(String(url), {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export default async function CompanyCandidateTokenPage({ params, searchParams }: Ctx) {
  const { token } = await params;
  const query = (await searchParams) || {};
  const requestedView = query.view === "full" ? "full" : "preview";
  const checkoutState = query.checkout === "success" ? "success" : query.checkout === "cancel" ? "cancel" : null;
  const { ok, status, body } = await fetchCompanyProfile(token, requestedView);
  const preview: PreviewSnapshot = body?.preview ?? {};
  const returnPath = `/company/candidate/${encodeURIComponent(token)}`;

  if (!ok) {
    const upgradeUrl = body?.upgrade_url ?? "/company/upgrade";

    if (status === 409) {
      return (
        <main className="max-w-4xl p-6">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Perfil aún en preparación</p>
            <h1 className="mt-2 text-2xl font-semibold text-amber-950">Este candidato aún está completando su perfil verificable</h1>
            <p className="mt-3 text-sm leading-6 text-amber-900">
              Recibirás una notificación cuando esté disponible. De momento puedes revisar el snapshot actual sin consumir una visualización completa.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SnapshotField label="Experiencias detectadas" value={String(preview?.experiences_detected ?? "—")} />
              <SnapshotField label="Verificaciones" value={String(preview?.total_verifications ?? "—")} />
              <SnapshotField label="Idiomas detectados" value={String(Array.isArray(preview?.languages_detected) ? preview.languages_detected.length : 0)} />
              <SnapshotField label="Trust score" value={preview?.trust_score != null ? String(preview.trust_score) : "—"} />
            </div>
            <p className="mt-4 text-sm text-amber-900">
              Estado actual: {mapProfileState(preview?.profile_state)} · última actividad {formatDateTime(preview?.last_activity_at)}.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100" href={`/company/candidate/${encodeURIComponent(token)}`}>
                Volver al snapshot
              </a>
              <a className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100" href="/company/candidates">
                Ver base RRHH
              </a>
            </div>
          </section>
        </main>
      );
    }

    if (status === 402) {
      return (
        <main className="max-w-4xl p-6">
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Límite de visualizaciones</p>
            <h1 className="mt-2 text-2xl font-semibold text-rose-950">Has alcanzado el límite de visualizaciones</h1>
            <p className="mt-3 text-sm leading-6 text-rose-900">
              Puedes seguir revisando el snapshot del candidato sin coste. Para abrir el perfil completo necesitas una visualización disponible. Cada apertura completa consume 1 visualización.
            </p>
            <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4 text-sm text-rose-900">
              <p className="font-semibold">Visualizaciones disponibles</p>
              <p className="mt-1">{body?.credits_remaining != null ? String(body.credits_remaining) : "0"} disponibles ahora mismo.</p>
              <p className="mt-1 text-rose-800">Después de comprar volverás a este snapshot y podrás decidir cuándo abrir el perfil completo.</p>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SnapshotField label="Experiencias detectadas" value={String(preview?.experiences_detected ?? "—")} />
              <SnapshotField label="Verificaciones" value={String(preview?.total_verifications ?? "—")} />
              <SnapshotField label="Idiomas detectados" value={String(Array.isArray(preview?.languages_detected) ? preview.languages_detected.length : 0)} />
              <SnapshotField label="Trust score" value={preview?.trust_score != null ? String(preview.trust_score) : "—"} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SnapshotField label="Empresa / email" value={String(preview?.verification_breakdown?.email_or_company ?? 0)} />
              <SnapshotField label="Documento" value={String(preview?.verification_breakdown?.documental ?? 0)} />
            </div>
            <div className="mt-6">
              <ProfileViewCheckoutButtons returnPath={returnPath} upgradeUrl={upgradeUrl} />
            </div>
          </section>
        </main>
      );
    }

    const msg =
      status === 401 ? "Necesitas iniciar sesión para acceder a esta vista privada." :
      status === 403 ? "Necesitas un contexto de empresa activo para acceder a esta vista." :
      status === 410 ? "Este enlace ha caducado." :
      status === 429 ? "Demasiadas solicitudes. Inténtalo más tarde." :
      "No encontrado.";

    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold">Perfil (Empresa)</h1>
        <p className="mt-3 text-sm text-gray-600">{msg}</p>
        {status === 401 ? (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/login?mode=company">Iniciar sesión</a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/signup?mode=company">Crear cuenta empresa</a>
          </div>
        ) : null}
        {status === 403 ? (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company">Cambiar a empresa</a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/dashboard">Ir al panel principal</a>
          </div>
        ) : null}
      </main>
    );
  }

  if (body?.view_mode === "preview") {
    const previewLanguages = Array.isArray(preview?.languages_detected) ? preview.languages_detected.slice(0, 6) : [];
    const verificationTypes = Array.isArray(preview?.verification_types) ? preview.verification_types : [];
    return (
      <main className="max-w-5xl p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {checkoutState === "success" ? (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              Compra completada. Ya puedes abrir el perfil completo cuando lo necesites. El consumo se hará solo al pulsar el botón de apertura completa.
            </div>
          ) : null}
          {checkoutState === "cancel" ? (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              La compra no se completó. Puedes seguir evaluando el snapshot y decidir después si compras visualizaciones o mejoras tu plan.
            </div>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate Snapshot</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Vista previa del candidato</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Resumen sin datos personales para decidir si merece la pena abrir el perfil completo. Esta vista no consume visualizaciones.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Abrir el perfil completo consume 1 visualización y no se descuenta en esta vista previa.
              </p>
            </div>
            <a
              href={`/company/candidate/${encodeURIComponent(token)}?view=full`}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
            >
              Ver perfil completo (-1 visualización)
            </a>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SnapshotField label="Experiencias detectadas" value={String(preview?.experiences_detected ?? "—")} />
            <SnapshotField label="Verificaciones" value={String(preview?.total_verifications ?? "—")} />
            <SnapshotField label="Aprobadas" value={String(preview?.approved_verifications ?? "—")} />
            <SnapshotField label="Idiomas detectados" value={String(previewLanguages.length)} />
            <SnapshotField label="Trust score" value={preview?.trust_score != null ? String(preview.trust_score) : "Pendiente"} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Señales visibles antes de abrir perfil</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {verificationTypes.length ? (
                  verificationTypes.map((item) => (
                    <span key={item} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      Verificación {item}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    Sin verificaciones todavía
                  </span>
                )}
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${preview?.onboarding_status === "candidate_onboarding_in_progress" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
                  {preview?.onboarding_status === "candidate_onboarding_in_progress" ? "Perfil aún completándose" : "Perfil listo para revisar"}
                </span>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {mapProfileState(preview?.profile_state)}
                </span>
              </div>
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                  <span>Progreso de onboarding</span>
                  <span className="font-semibold text-slate-900">{Number(preview?.onboarding_completion ?? 0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, Number(preview?.onboarding_completion ?? 0)))}%` }} />
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <SnapshotField label="Empresa / email" value={String(preview?.verification_breakdown?.email_or_company ?? 0)} />
                <SnapshotField label="Documento" value={String(preview?.verification_breakdown?.documental ?? 0)} />
              </div>
              <p className="mt-4 text-sm text-slate-600">
                Última actividad: {formatDateTime(preview?.last_activity_at)}.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Idiomas detectados</h2>
              {previewLanguages.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {previewLanguages.map((item) => (
                    <span key={item} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">Todavía no hay idiomas detectados en el snapshot.</p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <a className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black" href={`/company/candidate/${encodeURIComponent(token)}?view=full`}>
                  Ver perfil completo (-1 visualización)
                </a>
                <ProfileViewCheckoutButtons returnPath={returnPath} upgradeUrl="/company/upgrade" compact />
                <a className="inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50" href="/company/candidates">
                  Volver a candidatos
                </a>
              </div>
            </article>
          </div>
        </section>
      </main>
    );
  }

  const profile = body?.profile ?? {};
  const gate = body?.gate ?? {};
  const contact = body?.contact ?? {};
  const availability: Availability = body?.availability ?? {};
  const credibility: Credibility = body?.credibility ?? {};
  const trustComponents: TrustComponents = body?.trust_components ?? {};
  const timeline: TimelineRow[] = Array.isArray(body?.verification_timeline) ? body.verification_timeline : [];
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
  const lastVerificationAt = timeline.map((item) => item.resolved_at || item.created_at || null).find(Boolean);
  const actionableVerification = timeline.find((item) => {
    const status = String(item.status || "").toLowerCase();
    return Boolean(item.verification_id) && (status === "pending_company" || status === "reviewing" || status === "draft");
  });

  return (
    <main className="max-w-5xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Perfil verificado para empresa</h1>
          <p className="mt-1 text-sm text-gray-600">
            Vista profesional del candidato con señales verificables para acelerar decisiones de contratación.
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

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Resumen verificable</h2>
            <p className="mt-1 text-sm text-gray-600">
              Señales clave para entender en segundos cuánto del historial laboral está ya contrastado.
            </p>
          </div>
          {actionableVerification?.verification_id ? (
            <a
              href={`/company/verification/${encodeURIComponent(String(actionableVerification.verification_id))}`}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Confirmar experiencia
            </a>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryField label="Estado del perfil" value={mapProfileStatus(String(credibility?.profile_status || "reviewing"))} />
          <SummaryField label="Experiencias verificadas" value={String(verifiedWork)} />
          <SummaryField label="Evidencias documentales" value={String(evidencesCount)} />
          <SummaryField
            label="Última verificación"
            value={lastVerificationAt ? new Date(String(lastVerificationAt)).toLocaleDateString("es-ES") : "Pendiente"}
          />
          <SummaryField label="Trust Score" value={String(trustScore)} />
        </div>
        {timeline.length ? (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-900">Trayectoria confirmada reciente</div>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {timeline.slice(0, 3).map((item, idx) => (
                <li key={item.verification_id || `summary-${idx}`} className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                  <span className="font-medium text-slate-900">{item.position || "Experiencia verificada"}</span>
                  <span className="text-slate-500">{item.company_name || "Empresa no indicada"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Señales de credibilidad</h2>
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
          Este bloque resume la solidez verificable del perfil para reducir riesgo de contratación.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <BreakdownBar label="Verificaciones" value={Number(trustComponents?.verification ?? 0)} />
          <BreakdownBar label="Evidencias" value={Number(trustComponents?.evidence ?? 0)} />
          <BreakdownBar label="Consistencia" value={Number(trustComponents?.consistency ?? 0)} />
          <BreakdownBar label="Reutilización" value={Number(trustComponents?.reuse ?? 0)} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Historial verificable</h2>
        {timeline.length ? (
          <ol className="relative mt-3 ml-2 border-l border-slate-200 pl-4">
            {timeline.map((item, idx) => (
              <li key={item.verification_id || `timeline-${idx}`} className="mb-4 last:mb-0">
                <span className="absolute -left-[6px] mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-600" />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.position || "Experiencia verificada"}</p>
                      <p className="text-xs text-slate-600">{item.company_name || "Empresa no especificada"}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{formatPeriod(item.start_date, item.end_date)}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span>Evidencias: <span className="font-semibold text-slate-900">{Number(item.evidence_count ?? 0)}</span></span>
                    <span>Reutilizaciones: <span className="font-semibold text-slate-900">{Number(item.reuse_count ?? 0)}</span></span>
                    {item.verification_id ? (
                      <a
                        href={`/company/verification/${encodeURIComponent(String(item.verification_id))}`}
                        className="ml-auto rounded-full border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {String(item.status || "").toLowerCase() === "verified" || String(item.status || "").toLowerCase() === "rejected"
                          ? "Ver resolución"
                          : "Confirmar experiencia"}
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-gray-600">Aún no hay historial verificable disponible.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Contacto del candidato</h2>
        {hasContact ? (
          <div className="mt-3 space-y-3">
            {hasEmail ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="text-sm font-medium text-gray-900">{contact.email}</div>
                </div>
                <a className="rounded-md border px-3 py-2 text-sm inline-block" href={`mailto:${contact.email}`}>
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
                <a className="rounded-md border px-3 py-2 text-sm inline-block" href={`tel:${String(contact.phone).replace(/\s+/g, "")}`}>
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

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Disponibilidad profesional</h2>
        {hasAvailabilityData ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Estado actual" value={mapJobSearchStatus(availability?.job_search_status)} />
            <Field label="Incorporación" value={mapAvailabilityStart(availability?.availability_start)} />
            <Field label="Tipo de jornada" value={mapWorkday(availability?.preferred_workday)} />
            <Field label="Áreas o funciones de interés" value={roles.length ? roles.join(", ") : "Pendiente de completar"} />
            <Field label="Zona o zonas preferidas" value={typeof availability?.work_zones === "string" && availability.work_zones.trim() ? availability.work_zones : "Pendiente de completar"} />
            <Field label="Disponibilidad horaria" value={schedules.length ? schedules.join(", ") : "Pendiente de completar"} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">El candidato todavía no ha completado su disponibilidad profesional.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Resumen profesional</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" value={String(profile?.full_name || profile?.name || "Pendiente de completar")} />
          <Field label="Titular profesional" value={String(profile?.title || profile?.headline || "Pendiente de completar")} />
          <Field label="Ubicación" value={String(profile?.location || "Pendiente de completar")} />
          <Field label="Experiencias totales" value={String(profile?.experiences_total ?? "Pendiente de completar")} />
        </div>
      </section>

      <div className="mt-6 flex gap-3">
        <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/requests">Continuar evaluación en solicitudes</a>
        <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/candidates">Ver más candidatos</a>
      </div>
    </main>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "sin actividad reciente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sin actividad reciente";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function mapProfileState(value?: string | null) {
  const state = String(value || "").toLowerCase();
  if (state === "en_construccion") return "En construcción";
  if (state === "actualizado_recientemente") return "Actualizado recientemente";
  return "Listo para ver";
}

function SnapshotField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-slate-50 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function BreakdownBar({ label, value }: { label: string; value: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{safe}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}

function statusLabel(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "verified" || s === "approved") return "Verificada";
  if (s === "reviewing") return "En revisión";
  if (s === "pending_company") return "Pendiente empresa";
  if (s === "rejected") return "Rechazada";
  if (s === "revoked") return "Revocada";
  return "En validación";
}

function statusClass(status?: string | null) {
  const s = String(status || "").toLowerCase();
  if (s === "verified" || s === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "reviewing") return "border-amber-200 bg-amber-50 text-amber-700";
  if (s === "pending_company") return "border-slate-300 bg-slate-100 text-slate-700";
  if (s === "rejected" || s === "revoked") return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function formatPeriod(start?: string | null, end?: string | null) {
  const startText = formatMonthYear(start);
  const endText = end ? formatMonthYear(end) : "Actualidad";
  if (!startText && !end) return "Periodo no especificado";
  return `${startText || "Inicio no definido"} · ${endText}`;
}

function formatMonthYear(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { month: "short", year: "numeric" });
}

function mapJobSearchStatus(v?: string | null) {
  if (v === "buscando_activamente") return "Buscando empleo activamente";
  if (v === "abierto_oportunidades") return "Abierto a oportunidades";
  if (v === "no_disponible") return "No disponible actualmente";
  return "Pendiente de completar";
}

function mapAvailabilityStart(v?: string | null) {
  if (v === "inmediata") return "Inmediata";
  if (v === "7_dias") return "En 7 días";
  if (v === "15_dias") return "En 15 días";
  if (v === "30_dias") return "En 30 días";
  if (v === "mas_adelante") return "Más adelante";
  return "Pendiente de completar";
}

function mapWorkday(v?: string | null) {
  if (v === "jornada_completa") return "Jornada completa";
  if (v === "media_jornada") return "Media jornada";
  if (v === "temporal_proyectos" || v === "extras_eventos" || v === "fines_semana") return "Temporal / por proyectos";
  if (v === "flexible") return "Flexible";
  return "Pendiente de completar";
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
