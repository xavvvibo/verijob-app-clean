"use client"

import { useState } from "react"
import QRCode from "qrcode"

type State = "idle" | "loading" | "copied" | "error"

function today(){
  const d=new Date()
  const yyyy=d.getFullYear()
  const mm=String(d.getMonth()+1).padStart(2,"0")
  const dd=String(d.getDate()).padStart(2,"0")
  return `${yyyy}-${mm}-${dd}`
}

async function shortHash(text:string){
  const enc=new TextEncoder().encode(text)
  const buf=await crypto.subtle.digest("SHA-256",enc)
  const arr=Array.from(new Uint8Array(buf))
  const hex=arr.map(b=>b.toString(16).padStart(2,"0")).join("")
  return hex.slice(0,16)
}

function bytesToBase64(bytes: Uint8Array){
  let bin = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

async function loadLogoDataUrl(){
  const res = await fetch("/verijob-tick.png", { cache: "no-store" })
  if(!res.ok) throw new Error("logo_not_found")
  const buf = await res.arrayBuffer()
  const b64 = bytesToBase64(new Uint8Array(buf))
  return `data:image/png;base64,${b64}`
}

export default function PublicCvLinkButton({ verificationId }: { verificationId: string }) {

  const [state, setState] = useState<State>("idle")
  const [publicUrl, setPublicUrl] = useState<string>("")

  async function generatePublicUrl(){
    const res = await fetch(`/api/verification/${verificationId}/public-link`, { method: "POST" })
    const json = await res.json().catch(() => ({}))
    if(!res.ok || !json?.url){
      const msg = json?.error || "no_disponible"
      throw new Error(msg)
    }
    return String(json.url)
  }

  async function onCopyLink(){
    try{
      setState("loading")

      const url = publicUrl || await generatePublicUrl()
      setPublicUrl(url)

      await navigator.clipboard.writeText(url)

      setState("copied")
      setTimeout(()=>setState("idle"),1200)
    }catch{
      setState("error")
      setTimeout(()=>setState("idle"),1500)
    }
  }

  async function onDownloadQR(){
    try{
      setState("loading")

      const url = publicUrl || await generatePublicUrl()
      setPublicUrl(url)

      const qrPng = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 1400
      })

      const logoPng = await loadLogoDataUrl()

      const date = today()
      const token = url.split("/v/")[1] || ""
      const credId = await shortHash(token)

      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="720" viewBox="0 0 520 720">
  <rect width="520" height="720" rx="24" fill="#ffffff"/>

  <text x="40" y="60" font-size="20" font-weight="800" fill="#0f172a">VERIJOB</text>
  <text x="40" y="84" font-size="13" fill="#64748b">Credencial laboral verificable</text>

  <rect x="60" y="120" width="400" height="400" rx="18" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>

  <!-- watermark sutil -->
  <g transform="rotate(-30 260 320)">
    <text x="260" y="320" text-anchor="middle" font-size="34" font-weight="800" fill="#0f172a" opacity="0.035">
      VERIJOB ${date}
    </text>
  </g>

  <!-- QR grande -->
  <image href="${qrPng}" x="80" y="140" width="360" height="360"/>

  <!-- logo pequeño centrado -->
  <rect x="236" y="296" width="48" height="48" rx="14" fill="#ffffff"/>
  <rect x="234" y="294" width="52" height="52" rx="16" fill="none" stroke="#e5e7eb" stroke-width="2"/>
  <image href="${logoPng}" x="244" y="304" width="32" height="32"/>

  <text x="40" y="570" font-size="12" fill="#0f172a">Escanea para verificar la credencial</text>
  <text x="40" y="595" font-size="11" fill="#64748b">Emitido: ${date}</text>
  <text x="40" y="615" font-size="11" fill="#64748b">Credential ID: ${credId}</text>
</svg>`

      const blob = new Blob([svg], { type: "image/svg+xml" })
      const dl = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = dl
      a.download = "verijob_credential_qr.svg"
      document.body.appendChild(a)
      a.click()
      a.remove()

      URL.revokeObjectURL(dl)

      setState("idle")
    }catch{
      setState("error")
      setTimeout(()=>setState("idle"),1500)
    }
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
        type="button"
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
      >
        {label}
      </button>

      <button
        onClick={onDownloadQR}
        type="button"
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
      >
        Descargar QR
      </button>
    </div>
  )
}
