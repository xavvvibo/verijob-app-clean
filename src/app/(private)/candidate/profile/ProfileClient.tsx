"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

function pick(obj: any, keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

function prettyList(v: any): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (typeof v === "string") return v;
  return null;
}

export default function ProfileClient() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        setErr("No estás logueado.");
        setLoading(false);
        return;
      }

      setUserEmail(user.email ?? null);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) setErr(error.message);
      else setProfile(data);

      setLoading(false);
    })();
  }, [supabase]);

  if (loading) return <div className="text-sm text-gray-600">Cargando…</div>;
  if (err) return <div className="text-sm text-red-600">Error: {err}</div>;

  const displayName = pick(profile, ["full_name", "name", "display_name", "first_name"]);
  const headline = pick(profile, ["headline", "title", "position"]);
  const location = pick(profile, ["location", "city", "country"]);
  const languages = prettyList(pick(profile, ["languages", "langs"]));
  const role = pick(profile, ["role"]);
  const onboarding = pick(profile, ["onboarding_completed"]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Mi perfil</h2>
          <p className="mt-2 text-sm text-gray-600">
            Información del usuario autenticado (tabla <b>profiles</b>).
          </p>
        </div>

        <a
          href="/candidate/profile-share"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Compartir perfil
        </a>
      </div>

      <div className="mt-6 rounded-xl border p-5">
        <div className="text-sm font-semibold">{displayName ?? "Candidato"}</div>
        {headline && <div className="mt-1 text-sm text-gray-600">{headline}</div>}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">Email</div>
            <div className="mt-1 text-sm font-medium break-words">{userEmail ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">Rol</div>
            <div className="mt-1 text-sm font-medium">{role ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">Onboarding</div>
            <div className="mt-1 text-sm font-medium">
              {String(onboarding) === "true" ? "Completado" : "Pendiente"}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">Ubicación</div>
            <div className="mt-1 text-sm font-medium">{location ?? "—"}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-gray-500">Idiomas</div>
            <div className="mt-1 text-sm font-medium">{languages ?? "—"}</div>
          </div>
        </div>
      </div>

      <details className="mt-6 rounded-xl border p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Ver JSON completo (debug)
        </summary>
        <pre className="mt-3 text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(profile, null, 2)}
        </pre>
      </details>
    </div>
  );
}
