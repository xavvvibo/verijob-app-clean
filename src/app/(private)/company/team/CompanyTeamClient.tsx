"use client";

import { useEffect, useMemo, useState } from "react";

type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at?: string | null;
  invited_at?: string | null;
  full_name?: string | null;
  email?: string | null;
};

type TeamInvitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_at?: string | null;
  accepted_at?: string | null;
  revoked_at?: string | null;
  invite_token?: string | null;
};

type TeamPayload = {
  company_id?: string;
  membership_role?: string;
  members?: TeamMember[];
  invitations?: TeamInvitation[];
  invitations_meta?: {
    available?: boolean;
    warning_code?: string | null;
    warning_message?: string | null;
    migration_files?: string[] | null;
  };
  plan?: {
    code?: string;
    label?: string;
    status?: string;
    seats_limit?: number;
    seats_used?: number;
    pending_invitations?: number;
  };
};

function roleLabel(role: string) {
  return role === "admin" ? "Admin" : "Reviewer";
}

function inviteStatusLabel(status: string) {
  if (status === "accepted") return "Aceptada";
  if (status === "cancelled") return "Cancelada";
  if (status === "expired") return "Caducada";
  return "Pendiente";
}

function statusClass(status: string) {
  if (status === "active" || status === "accepted") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "cancelled" || status === "expired") return "border-slate-300 bg-slate-100 text-slate-700";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

export default function CompanyTeamClient() {
  const [payload, setPayload] = useState<TeamPayload | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("reviewer");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/company/team", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.user_message || data?.details || data?.error || "No se pudo cargar el equipo.");
      setLoading(false);
      return;
    }
    setPayload(data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const canInvite = String(payload?.membership_role || "") === "admin";
  const members = Array.isArray(payload?.members) ? payload!.members! : [];
  const invitations = Array.isArray(payload?.invitations) ? payload!.invitations! : [];
  const seatsLimit = Number(payload?.plan?.seats_limit || 0);
  const seatsUsed = Number(payload?.plan?.seats_used || 0);
  const pendingInvitations = Number(payload?.plan?.pending_invitations || 0);
  const seatsRemaining = Math.max(0, seatsLimit - seatsUsed - pendingInvitations);

  const summary = useMemo(() => {
    return {
      admins: members.filter((item) => item.role === "admin").length,
      reviewers: members.filter((item) => item.role !== "admin").length,
    };
  }, [members]);

  async function submitInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/company/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(data?.user_message || data?.details || data?.error || "No se pudo crear la invitacion.");
      return;
    }
    setMessage(data?.user_message || "Invitacion creada.");
    setInviteLink(typeof data?.invite_link === "string" ? data.invite_link : null);
    setEmail("");
    setRole("reviewer");
    await load();
  }

  async function cancelInvitation(invitationId: string) {
    setActionId(invitationId);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/company/team", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel", invitation_id: invitationId }),
    });
    const data = await res.json().catch(() => ({}));
    setActionId(null);
    if (!res.ok) {
      setError(data?.user_message || data?.details || data?.error || "No se pudo cancelar la invitacion.");
      return;
    }
    setMessage(data?.user_message || "Invitacion cancelada.");
    await load();
  }

  if (loading) return <p className="text-sm text-slate-600">Cargando equipo…</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Equipo y permisos</h1>
        <p className="mt-2 text-sm text-slate-600">Gestiona el workspace, entiende la capacidad actual y mueve invitaciones sin sensación de backoffice.</p>
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        {inviteLink ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Enlace de invitacion</p>
            <p className="mt-2 break-all text-sm text-blue-900">{inviteLink}</p>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(inviteLink)}
              className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100"
            >
              Copiar enlace
            </button>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Miembros activos</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{members.length}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Admins</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.admins}</p>
        </article>
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Reviewers</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.reviewers}</p>
        </article>
        <article className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Capacidad</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{seatsUsed + pendingInvitations}/{seatsLimit}</p>
          <p className="mt-2 text-sm text-slate-600">Plan {payload?.plan?.label || "Free"} · libres {seatsRemaining}</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Usuarios activos</h2>
              <p className="mt-1 text-sm text-slate-600">Miembros reales vinculados a la empresa.</p>
            </div>
          </div>
          <div className="mt-4 overflow-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Rol</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Alta</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-slate-100 text-slate-800">
                    <td className="px-3 py-2 font-medium text-slate-900">{member.full_name || "Usuario empresa"}</td>
                    <td className="px-3 py-2">{member.email || "Sin email visible"}</td>
                    <td className="px-3 py-2">{roleLabel(member.role)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(member.status)}`}>
                        Activo
                      </span>
                    </td>
                    <td className="px-3 py-2">{member.joined_at ? new Date(member.joined_at).toLocaleDateString("es-ES") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Invitar nuevo usuario</h2>
          <p className="mt-1 text-sm text-slate-600">Añade admins o reviewers sin salir del workspace.</p>
          {payload?.invitations_meta?.available === false ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Invitaciones pendientes de activar</p>
              <p className="mt-1 text-xs">{payload.invitations_meta.warning_message}</p>
              {Array.isArray(payload.invitations_meta.migration_files) && payload.invitations_meta.migration_files.length ? (
                <div className="mt-2 text-xs">
                  SQL requerido:
                  {payload.invitations_meta.migration_files.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={submitInvite}>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canInvite || submitting}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  placeholder="equipo@empresa.com"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Rol</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={!canInvite || submitting}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                >
                  <option value="reviewer">Reviewer</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={!canInvite || submitting || !email.trim()}
                className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {submitting ? "Creando invitacion…" : "Crear invitacion"}
              </button>
              {!canInvite ? <p className="text-xs text-slate-500">Solo los admins pueden invitar nuevos usuarios.</p> : null}
            </form>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Invitaciones</h3>
            {invitations.length === 0 ? (
              <p className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                No hay invitaciones pendientes ahora mismo.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {invitations.map((invitation) => (
                  <article key={invitation.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{invitation.email}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {roleLabel(invitation.role)} · {invitation.invited_at ? new Date(invitation.invited_at).toLocaleDateString("es-ES") : "Sin fecha"}
                        </div>
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(invitation.status)}`}>
                        {inviteStatusLabel(invitation.status)}
                      </span>
                    </div>
                    {invitation.status === "pending" && canInvite ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => cancelInvitation(invitation.id)}
                          disabled={actionId === invitation.id}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {actionId === invitation.id ? "Actualizando…" : "Cancelar invitacion"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </div>
  );
}
