"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

function isExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

export default function CandidateOverviewPage() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [totalVerifications, setTotalVerifications] = useState<number>(0);
  const [profileToken, setProfileToken] = useState<string | null>(null);
  const [profileExpires, setProfileExpires] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // 1) Conteo de verificaciones
      const { count } = await supabase
        .from("verification_requests")
        .select("*", { count: "exact", head: true })
        .eq("requested_by", user.id);

      setTotalVerifications(count ?? 0);

      // 2) Link público de perfil
      const { data: link } = await supabase
        .from("candidate_public_links")
        .select("public_token, expires_at")
        .eq("candidate_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (link?.public_token && !isExpired(link.expires_at)) {
        setProfileToken(link.public_token);
        setProfileExpires(link.expires_at);
      }

      setLoading(false);
    })();
  }, [supabase]);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010");

  const profileUrl = profileToken ? `${origin}/p/${profileToken}` : null;

  async function copyLink() {
    if (!profileUrl) return;
    await navigator.clipboard.writeText(profileUrl);
    alert("Enlace copiado");
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Resumen</h2>
          <p className="mt-2 text-sm text-gray-600">
            Estado actual de tu perfil y verificaciones.
          </p>
        </div>

        <Link
          href="/candidate/profile-share"
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
        >
          Generar enlace
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-5">
          <div className="text-xs text-gray-500">Verificaciones</div>
          <div className="mt-2 text-2xl font-semibold">
            {loading ? "…" : totalVerifications}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Total solicitadas
          </div>
        </div>

        <div className="rounded-xl border p-5">
          <div className="text-xs text-gray-500">Perfil público</div>
          <div className="mt-2 text-sm font-medium">
            {loading
              ? "…"
              : profileUrl
              ? "Activo"
              : "No generado"}
          </div>
          {profileUrl && (
            <div className="mt-3 text-xs text-gray-600 break-words">
              {profileUrl}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-5">
          <div className="text-xs text-gray-500">Caducidad enlace</div>
          <div className="mt-2 text-sm font-medium">
            {profileExpires
              ? new Date(profileExpires).toLocaleDateString()
              : "—"}
          </div>
          {profileUrl && (
            <button
              onClick={copyLink}
              className="mt-3 rounded-md border px-3 py-1 text-xs hover:bg-gray-50"
            >
              Copiar enlace
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/candidate/profile"
          className="rounded-xl border p-5 hover:bg-gray-50"
        >
          <div className="text-sm font-semibold">Mi perfil</div>
          <div className="mt-2 text-xs text-gray-600">
            Revisa lo que verá una empresa.
          </div>
        </Link>

        <Link
          href="/candidate/verifications"
          className="rounded-xl border p-5 hover:bg-gray-50"
        >
          <div className="text-sm font-semibold">Verificaciones</div>
          <div className="mt-2 text-xs text-gray-600">
            Gestiona tus procesos activos.
          </div>
        </Link>
      </div>
    </div>
  );
}
