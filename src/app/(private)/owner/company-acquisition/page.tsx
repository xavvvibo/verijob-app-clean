import Link from "next/link";
import { redirect } from "next/navigation";
import {
  conversionStateLabel,
  loadVerificationCompanyAcquisition,
  onboardingStateLabel,
  originStateLabel,
  registrationStateDisplay,
  subscriptionStateLabel,
  verificationCompanyAcquisitionBadgeTone,
} from "@/lib/owner/verification-company-acquisition";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-ES");
}

function Badge({
  tone,
  label,
}: {
  tone: string;
  label: string;
}) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export default async function OwnerCompanyAcquisitionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filter = String(sp.filter || "all").toLowerCase();
  const q = String(sp.q || "").trim();

  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect("/login?next=/owner/company-acquisition");
  const { data: ownerProfile } = await sessionClient.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (ownerRole !== "owner" && ownerRole !== "admin") redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const { summary, filteredRows, rows } = await loadVerificationCompanyAcquisition(admin, {
    filter:
      filter === "unregistered" ||
      filter === "registered" ||
      filter === "free" ||
      filter === "paid" ||
      filter === "multiple_requests" ||
      filter === "inactive"
        ? filter
        : "all",
    q,
  });

  const filterLinks = [
    { key: "all", label: "Todas", note: `${rows.length}` },
    {
      key: "unregistered",
      label: "No registradas",
      note: `${rows.filter((row) => row.registrationState === "not_registered" || row.registrationState === "opened_link").length}`,
    },
    {
      key: "registered",
      label: "Registradas",
      note: `${rows.filter((row) => row.registrationState === "registered" || row.registrationState === "onboarding_completed").length}`,
    },
    { key: "free", label: "Free", note: `${rows.filter((row) => row.conversionState === "converted_free").length}` },
    { key: "paid", label: "De pago", note: `${rows.filter((row) => row.conversionState === "converted_paid").length}` },
    { key: "multiple_requests", label: "Con varias solicitudes", note: `${rows.filter((row) => row.hasMultipleRequests).length}` },
    { key: "inactive", label: "Sin actividad reciente", note: `${rows.filter((row) => !row.hasRecentActivity).length}` },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Empresas captadas por verificación</h1>
            <p className="mt-1 text-sm text-slate-600">
              Seguimiento de empresas que han recibido solicitudes de verificación y su conversión a registro y pago.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/owner/overview"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Volver a overview
            </Link>
            <Link
              href="/owner/verifications"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver solicitudes individuales
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Empresas con al menos 1 solicitud</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.impactedCompanies}</div>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Registradas desde verificación</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.registeredFromVerification}</div>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Convertidas a free</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.convertedToFree}</div>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Convertidas a pago</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.convertedToPaid}</div>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Tasa verificación → registro</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.verificationToRegistrationRate}%</div>
          </article>
          <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">Tasa verificación → pago</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.verificationToPaymentRate}%</div>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterLinks.map((item) => {
              const active = filter === item.key || (!filter && item.key === "all");
              const href = item.key === "all" ? `/owner/company-acquisition${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/owner/company-acquisition?filter=${encodeURIComponent(item.key)}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
              return (
                <Link
                  key={item.key}
                  href={href}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                  <span className={`ml-1 ${active ? "text-blue-100" : "text-slate-500"}`}>{item.note}</span>
                </Link>
              );
            })}
          </div>

          <form className="flex w-full max-w-md gap-2">
            <input type="hidden" name="filter" value={filter === "all" ? "" : filter} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar empresa, email o dominio"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Filtrar
            </button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Empresa</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Email / dominio objetivo</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Solicitudes</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Primera solicitud</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Última solicitud</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Última actividad</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Registro</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Onboarding</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Suscripción / plan</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Conversión</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRows.length ? (
                filteredRows.map((row) => (
                  <tr key={row.key} className="align-top">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{row.companyName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Origen: {originStateLabel(row.origin)}
                        {row.companyWasPreexisting ? " · ya existía antes de la primera solicitud" : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <div>{row.targetEmail || "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.targetDomain || "Dominio no concluyente"}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      <div className="font-semibold text-slate-900">{row.requestsCount}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.hasMultipleRequests ? "Varias solicitudes" : "Una solicitud"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{formatDate(row.firstRequestAt)}</td>
                    <td className="px-3 py-3 text-slate-700">{formatDate(row.lastRequestAt)}</td>
                    <td className="px-3 py-3 text-slate-700">
                      <div>{formatDate(row.lastActivityAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {row.hasRecentActivity ? "Con actividad reciente" : "Sin actividad reciente"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        tone={verificationCompanyAcquisitionBadgeTone("registration", row.registrationState)}
                        label={registrationStateDisplay(row.registrationState)}
                      />
                    </td>
                    <td className="px-3 py-3 text-slate-700">{onboardingStateLabel(row.onboardingState)}</td>
                    <td className="px-3 py-3">
                      <Badge
                        tone={verificationCompanyAcquisitionBadgeTone("subscription", row.subscriptionState)}
                        label={subscriptionStateLabel(row.subscriptionState)}
                      />
                      <div className="mt-1 text-xs text-slate-500">{row.planLabel}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        tone={verificationCompanyAcquisitionBadgeTone("conversion", row.conversionState)}
                        label={conversionStateLabel(row.conversionState)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-2">
                        {row.companyId ? (
                          <Link
                            href={`/owner/companies/${row.companyId}`}
                            className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Ver empresa
                          </Link>
                        ) : null}
                        <Link
                          href={`/owner/verifications?q=${encodeURIComponent(row.targetEmail || row.targetDomain || row.companyName)}`}
                          className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Ver solicitudes
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay empresas impactadas que encajen con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
