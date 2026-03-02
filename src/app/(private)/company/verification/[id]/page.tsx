"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Summary = Record<string, any>;

function Badge({ status }: { status: string }) {
  const cls = useMemo(() => {
    const map: Record<string, string> = {
      approved: "bg-green-100 text-green-800",
      verified: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      pending: "bg-yellow-100 text-yellow-800",
      revoked: "bg-gray-200 text-gray-800",
    };
    return map[status] || "bg-gray-100 text-gray-700";
  }, [status]);

  return (
    <span className={`px-3 py-1 text-xs font-medium rounded-full ${cls}`}>
      {status.toUpperCase()}
    </span>
  );
}

export default function CompanyVerificationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<number | null>(null);
  const [data, setData] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/verification/${id}/summary`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!alive) return;

        setStatus(res.status);

        if (!res.ok) {
          setData(null);
          return;
        }

        const json = await res.json();
        setData(json);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // UX: no access = 404 screen (sin redirect)
  if (!loading && (status === 404 || status === 401)) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">No tienes acceso</h1>
        <p className="text-sm text-gray-600">
          Esta verificación no existe o no pertenece a tu empresa activa.
        </p>
        <Link href="/company/requests" className="text-sm underline">
          ← Volver a solicitudes
        </Link>
      </div>
    );
  }

  if (!loading && status && status >= 500) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Error del servidor</h1>
        <p className="text-sm text-gray-600">
          Ha ocurrido un error cargando la verificación.
        </p>
        <div className="flex gap-4">
          <button
            className="text-sm underline"
            onClick={() => location.reload()}
          >
            Reintentar
          </button>
          <Link href="/company/requests" className="text-sm underline">
            ← Volver a solicitudes
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Detalle de verificación</h1>
          <Link href="/company/requests" className="text-sm underline">
            ← Volver a solicitudes
          </Link>
        </div>
        <div className="border rounded-xl p-6 bg-white shadow-sm">
          <div className="text-sm text-gray-500">Cargando…</div>
        </div>
      </div>
    );
  }

  const statusEffective = data.is_revoked
    ? "revoked"
    : (data.status_effective || data.status || "pending");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Detalle de verificación</h1>
        <Link href="/company/requests" className="text-sm underline">
          ← Volver a solicitudes
        </Link>
      </div>

      <div className="border rounded-xl p-6 space-y-4 shadow-sm bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">Empresa</div>
            <div className="font-medium">
              {data.company_name_freeform ?? "—"}
            </div>
          </div>

          <Badge status={String(statusEffective)} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Posición</div>
            <div>{data.position ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-500">Periodo</div>
            <div>
              {(data.start_date ?? "—")} — {(data.end_date ?? "Actual")}
            </div>
          </div>
        </div>
      </div>

      {data.is_revoked && (
        <div className="border border-gray-300 bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="font-semibold">Verificación revocada</div>
          <div className="text-sm">
            Motivo: {data.revoked_reason || "No especificado"}
          </div>
          <div className="text-xs text-gray-500">
            Revocada en: {data.revoked_at || "—"}
          </div>
        </div>
      )}

      <div className="flex gap-4">
        <Link
          href={`/api/verification/${id}/summary`}
          className="text-sm underline"
        >
          Ver JSON resumen
        </Link>
        <Link
          href={`/company/verification/${id}/evidences`}
          className="text-sm underline"
        >
          Ver evidencias
        </Link>
      </div>
    </div>
  );
}
