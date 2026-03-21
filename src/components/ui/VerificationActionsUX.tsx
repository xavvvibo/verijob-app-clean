"use client";

import { UX_COPY } from "@/lib/ux-copy";

export default function VerificationActionsUX({
  onConfirm,
  onReject,
}: {
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="space-y-3">
      <button
        onClick={onConfirm}
        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-2 font-medium"
      >
        {UX_COPY.actions.confirm}
      </button>

      <button
        onClick={onReject}
        className="w-full border border-red-300 text-red-600 hover:bg-red-50 rounded-xl py-2 font-medium"
      >
        {UX_COPY.actions.reject}
      </button>

      <p className="text-xs text-gray-500">
        {UX_COPY.actions.trace}
      </p>
    </div>
  );
}
