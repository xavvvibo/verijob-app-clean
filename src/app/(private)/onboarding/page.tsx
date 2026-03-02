"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export const dynamic = "force-dynamic";

function isStrongEnough(pw: string) {
  // mínimo razonable sin complicarlo (ajustable luego)
  return (pw || "").length >= 8;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setErr(null);
      setLoading(true);

      // 1) sesión obligatoria
      const { data: au } = await supabase.auth.getUser();
      const user = au.user;

      if (!user) {
        if (!cancelled) router.replace("/login?next=/onboarding");
        return;
      }

      // 2) si ya completó onboarding -> dashboard
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      // Si no existe profile todavía, no rebotamos: dejaremos que el submit lo marque
      if (pErr) {
        // no bloqueamos, pero mostramos error si fuese crítico
        if (!cancelled) setErr("No se pudo leer tu perfil. Intenta recargar.");
      } else if (profile?.onboarding_completed) {
        if (!cancelled) router.replace("/dashboard");
        return;
      }

      if (!cancelled) setLoading(false);
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!isStrongEnough(pw)) {
      setErr("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pw !== pw2) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);
    try {
      // sesión obligatoria
      const { data: au } = await supabase.auth.getUser();
      const user = au.user;
      if (!user) {
        router.replace("/login?next=/onboarding");
        return;
      }

      // 3) set password
      const { error: upErr } = await supabase.auth.updateUser({ password: pw });
      if (upErr) throw upErr;

      // 4) marcar onboarding como completado (si la fila existe)
      // si no existe, el upsert dependerá de constraints; preferimos update best-effort
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);

      // 5) salida limpia: dashboard
      router.replace("/dashboard");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Error guardando la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ width: 420, maxWidth: "100%" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Configura tu contraseña</h1>
        <p style={{ marginTop: 8, opacity: 0.75 }}>
          Este paso es necesario para terminar el onboarding.
        </p>

        {loading ? (
          <div style={{ opacity: 0.7, marginTop: 16 }}>Cargando…</div>
        ) : (
          <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Contraseña</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                marginBottom: 12,
              }}
            />

            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Repite contraseña</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                marginBottom: 12,
              }}
            />

            {err ? (
              <div style={{ background: "#fff1f1", border: "1px solid #ffd1d1", padding: 10, borderRadius: 10, marginBottom: 12 }}>
                <div style={{ color: "#a40000", fontSize: 13 }}>{err}</div>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: saving ? "#333" : "#111",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Guardando…" : "Guardar y continuar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
