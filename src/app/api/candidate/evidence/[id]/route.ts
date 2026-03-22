import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";
import { groupAndMergeEmploymentEntries } from "@/lib/candidate/documentary-processing";
import { recalculateAndPersistCandidateTrustScore } from "@/server/trustScore/calculateTrustScore";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function resolveRouteId(ctx: any) {
  const params = typeof ctx?.params?.then === "function" ? await ctx.params : ctx?.params;
  return String(params?.id || "").trim();
}

async function materializeEmploymentRecordFromProfileExperience(params: {
  admin: any;
  userId: string;
  profileExperienceId: string;
}) {
  const { data: profileExperience, error: profileExperienceErr } = await params.admin
    .from("profile_experiences")
    .select("id,role_title,company_name,start_date,end_date,user_id")
    .eq("id", params.profileExperienceId)
    .maybeSingle();
  if (profileExperienceErr) {
    return { error: { error: "profile_experience_lookup_failed", details: profileExperienceErr.message } };
  }
  if (!profileExperience || String((profileExperience as any).user_id || "") !== params.userId) {
    return { error: { error: "profile_experience_not_found" } };
  }

  const insertPayload: Record<string, any> = {
    candidate_id: params.userId,
    position: (profileExperience as any)?.role_title || null,
    company_name_freeform: (profileExperience as any)?.company_name || null,
    start_date: (profileExperience as any)?.start_date || null,
    end_date: (profileExperience as any)?.end_date || null,
    verification_status: "unverified",
    source_experience_id: String((profileExperience as any)?.id || ""),
  };

  let insertResult = await params.admin.from("employment_records").insert(insertPayload).select("id").single();
  if (insertResult.error && /source_experience_id/i.test(String(insertResult.error.message || ""))) {
    const fallbackPayload = { ...insertPayload };
    delete fallbackPayload.source_experience_id;
    insertResult = await params.admin.from("employment_records").insert(fallbackPayload).select("id").single();
  }

  if (insertResult.error || !insertResult.data?.id) {
    return {
      error: {
        error: "employment_record_create_failed",
        details: insertResult.error?.message || "missing_employment_record_id",
      },
    };
  }

  return { employmentRecordId: String(insertResult.data.id) };
}

async function createEmploymentRecordFromVidaLaboralEntry(params: {
  admin: any;
  userId: string;
  entry: any;
}) {
  const roleTitle = String(params.entry?.position || "").trim() || "Experiencia detectada en vida laboral";
  const companyName = String(params.entry?.company_name || "").trim() || "Empresa detectada";
  const startDate = String(params.entry?.start_date || "").trim() || null;
  const endDate = String(params.entry?.end_date || "").trim() || null;
  const summary = String(params.entry?.raw_text || "").trim() || null;

  const insertProfileExperience = await params.admin
    .from("profile_experiences")
    .insert({
      user_id: params.userId,
      role_title: roleTitle,
      company_name: companyName,
      start_date: startDate,
      end_date: endDate,
      description: summary,
      matched_verification_id: null,
      confidence: params.entry?.confidence == null ? null : Number(params.entry.confidence),
    })
    .select("id")
    .single();

  if (insertProfileExperience.error || !insertProfileExperience.data?.id) {
    return {
      error: {
        error: "profile_experience_create_failed",
        details: insertProfileExperience.error?.message || "missing_profile_experience_id",
      },
    };
  }

  const materialized = await materializeEmploymentRecordFromProfileExperience({
    admin: params.admin,
    userId: params.userId,
    profileExperienceId: String(insertProfileExperience.data.id),
  });
  if ((materialized as any)?.error) return materialized;

  return {
    employmentRecordId: String((materialized as any).employmentRecordId),
    profileExperienceId: String(insertProfileExperience.data.id),
  };
}

