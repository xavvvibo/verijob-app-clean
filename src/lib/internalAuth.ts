export function requireInternalJobAuth(req: Request) {
  const internalHeader = req.headers.get("x-verijob-internal") || "";
  const tokenHeader =
    req.headers.get("x-verijob-internal-token") ||
    req.headers.get("x-internal-job-token") ||
    "";

  const bearer = req.headers.get("authorization") || "";
  const bearerToken = bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : "";

  const expected = process.env.INTERNAL_JOB_TOKEN || "";

  const provided = tokenHeader || bearerToken;

  if (!expected) {
    return { ok: false as const, status: 500, error: "server_misconfigured_missing_INTERNAL_JOB_TOKEN" };
  }

  // Requiere ambos: flag interno + token válido (evita que un token filtrado “sirva” sin el header)
  const internalOk = internalHeader === "1" || internalHeader.toLowerCase() === "true";
  const tokenOk = provided === expected;

  if (!internalOk || !tokenOk) {
    return { ok: false as const, status: 401, error: "unauthorized_internal_job" };
  }

  return { ok: true as const };
}
