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
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (hour < 24) return `hace ${hour} h`;
  return `hace ${day} d`;
}

function hrefFor(item: NotificationItem) {
  if (item.entity_type === "verification_request" && item.entity_id) {
    return `/company/verification/${item.entity_id}`;
  }
  return null;
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
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      >
        <span className="text-lg leading-none">🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[360px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Notificaciones</div>
              <div className="text-xs text-slate-500">
                {loading ? "Cargando..." : unread > 0 ? `${unread} sin leer` : "Todo al día"}
              </div>
            </div>
            <button
              type="button"
              disabled={busy || unread === 0}
              onClick={markAllRead}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              Marcar todo leído
            </button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-auto">
            {!loading && data.items.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No hay notificaciones todavía.
              </div>
            ) : null}

            {data.items.map((item) => {
              const href = hrefFor(item);
              const content = (
                <div
                  className={`rounded-xl border p-3 ${
                    item.read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      {item.body ? <div className="mt-1 text-sm text-slate-600">{item.body}</div> : null}
                      <div className="mt-2 text-xs text-slate-400">{timeAgo(item.created_at)}</div>
                    </div>
                    {!item.read ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          markOneRead(item.id);
                        }}
                        className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                      >
                        Leída
                      </button>
                    ) : null}
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
                    {content}
                  </a>
                );
              }

              return <div key={item.id}>{content}</div>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