export async function DELETE(_req: Request, ctx: any) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json(401, { error: "unauthorized" });

  const id = await resolveRouteId(ctx);
  if (!id) return json(400, { error: "missing_id" });

  const { data: row, error: rowErr } = await supabase
    .from("evidences")
    .select("id,verification_request_id")
    .eq("id", id)
    .eq("uploaded_by", user.id)
    .maybeSingle();

  if (rowErr) return json(400, { error: "lookup_failed", details: rowErr.message });
  if (!row) return json(404, { error: "not_found" });

  const { error: delErr } = await supabase.from("evidences").delete().eq("id", id).eq("uploaded_by", user.id);
  if (delErr) return json(400, { error: "delete_failed", details: delErr.message });

  const verificationRequestId = String((row as any)?.verification_request_id || "").trim();
  if (verificationRequestId) {
    const admin = createServiceRoleClient() as any;
    const { count } = await admin
      .from("evidences")
      .select("id", { count: "exact", head: true })
      .eq("verification_request_id", verificationRequestId);

    if (Number(count || 0) === 0) {
      const { data: vr } = await admin
        .from("verification_requests")
        .select("request_context")
        .eq("id", verificationRequestId)
        .maybeSingle();

      const currentContext =
        vr?.request_context && typeof vr.request_context === "object" ? (vr.request_context as any) : {};
      const nextContext = { ...currentContext };
      delete nextContext.documentary_processing;

      await admin
        .from("verification_requests")
        .update({ request_context: nextContext })
        .eq("id", verificationRequestId);
    }
  }

  await recalculateAndPersistCandidateTrustScore(user.id).catch(() => {});

  return json(200, { ok: true, id });
}

