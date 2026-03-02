const SENSITIVE_KEY_RE =
  /(email|e-mail|mail|phone|tel|mobile|dni|nif|ssn|passport|address|direccion|street|zip|postal|birth|dob|fecha_nac|iban|bank|account|token|secret|key)/i;

function isPlainObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function sanitizePublic<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((x) => sanitizePublic(x)) as any;
  }
  if (!isPlainObject(input)) return input;

  const out: any = {};
  for (const [k, v] of Object.entries(input as any)) {
    if (SENSITIVE_KEY_RE.test(k)) continue;
    out[k] = sanitizePublic(v);
  }
  return out;
}
