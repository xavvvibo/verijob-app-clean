import Link from "next/link";

export default function CandidatePageHeader({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  badges,
  variant = "editorial",
}: {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  badges?: string[];
  variant?: "editorial" | "management";
}) {
  const containerClass =
    variant === "management"
      ? "space-y-5 border-b border-slate-100 pb-8"
      : "space-y-5 border-b border-slate-100 pb-7";

  return (
    <section className={containerClass}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-[820px] space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950">{title}</h1>
          <p className="max-w-[720px] text-base leading-7 text-slate-600">{description}</p>
        </div>

        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition duration-150 hover:bg-black"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>

      {badges?.length ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span key={badge} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              {badge}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
