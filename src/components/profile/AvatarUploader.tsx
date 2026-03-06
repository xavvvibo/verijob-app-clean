"use client";

type Props = {
  url?: string | null;
  currentUrl?: string | null;
  fallbackName?: string | null;
  onUploaded?: (url: string) => void;
};

export default function AvatarUploader({
  url,
  currentUrl,
  fallbackName,
}: Props) {
  const finalUrl = currentUrl || url || null;
  const initials = (fallbackName || "?")
    .trim()
    .split(/\s+/)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm font-medium">Avatar</div>

      {finalUrl ? (
        <img
          src={finalUrl}
          alt="Avatar"
          className="mt-3 h-20 w-20 rounded-full object-cover"
        />
      ) : (
        <div className="mt-3 flex h-20 w-20 items-center justify-center rounded-full border text-sm font-semibold">
          {initials || "?"}
        </div>
      )}
    </div>
  );
}
