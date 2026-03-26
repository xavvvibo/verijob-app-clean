export default function CandidateStatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "brand" | "success" | "warning";
}) {
  const toneClass =
    tone === "brand"
      ? "border-indigo-200 bg-indigo-50 text-indigo-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>;
}
