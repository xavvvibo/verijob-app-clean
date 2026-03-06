"use client";

type Props = {
  token?: string | null;
  verificationId?: string | null;
  className?: string;
};

export default function PublicCvLinkButton({
  token,
  verificationId,
  className,
}: Props) {
  const href = token
    ? `/v/${token}`
    : verificationId
      ? `/api/verification/${verificationId}/public-link`
      : "#";

  return (
    <a
      href={href}
      className={className || "inline-flex rounded-lg border px-3 py-2 text-sm"}
      aria-disabled={!token && !verificationId}
    >
      {token || verificationId ? "Ver CV público" : "CV público no disponible"}
    </a>
  );
}
