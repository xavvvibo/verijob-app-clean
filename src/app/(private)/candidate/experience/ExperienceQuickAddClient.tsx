"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function ExperienceQuickAddClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(false);

  const [roleTitle, setRoleTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [description, setDescription] = useState("");

  const formRef = useRef<HTMLDivElement | null>(null);
  const roleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchParams?.get("new") === "1") {
      setOpen(true);
      setHighlighted(true);
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        roleInputRef.current?.focus();
      }, 40);
      setTimeout(() => setHighlighted(false), 2200);
    }
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const { data: au } = await supabase.auth.getUser();
      if (!au.user) throw new Error("No autorizado");
      if (!roleTitle.trim() || !companyName.trim()) throw new Error("Indica puesto y empresa");

      const { error } = await supabase.from("profile_experiences").insert({
        user_id: au.user.id,
        role_title: roleTitle.trim(),
        company_name: companyName.trim(),
        start_date: startDate.trim() || null,
        end_date: isCurrent ? null : endDate.trim() || null,
        description: description.trim() || null,
        matched_verification_id: null,
        confidence: null,
      });

      if (error) throw new Error(error.message);

      setMessage("Experiencia guardada correctamente.");
      setRoleTitle("");
      setCompanyName("");
      setStartDate("");
      setEndDate("");
      setDescription("");
      setIsCurrent(false);
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setMessage(err?.message || "No se pudo añadir la experiencia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      ref={formRef}
      className={`mt-4 rounded-2xl border p-4 transition-colors ${
        highlighted ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">Nueva experiencia laboral</div>
          <div className="text-xs text-gray-600">Las experiencias nuevas se crean con estado sin verificar.</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setHighlighted(true);
            setTimeout(() => setHighlighted(false), 1200);
            if (!open) {
              setTimeout(() => roleInputRef.current?.focus(), 20);
            }
          }}
          className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
        >
          {open ? "Cerrar" : "Añadir experiencia"}
        </button>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Puesto</div>
            <input
              ref={roleInputRef}
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Empresa</div>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Fecha inicio</div>
            <input type="month" lang="es" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Fecha fin</div>
            <input
              type="month"
              lang="es"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isCurrent}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
            />
          </label>
          <label className="md:col-span-2 flex items-center gap-2 text-xs font-medium text-gray-700">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => {
                const next = e.target.checked;
                setIsCurrent(next);
                if (next) setEndDate("");
              }}
            />
            Trabajo actualmente aquí
          </label>
          <label className="block md:col-span-2">
            <div className="text-xs font-semibold text-gray-900">Descripción breve</div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
              {saving ? "Guardando…" : "Guardar experiencia"}
            </button>
          </div>
        </form>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <div className="font-semibold">{message}</div>
          <div className="mt-1 text-xs">Siguiente paso: verifica esta experiencia con tu empresa o añade evidencia documental.</div>
        </div>
      ) : null}
    </div>
  );
}
