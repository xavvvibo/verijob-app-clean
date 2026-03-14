import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { isCompanyLifecycleBlocked, readCompanyLifecycle } from "@/lib/company/lifecycle-guard";

export const dynamic = "force-dynamic";

const ROUTE_VERSION = "company-team-v1";

function json(status: number, body: any) {
  return NextResponse.json({ ...body, route_version: ROUTE_VERSION }, { status });
}

function seatLimitForPlan(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("company_team")) return 10;
  if (plan.includes("company_hiring")) return 5;
  if (plan.includes("company_access")) return 2;
  return 1;
}

function planLabel(planRaw: unknown) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("company_team")) return "Team";
  if (plan.includes("company_hiring")) return "Hiring";
  if (plan.includes("company_access")) return "Access";
  return "Free";
}

function normalizeInviteRole(value: unknown) {
  return String(value || "").toLowerCase() === "admin" ? "admin" : "reviewer";
}

function isInvitationTableMissing(error: any) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || msg.includes("company_team_invitations");
}

async function resolveContext() {
  const supabase = await createRouteHandlerClient();
  const admin = createServiceRoleClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) return { error: json(400, { error: "auth_getUser_failed", details: userErr.message }) };
  if (!user) return { error: json(401, { error: "unauthorized" }) };

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("active_company_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) return { error: json(400, { error: "profiles_read_failed", details: profileErr.message }) };

  let companyId = profile?.active_company_id ? String(profile.active_company_id) : null;
  if (!companyId) {
    const { data: latestMembership, error: membershipErr } = await admin
      .from("company_members")
      .select("company_id,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (membershipErr) return { error: json(400, { error: "company_members_read_failed", details: membershipErr.message }) };
    companyId = latestMembership?.company_id ? String(latestMembership.company_id) : null;
    if (companyId) {
      await admin.from("profiles").update({ active_company_id: companyId }).eq("id", user.id);
    }
  }
  if (!companyId) return { error: json(400, { error: "no_active_company" }) };

  const { data: membership, error: membershipErr } = await admin
    .from("company_members")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipErr) return { error: json(400, { error: "company_membership_read_failed", details: membershipErr.message }) };
  if (!membership) return { error: json(403, { error: "company_membership_required" }) };

  return {
    user,
    companyId,
    membershipRole: String(membership.role || "reviewer").toLowerCase(),
    admin,
  };
}

