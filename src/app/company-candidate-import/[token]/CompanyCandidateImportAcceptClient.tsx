"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";

type InvitePayload = {
  id: string;
  candidate_email: string;
  candidate_name_raw?: string | null;
  target_role?: string | null;
  status?: string | null;
  parse_status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  display_status?: string | null;
  company?: {
    id: string;
    name: string;
  };
  extracted_payload_json?: Record<string, any> | null;
  candidate_already_exists?: boolean | null;
  existing_candidate_public_token?: string | null;
};

type InviteResponse = {
  invite?: InvitePayload;
  auth?: {
    user_id?: string | null;
    user_email?: string | null;
    email_matches_invite?: boolean;
  };
  legal?: {
    text_version?: string;
    snapshot?: {
      statements?: string[];
    };
  };
  user_message?: string;
  migration_files?: string[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPeriod(startDate: unknown, endDate: unknown) {
  const start = String(startDate || "").trim();
  const end = String(endDate || "").trim();
  return `${start || "Fecha no detectada"} — ${end || "Actualidad"}`;
}

export default function CompanyCandidateImportAcceptClient({ token }: { token: string }) {
  const [payload, setPayload] = useState<InviteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checks, setChecks] = useState({
    declared_cv_delivery: false,
    accepted_company_process: false,
    accepted_import_processing: false,
    understood_review_before_publish: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/company-candidate-import/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.user_message || data?.details || data?.error || "No se pudo cargar la invitación.");
        }
        if (!cancelled) setPayload(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "No se pudo cargar la invitación.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const nextPath = useMemo(() => `/company-candidate-import/${encodeURIComponent(token)}`, [token]);
  const loginHref = useMemo(() => `/login?next=${encodeURIComponent(nextPath)}`, [nextPath]);
  const signupHref = useMemo(() => `/signup?mode=candidate&next=${encodeURIComponent(nextPath)}`, [nextPath]);
  const allChecked = Object.values(checks).every(Boolean);

  async function acceptInvite(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/public/company-candidate-import/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(checks),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.user_message || data?.details || data?.error || "No se pudo aceptar la invitación.");
      }
      setNotice(data?.user_message || "Invitación aceptada correctamente.");
      window.location.href = data?.next_url || "/candidate/overview?company_cv_import=1";
    } catch (e: any) {
      setError(e?.message || "No se pudo aceptar la invitación.");
    } finally {
      setSubmitting(false);
    }
  }

  const invite = payload?.invite;
  const auth = payload?.auth;
  const statements = Array.isArray(payload?.legal?.snapshot?.statements) ? payload?.legal?.snapshot?.statements : [];
  const companyName = resolveCompanyDisplayName(invite?.company || null, "Tu empresa");
  const candidateAlreadyExists = Boolean(invite?.candidate_already_exists);
  const parsePreview = invite?.extracted_payload_json || null;
  const experienceCount = Array.isArray(parsePreview?.experiences) ? parsePreview.experiences.length : 0;
  const educationCount = Array.isArray(parsePreview?.education) ? parsePreview.education.length : 0;
  const languagesCount = Array.isArray(parsePreview?.languages) ? parsePreview.languages.length : 0;
  const previewExperiences = Array.isArray(parsePreview?.experiences) ? parsePreview.experiences.slice(0, 6) : [];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">VERIJOB · Importación de candidatura</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            Revisa y acepta la importación de tu CV
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {candidateAlreadyExists
              ? `${companyName} ha incorporado una nueva versión de tu CV a su proceso de selección dentro de VERIJOB. Antes de continuar, debes confirmar expresamente la gestión de tu candidatura y revisar posibles cambios detectados.`
              : `${companyName} ha incorporado tu CV a su proceso de selección dentro de VERIJOB. Antes de continuar, debes confirmar expresamente la gestión de tu candidatura y la importación inicial de tus datos.`}
          </p>
        </section>

        {loading ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm text-sm text-slate-600">
            Cargando invitación…
          </section>
        ) : error ? (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-7 shadow-sm text-sm text-rose-700">
            {error}
          </section>
        ) : invite ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Resumen de la invitación</h2>
                <dl className="mt-4 grid gap-3 text-sm text-slate-700">
                  <div>
                    <dt className="font-semibold text-slate-900">Empresa</dt>
                    <dd>{companyName}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Email asociado</dt>
                    <dd>{invite.candidate_email}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Puesto asociado</dt>
                    <dd>{invite.target_role || "No indicado"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Recibida</dt>
                    <dd>{formatDate(invite.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-900">Estado actual</dt>
                    <dd>{invite.display_status || "Pendiente"}</dd>
                  </div>
                </dl>
              </article>

              <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-base font-semibold text-slate-900">Prefill detectado</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {candidateAlreadyExists
                    ? "Tras aceptar podrás revisar posibles experiencias nuevas o cambios detectados antes de incorporarlos a tu perfil."
                    : "Tras aceptar podrás revisar este perfil preliminar antes de publicarlo o verificarlo."}
                </p>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Experiencia</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{experienceCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Formación</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{educationCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Idiomas</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{languagesCount}</p>
                  </div>
                </div>
              </aside>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Hemos detectado estas experiencias en tu CV</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Antes de continuar, revisa rápidamente las experiencias detectadas. Después podrás confirmarlas o editarlas dentro de tu perfil.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {experienceCount} experiencias
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    {languagesCount} idiomas
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {previewExperiences.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    No hemos detectado experiencias con suficiente claridad en este CV. Aun así podrás revisar y completar tu perfil manualmente.
                  </div>
                ) : (
                  previewExperiences.map((item: any, index: number) => (
                    <article key={`${item?.company_name || "exp"}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item?.role_title || "Puesto detectado"}</p>
                      <p className="mt-1 text-sm text-slate-600">{item?.company_name || "Empresa no detectada"}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatPeriod(item?.start_date, item?.end_date)}</p>
                    </article>
                  ))
                )}
              </div>
            </section>

            {!auth?.user_id ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Accede con tu email para continuar</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Este acceso forma parte de un proceso de registro. Si ya tienes cuenta inicia sesión. Si no, crea tu cuenta para continuar con la importación del CV.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={signupHref} className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                    Continuar registro
                  </Link>
                  <Link href={loginHref} className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                    Ya tengo cuenta → iniciar sesión
                  </Link>
                </div>
              </section>
            ) : auth.email_matches_invite === false ? (
              <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 shadow-sm text-sm text-amber-900">
                Esta invitación está vinculada a <strong>{invite.candidate_email}</strong>. Has iniciado sesión con <strong>{auth.user_email || "otro email"}</strong>. Entra con el email correcto para continuar.
              </section>
            ) : invite.display_status === "completed" ? (
              <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 shadow-sm">
                <h2 className="text-base font-semibold text-emerald-900">Invitación ya aceptada</h2>
                <p className="mt-2 text-sm text-emerald-800">
                  Esta invitación ya quedó registrada y tu perfil preliminar está disponible dentro de VERIJOB.
                </p>
                <div className="mt-4">
                  <Link href={candidateAlreadyExists ? "/candidate/import-updates?company_cv_import=1" : "/candidate/overview?company_cv_import=1"} className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">
                    {candidateAlreadyExists ? "Revisar cambios detectados" : "Ir a mi perfil importado"}
                  </Link>
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Aceptación legal expresa</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Esta aceptación deja trazabilidad de tu consentimiento en el flujo empresa → candidato dentro de VERIJOB.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    Versión legal {payload?.legal?.text_version || "v1"}
                  </span>
                </div>

                <form onSubmit={acceptInvite} className="mt-5 space-y-4">
                  <label className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={checks.declared_cv_delivery}
                      onChange={(e) => setChecks((prev) => ({ ...prev, declared_cv_delivery: e.target.checked }))}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-700">
                      {statements[0] || `Declaro que he entregado voluntariamente mi CV a ${companyName} en el contexto de un proceso de selección.`}
                    </span>
                  </label>

                  <label className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={checks.accepted_company_process}
                      onChange={(e) => setChecks((prev) => ({ ...prev, accepted_company_process: e.target.checked }))}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-700">
                      Acepto que {companyName} gestione mi candidatura mediante VERIJOB dentro de este proceso de selección.
                    </span>
                  </label>

                  <label className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={checks.accepted_import_processing}
                      onChange={(e) => setChecks((prev) => ({ ...prev, accepted_import_processing: e.target.checked }))}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-700">
                      {statements[1] || `Acepto que ${companyName} gestione mi candidatura mediante VERIJOB y que los datos contenidos en mi CV sean importados y estructurados para completar mi perfil profesional.`}
                    </span>
                  </label>

                  <label className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                    <input
                      type="checkbox"
                      checked={checks.understood_review_before_publish}
                      onChange={(e) => setChecks((prev) => ({ ...prev, understood_review_before_publish: e.target.checked }))}
                      className="mt-1"
                    />
                    <span className="text-sm text-slate-700">
                      {statements[2] || "Entiendo que podré revisar, corregir y completar mi información antes de publicarla o verificarla."}
                    </span>
                  </label>

                  <p className="text-xs leading-6 text-slate-500">
                    Al continuar aceptas el tratamiento inicial de tus datos conforme a la <Link href="/privacidad" className="font-semibold text-slate-700 underline">Política de privacidad</Link> y los <Link href="/terminos" className="font-semibold text-slate-700 underline">Términos de uso</Link> aplicables.
                  </p>

                  {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
                  {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={!allChecked || submitting}
                      className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                    >
                      {submitting ? "Registrando aceptación…" : "Confirmar experiencias y continuar"}
                    </button>
                    <Link
                      href="/candidate/experience?new=1#manual-experience"
                      className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      Editar antes de continuar
                    </Link>
                  </div>
                </form>
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
