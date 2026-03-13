type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

type SendEmailResult = {
  ok: boolean;
  provider: "resend";
  skipped?: boolean;
  error?: string | null;
  id?: string | null;
};

function getConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "").trim();
  return { apiKey, from };
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { apiKey, from } = getConfig();
  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "resend",
      skipped: true,
      error: "email_provider_not_configured",
    };
  }

  try {
    const payload = {
      from,
      to: [String(input.to).trim()],
      subject: String(input.subject || "").trim(),
      html: String(input.html || ""),
      text: String(input.text || ""),
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        provider: "resend",
        error: `resend_api_error_${response.status}: ${raw}`,
      };
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    return {
      ok: true,
      provider: "resend",
      id: parsed?.id ? String(parsed.id) : null,
      error: null,
    };
  } catch (e: any) {
    return {
      ok: false,
      provider: "resend",
      error: String(e?.message || "send_email_failed"),
    };
  }
}