async function readTeamSnapshot(admin: any, companyId: string, userId: string) {
  const [{ data: members }, { data: sub }, invitationsRes] = await Promise.all([
    admin
      .from("company_members")
      .select("id,user_id,role,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    admin
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("company_team_invitations")
      .select("id,email,role,status,invited_at,accepted_at,revoked_at,invite_token")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  let invitationMeta: any = {
    available: true,
    warning_code: null,
    warning_message: null,
    migration_files: [] as string[],
  };

  let invitations = Array.isArray(invitationsRes.data) ? invitationsRes.data : [];
  if (invitationsRes.error) {
    if (isInvitationTableMissing(invitationsRes.error)) {
      invitationMeta = {
        available: false,
        warning_code: "company_team_invitations_missing_migration",
        warning_message:
          "La base actual aun no tiene activado el modulo de invitaciones. Puedes ver los miembros reales y activar invitaciones aplicando la migracion SQL.",
        migration_files: ["scripts/sql/f35_company_team_invitations.sql"],
      };
      invitations = [];
    } else {
      throw new Error(invitationsRes.error.message);
    }
  }

  const userIds = Array.isArray(members) ? members.map((row: any) => String(row.user_id || "")).filter(Boolean) : [];
  const { data: userProfiles } = userIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", userIds)
    : ({ data: [] } as any);
  const profilesById = new Map(
    (Array.isArray(userProfiles) ? userProfiles : []).map((row: any) => [String(row.id), row])
  );

  const normalizedMembers = (Array.isArray(members) ? members : []).map((row: any) => {
    const profile = profilesById.get(String(row.user_id || "")) || {};
    return {
      id: String(row.id || ""),
      user_id: String(row.user_id || ""),
      role: String(row.role || "reviewer"),
      status: "active",
      joined_at: row.created_at || null,
      invited_at: row.created_at || null,
      full_name: String((profile as any)?.full_name || "").trim() || null,
      email: String((profile as any)?.email || "").trim() || null,
    };
  });

  return {
    members: normalizedMembers,
    invitations,
    invitations_meta: invitationMeta,
    plan: {
      code: String(sub?.plan || "company_free"),
      label: planLabel(sub?.plan || "company_free"),
      status: String(sub?.status || "inactive"),
      seats_limit: seatLimitForPlan(sub?.plan || "company_free"),
      seats_used: normalizedMembers.length,
      pending_invitations: invitations.filter((row: any) => String(row.status || "") === "pending").length,
    },
  };
}

export async function GET() {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { user, companyId, membershipRole, admin } = ctx as any;
    const snapshot = await readTeamSnapshot(admin, companyId, user.id);
    return json(200, {
      company_id: companyId,
      membership_role: membershipRole,
      ...snapshot,
    });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { user, companyId, membershipRole, admin } = ctx as any;
    const companyLifecycle = await readCompanyLifecycle(admin, companyId);
    if (!companyLifecycle.ok) {
      return json(400, { error: "company_read_failed", details: companyLifecycle.error.message });
    }
    if (isCompanyLifecycleBlocked(companyLifecycle.lifecycleStatus)) {
      return json(423, {
        error: "company_inactive",
        user_message: "La empresa esta desactivada o cerrada. Reactivala desde ajustes antes de invitar a nuevas personas.",
      });
    }
    if (membershipRole !== "admin") {
      return json(403, { error: "forbidden", user_message: "Solo admins pueden invitar miembros al equipo." });
    }

    const snapshot = await readTeamSnapshot(admin, companyId, user.id);
    if (!snapshot.invitations_meta?.available) {
      return json(409, {
        error: "company_team_invitations_missing_migration",
        user_message: snapshot.invitations_meta.warning_message,
        migration_files: snapshot.invitations_meta.migration_files,
      });
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const role = normalizeInviteRole(body?.role);
    if (!email || !email.includes("@")) {
      return json(400, { error: "invalid_email", user_message: "Introduce un email valido para la invitacion." });
    }

    const seatsPlanned = Number(snapshot.plan.seats_limit || 0);
    const seatsUsed = Number(snapshot.plan.seats_used || 0) + Number(snapshot.plan.pending_invitations || 0);
    if (seatsUsed >= seatsPlanned) {
      return json(409, {
        error: "team_seat_limit_reached",
        user_message: "Has alcanzado la capacidad de tu plan. Libera una plaza o mejora plan para invitar a otra persona.",
      });
    }

    const alreadyMember = snapshot.members.some((member: any) => String(member.email || "").toLowerCase() === email);
    if (alreadyMember) {
      return json(409, { error: "already_member", user_message: "Ese usuario ya forma parte del equipo." });
    }

    const pendingInvite = snapshot.invitations.find((invite: any) => String(invite.email || "").toLowerCase() === email && String(invite.status || "") === "pending");
    if (pendingInvite) {
      return json(200, {
        ok: true,
        invitation: pendingInvite,
        invite_link: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es"}/signup?mode=company&invite=${pendingInvite.invite_token}`,
        user_message: "Ya existia una invitacion pendiente para este email.",
      });
    }

    const inviteToken = randomUUID().replace(/-/g, "");
    const nowIso = new Date().toISOString();
    const { data: invitation, error: invitationErr } = await admin
      .from("company_team_invitations")
      .insert({
        company_id: companyId,
        email,
        role,
        status: "pending",
        invited_by: user.id,
        invite_token: inviteToken,
        invited_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id,email,role,status,invited_at,accepted_at,revoked_at,invite_token")
      .single();

    if (invitationErr) {
      return json(400, { error: "company_team_invitation_insert_failed", details: invitationErr.message, user_message: "No se pudo crear la invitacion." });
    }

    return json(200, {
      ok: true,
      invitation,
      invite_link: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es"}/signup?mode=company&invite=${inviteToken}`,
      user_message: "Invitacion creada. Puedes copiar el enlace y compartirlo con tu equipo.",
    });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await resolveContext();
    if ((ctx as any).error) return (ctx as any).error;
    const { companyId, membershipRole, admin } = ctx as any;
    if (membershipRole !== "admin") {
      return json(403, { error: "forbidden", user_message: "Solo admins pueden gestionar invitaciones." });
    }

    const body = await request.json().catch(() => ({}));
    const invitationId = String(body?.invitation_id || "").trim();
    const action = String(body?.action || "").trim().toLowerCase();
    if (!invitationId) return json(400, { error: "invitation_id_required", user_message: "Falta la invitacion a gestionar." });
    if (action !== "cancel") return json(400, { error: "unsupported_action" });

    const nowIso = new Date().toISOString();
    const { data: invitation, error: updateErr } = await admin
      .from("company_team_invitations")
      .update({
        status: "cancelled",
        revoked_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", invitationId)
      .eq("company_id", companyId)
      .select("id,email,role,status,invited_at,accepted_at,revoked_at,invite_token")
      .single();

    if (updateErr) {
      if (isInvitationTableMissing(updateErr)) {
        return json(409, {
          error: "company_team_invitations_missing_migration",
          user_message: "La tabla de invitaciones aun no esta activada en esta base.",
          migration_files: ["scripts/sql/f35_company_team_invitations.sql"],
        });
      }
      return json(400, { error: "company_team_invitation_update_failed", details: updateErr.message, user_message: "No se pudo cancelar la invitacion." });
    }

    return json(200, { ok: true, invitation, user_message: "Invitacion cancelada." });
  } catch (error: any) {
    return json(500, { error: "unhandled_exception", details: String(error?.message || error) });
  }
}
