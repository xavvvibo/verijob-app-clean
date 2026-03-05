"use client"

import { useMemo, useState } from "react"

export default function PublicCvLinkButton({ verificationId }: { verificationId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle")
  const [publicUrl, setPublicUrl] = useState<string>("")

  async function onCopyLink() {
    try {
      setState("loading")
      const res = await fetch(`/api/verification/${verificationId}/public-link`, { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json?.url) throw new Error(json?.error || "failed")

      setPublicUrl(json.url)
      await navigator.clipboard.writeText(json.url)
      setState("copied")
      setTimeout(() => setState("idle"), 1200)
    } catch {
      setState("error")
      setTimeout(() => setState("idle"), 1500)
    }
  }

  const token = useMemo(() => {
    if (!publicUrl) return ""
    const m = publicUrl.match(/\/v\/([^/?#]+)/)
    return m?.[1] || ""
  }, [publicUrl])

  function onDownloadQr() {
    if (!token) return
    const href = `/api/public/verification/${token}/qr.svg`
    const a = document.createElement("a")
    a.href = href
    a.download = `verijob-qr-${token}.svg`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const label =
    state === "loading" ? "Generando…" :
    state === "copied" ? "Copiado" :
    state === "error" ? "Error" :
    "Copiar CV público"

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onCopyLink}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
        type="button"
      >
        {label}
      </button>

      <button
        onClick={onDownloadQr}
        disabled={!token}
        className={`rounded-xl border px-3 py-2 text-sm ${token ? "border-gray-200 hover:bg-gray-50" : "border-gray-100 text-gray-300 cursor-not-allowed"}`}
        type="button"
      >
        Descargar QR
      </button>
    </div>
  )
}
