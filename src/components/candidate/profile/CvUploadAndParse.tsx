"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { normalizeCvLanguages, shouldApplyParsedResultOnce } from "@/lib/candidate/cv-parse-normalize";

type Job = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  error: string | null;
  result_json: any;
};

type MatchStatus = "new" | "possible_duplicate" | "already_exists";

type ImportResult = {
  section: "experiences" | "education" | "languages";
  imported: number;
  duplicatesSkipped: number;
  notSelected: number;
  languagesImported?: number;
  achievementsImported?: number;
};

const MAX_CV_SIZE_BYTES = 8 * 1024 * 1024;

function isSupportedCvFile(file: File) {
  const mime = String(file.type || "").toLowerCase();
  const lowerName = String(file.name || "").toLowerCase();
  return (
    mime.includes("pdf") ||
    mime.includes("wordprocessingml") ||
    mime.includes("msword") ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  );
}

function toFriendlyCvError(raw: string | null | undefined) {
  const msg = String(raw || "").trim();
  const lower = msg.toLowerCase();
  if (!msg) {
    return "No hemos podido procesar el CV. Puedes continuar completando tu perfil manualmente.";
  }
  if (lower.includes("pdf_extract_failed") || lower.includes("bad xref") || lower.includes("empty_pdf_text")) {
    return "No hemos podido leer este PDF. Puedes continuar con la carga manual de tu experiencia, formacion e idiomas.";
  }
  if (lower.includes("docx_extract_failed") || lower.includes("empty_docx_text")) {
    return "No hemos podido leer este DOCX. Puedes continuar con la carga manual de tu experiencia, formacion e idiomas.";
  }
  if (lower.includes("file_too_large")) {
    return "El archivo supera el tamano maximo permitido de 8 MB. Sube un CV mas ligero o completa tu perfil manualmente.";
  }
  if (lower.includes("unsupported_file_type")) {
    return "Formato no soportado. Usa PDF o DOCX, o completa tu perfil manualmente.";
  }
  return msg;
}

function collapseSpaces(v: string) {
  return v.replace(/\s+/g, " ").trim();
}

function normalizedBase(v: any) {
  return collapseSpaces(String(v || "").toLowerCase())
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:()]+/g, " ");
}

const COMPANY_SUFFIXES = new Set([
  "sl",
  "s.l",
  "s l",
  "sa",
  "s.a",
  "s a",
  "slu",
  "s.l.u",
  "spain",
  "espana",
  "españa",
]);

function normalizeCompany(v: any) {
  const parts = collapseSpaces(normalizedBase(v)).split(" ").filter(Boolean);
  while (parts.length > 0 && COMPANY_SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  return parts.join(" ");
}

function normalizeTitle(v: any) {
  return collapseSpaces(normalizedBase(v));
}

function normalizeDate(v: any) {
  const raw = String(v || "").trim().toLowerCase();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  const ym = raw.match(/^(\d{4})-(\d{2})$/);
  if (ym) return `${ym[1]}-${ym[2]}`;
  const y = raw.match(/^(\d{4})$/);
  if (y) return `${y[1]}-01`;
  return raw;
}

function expExactSig(item: any) {
  return [
    normalizeTitle(item?.role_title || item?.title),
    normalizeCompany(item?.company_name || item?.company),
    normalizeDate(item?.start_date),
    normalizeDate(item?.end_date),
  ].join("|");
}

function expPossibleSig(item: any) {
  return [normalizeTitle(item?.role_title || item?.title), normalizeCompany(item?.company_name || item?.company)].join("|");
}

function eduExactSig(item: any) {
  return [
    normalizeTitle(item?.title || item?.degree),
    normalizeCompany(item?.institution),
    normalizeDate(item?.start_date || item?.start),
    normalizeDate(item?.end_date || item?.end),
  ].join("|");
}

function eduPossibleSig(item: any) {
  return [normalizeTitle(item?.title || item?.degree), normalizeCompany(item?.institution)].join("|");
}

function statusBadge(status: MatchStatus) {
  if (status === "new") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "possible_duplicate") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
}

