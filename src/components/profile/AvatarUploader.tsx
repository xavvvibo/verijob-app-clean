"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/browser";

type Props = {
  currentUrl?: string | null;
  fallbackName: string;
  onUpdated?: (url: string) => void;
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "U";
}

export default function AvatarUploader({ currentUrl, fallbackName, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const initials = useMemo(() => initialsFrom(fallbackName), [fallbackName]);

  async function pick() {
    setErr(null);
    inputRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErr("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Máximo 5MB.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const supabase = createClient();
      const { data: au, error: auErr } = await supabase.auth.getUser();
      if (auErr) throw auErr;
      if (!au.user) throw new Error("No hay sesión.");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${au.user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;

      // Guardamos URL pública en profiles (v1)
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", au.user.id);

      if (pErr) throw pErr;

      onUpdated?.(url);
    } catch (e: any) {
      setErr(e?.message ?? "No se pudo subir la foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-24 h-24 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-500 text-2xl font-semibold">{initials}</div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-600">
          Sube una foto profesional. Esto prepara tu CV verificado.
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={pick}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {busy ? "Subiendo…" : currentUrl ? "Cambiar foto" : "Subir foto"}
          </button>

          {currentUrl ? (
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
            >
              Ver
            </a>
          ) : null}
        </div>

        {err ? <div className="text-sm text-red-600">{err}</div> : null}

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
    </div>
  );
}
