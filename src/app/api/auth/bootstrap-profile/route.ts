import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function normalizeAccountType(v: unknown): "candidate" | "company" {
  const raw = String(v || "").toLowerCase();
  if (raw === "company" || raw === "empresa") return "company";
  return "candidate";
}

function makeFallbackCompanyName(emailRaw: unknown) {
  const email = String(emailRaw || "").trim().toLowerCase();
  const local = email.split("@")[0] || "empresa";
  return `Empresa ${local.slice(0, 40)}`;
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteHandlerClient();
    const admin = createServiceRoleClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr) return json(400, { error: "auth_getUser_failed", details: userErr.message });
    if (!user) return json(401, { error: "unauthorized" });

    const body = await req.json().catch(() => ({}));
    const accountType = normalizeAccountType((body as any)?.account_type);

    const { data: existingProfile, error: profileErr } = await admin
      .from("profiles")
      .select("id,role,active_company_id,onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) return json(400, { error: "profiles_read_failed", details: profileErr.message });

    const nextRole = accountType === "company" ? "company" : "candidate";
    const profilePatch: Record<string, any> = {
      id: user.id,
      role: nextRole,
      onboarding_completed: false,
      email: user.email || null,
    };

    let companyId = existingProfile?.active_company_id ? String(existingProfile.active_company_id) : null;

    if (accountType === "company") {
      if (!companyId) {
        const { data: latestMembership } = await admin
          .from("company_members")
          .select("company_id,role,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestMembership?.company_id) {
          companyId = String(latestMembership.company_id);
        }
      }

      if (!companyId) {
        const { data: createdCompany, error: createCompanyErr } = await admin
          .from("companies")
          .insert({
            name: makeFallbackCompanyName(user.email),
          })
          .select("id")
          .single();
        if (createCompanyErr || !createdCompany?.id) {
          return json(400, {
            error: "companies_create_failed",
            details: createCompanyErr?.message || null,
          });
        }
        companyId = String(createdCompany.id);
      }

      if (companyId) {
        const { data: membershipExists } = await admin
          .from("company_members")
          .select("company_id,user_id,role")
          .eq("company_id", companyId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!membershipExists) {
          const { error: insertMembershipErr } = await admin.from("company_members").insert({
            company_id: companyId,
            user_id: user.id,
            role: "admin",
          });
          if (insertMembershipErr) {
            return json(400, {
              error: "company_members_insert_failed",
              details: insertMembershipErr.message,
            });
          }
        }

        profilePatch.active_company_id = companyId;

        await admin
          .from("company_profiles")
          .upsert(
            {
              company_id: companyId,
              contact_email: user.email || null,
            },
            { onConflict: "company_id" },
          );
      }
    } else {
      profilePatch.active_company_id = null;
    }

    const { data: upsertedProfile, error: upsertErr } = await admin
      .from("profiles")
      .upsert(profilePatch, { onConflict: "id" })
      .select("id,role,active_company_id,onboarding_completed")
      .single();
    if (upsertErr) return json(400, { error: "profiles_upsert_failed", details: upsertErr.message });

    return json(200, {
      ok: true,
      profile: upsertedProfile,
      account_type: accountType,
    });
  } catch (e: any) {
    return json(500, { error: "unhandled_exception", details: e?.message || String(e) });
  }
}