function matchStatusLabel(status: MatchStatus) {
  if (status === "new") return "Nuevo para importar";
  if (status === "possible_duplicate") return "Posible duplicado";
  return "Ya existente";
}

export default function CvUploadAndParse() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [importing, setImporting] = useState<null | "experiences" | "education" | "languages">(null);
  const [dedupLoading] = useState(false);

  const [expDrafts, setExpDrafts] = useState<any[]>([]);
  const [eduDrafts, setEduDrafts] = useState<any[]>([]);
  const [expStatuses, setExpStatuses] = useState<MatchStatus[]>([]);
  const [eduStatuses, setEduStatuses] = useState<MatchStatus[]>([]);
  const [expChecked, setExpChecked] = useState<boolean[]>([]);
  const [eduChecked, setEduChecked] = useState<boolean[]>([]);

  const [expExistingExact, setExpExistingExact] = useState<Set<string>>(new Set());
  const [expExistingPossible, setExpExistingPossible] = useState<Set<string>>(new Set());
  const [eduExistingExact, setEduExistingExact] = useState<Set<string>>(new Set());
  const [eduExistingPossible, setEduExistingPossible] = useState<Set<string>>(new Set());

  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [languagesDraft, setLanguagesDraft] = useState<string[]>([]);
  const [languagesChecked, setLanguagesChecked] = useState<boolean[]>([]);
  const [lastAppliedJobId, setLastAppliedJobId] = useState<string | null>(null);

  const loadProfileSets = useCallback(async () => {
    const [{ data: profileExps }, { data: profile }] = await Promise.all([
      supabase.from("profile_experiences").select("role_title,company_name,start_date,end_date").order("created_at", { ascending: false }),
      supabase.from("candidate_profiles").select("education").maybeSingle(),
    ]);

    const expRows = Array.isArray(profileExps) ? profileExps : [];
    const eduRows = Array.isArray((profile as any)?.education) ? (profile as any).education : [];

    setExpExistingExact(new Set(expRows.map((x: any) => expExactSig(x))));
    setExpExistingPossible(new Set(expRows.map((x: any) => expPossibleSig(x))));
    setEduExistingExact(new Set(eduRows.map((x: any) => eduExactSig(x))));
    setEduExistingPossible(new Set(eduRows.map((x: any) => eduPossibleSig(x))));
  }, [supabase]);

  function recalcStatusesAndSelection(expsArg: any[], eduArg: any[]) {
    const nextExpStatuses = expsArg.map((x) => {
      const exact = expExactSig(x);
      if (expExistingExact.has(exact)) return "already_exists" as MatchStatus;
      const possible = expPossibleSig(x);
      if (expExistingPossible.has(possible)) return "possible_duplicate" as MatchStatus;
      return "new" as MatchStatus;
    });

    const nextEduStatuses = eduArg.map((x) => {
      const exact = eduExactSig(x);
      if (eduExistingExact.has(exact)) return "already_exists" as MatchStatus;
      const possible = eduPossibleSig(x);
      if (eduExistingPossible.has(possible)) return "possible_duplicate" as MatchStatus;
      return "new" as MatchStatus;
    });

    setExpStatuses(nextExpStatuses);
    setEduStatuses(nextEduStatuses);

    setExpChecked((prev) => nextExpStatuses.map((status, idx) => (typeof prev[idx] === "boolean" ? prev[idx] : status === "new")));
    setEduChecked((prev) => nextEduStatuses.map((status, idx) => (typeof prev[idx] === "boolean" ? prev[idx] : status === "new")));
  }

  useEffect(() => {
    if (!job || job.status !== "succeeded") return;
    recalcStatusesAndSelection(expDrafts, eduDrafts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expDrafts, eduDrafts, expExistingExact, expExistingPossible, eduExistingExact, eduExistingPossible]);

  function applyParsedResults(nextJob: Job) {
    const parsedExps = Array.isArray(nextJob?.result_json?.experiences) ? nextJob.result_json.experiences : [];
    const parsedEdu = Array.isArray(nextJob?.result_json?.education) ? nextJob.result_json.education : [];
    const parsedLanguages = Array.isArray(nextJob?.result_json?.languages) ? nextJob.result_json.languages : [];
    setExpDrafts(parsedExps.map((x: any) => ({
      company_name: x.company_name || x.company || "",
      role_title: x.role_title || x.title || "",
      start_date: x.start_date || "",
      end_date: x.end_date || "",
      description: x.description || "",
    })));
    setEduDrafts(parsedEdu.map((x: any) => ({
      institution: x.institution || "",
      title: x.title || x.degree || "",
      start_date: x.start_date || x.start || "",
      end_date: x.end_date || x.end || "",
      description: x.description || x.notes || "",
    })));
    const normalizedLanguages = normalizeCvLanguages(parsedLanguages, 30);
    setLanguagesDraft(normalizedLanguages);
    setLanguagesChecked(normalizedLanguages.map(() => true));
    setLastAppliedJobId(nextJob.id);
  }

  async function importSection(section: "experiences" | "education" | "languages") {
    if (!jobId || !job || job.status !== "succeeded") return;
    setImporting(section);
    setMsg(null);

    const selectedItems =
      section === "experiences"
        ? expDrafts.filter((_: any, idx: number) => expChecked[idx])
        : section === "education"
          ? eduDrafts.filter((_: any, idx: number) => eduChecked[idx])
          : languagesDraft.filter((_: any, idx: number) => languagesChecked[idx]);

    if (selectedItems.length === 0) {
      setImporting(null);
      setMsg(
        section === "experiences"
          ? "No hay experiencias seleccionadas para importar."
          : section === "education"
            ? "No hay formaciones seleccionadas para importar."
            : "No hay idiomas seleccionados para importar."
      );
      return;
    }

    try {
      const res = await fetch("/api/candidate/cv/parse/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, section, selected_items: selectedItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "import_failed");

      const imported = Number(data?.imported ?? 0);
      const duplicatesSkipped = Number(data?.duplicates_skipped ?? 0);
      const notSelected = Number(data?.not_selected ?? 0);
      const languagesImported = Number(data?.languages_imported ?? 0);
      const achievementsImported = Number(data?.achievements_imported ?? 0);

      setLastImport({ section, imported, duplicatesSkipped, notSelected, languagesImported, achievementsImported });
      setMsg(
        section === "experiences"
          ? `${imported} experiencias importadas · ${duplicatesSkipped} omitidas por duplicadas · ${notSelected} no seleccionadas.${languagesImported > 0 || achievementsImported > 0 ? ` Además, hemos añadido ${languagesImported} idiomas y ${achievementsImported} logros detectados.` : ""}`
          : section === "education"
            ? `${imported} formaciones importadas · ${duplicatesSkipped} omitidas por duplicadas · ${notSelected} no seleccionadas.${languagesImported > 0 || achievementsImported > 0 ? ` Además, hemos añadido ${languagesImported} idiomas y ${achievementsImported} logros detectados.` : ""}`
            : `${imported} idiomas importados · ${duplicatesSkipped} omitidos por duplicados · ${notSelected} no seleccionados.${achievementsImported > 0 ? ` También hemos añadido ${achievementsImported} logros detectados.` : ""}`
      );

      await loadProfileSets();
      router.refresh();
    } catch (e: any) {
      setMsg(e?.message || "No se pudo aplicar la propuesta de importación.");
    } finally {
      setImporting(null);
    }
  }

  async function start() {
    setMsg(null);
    setLastImport(null);
    setJob(null);
    setJobId(null);
    setExpDrafts([]);
    setEduDrafts([]);
    setExpStatuses([]);
    setEduStatuses([]);
    setExpChecked([]);
    setEduChecked([]);
    setLanguagesDraft([]);
    setLanguagesChecked([]);
    setLastAppliedJobId(null);

    if (!file) {
      setMsg("Selecciona un CV (PDF o DOCX).");
      return;
    }

    if (!isSupportedCvFile(file)) {
      setMsg("Formato no soportado. Usa PDF o DOCX.");
      return;
    }
    if (file.size > MAX_CV_SIZE_BYTES) {
      setMsg("El archivo supera el tamano maximo permitido de 8 MB.");
      return;
    }

    setBusy(true);

    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error(authErr.message);
      const user = auth?.user;
      if (!user) throw new Error("No autorizado.");

      const bucket = "candidate-cv";
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

      const { data: upload, error: cvUploadErr } = await supabase
        .from("cv_uploads")
        .insert({
          user_id: user.id,
          storage_bucket: bucket,
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        .select("id")
        .single();
      if (cvUploadErr || !upload) throw new Error(`cv_uploads_insert_failed: ${cvUploadErr?.message || "insert_failed"}`);

      const { data: parseJob, error: jobErr } = await supabase
        .from("cv_parse_jobs")
        .insert({ user_id: user.id, cv_upload_id: upload.id, status: "queued" })
        .select("id,status")
        .single();
      if (jobErr || !parseJob) throw new Error(`cv_parse_jobs_insert_failed: ${jobErr?.message || "insert_failed"}`);

      setJobId(parseJob.id);
      setMsg("Job en cola…");

      void fetch("/api/candidate/cv/parse/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: parseJob.id }),
      }).catch(() => {});
    } catch (e: any) {
      setMsg(toFriendlyCvError(e?.message || "Error subiendo/procesando CV."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!jobId) return;
    let alive = true;

    const tick = async () => {
      try {
        const { data, error } = await supabase
          .from("cv_parse_jobs")
          .select("id,status,error,result_json")
          .eq("id", jobId)
          .single();
        if (error) throw new Error(error.message);
        if (!alive) return;

        const casted = data as Job;
        setJob(casted);
        const nextWarnings = Array.isArray(casted?.result_json?.meta?.warnings) ? casted.result_json.meta.warnings : [];

        if (casted.status === "queued") {
          setMsg("Job en cola…");
        } else if (casted.status === "processing") {
          setMsg("Procesando CV…");
        } else if (casted.status === "succeeded") {
          if (shouldApplyParsedResultOnce({ nextJobId: casted.id, lastAppliedJobId })) {
            await loadProfileSets();
            applyParsedResults(casted);
          }

          const ex = Array.isArray(casted?.result_json?.experiences) ? casted.result_json.experiences.length : 0;
          const ed = Array.isArray(casted?.result_json?.education) ? casted.result_json.education.length : 0;

          if (nextWarnings.includes("cv_text_insufficient")) {
            setMsg("Procesamiento completado con aviso: el CV tiene poco texto legible y la extracción puede ser incompleta.");
          } else if (ex === 0 && ed === 0) {
            setMsg("Procesamiento completado: no se detectaron experiencias ni formación con suficiente claridad.");
          } else if (ex === 0) {
            setMsg("Procesamiento completado: se detectó formación, pero no experiencias laborales.");
          } else if (ed === 0) {
            setMsg("Procesamiento completado: se detectaron experiencias, pero no formación académica.");
          } else {
            setMsg("Listo. CV procesado con extracción laboral y académica.");
          }
        } else if (casted.status === "failed") {
          setMsg(toFriendlyCvError(casted.error || "Falló el parsing."));
        }
      } catch (e: any) {
        if (!alive) return;
        setMsg(toFriendlyCvError(e?.message || "Error consultando job."));
      }
    };

    void tick();
    const t = setInterval(() => void tick(), 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [jobId, supabase, lastAppliedJobId, loadProfileSets]);

  const statusLabel =
    job?.status === "queued" ? "En cola" : job?.status === "processing" ? "Procesando" : job?.status === "succeeded" ? "Completado" : job?.status === "failed" ? "Fallido" : "—";

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
        <div className="w-full md:max-w-lg">
          <label className="block text-sm font-medium text-slate-700">Subir CV</label>
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white"
          />
        </div>
        <button onClick={start} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-medium border bg-slate-900 text-white disabled:opacity-50">
          {busy ? "Subiendo…" : "Extraer perfil desde CV"}
        </button>
      </div>

      {msg ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div>{msg}</div>
          {String(msg).toLowerCase().includes("manualmente") ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="/candidate/experience" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                Completar experiencia manualmente
              </a>
              <a href="/candidate/education" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                Completar formacion
              </a>
              <a href="/candidate/achievements?open=language" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100">
                Anadir idiomas
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {lastImport ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div>
            {lastImport.section === "experiences"
              ? "Experiencias"
              : lastImport.section === "education"
                ? "Formación"
                : "Idiomas"}: {lastImport.imported} importadas · {lastImport.duplicatesSkipped} omitidas por duplicadas · {lastImport.notSelected} no seleccionadas.
          </div>
          {Number(lastImport.languagesImported || 0) > 0 || Number(lastImport.achievementsImported || 0) > 0 ? (
            <div className="mt-1">
              También hemos añadido {Number(lastImport.languagesImported || 0)} idiomas y {Number(lastImport.achievementsImported || 0)} logros detectados al perfil.
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <a href="/candidate/experience" className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100">
              Abrir experiencias
            </a>
            <a href="/candidate/education" className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100">
              Abrir formación
            </a>
            <a href="/candidate/achievements" className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100">
              Abrir idiomas y logros
            </a>
          </div>
        </div>
      ) : null}

      {job ? (
        <div className="rounded-lg border p-3 bg-slate-50">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <span className="font-medium">Estado:</span> <span>{statusLabel}</span>
            </div>
            {jobId ? <div className="text-xs text-slate-500 break-all">ID del proceso: {jobId}</div> : null}
          </div>

          {job.status === "succeeded" ? (
            <div className="mt-3 space-y-5">
              {(Array.isArray(job?.result_json?.meta?.warnings) ? job.result_json.meta.warnings : []).length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {(Array.isArray(job?.result_json?.meta?.warnings) ? job.result_json.meta.warnings : []).includes("cv_text_insufficient")
                    ? "Aviso: el CV tiene poco texto legible. Revisa los datos extraídos antes de importarlos."
                    : "Aviso: la extracción puede estar incompleta. Revisa los datos antes de importarlos."}
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">Experiencias laborales detectadas</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setExpChecked(expStatuses.map(() => true))} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium">Seleccionar todas</button>
                    <button type="button" onClick={() => setExpChecked(expStatuses.map(() => false))} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium">Deseleccionar todas</button>
                    <button type="button" onClick={() => void importSection("experiences")} disabled={importing !== null || dedupLoading} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60">
                      {importing === "experiences" ? "Importando…" : "Importar seleccionadas"}
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                  Puedes editar estos datos antes de importarlos. La importación solo aplicará los elementos seleccionados.
                </div>

                {expDrafts.length === 0 ? (
                  <div className="text-sm text-slate-600">No se detectaron experiencias laborales.</div>
                ) : (
                  <div className="space-y-2">
                    {expDrafts.map((x: any, idx: number) => (
                      <div key={idx} className="rounded-md border bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(expChecked[idx])}
                              onChange={(e) => setExpChecked((prev) => prev.map((v, i) => (i === idx ? e.target.checked : v)))}
                            />
                            Seleccionar
                          </label>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge(expStatuses[idx] || "new")}`}>
                            {matchStatusLabel(expStatuses[idx] || "new")}
                          </span>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          <input value={x.company_name || ""} onChange={(e) => setExpDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, company_name: e.target.value } : r)))} placeholder="Empresa" className="rounded-lg border px-3 py-2 text-sm" />
                          <input value={x.role_title || ""} onChange={(e) => setExpDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, role_title: e.target.value } : r)))} placeholder="Puesto" className="rounded-lg border px-3 py-2 text-sm" />
                          <input value={x.start_date || ""} onChange={(e) => setExpDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, start_date: e.target.value } : r)))} placeholder="Fecha inicio (YYYY-MM)" className="rounded-lg border px-3 py-2 text-sm" />
                          <input value={x.end_date || ""} onChange={(e) => setExpDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, end_date: e.target.value } : r)))} placeholder="Fecha fin (YYYY-MM o Actual)" className="rounded-lg border px-3 py-2 text-sm" />
                        </div>
                        <textarea value={x.description || ""} onChange={(e) => setExpDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))} rows={2} placeholder="Descripción" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">Formación académica detectada</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEduChecked(eduStatuses.map(() => true))} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium">Seleccionar todas</button>
                    <button type="button" onClick={() => setEduChecked(eduStatuses.map(() => false))} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium">Deseleccionar todas</button>
                    <button type="button" onClick={() => void importSection("education")} disabled={importing !== null || dedupLoading} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60">
                      {importing === "education" ? "Importando…" : "Importar formación seleccionada"}
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                  Revisa y corrige cada formación antes de importarla. Solo se guardará la selección marcada.
                </div>

                {eduDrafts.length === 0 ? (
                  <div className="text-sm text-slate-600">No se detectó formación académica.</div>
                ) : (
                  <div className="space-y-2">
                    {eduDrafts.map((x: any, idx: number) => (
                      <div key={idx} className="rounded-md border bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(eduChecked[idx])}
                              onChange={(e) => setEduChecked((prev) => prev.map((v, i) => (i === idx ? e.target.checked : v)))}
                            />
                            Seleccionar
                          </label>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadge(eduStatuses[idx] || "new")}`}>
                            {matchStatusLabel(eduStatuses[idx] || "new")}
                          </span>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          <input value={x.institution || ""} onChange={(e) => setEduDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, institution: e.target.value } : r)))} placeholder="Institución" className="rounded-lg border px-3 py-2 text-sm" />
                          <input value={x.title || ""} onChange={(e) => setEduDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, title: e.target.value } : r)))} placeholder="Título" className="rounded-lg border px-3 py-2 text-sm" />
                          <input value={x.start_date || ""} onChange={(e) => setEduDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, start_date: e.target.value } : r)))} placeholder="Fecha inicio (YYYY-MM)" className="rounded-lg border px-3 py-2 text-sm" />
                          <input value={x.end_date || ""} onChange={(e) => setEduDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, end_date: e.target.value } : r)))} placeholder="Fecha fin (YYYY-MM)" className="rounded-lg border px-3 py-2 text-sm" />
                        </div>
                        <textarea value={x.description || ""} onChange={(e) => setEduDrafts((prev) => prev.map((r, i) => (i === idx ? { ...r, description: e.target.value } : r)))} rows={2} placeholder="Descripción" className="mt-2 w-full rounded-lg border px-3 py-2 text-sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">Idiomas detectados</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setLanguagesChecked(languagesDraft.map(() => true))} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium">Seleccionar todos</button>
                    <button type="button" onClick={() => setLanguagesChecked(languagesDraft.map(() => false))} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium">Deseleccionar todos</button>
                    <button type="button" onClick={() => void importSection("languages")} disabled={importing !== null || dedupLoading} className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60">
                      Importar idiomas seleccionados
                    </button>
                  </div>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                  Los idiomas importados se añadirán al perfil del candidato y estarán disponibles en la vista pública.
                </div>

                {languagesDraft.length === 0 ? (
                  <div className="text-sm text-slate-600">No se detectaron idiomas en el CV.</div>
                ) : (
                  <div className="space-y-2">
                    {languagesDraft.map((lang: string, idx: number) => (
                      <div key={`${lang}-${idx}`} className="rounded-md border bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(languagesChecked[idx])}
                              onChange={(e) => setLanguagesChecked((prev) => prev.map((v, i) => (i === idx ? e.target.checked : v)))}
                            />
                            Seleccionar
                          </label>
                        </div>
                        <input
                          value={lang}
                          onChange={(e) => setLanguagesDraft((prev) => prev.map((r, i) => (i === idx ? e.target.value : r)))}
                          placeholder="Idioma"
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {job.status === "failed" && job.error ? <div className="mt-3 text-sm text-red-700">{job.error}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
