"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Job = {
  id: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  error: string | null;
  result_json: any;
};

export default function CvUploadAndParse() {
  const supabase = useMemo(() => createClient(), []);
  const [file, setFile] = useState<File | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);

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
      setMsg("CV subido. Job de parse creado.");
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
          setMsg("Listo. Experiencias extraídas.");
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

  const exps = job?.result_json?.experiences || [];

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
          {busy ? "Subiendo…" : "Extraer experiencias"}
        </button>
      </div>

      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      {job && (
        <div className="rounded-lg border p-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">Estado:</span>{" "}
              <span className="uppercase">{job.status}</span>
            </div>
            {jobId && <div className="text-xs text-slate-500">job_id: {jobId}</div>}
          </div>

          {job.status === "succeeded" && (
            <div className="mt-3 space-y-2">
              <div className="text-sm font-medium">Experiencias detectadas</div>
              {exps.length === 0 ? (
                <div className="text-sm text-slate-600">No se detectaron experiencias.</div>
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
          )}

          {job.status === "failed" && job.error ? (
            <div className="mt-3 text-sm text-red-700">{job.error}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
