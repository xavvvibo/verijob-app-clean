import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { summarizeCompanyCvImportUpdates } from "@/lib/candidate/import-update-summary";

export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function pickLongerText(current: unknown, incoming: unknown) {
  const left = normalizeText(current);
  const right = normalizeText(incoming);
  if (!left) return right || null;
  if (!right) return left || null;
  return right.length > left.length ? right : left;
}

function collapseSpaces(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizedBase(value: unknown) {
  return collapseSpaces(String(value || "").toLowerCase())
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:()]+/g, " ");
}

function normalizeCompanyOrInstitution(value: unknown) {
  return normalizedBase(value);
}

function normalizeRoleOrTitle(value: unknown) {
  return normalizedBase(value);
}

function normalizeMonth(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "";
  const ym = text.match(/^(\d{4})-(\d{2})/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const y = text.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01`;
  return text.toLowerCase();
}

function expExactSig(row: any) {
  return `${normalizeRoleOrTitle(row?.role_title || row?.title)}|${normalizeCompanyOrInstitution(row?.company_name || row?.company)}|${normalizeMonth(row?.start_date)}|${normalizeMonth(row?.end_date)}`;
}

function expPossibleSig(row: any) {
  return `${normalizeRoleOrTitle(row?.role_title || row?.title)}|${normalizeCompanyOrInstitution(row?.company_name || row?.company)}`;
}

function updateSuggestionStatus(rawCvJson: any, inviteId: string, suggestionId: string, status: "accepted" | "dismissed") {
  const base = rawCvJson && typeof rawCvJson === "object" ? rawCvJson : {};
  const updates = Array.isArray(base.company_cv_import_updates) ? base.company_cv_import_updates : [];
  return {
    ...base,
    company_cv_import_updates: updates.map((entry: any) => {
      if (String(entry?.invite_id || "") !== inviteId) return entry;
      const suggestions = Array.isArray(entry?.experience_suggestions) ? entry.experience_suggestions : [];
      return {
        ...entry,
        experience_suggestions: suggestions.map((suggestion: any) =>
          String(suggestion?.id || "") === suggestionId ? { ...suggestion, status } : suggestion
        ),
      };
    }),
  };
}

function updateProfileProposal(rawCvJson: any, inviteId: string, patch: Record<string, any>) {
  const base = rawCvJson && typeof rawCvJson === "object" ? rawCvJson : {};
  const updates = Array.isArray(base.company_cv_import_updates) ? base.company_cv_import_updates : [];
  return {
    ...base,
    company_cv_import_updates: updates.map((entry: any) => {
      if (String(entry?.invite_id || "") !== inviteId) return entry;
      return {
        ...entry,
        profile_proposal: {
          ...(entry?.profile_proposal && typeof entry.profile_proposal === "object" ? entry.profile_proposal : {}),
          ...patch,
        },
      };
    }),
  };
}

export async function GET() {
  const supabase = await createRouteHandlerClient();
  const admin = createServiceRoleClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) return json(400, { error: "auth_getUser_failed", details: userErr.message });
  if (!user) return json(401, { error: "unauthorized" });

  const [{ data: candidateProfile, error: cpErr }, { data: experiences, error: expErr }] = await Promise.all([
    admin.from("candidate_profiles").select("user_id,raw_cv_json").eq("user_id", user.id).maybeSingle(),
    admin.from("profile_experiences").select("id,company_name,role_title,start_date,end_date,description").eq("user_id", user.id).order("start_date", { ascending: false }),
  ]);

  if (cpErr) return json(400, { error: "candidate_profile_read_failed", details: cpErr.message });
  if (expErr) return json(400, { error: "profile_experiences_read_failed", details: expErr.message });

  const rawCvJson = candidateProfile?.raw_cv_json && typeof candidateProfile.raw_cv_json === "object" ? candidateProfile.raw_cv_json : {};
  const updates = Array.isArray((rawCvJson as any)?.company_cv_import_updates) ? (rawCvJson as any).company_cv_import_updates : [];
  const summary = summarizeCompanyCvImportUpdates(rawCvJson);

  return json(200, {
    updates,
    experiences: Array.isArray(experiences) ? experiences : [],
    pending_count: summary.totalPendingItems,
    summary,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createRouteHandlerClient();
  const admin = createServiceRoleClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) return json(400, { error: "auth_getUser_failed", details: userErr.message });
  if (!user) return json(401, { error: "unauthorized" });

  const body = await request.json().catch(() => ({}));
  const inviteId = normalizeText(body?.invite_id);
  const suggestionId = normalizeText(body?.suggestion_id);
  const action = normalizeText(body?.action).toLowerCase();
  const proposalAction = normalizeText(body?.proposal_action).toLowerCase();
  if (!inviteId) return json(400, { error: "missing_identifiers" });
  if (!["accept", "dismiss"].includes(action) && proposalAction !== "apply_languages") {
    return json(400, { error: "unsupported_action" });
  }

  const { data: candidateProfile, error: cpErr } = await admin
    .from("candidate_profiles")
    .select("user_id,raw_cv_json")
    .eq("user_id", user.id)
    .maybeSingle();
  if (cpErr) return json(400, { error: "candidate_profile_read_failed", details: cpErr.message });

  const rawCvJson = candidateProfile?.raw_cv_json && typeof candidateProfile.raw_cv_json === "object" ? candidateProfile.raw_cv_json : {};
  const updates = Array.isArray((rawCvJson as any)?.company_cv_import_updates) ? (rawCvJson as any).company_cv_import_updates : [];
  const updateEntry = updates.find((entry: any) => String(entry?.invite_id || "") === inviteId);
  if (!updateEntry) return json(404, { error: "update_entry_not_found" });

  if (proposalAction === "apply_languages") {
    const proposal = updateEntry?.profile_proposal && typeof updateEntry.profile_proposal === "object" ? updateEntry.profile_proposal : {};
    const mergedLanguages = Array.isArray(proposal?.merged_languages)
      ? proposal.merged_languages.map((item: any) => normalizeText(item)).filter(Boolean)
      : [];
    const newLanguages = Array.isArray(proposal?.new_languages)
      ? proposal.new_languages.map((item: any) => normalizeText(item)).filter(Boolean)
      : [];

    if (mergedLanguages.length === 0) {
      return json(400, { error: "no_languages_to_apply" });
    }

    const [{ data: profileRow, error: profileErr }, { data: candidateProfileRow, error: candidateProfileErr }] = await Promise.all([
      admin.from("profiles").select("languages").eq("id", user.id).maybeSingle(),
      admin.from("candidate_profiles").select("id,certifications,raw_cv_json").eq("user_id", user.id).maybeSingle(),
    ]);
    if (profileErr) return json(400, { error: "profile_read_failed", details: profileErr.message });
    if (candidateProfileErr) return json(400, { error: "candidate_profile_read_failed", details: candidateProfileErr.message });

    const currentLanguages = Array.isArray((profileRow as any)?.languages)
      ? (profileRow as any).languages.map((item: any) => normalizeText(item)).filter(Boolean)
      : [];
    const deduped = Array.from(
      new Map(
        [...currentLanguages, ...mergedLanguages].map((language) => [language.toLowerCase(), language])
      ).values()
    );

    const { error: profileUpdateErr } = await admin
      .from("profiles")
      .update({
        languages: deduped,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (profileUpdateErr) return json(400, { error: "profile_languages_update_failed", details: profileUpdateErr.message });

    const nextRawCvJson = updateProfileProposal(rawCvJson, inviteId, {
      languages_applied_at: new Date().toISOString(),
      languages_applied_count: newLanguages.length,
    });
    const candidateProfilePatch: Record<string, any> = {
      raw_cv_json: nextRawCvJson,
      updated_at: new Date().toISOString(),
      user_id: user.id,
    };
    const candidateProfileWrite = (candidateProfileRow as any)?.id
      ? await admin
          .from("candidate_profiles")
          .update(candidateProfilePatch)
          .eq("user_id", user.id)
      : await admin
          .from("candidate_profiles")
          .insert(candidateProfilePatch);
    const profileProposalErr = candidateProfileWrite.error;
    if (profileProposalErr) {
      return json(400, { error: "candidate_profile_update_failed", details: profileProposalErr.message });
    }

    return json(200, { ok: true, proposal_action: proposalAction, applied_languages: newLanguages.length });
  }

  if (!suggestionId) return json(400, { error: "missing_identifiers" });
  const suggestion = Array.isArray(updateEntry?.experience_suggestions)
    ? updateEntry.experience_suggestions.find((item: any) => String(item?.id || "") === suggestionId)
    : null;
  if (!suggestion) return json(404, { error: "suggestion_not_found" });

  if (action === "accept") {
    const extracted = suggestion?.extracted_experience || {};
    const { data: existingRows, error: existingErr } = await admin
      .from("profile_experiences")
      .select("id,company_name,role_title,start_date,end_date,description")
      .eq("user_id", user.id);
    if (existingErr) return json(400, { error: "profile_experiences_read_failed", details: existingErr.message });

    const rows = Array.isArray(existingRows) ? existingRows : [];
    const extractedExact = expExactSig(extracted);
    const extractedPossible = expPossibleSig(extracted);
    const exactMatch = rows.find((row: any) => expExactSig(row) === extractedExact);
    const possibleMatch = rows.find((row: any) => expPossibleSig(row) === extractedPossible);

    if (String(suggestion?.kind || "") === "new") {
      if (exactMatch || possibleMatch) {
        // Already present: mark accepted without creating a duplicate row.
      } else {
      const insertPayload: any = {
        user_id: user.id,
        role_title: normalizeText(extracted?.role_title) || "Experiencia",
        company_name: normalizeText(extracted?.company_name) || "Empresa",
        start_date: extracted?.start_date || null,
        end_date: extracted?.end_date || null,
        description: normalizeText(extracted?.description) || null,
      };
      const { error: insertErr } = await admin.from("profile_experiences").insert(insertPayload);
      if (insertErr) return json(400, { error: "profile_experience_insert_failed", details: insertErr.message });
      }
    } else if (String(suggestion?.kind || "") === "update" && suggestion?.matched_existing?.id) {
      const { data: currentExperience, error: currentErr } = await admin
        .from("profile_experiences")
        .select("id,company_name,role_title,start_date,end_date,description")
        .eq("id", suggestion.matched_existing.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (currentErr) return json(400, { error: "profile_experience_read_failed", details: currentErr.message });
      const patch = {
        company_name: normalizeText(currentExperience?.company_name) || normalizeText(extracted?.company_name) || null,
        role_title: normalizeText(currentExperience?.role_title) || normalizeText(extracted?.role_title) || null,
        start_date: currentExperience?.start_date || extracted?.start_date || null,
        end_date: currentExperience?.end_date || extracted?.end_date || null,
        description: pickLongerText(currentExperience?.description, extracted?.description),
      };
      const { error: updateErr } = await admin.from("profile_experiences").update(patch).eq("id", suggestion.matched_existing.id).eq("user_id", user.id);
      if (updateErr) return json(400, { error: "profile_experience_update_failed", details: updateErr.message });
    }
  }

  const nextRawCvJson = updateSuggestionStatus(rawCvJson, inviteId, suggestionId, action === "accept" ? "accepted" : "dismissed");
  const nowIso = new Date().toISOString();
  const { error: updateProfileErr } = await admin
    .from("candidate_profiles")
    .update({ raw_cv_json: nextRawCvJson, updated_at: nowIso })
    .eq("user_id", user.id);
  if (updateProfileErr) return json(400, { error: "candidate_profile_update_failed", details: updateProfileErr.message });

  return json(200, { ok: true, action });
}
