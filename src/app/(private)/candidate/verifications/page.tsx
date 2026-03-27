import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import CandidateOperationsLayout from "@/components/candidate-v2/layouts/CandidateOperationsLayout";
import CandidatePageHeader from "@/components/candidate-v2/primitives/CandidatePageHeader";
import CandidateEmptyState from "@/components/candidate-v2/primitives/CandidateEmptyState";
import DeleteVerificationInlineButton from "./DeleteVerificationInlineButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusLabel(status: string | null | undefined) {
  const raw = String(status || "").toLowerCase();
  if (raw === "pending_company") return "Pendiente de validación";
  if (raw === "reviewing") return "En revisión";
  if (raw === "verified") return "Verificación completada";
  if (raw === "rejected") return "Rechazada";
  if (raw === "revoked") return "Revocada";
  return "En seguimiento";
}

function channelLabel(rawValue: string | null | undefined) {
  const raw = String(rawValue || "").toLowerCase();
  if (raw === "documentary") return "Documental";
  if (raw === "email") return "Email corporativo";
  if (raw === "peer") return "Peer";
  return "Verificación";
}

function companySignalLabel(status: string | null | undefined) {
  const raw = String(status || "").toLowerCase();
  if (raw === "registered_in_verijob") return "Empresa registrada en VERIJOB";
  if (raw === "verified_document") return "Empresa verificadora validada documentalmente";
  if (raw === "verified_paid") return "Empresa con plan activo";
  if (raw === "unverified_external") return "Validación por Email corporativo";
  return "Sin señal adicional";
}

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function CandidateVerificationsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: au } = await supabase.auth.getUser();
  if (!au.user) redirect("/login?next=/candidate/verifications");

  const { data: rows, error } = await supabase
    .from("verification_requests")
    .select(
      "id,status,revoked_at,verification_channel,requested_at,created_at,company_name_target,external_email_target,request_context,company_verification_status_snapshot",
    )
    .eq("requested_by", au.user.id)
    .order("requested_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });
  const visibleRows = (rows || []).filter((row: any) => {
    const status = String(row?.status || "").toLowerCase();
    return !row?.revoked_at && status !== "revoked";
  });
  const activeRows = visibleRows.filter((row: any) => {
    const status = String(row?.status || "").toLowerCase();
    return status === "pending_company" || status === "reviewing";
  });
  const completedRows = visibleRows.filter((row: any) => !activeRows.includes(row));

  return (
    <CandidateOperationsLayout>
      <CandidatePageHeader
        eyebrow="Verificaciones"
        title="Qué validaciones están en marcha y cuáles ya se han resuelto"
        description="Sigue tus solicitudes con una lectura clara: quién valida tu experiencia, por qué canal se ha enviado y qué impacto tiene en tu perfil."
        badges={["En curso", "Completadas", "Señal empresarial"]}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          No se han podido cargar tus verificaciones: {error.message}
        </div>
      ) : null}

      {!error && (!visibleRows || visibleRows.length === 0) ? (
        <CandidateEmptyState
          title="Aún no tienes solicitudes"
          description="Crea la primera verificación desde Experiencias para empezar a reforzar tu historial con señales reales."
          action={
            <Link href="/candidate/experience" className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
              Ir a experiencias
            </Link>
          }
        />
      ) : null}

      {!error && visibleRows && visibleRows.length > 0 ? (
        <div className="space-y-10">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800">En curso</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{activeRows.length}</p>
              <p className="mt-2 text-sm text-slate-700">Solicitudes que todavía pueden reforzar tu perfil.</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Resueltas</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{completedRows.length}</p>
              <p className="mt-2 text-sm text-slate-700">Validaciones ya cerradas y visibles para consulta.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Valor para tu perfil</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Más señal, menos dudas</p>
              <p className="mt-2 text-sm text-slate-600">Cada validación completada hace tu trayectoria más creíble cuando una empresa la revisa.</p>
            </div>
          </div>
          <VerificationSection
            title="En curso"
            description="Solicitudes que todavía están esperando respuesta o revisión por parte de la empresa."
            rows={activeRows}
          />
          <VerificationSection
            title="Completadas y cerradas"
            description="Solicitudes ya resueltas para que puedas consultar qué experiencias ya están reforzadas."
            rows={completedRows}
          />
        </div>
      ) : null}
    </CandidateOperationsLayout>
  );
}

function VerificationSection({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: any[];
}) {
  if (!rows.length) return null;

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="space-y-3">
        {rows.map((row: any) => (
          <article key={row.id} className="flex flex-col gap-4 rounded-2xl border-b border-slate-100 px-2 py-4 transition-colors duration-150 hover:bg-slate-50/50 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-slate-950">{row.company_name_target || "Empresa"}</h3>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {statusLabel(row.status)}
                </span>
              </div>
              <div className="space-y-1 text-sm text-slate-500">
                <p>{row.external_email_target || "Sin email asociado"}</p>
                <p>
                  {channelLabel(row.verification_channel)} · {companySignalLabel(row.company_verification_status_snapshot)}
                </p>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{fmt(row.requested_at || row.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Link
                href={`/candidate/verification?verification_request_id=${encodeURIComponent(row.id)}`}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-black"
              >
                Ver detalle
              </Link>
              <DeleteVerificationInlineButton verificationId={String(row.id)} />
            </div>
          </article>
        ))}
        </div>
      </div>
    </section>
  );
}
