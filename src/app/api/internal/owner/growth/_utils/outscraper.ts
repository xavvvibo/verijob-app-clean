export type OutscraperImportPayload = {
  job_id?: string | null;
  status?: string | null;
  cost?: number | string | null;
  leads?: number | string | null;
  contacts_found?: number | string | null;
  source?: string | null;
  query?: string | null;
  [key: string]: any;
};

function asNonNegativeNumber(value: unknown) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function asText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizeOutscraperImport(payload: OutscraperImportPayload | null | undefined) {
  const safe = payload && typeof payload === "object" ? payload : {};

  const jobId = asText(safe.job_id);
  const status = asText(safe.status) || "imported";
  const cost = asNonNegativeNumber(safe.cost);
  const leads = Math.floor(asNonNegativeNumber(safe.leads));
  const contactsFound = Math.floor(asNonNegativeNumber(safe.contacts_found));
  const source = asText(safe.source);
  const query = asText(safe.query);

  return {
    jobId,
    status,
    cost,
    leads,
    contactsFound,
    source,
    query,
    payload: {
      ...safe,
      job_id: jobId,
      status,
      cost,
      leads,
      contacts_found: contactsFound,
      source,
      query,
    },
  };
}
