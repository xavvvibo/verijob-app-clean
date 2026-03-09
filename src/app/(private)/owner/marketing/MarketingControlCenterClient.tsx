"use client";

import { useEffect, useMemo, useState } from "react";

type PromoCode = {
  id: string;
  code: string;
  target_type: string;
  benefit_type: string;
  benefit_value: string | null;
  expires_at: string | null;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  created_at: string;
};

type ManualGrant = {
  id: string;
  user_id: string;
  grant_type: string;
  grant_value: string | null;
  reason: string;
  expires_at: string | null;
  status: string;
  created_at?: string;
};

type UserResult = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
};

const targetOptions = ["candidatos", "empresas", "ambos", "usuarios concretos"];
const benefitOptions = [
  "upgrade a Pro",
  "upgrade a Pro+",
  "créditos extra",
  "descuento 25%",
  "descuento 50%",
  "100% gratis temporal",
  "plan especial",
];
const durationOptions = ["7_dias", "14_dias", "30_dias", "90_dias", "sin_caducidad", "fecha_personalizada"];
const reasonOptions = ["tester inicial", "amigo fundador", "compensación", "demo comercial", "incidencia", "beta privada"];

function normalizeBenefitToGrant(benefit: string) {
  const b = benefit.toLowerCase();
  if (b.includes("pro+")) return { grant_type: "upgrade", grant_value: "proplus" };
  if (b.includes("pro")) return { grant_type: "upgrade", grant_value: "pro" };
  if (b.includes("créditos")) return { grant_type: "credits", grant_value: "5" };
  return { grant_type: "special", grant_value: benefit };
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}

