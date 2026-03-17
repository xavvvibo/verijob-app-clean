function trimToString(value: unknown) {
  return String(value ?? "").trim();
}

type PhoneNormalizationResult =
  | { ok: true; normalized: string | null }
  | { ok: false; error: string };

export function normalizeCandidatePhone(value: unknown): PhoneNormalizationResult {
  const raw = trimToString(value);
  if (!raw) return { ok: true, normalized: null };

  if (/[A-Za-z]/.test(raw)) {
    return { ok: false, error: "El teléfono contiene letras y no es válido." };
  }

  if (!/^[+\d\s().-]+$/.test(raw)) {
    return { ok: false, error: "El teléfono contiene símbolos no válidos." };
  }

  let compact = raw.replace(/[\s().-]+/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;

  if (compact.startsWith("+")) {
    const digits = compact.slice(1);
    if (!/^\d+$/.test(digits)) {
      return { ok: false, error: "El teléfono internacional no es válido." };
    }
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, error: "El teléfono debe tener entre 8 y 15 dígitos." };
    }
    if (digits.startsWith("34")) {
      const national = digits.slice(2);
      if (!/^[6789]\d{8}$/.test(national)) {
        return { ok: false, error: "El teléfono español no es válido." };
      }
    }
    return { ok: true, normalized: `+${digits}` };
  }

  if (!/^\d+$/.test(compact)) {
    return { ok: false, error: "El teléfono no es válido." };
  }

  if (/^[6789]\d{8}$/.test(compact)) {
    return { ok: true, normalized: `+34${compact}` };
  }

  return { ok: false, error: "Introduce un teléfono válido en formato nacional o internacional." };
}
