"use client";

type InlineStatusTone = "success" | "warning" | "error";

const TONE_STYLES: Record<InlineStatusTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function InlineStatusMessage({
  tone,
  message,
}: {
  tone: InlineStatusTone;
  message: string;
}) {
  return (
    <div
      role="status"
      className={`mt-4 rounded-xl border px-3 py-2 text-sm ${TONE_STYLES[tone]}`}
    >
      {message}
    </div>
  );
}
