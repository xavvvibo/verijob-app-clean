"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ExperienceQuickAddClient() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [roleTitle, setRoleTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

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
        end_date: endDate.trim() || null,
        description: description.trim() || null,
        matched_verification_id: null,
        confidence: null,
      });

      if (error) throw new Error(error.message);

      setMessage("Experiencia añadida correctamente como sin verificar.");
      setRoleTitle("");
      setCompanyName("");
      setStartDate("");
      setEndDate("");
      setDescription("");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setMessage(e?.message || "No se pudo añadir la experiencia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">Añadir experiencia manual</div>
          <div className="text-xs text-gray-600">Las experiencias nuevas se crean con estado sin verificar.</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-gray-50"
        >
          {open ? "Cerrar" : "Añadir experiencia"}
        </button>
      </div>

      {open ? (
        <form onSubmit={submit} className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Puesto</div>
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Empresa</div>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Fecha inicio</div>
            <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="YYYY-MM" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <div className="text-xs font-semibold text-gray-900">Fecha fin</div>
            <input value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="YYYY-MM" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
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

      {message ? <div className="mt-3 text-sm text-gray-600">{message}</div> : null}
    </div>
  );
}
