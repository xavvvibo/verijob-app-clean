import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

function normalizeText(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

function toNullable(v: any) {
  const s = normalizeText(v);
  return s ? s : null;
}

function looksCurrent(endDate: string | null) {
  const v = (endDate || "").toLowerCase();
  return !v || v.includes("actual") || v.includes("present");
}

function normalizeDateForDb(v: any): string | null {
  const s = normalizeText(v).toLowerCase();
  if (!s) return null;
  if (s.includes("actual") || s.includes("present")) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ym = s.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}-01`;
  const y = s.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01-01`;
  return null;
}

function normalizeDateText(v: any): string | null {
  const db = normalizeDateForDb(v);
  if (!db) return null;
  return db.slice(0, 7);
}

function expSig(row: any) {
  const title = normalizeText(row?.title).toLowerCase();
  const company = normalizeText(row?.company_name).toLowerCase();
  const start = normalizeText(row?.start_date).toLowerCase();
  const end = normalizeText(row?.end_date).toLowerCase();
  return `${title}|${company}|${start}|${end}`;
}

function eduSig(row: any) {
  const title = normalizeText(row?.title).toLowerCase();
  const institution = normalizeText(row?.institution).toLowerCase();
  const start = normalizeText(row?.start_date).toLowerCase();
  const end = normalizeText(row?.end_date).toLowerCase();
  return `${title}|${institution}|${start}|${end}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const jobId = typeof body?.job_id === "string" ? body.job_id.trim() : "";
  const section = typeof body?.section === "string" ? body.section.trim() : "";
  if (!jobId || !section) {
    return NextResponse.json({ error: "missing_job_id_or_section" }, { status: 400 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("cv_parse_jobs")
    .select("id,user_id,status,result_json")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (jobErr) return NextResponse.json({ error: "job_fetch_failed", details: jobErr.message }, { status: 400 });
  if (!job) return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  if (job.status !== "succeeded") return NextResponse.json({ error: "job_not_succeeded" }, { status: 400 });

  const result = (job as any)?.result_json || {};

  if (section === "experiences") {
    const extracted = Array.isArray(result?.experiences) ? result.experiences : [];
    const candidateRows = extracted
      .map((x: any) => {
        const title = toNullable(x?.role_title);
        const company = toNullable(x?.company_name);
        const description = toNullable(x?.description);
        if (!title && !company && !description) return null;
        const startDate = normalizeDateForDb(x?.start_date);
        const endDate = normalizeDateForDb(x?.end_date);
        return {
          user_id: user.id,
          title: title || "Experiencia",
          company_name: company || "Empresa",
          start_date: startDate,
          end_date: endDate,
          is_current: looksCurrent(endDate),
          description,
        };
      })
      .filter(Boolean);

    if (candidateRows.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, section: "experiences" });
    }

    const { data: existingRows, error: existingErr } = await supabase
      .from("experiences")
      .select("title,company_name,start_date,end_date")
      .eq("user_id", user.id);
    if (existingErr) {
      return NextResponse.json({ error: "experiences_existing_fetch_failed", details: existingErr.message }, { status: 400 });
    }

    const existingSet = new Set((existingRows || []).map((x: any) => expSig(x)));
    const toInsert: any[] = [];
    for (const row of candidateRows as any[]) {
      const sig = expSig(row);
      if (existingSet.has(sig)) continue;
      existingSet.add(sig);
      toInsert.push(row);
    }

    if (toInsert.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, section: "experiences", deduped: true });
    }

    const { error: insErr } = await supabase.from("experiences").insert(toInsert as any[]);
    if (insErr) {
      return NextResponse.json({ error: "experiences_insert_failed", details: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, imported: toInsert.length, section: "experiences" });
  }

  if (section === "education") {
    const extracted = Array.isArray(result?.education) ? result.education : [];
    const normalized = extracted
      .map((x: any) => {
        const title = toNullable(x?.title);
        const institution = toNullable(x?.institution);
        const description = toNullable(x?.description);
        if (!title && !institution && !description) return null;
        return {
          title: title || "",
          institution: institution || "",
          start_date: normalizeDateText(x?.start_date),
          end_date: normalizeDateText(x?.end_date),
          description,
        };
      })
      .filter(Boolean);

    if (normalized.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, section: "education" });
    }

    const { data: cp, error: cpErr } = await supabase
      .from("candidate_profiles")
      .select("education")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cpErr) return NextResponse.json({ error: "profile_fetch_failed", details: cpErr.message }, { status: 400 });

    const currentEducation = Array.isArray((cp as any)?.education) ? (cp as any).education : [];
    const mergedSet = new Set(currentEducation.map((x: any) => eduSig(x)));
    const toAppend: any[] = [];
    for (const row of normalized as any[]) {
      const sig = eduSig(row);
      if (mergedSet.has(sig)) continue;
      mergedSet.add(sig);
      toAppend.push(row);
    }

    if (toAppend.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, section: "education", deduped: true });
    }

    const merged = [...currentEducation, ...toAppend];

    const { error: upErr } = await supabase
      .from("candidate_profiles")
      .upsert(
        {
          user_id: user.id,
          education: merged,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (upErr) return NextResponse.json({ error: "education_upsert_failed", details: upErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, imported: toAppend.length, section: "education" });
  }

  return NextResponse.json({ error: "unsupported_section" }, { status: 400 });
}
