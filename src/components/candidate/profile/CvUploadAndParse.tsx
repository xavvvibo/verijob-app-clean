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
    const ok = mime.includes("pdf") || mime.includes("wordprocessingml") || file.name.toLowerCase().endsWith(".docx");
    if (!ok) {
      setMsg("Formato no soportado. Usa PDF o DOCX.");
      return;
    }

    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("No autorizado.");

      const bucket = "candidate-cv";
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${user.id}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw new Error(upErr.message);

      const r = await fetch("/api/candidate/cv/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storage_bucket: bucket,
          storage_path: path,
          original_filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Error creando job.");

      setJobId(j.job_id);
      setMsg("CV subido. Procesando…");
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
        const r = await fetch(`/api/candidate/cv/parse/job/${jobId}`, { method: "GET" });
        const out = await r.json();
        if (!r.ok) throw new Error(out?.error || "Error leyendo job.");

        const j: Job = out.job;
        if (!alive) return;
        setJob(j);

        if (j.status === "succeeded") setMsg("Listo. Experiencias extraídas.");
        if (j.status === "failed") setMsg(j.error || "Falló el parsing.");
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message || "Error poll job.");
      }
    };

    tick();
    const t = setInterval(tick, 2000);

    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [jobId]);

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
                      <div className="text-sm font-semibold">{x.role_title} — {x.company_name}</div>
                      <div className="text-xs text-slate-600">
                        {(x.start_date || "¿inicio?" )} → {(x.end_date || "actualidad")} · conf {(typeof x.confidence === "number" ? x.confidence.toFixed(2) : "0.50")}
                      </div>
                      {x.description && <div className="mt-2 text-sm text-slate-700">{x.description}</div>}
                      {Array.isArray(x.skills) && x.skills.length > 0 && (
                        <div className="mt-2 text-xs text-slate-600">Skills: {x.skills.join(", ")}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* siguiente paso: endpoint import -> experiences */}
              <div className="pt-2 text-xs text-slate-500">
                Siguiente paso (lo hacemos después): botón “Guardar experiencias” que inserta en public.experiences con source=cv_parse.
              </div>
            </div>
          )}

          {job.status === "failed" && job.error && (
            <div className="mt-3 text-sm text-red-700">{job.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
