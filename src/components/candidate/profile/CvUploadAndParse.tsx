"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

type Job = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  error: string | null;
  result_json: any;
};

export default function CvUploadAndParse() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [importing, setImporting] = useState<null | "experiences" | "education">(null);

  async function importSection(section: "experiences" | "education") {
    if (!jobId) return;
    setImporting(section);
    setMsg(null);
    try {
      const res = await fetch("/api/candidate/cv/parse/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: jobId, section }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "import_failed");
      const imported = Number(data?.imported ?? 0);
      if (imported === 0) {
        setMsg(
          section === "experiences"
            ? "No se importaron experiencias: ya existían o no había datos válidos para insertar."
            : "No se importó formación: ya existía o no había datos válidos para insertar."
        );
      } else {
        setMsg(
          section === "experiences"
            ? `Propuesta aplicada: ${imported} experiencias importadas con estado no verificado. Ya puedes revisarlas en /candidate/experience.`
            : `Propuesta aplicada: ${imported} formaciones importadas. Ya están disponibles en tu perfil.`
        );
        router.refresh();
      }
    } catch (e: any) {
      setMsg(e?.message || "No se pudo aplicar la propuesta de importación.");
    } finally {
      setImporting(null);
    }
  }

  async function start() {
    setMsg(null);
    setJob(null);
    setJobId(null);

    if (!file) {
      setMsg("Selecciona un CV (PDF o DOCX).");
      return;
    }

    const mime = (file.type || "").toLowerCase();
    const ok =
      mime.includes("pdf") ||
      mime.includes("wordprocessingml") ||
      file.name.toLowerCase().endsWith(".docx");

    if (!ok) {
      setMsg("Formato no soportado. Usa PDF o DOCX.");
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

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || undefined,
        });

      if (upErr) {
        throw new Error(`upload_failed: ${upErr.message}`);
      }

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

      if (cvUploadErr || !upload) {
        throw new Error(`cv_uploads_insert_failed: ${cvUploadErr?.message || "insert_failed"}`);
      }

      const { data: parseJob, error: jobErr } = await supabase
        .from("cv_parse_jobs")
        .insert({
          user_id: user.id,
          cv_upload_id: upload.id,
          status: "queued",
        })
        .select("id,status")
        .single();

      if (jobErr || !parseJob) {
        throw new Error(`cv_parse_jobs_insert_failed: ${jobErr?.message || "insert_failed"}`);
      }

      setJobId(parseJob.id);
      setMsg("Job en cola…");

      void fetch("/api/candidate/cv/parse/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ job_id: parseJob.id }),
      }).catch(() => {});
    } catch (e: any) {
      setMsg(e?.message || "Error subiendo/procesando CV.");
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

        setJob(data as Job);

        if (data.status === "queued") {
          setMsg("Job en cola…");
        } else if (data.status === "processing") {
          setMsg("Procesando CV…");
        } else if (data.status === "succeeded") {
          const ex = Array.isArray((data as any)?.result_json?.experiences)
            ? (data as any).result_json.experiences.length
            : 0;
          const ed = Array.isArray((data as any)?.result_json?.education)
            ? (data as any).result_json.education.length
            : 0;
          const warnings = Array.isArray((data as any)?.result_json?.meta?.warnings)
            ? (data as any).result_json.meta.warnings
            : [];

          if (warnings.includes("cv_text_insufficient")) {
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
        } else if (data.status === "failed") {
          setMsg(data.error || "Falló el parsing.");
        }
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message || "Error consultando job.");
      }
    };

    tick();
    const t = setInterval(tick, 2000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [jobId, supabase]);

  const exps = Array.isArray(job?.result_json?.experiences) ? job?.result_json?.experiences : [];
  const education = Array.isArray(job?.result_json?.education) ? job?.result_json?.education : [];
  const warnings = Array.isArray(job?.result_json?.meta?.warnings) ? job?.result_json?.meta?.warnings : [];
  const statusLabel =
    job?.status === "queued"
      ? "En cola"
      : job?.status === "processing"
        ? "Procesando"
        : job?.status === "succeeded"
          ? "Completado"
          : job?.status === "failed"
            ? "Fallido"
            : "—";

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

        <button
          onClick={start}
          disabled={busy}
          className="rounded-lg px-3 py-2 text-sm font-medium border bg-slate-900 text-white disabled:opacity-50"
        >
          {busy ? "Subiendo…" : "Extraer perfil desde CV"}
        </button>
      </div>

      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      {job && (
        <div className="rounded-lg border p-3 bg-slate-50">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <span className="font-medium">Estado:</span>{" "}
              <span>{statusLabel}</span>
            </div>
            {jobId && <div className="text-xs text-slate-500 break-all">ID del proceso: {jobId}</div>}
          </div>

          {job.status === "succeeded" && (
            <div className="mt-3 space-y-5">
              {warnings.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {warnings.includes("cv_text_insufficient")
                    ? "Aviso: el CV tiene poco texto legible. Revisa los datos extraídos antes de importarlos."
                    : "Aviso: la extracción puede estar incompleta. Revisa los datos antes de importarlos."}
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Experiencias laborales detectadas</div>
                  <button
                    type="button"
                    onClick={() => importSection("experiences")}
                    disabled={importing !== null}
                    className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  >
                    {importing === "experiences" ? "Importando…" : "Importar a experiencias"}
                  </button>
                </div>
              {exps.length === 0 ? (
                <div className="text-sm text-slate-600">No se detectaron experiencias laborales.</div>
              ) : (
                <div className="space-y-2">
                  {exps.map((x: any, idx: number) => (
                    <div key={idx} className="rounded-md border bg-white p-3">
                      <div className="text-sm font-semibold">
                        {x.role_title || x.title || "Puesto"} — {x.company_name || x.company || "Empresa"}
                      </div>
                      <div className="text-xs text-slate-600">
                        {(x.start_date || "¿inicio?")} → {(x.end_date || "actualidad")}
                      </div>
                      {x.description ? (
                        <div className="mt-2 text-sm text-slate-700">{x.description}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Formación académica detectada</div>
                  <button
                    type="button"
                    onClick={() => importSection("education")}
                    disabled={importing !== null}
                    className="rounded-md border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  >
                    {importing === "education" ? "Importando…" : "Importar a formación"}
                  </button>
                </div>
                {education.length === 0 ? (
                  <div className="text-sm text-slate-600">No se detectó formación académica.</div>
                ) : (
                  <div className="space-y-2">
                    {education.map((x: any, idx: number) => (
                      <div key={idx} className="rounded-md border bg-white p-3">
                        <div className="text-sm font-semibold">
                          {x.title || "Título"} — {x.institution || "Institución"}
                        </div>
                        <div className="text-xs text-slate-600">
                          {(x.start_date || "¿inicio?")} → {(x.end_date || "actualidad")}
                        </div>
                        {x.study_field ? (
                          <div className="mt-1 text-xs text-slate-600">Área: {x.study_field}</div>
                        ) : null}
                        {x.description ? (
                          <div className="mt-2 text-sm text-slate-700">{x.description}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {job.status === "failed" && job.error ? (
            <div className="mt-3 text-sm text-red-700">{job.error}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
