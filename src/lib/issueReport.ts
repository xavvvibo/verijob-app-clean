export async function reportIssue(input: {
  severity?: "low" | "med" | "high";
  http_status: number;
  error_code?: string | null;
  path: string;
  message: string;
  metadata?: any;
}) {
  try {
    await fetch("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        severity: input.severity ?? (input.http_status >= 500 ? "high" : "med"),
        http_status: input.http_status,
        error_code: input.error_code ?? null,
        path: input.path,
        message: input.message,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        referrer: typeof document !== "undefined" ? document.referrer : null,
        metadata: input.metadata ?? {},
      }),
    });
  } catch {
    // silent
  }
}