export default function MarketingControlCenterClient() {
  const [loading, setLoading] = useState(true);
  const [savingPromo, setSavingPromo] = useState(false);
  const [savingGrant, setSavingGrant] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [manualGrants, setManualGrants] = useState<ManualGrant[]>([]);

  const [promoForm, setPromoForm] = useState({
    target_type: targetOptions[0],
    benefit_type: benefitOptions[0],
    benefit_value: "",
    duration_option: durationOptions[0],
    custom_expires_at: "",
    max_redemptions: "5",
    code_mode: "autogen",
    custom_code: "",
    campaign_type: "beta",
  });

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [grantForm, setGrantForm] = useState({
    benefit_type: benefitOptions[0],
    duration_option: durationOptions[0],
    reason: reasonOptions[0],
    note: "",
  });

  async function loadData() {
    const [promoRes, grantsRes] = await Promise.all([
      fetch("/api/internal/owner/marketing/promo-codes", { cache: "no-store" }),
      fetch("/api/internal/owner/marketing/manual-grants", { cache: "no-store" }),
    ]);

    const promoJson = await promoRes.json().catch(() => ({}));
    const grantsJson = await grantsRes.json().catch(() => ({}));

    if (!promoRes.ok) throw new Error(promoJson?.error || "No se pudieron cargar promociones");
    if (!grantsRes.ok) throw new Error(grantsJson?.error || "No se pudieron cargar bonificaciones");

    setPromoCodes(Array.isArray(promoJson?.promo_codes) ? promoJson.promo_codes : []);
    setManualGrants(Array.isArray(grantsJson?.manual_grants) ? grantsJson.manual_grants : []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "No se pudo cargar el módulo de marketing");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function createPromo(e: React.FormEvent) {
    e.preventDefault();
    setSavingPromo(true);
    setError(null);
    try {
      const maxRedemptions = promoForm.max_redemptions === "ilimitado" ? null : Number(promoForm.max_redemptions);
      const res = await fetch("/api/internal/owner/marketing/promo-codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target_type: promoForm.target_type,
          benefit_type: promoForm.benefit_type,
          benefit_value: promoForm.benefit_value || null,
          duration_option: promoForm.duration_option,
          max_redemptions: maxRedemptions,
          code_mode: promoForm.code_mode,
          custom_code: promoForm.custom_code,
          campaign_type: promoForm.campaign_type,
          custom_expires_at: promoForm.custom_expires_at || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo crear la promoción");
      await loadData();
    } catch (e: any) {
      setError(e?.message || "No se pudo crear la promoción");
    } finally {
      setSavingPromo(false);
    }
  }

  async function promoAction(id: string, action: "deactivate" | "extend" | "duplicate") {
    setError(null);
    try {
      const payload = action === "extend" ? { action, add_days: 30 } : { action };
      const res = await fetch(`/api/internal/owner/marketing/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo actualizar la promoción");
      await loadData();
    } catch (e: any) {
      setError(e?.message || "No se pudo actualizar la promoción");
    }
  }

  async function searchUsers() {
    if (!userQuery.trim()) {
      setUserResults([]);
      return;
    }
    const res = await fetch(`/api/internal/owner/users/search?q=${encodeURIComponent(userQuery.trim())}`, {
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "No se pudo buscar usuarios");
      return;
    }
    setUserResults(Array.isArray(json?.users) ? json.users : []);
  }

  async function applyManualGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) {
      setError("Selecciona un usuario para aplicar el beneficio");
      return;
    }

    setSavingGrant(true);
    setError(null);
    try {
      const mapped = normalizeBenefitToGrant(grantForm.benefit_type);
      const res = await fetch("/api/internal/owner/marketing/manual-grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: selectedUserId,
          grant_type: mapped.grant_type,
          grant_value: mapped.grant_value,
          duration_option: grantForm.duration_option,
          reason: grantForm.reason,
          note: grantForm.note,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "No se pudo aplicar el beneficio");
      setSelectedUserId("");
      setUserResults([]);
      setUserQuery("");
      await loadData();
    } catch (e: any) {
      setError(e?.message || "No se pudo aplicar el beneficio");
    } finally {
      setSavingGrant(false);
    }
  }

  const analytics = useMemo(() => {
    const redemptions = promoCodes.reduce((acc, p) => acc + Number(p.current_redemptions || 0), 0);
    const activeUsers = new Set(manualGrants.filter((g) => g.status === "active").map((g) => g.user_id)).size;
    const expiryCandidates = promoCodes.map((promo) => promo.expires_at).filter(Boolean) as string[];
    const nextExpiry = expiryCandidates.length
      ? expiryCandidates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
      : null;
    return { redemptions, activeUsers, nextExpiry };
  }, [manualGrants, promoCodes]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Marketing Control Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Gestiona promociones, códigos y bonificaciones manuales para campañas, betas y activación comercial.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <MetricCard label="Redemptions" value={analytics.redemptions} />
        <MetricCard label="Active users" value={analytics.activeUsers} />
        <MetricCard
          label="Expiry date"
          value={analytics.nextExpiry ? new Date(analytics.nextExpiry).toLocaleDateString("es-ES") : "Sin caducidad"}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Promo Builder</h2>
        <form className="mt-4 grid gap-6 md:grid-cols-2" onSubmit={createPromo}>
          <SelectField label="Target" value={promoForm.target_type} onChange={(v) => setPromoForm((s) => ({ ...s, target_type: v }))} options={targetOptions} />
          <SelectField label="Beneficio" value={promoForm.benefit_type} onChange={(v) => setPromoForm((s) => ({ ...s, benefit_type: v }))} options={benefitOptions} />
          <InputField label="Valor adicional (opcional)" value={promoForm.benefit_value} onChange={(v) => setPromoForm((s) => ({ ...s, benefit_value: v }))} placeholder="Ej. 5 créditos" />
          <SelectField label="Duración" value={promoForm.duration_option} onChange={(v) => setPromoForm((s) => ({ ...s, duration_option: v }))} options={durationOptions} />
          <SelectField label="Modo código" value={promoForm.code_mode} onChange={(v) => setPromoForm((s) => ({ ...s, code_mode: v }))} options={["autogen", "custom"]} />
          <InputField label="Código personalizado" value={promoForm.custom_code} onChange={(v) => setPromoForm((s) => ({ ...s, custom_code: v }))} placeholder="VJ-BETA-2026" />
          <InputField label="Caducidad personalizada (ISO)" value={promoForm.custom_expires_at} onChange={(v) => setPromoForm((s) => ({ ...s, custom_expires_at: v }))} placeholder="2026-12-31T23:59:59.000Z" />
          <SelectField label="Límite de uso" value={promoForm.max_redemptions} onChange={(v) => setPromoForm((s) => ({ ...s, max_redemptions: v }))} options={["1", "5", "10", "ilimitado"]} />

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingPromo}
              className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {savingPromo ? "Creando..." : "Crear promoción"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Promotions Active</h2>
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Cargando promociones...</p>
        ) : promoCodes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Aún no hay promociones activas.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Benefit</th>
                  <th className="px-3 py-2">Target</th>
                  <th className="px-3 py-2">Redemptions</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.map((promo) => (
                  <tr key={promo.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-semibold text-slate-900">{promo.code}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {promo.benefit_type}
                      {promo.benefit_value ? <span className="text-slate-500"> · {promo.benefit_value}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{promo.target_type}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {promo.current_redemptions}/{promo.max_redemptions ?? "∞"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          promo.is_active
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {promo.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(promo.code)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Copy Code
                        </button>
                        <button
                          type="button"
                          onClick={() => promoAction(promo.id, "deactivate")}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Desactivar
                        </button>
                        <button
                          type="button"
                          onClick={() => promoAction(promo.id, "extend")}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Ampliar
                        </button>
                        <button
                          type="button"
                          onClick={() => promoAction(promo.id, "duplicate")}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Duplicar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Manual Grants</h2>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="Buscar usuario por email o nombre"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={searchUsers}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Buscar usuario
          </button>
        </div>

        {userResults.length > 0 ? (
          <div className="mt-3 rounded-lg border border-slate-200">
            {userResults.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUserId(u.id)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  selectedUserId === u.id ? "bg-blue-50" : "bg-white"
                }`}
              >
                <span>
                  <span className="font-semibold text-slate-900">{u.full_name || "Usuario"}</span>
                  <span className="ml-2 text-slate-600">{u.email || "sin-email"}</span>
                </span>
                <span className="text-xs uppercase tracking-wide text-slate-500">{u.role || "n/a"}</span>
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={applyManualGrant} className="mt-4 grid gap-6 md:grid-cols-2">
          <SelectField
            label="Beneficio"
            value={grantForm.benefit_type}
            onChange={(v) => setGrantForm((s) => ({ ...s, benefit_type: v }))}
            options={benefitOptions}
          />
          <SelectField
            label="Duración"
            value={grantForm.duration_option}
            onChange={(v) => setGrantForm((s) => ({ ...s, duration_option: v }))}
            options={durationOptions}
          />
          <SelectField
            label="Motivo"
            value={grantForm.reason}
            onChange={(v) => setGrantForm((s) => ({ ...s, reason: v }))}
            options={reasonOptions}
          />
          <InputField
            label="Nota interna"
            value={grantForm.note}
            onChange={(v) => setGrantForm((s) => ({ ...s, note: v }))}
            placeholder="Contexto opcional"
          />

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingGrant}
              className="rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {savingGrant ? "Aplicando..." : "Aplicar beneficio"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Últimos grants</h3>
          {manualGrants.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aún no hay bonificaciones manuales registradas.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {manualGrants.slice(0, 6).map((grant) => (
                <li key={grant.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">{grant.grant_type}</span>
                  {grant.grant_value ? <span> · {grant.grant_value}</span> : null}
                  <span> · {grant.reason}</span>
                  <span className="ml-2 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
                    {grant.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</section>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        placeholder={placeholder}
      />
    </label>
  );
}
