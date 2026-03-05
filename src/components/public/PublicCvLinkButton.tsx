"use client"

import { useState } from "react"
import QRCode from "qrcode"

export default function PublicCvLinkButton({ verificationId }: { verificationId: string }) {

  const [state, setState] = useState<"idle" | "loading" | "copied" | "error">("idle")
  const [publicUrl, setPublicUrl] = useState<string>("")

  async function onCopyLink() {
    try {
      setState("loading")

      const res = await fetch(`/api/verification/${verificationId}/public-link`, { method: "POST" })
      const json = await res.json()

      if (!res.ok || !json?.url) throw new Error()

      setPublicUrl(json.url)

      await navigator.clipboard.writeText(json.url)

      setState("copied")
      setTimeout(() => setState("idle"), 1200)

    } catch {
      setState("error")
      setTimeout(() => setState("idle"), 1500)
    }
  }

  async function downloadQR() {

    if (!publicUrl) return

    const svg = await QRCode.toString(publicUrl, {
      type: "svg",
      width: 320,
      margin: 1
    })

    const blob = new Blob([svg], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "verijob_qr.svg"

    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)
  }

  const label =
    state === "loading" ? "Generando…" :
    state === "copied" ? "Copiado" :
    state === "error" ? "Error" :
    "Copiar CV público"

  return (
    <div className="flex gap-2">

      <button
        onClick={onCopyLink}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
        type="button"
      >
        {label}
      </button>

      <button
        onClick={downloadQR}
        disabled={!publicUrl}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
        type="button"
      >
        Descargar QR
      </button>

    </div>
  )
}