export async function PATCH(req: Request, ctx: any) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return json(401, { error: "unauthorized" });

    const id = await resolveRouteId(ctx);
    if (!id) return json(400, { error: "missing_id" });

    const body = await req.json().catch(() => null);
    if (!body || String(body?.action || "") !== "reconcile_vida_laboral") {
      return json(400, { error: "invalid_action" });
    }

    const updates = Array.isArray(body?.entries) ? body.entries : [];
    const admin = createServiceRoleClient() as any;

    const { data: evidence, error: evidenceErr } = await admin
      .from("evidences")
      .select("id,uploaded_by,evidence_type,document_type,verification_request_id")
      .eq("id", id)
      .maybeSingle();

    if (evidenceErr) return json(400, { error: "evidence_lookup_failed", details: evidenceErr.message });
    if (!evidence || String(evidence.uploaded_by || "") !== user.id) return json(404, { error: "not_found" });

    const { data: vr, error: vrErr } = await admin
      .from("verification_requests")
      .select("id,request_context")
      .eq("id", evidence.verification_request_id)
      .maybeSingle();

    if (vrErr) return json(400, { error: "verification_request_lookup_failed", details: vrErr.message });
    if (!vr) return json(404, { error: "verification_request_not_found" });

    const currentContext =
      vr.request_context && typeof vr.request_context === "object" ? (vr.request_context as any) : {};
    const processing =
      currentContext.documentary_processing && typeof currentContext.documentary_processing === "object"
        ? { ...(currentContext.documentary_processing as any) }
        : {};
    const currentEntries = Array.isArray(processing.extracted_employment_entries)
      ? processing.extracted_employment_entries
      : [];
    const summary = {
      linked_existing_count: 0,
      created_count: 0,
      ignored_count: 0,
      auto_ignored_count: currentEntries.filter((entry: any) => String(entry?.ignored_reason || "").trim()).length,
      pending_count: 0,
      material_changes: false,
      linked_employment_record_ids: [] as string[],
      created_profile_experience_ids: [] as string[],
      message: "",
    };

    const nextEntries = [];
    for (const currentEntry of currentEntries) {
      const entryId = String(currentEntry?.entry_id || "").trim();
      const requested = updates.find((item: any) => String(item?.entry_id || "").trim() === entryId);
      if (!requested) {
        nextEntries.push(currentEntry);
        continue;
      }

      const choice = String(requested?.selection || "").trim();
      const nextEntry = { ...currentEntry };

      if (choice === "__ignore__") {
        nextEntry.reconciliation_status = "ignored";
        nextEntry.reconciliation_choice = "ignore";
        nextEntry.linked_employment_record_id = null;
        nextEntry.created_profile_experience_id = null;
        summary.ignored_count += 1;
        nextEntries.push(nextEntry);
        continue;
      }

      if (choice === "__create_new__") {
        const created = await createEmploymentRecordFromVidaLaboralEntry({
          admin,
          userId: user.id,
          entry: currentEntry,
        });
        if ((created as any)?.error) return json(400, (created as any).error);
        nextEntry.reconciliation_status = "linked";
        nextEntry.reconciliation_choice = "create_new";
        nextEntry.linked_employment_record_id = String((created as any).employmentRecordId || "");
        nextEntry.created_profile_experience_id = String((created as any).profileExperienceId || "");
        summary.created_count += 1;
        summary.material_changes = true;
        if (nextEntry.linked_employment_record_id) summary.linked_employment_record_ids.push(nextEntry.linked_employment_record_id);
        if (nextEntry.created_profile_experience_id) summary.created_profile_experience_ids.push(nextEntry.created_profile_experience_id);
        nextEntries.push(nextEntry);
        continue;
      }

      if (choice.startsWith("profile:")) {
        const materialized = await materializeEmploymentRecordFromProfileExperience({
          admin,
          userId: user.id,
          profileExperienceId: choice.replace(/^profile:/, "").trim(),
        });
        if ((materialized as any)?.error) return json(400, (materialized as any).error);
        nextEntry.reconciliation_status = "linked";
        nextEntry.reconciliation_choice = "link_existing";
        nextEntry.linked_employment_record_id = String((materialized as any).employmentRecordId || "");
        summary.linked_existing_count += 1;
        summary.material_changes = true;
        if (nextEntry.linked_employment_record_id) summary.linked_employment_record_ids.push(nextEntry.linked_employment_record_id);
        nextEntries.push(nextEntry);
        continue;
      }

      if (choice) {
        nextEntry.reconciliation_status = "linked";
        nextEntry.reconciliation_choice = "link_existing";
        nextEntry.linked_employment_record_id = choice;
        summary.linked_existing_count += 1;
        summary.material_changes = true;
        if (nextEntry.linked_employment_record_id) summary.linked_employment_record_ids.push(nextEntry.linked_employment_record_id);
      } else {
        summary.pending_count += 1;
      }
      nextEntries.push(nextEntry);
    }

    const supportingEmploymentRecordIds = Array.from(
      new Set(
        nextEntries
          .flatMap((entry: any) => [
            String(entry?.linked_employment_record_id || "").trim(),
            String(entry?.suggested_match_employment_record_id || "").trim(),
          ])
          .filter(Boolean),
      ),
    );

    processing.extracted_employment_entries = nextEntries;
    processing.grouped_employment_entries = groupAndMergeEmploymentEntries(nextEntries);
    processing.supporting_employment_record_ids = supportingEmploymentRecordIds;
    processing.supports_multiple_experiences = supportingEmploymentRecordIds.length > 1;
    processing.link_state = nextEntries.some((entry: any) => String(entry?.reconciliation_status || "") === "linked")
      ? "reconciled"
      : "reconciliation_required";
    processing.processing_summary =
      nextEntries.filter((entry: any) => String(entry?.reconciliation_status || "") === "linked").length > 0
        ? "Experiencias de vida laboral reconciliadas con el perfil."
        : "Revisa y vincula las experiencias detectadas en la fe de vida laboral.";
    summary.linked_employment_record_ids = Array.from(new Set(summary.linked_employment_record_ids.filter(Boolean)));
    summary.created_profile_experience_ids = Array.from(new Set(summary.created_profile_experience_ids.filter(Boolean)));
    summary.message = summary.material_changes
      ? `Conciliación guardada. ${summary.linked_existing_count} experiencias vinculadas, ${summary.created_count} creadas y ${summary.ignored_count + summary.auto_ignored_count} movimientos ignorados.`
      : `Conciliación guardada. No se ha creado ni vinculado ninguna experiencia; los movimientos detectados fueron ignorados por no corresponder a experiencia laboral CV.`;
    processing.reconciliation_summary = summary;

    const nextContext = {
      ...currentContext,
      documentary_processing: processing,
    };

    const { error: updateErr } = await admin
      .from("verification_requests")
      .update({ request_context: nextContext })
      .eq("id", vr.id);

    if (updateErr) return json(400, { error: "reconciliation_update_failed", details: updateErr.message });

    await recalculateAndPersistCandidateTrustScore(user.id).catch(() => {});

    return json(200, {
      ok: true,
      id,
      extracted_employment_entries: nextEntries,
      supporting_employment_record_ids: supportingEmploymentRecordIds,
      reconciliation_summary: summary,
    });
  } catch (error: any) {
    return json(500, {
      error: "reconciliation_failed",
      details: String(error?.message || error || "unknown_error"),
    });
  }
}
