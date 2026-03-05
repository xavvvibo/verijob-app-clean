export function requireInternalJobToken(req: Request) {
  const token = req.headers.get("x-verijob-internal") || "";
  const expected = process.env.INTERNAL_JOB_TOKEN || "";

  if (!expected) {
    return { ok: false as const, status: 500, error: "server_misconfigured_missing_INTERNAL_JOB_TOKEN" };
  }

  if (!token || token !== expected) {
    return { ok: false as const, status: 401, error: "unauthorized_internal_job" };
  }

  return { ok: true as const };
}
