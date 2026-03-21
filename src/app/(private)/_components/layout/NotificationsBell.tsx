"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  read: boolean;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at: string;
};

type NotificationsResponse = {
  unread_count: number;
  items: NotificationItem[];
};

function timeAgo(value: string) {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  const hour = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  if (hour < 24) return `Hace ${hour} h`;
  return `Hace ${day} d`;
}

function hrefFor(item: NotificationItem) {
  if (item.entity_type === "verification_request" && item.entity_id) {
    return `/company/verification/${item.entity_id}`;
  }
  return null;
}

function typeLabel(item: NotificationItem) {
  if (item.type === "verification_requested") return "Nueva solicitud";
  if (item.type === "verification_resolved") return "Resultado";
  if (item.type === "verification_resolved_company") return "Solicitud resuelta";
  if (item.type === "low_confidence_verification") return "Revisión";
  return "Notificación";
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        d="M12 3a5 5 0 0 0-5 5v2.2c0 .9-.3 1.8-.8 2.5L4.7 15a1.5 1.5 0 0 0 1.2 2.4h12.2a1.5 1.5 0 0 0 1.2-2.4l-1.5-2.3a4.6 4.6 0 0 1-.8-2.5V8a5 5 0 0 0-5-5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 19a2.5 2.5 0 0 0 5 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<NotificationsResponse>({ unread_count: 0, items: [] });
  const rootRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as NotificationsResponse;
      setData({
        unread_count: Number(json?.unread_count || 0),
        items: Array.isArray(json?.items) ? json.items : [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const unread = useMemo(() => Number(data.unread_count || 0), [data.unread_count]);

  async function markOneRead(id: string) {
    try {
      setBusy(true);
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setData((prev) => ({
          unread_count: Math.max(
            0,
            prev.unread_count - (prev.items.find((x) => x.id === id && !x.read) ? 1 : 0)
          ),
          items: prev.items.map((x) => (x.id === id ? { ...x, read: true } : x)),
        }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    try {
      setBusy(true);
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true }),
      });
      if (res.ok) {
        setData((prev) => ({
          unread_count: 0,
          items: prev.items.map((x) => ({ ...x, read: true })),
        }));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notificaciones"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[19px] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-[390px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Notificaciones</div>
                <div className="mt-1 text-xs text-slate-500">
                  {loading ? "Cargando..." : unread > 0 ? `${unread} pendientes` : "Todo al día"}
                </div>
              </div>
              <button
                type="button"
                disabled={busy || unread === 0}
                onClick={markAllRead}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm disabled:opacity-50"
              >
                Marcar todo leído
              </button>
            </div>
          </div>

          <div className="max-h-[440px] overflow-auto px-3 py-3">
            {!loading && data.items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No tienes notificaciones todavía.
              </div>
            ) : null}

            <div className="space-y-2">
              {data.items.map((item) => {
                const href = hrefFor(item);
                const unreadStyle = !item.read
                  ? "border-blue-200 bg-blue-50/70"
                  : "border-slate-200 bg-white";
                const CardInner = (
                  <div className={`rounded-2xl border p-4 transition hover:border-slate-300 ${unreadStyle}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                          {typeLabel(item)}
                        </span>
                        {!item.read ? (
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-400">{timeAgo(item.created_at)}</div>
                    </div>

                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    {item.body ? (
                      <div className="mt-1.5 text-sm leading-5 text-slate-600">{item.body}</div>
                    ) : null}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-400">
                        {item.read ? "Leída" : "Pendiente de lectura"}
                      </div>

                      <div className="flex items-center gap-2">
                        {!item.read ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markOneRead(item.id);
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700"
                          >
                            Marcar leída
                          </button>
                        ) : null}

                        {href ? (
                          <span className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white">
                            Abrir
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );

                if (href) {
                  return (
                    <a
                      key={item.id}
                      href={href}
                      onClick={() => {
                        setOpen(false);
                        if (!item.read) markOneRead(item.id);
                      }}
                      className="block"
                    >
                      {CardInner}
                    </a>
                  );
                }

                return <div key={item.id}>{CardInner}</div>;
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
