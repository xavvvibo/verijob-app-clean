export const OTP_RESEND_SECONDS = 90;

export function mapOtpErrorMessage(raw) {
  const msg = String(raw || "").trim();
  const normalized = msg.toLowerCase();

  if (!msg) return "No se pudo completar la operacion. Intentalo de nuevo.";

  if (
    normalized.includes("sending magic link email") ||
    normalized.includes("error sending") ||
    normalized.includes("smtp") ||
    normalized.includes("email provider")
  ) {
    return "No se pudo enviar el codigo por email en este momento. Intentalo de nuevo en unos minutos.";
  }

  if (normalized.includes("email") && (normalized.includes("invalid") || normalized.includes("not valid"))) {
    return "El email no es valido. Revisa el formato e intentalo de nuevo.";
  }

  if (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("otp_expired") ||
    normalized.includes("token")
  ) {
    return "El codigo no coincide o ya no es valido. Usa siempre el ultimo codigo enviado o solicita uno nuevo.";
  }

  if (normalized.includes("rate") || normalized.includes("too many")) {
    return "Has realizado demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
  }

  if (
    (normalized.includes("signup") && normalized.includes("otp")) ||
    normalized.includes("signups not allowed") ||
    normalized.includes("sign up not allowed")
  ) {
    return "Este acceso forma parte de un proceso de registro. Si ya tienes cuenta inicia sesion. Si no, crea tu cuenta para continuar.";
  }

  return msg;
}

export function getOtpHelpMessage(secondsLeft) {
  if (secondsLeft > 0) {
    return `Usa siempre el ultimo codigo enviado. Si reenvias el acceso, los anteriores dejan de servir. Podras pedir uno nuevo en ${secondsLeft}s.`;
  }

  return "Si el codigo no llega o ya no funciona, solicita uno nuevo. Usa siempre el ultimo codigo recibido.";
}

export async function verifyOtpWithFallbacks(supabase, params) {
  const email = String(params?.email || "").trim().toLowerCase();
  const token = String(params?.token || "").trim();
  const types = Array.isArray(params?.types) ? params.types.filter(Boolean) : [];

  let lastError = null;

  for (const type of types) {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (!error) return { ok: true, otpType: type };
    lastError = error;
  }

  return { ok: false, error: lastError };
}
