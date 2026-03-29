"use client";

import { useState } from "react";
import type { CandidateSkillItem } from "@/lib/candidate/profile-visibility";

function slugifySkill(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CandidateProfileSkillsClient({
  initialSkills,
}: {
  initialSkills: CandidateSkillItem[];
}) {
  const [skills, setSkills] = useState<CandidateSkillItem[]>(initialSkills || []);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function persist(nextSkills: CandidateSkillItem[], successMessage: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/candidate/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skills: nextSkills }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "No se han podido guardar las skills.");
      }
      setSkills(nextSkills);
      setMessage(successMessage);
    } catch (error: any) {
      setMessage(error?.message || "No se han podido guardar las skills.");
    } finally {
      setSaving(false);
    }
  }

  async function addSkill() {
    const name = draft.trim();
    if (!name) {
      setMessage("Escribe una skill antes de añadirla.");
      return;
    }
    if (skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
      setMessage("Esa skill ya está en tu perfil.");
      return;
    }
    const nextSkills = [
      ...skills,
      {
        id: `skill-${slugifySkill(name) || Date.now()}`,
        name,
        source_type: "self",
        verified: false,
        verification_type: null,
      } satisfies CandidateSkillItem,
    ];
    await persist(nextSkills, "Skill añadida correctamente.");
    setDraft("");
  }

  async function removeSkill(id: string) {
    const nextSkills = skills.filter((skill) => skill.id !== id);
    await persist(nextSkills, "Skill eliminada correctamente.");
  }

  return (
    <section className="rounded-[28px] border border-violet-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,1)_0%,rgba(245,243,255,0.72)_100%)] p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600">Skills</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Capacidades visibles de tu perfil</h2>
          <p className="mt-1 text-sm text-slate-600">Úsalas para reforzar lo que una empresa entiende de ti en segundos.</p>
        </div>
        <div className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700">
          {skills.length} {skills.length === 1 ? "skill visible" : "skills visibles"}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {skills.length > 0 ? (
          skills.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
            >
              <span>{skill.name}</span>
              <button
                type="button"
                onClick={() => void removeSkill(skill.id)}
                disabled={saving}
                className="text-xs font-semibold text-slate-500 hover:text-rose-700 disabled:opacity-60"
              >
                Eliminar
              </button>
            </span>
          ))
        ) : (
          <p className="text-sm text-slate-500">Todavía no has añadido skills manuales.</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ej. Excel avanzado, atención al cliente, SQL"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
        <button
          type="button"
          onClick={() => void addSkill()}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Añadir skill"}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">Las verificaciones futuras podrán reforzar estas skills sin cambiar su estructura actual.</p>

      {message ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{message}</div>
      ) : null}
    </section>
  );
}
