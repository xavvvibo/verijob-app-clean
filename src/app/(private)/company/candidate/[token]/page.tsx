export const dynamic = "force-dynamic";
export const revalidate = 0;
import { headers } from "next/headers";

type Ctx = { params: Promise<{ token: string }> };

async function fetchCompanyProfile(token: string) {
  const h = await headers();
  const forwardedProto = h.get("x-forwarded-proto") || "http";
  const forwardedHost = h.get("x-forwarded-host") || h.get("host");
  const base =
    (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const cookie = h.get("cookie") || "";

  const res = await fetch(`${base}/api/company/candidate/${token}`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export default async function CompanyCandidateTokenPage({ params }: Ctx) {
  const { token } = await params;
  const { ok, status, body } = await fetchCompanyProfile(token);

  if (!ok) {
    const msg =
      status === 401 ? "Necesitas iniciar sesión para acceder a esta vista privada." :
      status === 403 ? "Necesitas un contexto de empresa activo para acceder a esta vista." :
      status === 402 ? "Has agotado tus créditos. Sube de plan o compra un pack." :
      status === 410 ? "Este enlace ha caducado." :
      status === 429 ? "Demasiadas solicitudes. Inténtalo más tarde." :
      "No encontrado.";

    const upgradeUrl = body?.upgrade_url ?? "/company/upgrade";

    return (
      <main className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold">Perfil (Empresa)</h1>
        <p className="mt-3 text-sm text-gray-600">{msg}</p>

        {status === 401 && (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/login?mode=company">
              Iniciar sesión
            </a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/signup?mode=company">
              Crear cuenta empresa
            </a>
          </div>
        )}

        {status === 403 && (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/dashboard">
              Cambiar a empresa
            </a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/dashboard">
              Ir al panel principal
            </a>
          </div>
        )}

        {status === 402 && (
          <div className="mt-4 flex gap-3">
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href={upgradeUrl}>
              Ir a Upgrade
            </a>
            <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/requests">
              Volver
            </a>
          </div>
        )}
      </main>
    );
  }

  const profile = body?.profile ?? {};
  const gate = body?.gate ?? {};
  const contact = body?.contact ?? {};
  const hasEmail = typeof contact?.email === "string" && contact.email.length > 0;
  const hasPhone = typeof contact?.phone === "string" && contact.phone.length > 0;
  const hasContact = hasEmail || hasPhone;

  return (
    <main className="p-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">CV completo (Empresa)</h1>
          <p className="mt-1 text-sm text-gray-600">
            Este acceso consume 1 crédito por candidato y periodo (idempotente).
          </p>
        </div>

        {gate?.requires_overage ? (
          <span className="text-xs rounded-full border px-3 py-1">
            Enterprise: overage pendiente ({gate?.overage_price ?? "—"}€)
          </span>
        ) : (
          <span className="text-xs rounded-full border px-3 py-1">
            Créditos restantes: {gate?.credits_remaining ?? "—"}
          </span>
        )}
      </div>

      <section className="mt-6 rounded-lg border p-4">
        <h2 className="text-base font-semibold text-gray-900">Contacto del candidato</h2>
        {hasContact ? (
          <div className="mt-3 space-y-3">
            {hasEmail ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                <div>
                  <div className="text-xs text-gray-500">Email</div>
                  <div className="text-sm font-medium text-gray-900">{contact.email}</div>
                </div>
                <a
                  className="rounded-md border px-3 py-2 text-sm inline-block"
                  href={`mailto:${contact.email}`}
                >
                  Enviar email
                </a>
              </div>
            ) : null}

            {hasPhone ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                <div>
                  <div className="text-xs text-gray-500">Teléfono</div>
                  <div className="text-sm font-medium text-gray-900">{contact.phone}</div>
                </div>
                <a
                  className="rounded-md border px-3 py-2 text-sm inline-block"
                  href={`tel:${String(contact.phone).replace(/\s+/g, "")}`}
                >
                  Llamar
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            El candidato no ha habilitado métodos de contacto directo para empresas registradas.
          </p>
        )}
      </section>

      <div className="mt-6 rounded-lg border p-4">
        <pre className="text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(profile, null, 2)}
        </pre>
      </div>

      <div className="mt-6">
        <a className="rounded-md border px-4 py-2 text-sm inline-block" href="/company/requests">
          Volver a Requests
        </a>
      </div>
    </main>
  );
}
