"use client"

import { useState } from "react"

export default function PublicCvLinkButton({ verificationId }: { verificationId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle")

  async function onClick() {
    try {
      setState("loading")
      const res = await fetch(`/api/verification/${verificationId}/public-link`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json?.url) throw new Error(json?.error || "failed")

      await navigator.clipboard.writeText(json.url)
      setState("copied")
      setTimeout(() => setState("idle"), 1200)
    } catch {
      setState("error")
      setTimeout(() => setState("idle"), 1500)
    }
  }

  const label =
    state === "loading" ? "Generando…" :
    state === "copied" ? "Copiado" :
    state === "error" ? "Error" :
    "Copiar CV público"

  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
      type="button"
    >
      {label}
    </button>
  )
}
