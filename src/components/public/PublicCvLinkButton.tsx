"use client"

import { useState } from "react"
import QRCode from "qrcode"

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

export default function PublicCvLinkButton({verificationId}:{verificationId:string}){

  const [state,setState]=useState<"idle"|"loading"|"copied"|"error">("idle")
  const [publicUrl,setPublicUrl]=useState<string>("")

  async function onCopyLink(){

    try{

      setState("loading")

      const res=await fetch(`/api/verification/${verificationId}/public-link`,{
        method:"POST"
      })

      const json=await res.json()

      if(!res.ok||!json?.url) throw new Error()

      setPublicUrl(json.url)

      await navigator.clipboard.writeText(json.url)

      setState("copied")
      setTimeout(()=>setState("idle"),1200)

    }catch{

      setState("error")
      setTimeout(()=>setState("idle"),1500)

    }
  }

  async function downloadQR(){

    if(!publicUrl) return

    const qrPng=await QRCode.toDataURL(publicUrl,{
      errorCorrectionLevel:"H",
      margin:2,
      width:1200
    })

    const date=today()
    const token=publicUrl.split("/v/")[1]||""
    const credId=await shortHash(token)

    const logo="/favicon_512.png"

    const branded=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="700" viewBox="0 0 520 700">

  <rect width="520" height="700" rx="24" fill="#ffffff"/>

  <text x="40" y="60" font-size="20" font-weight="800" fill="#0f172a">VERIJOB</text>
  <text x="40" y="84" font-size="13" fill="#64748b">Credencial laboral verificable</text>

  <rect x="60" y="120" width="400" height="400" rx="18" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>

  <image href="${qrPng}" x="80" y="140" width="360" height="360"/>

  <!-- logo pequeño centrado -->
  <rect x="238" y="298" width="44" height="44" rx="12" fill="#ffffff"/>
  <image href="${logo}" x="244" y="304" width="32" height="32"/>

  <text x="40" y="570" font-size="12" fill="#0f172a">
  Escanea para verificar la credencial
  </text>

  <text x="40" y="595" font-size="11" fill="#64748b">
  Emitido: ${date}
  </text>

  <text x="40" y="615" font-size="11" fill="#64748b">
  Credential ID: ${credId}
  </text>

</svg>`

    const blob=new Blob([branded],{type:"image/svg+xml"})
    const url=URL.createObjectURL(blob)

    const a=document.createElement("a")
    a.href=url
    a.download="verijob_credential_qr.svg"
    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)
  }

  const label=
    state==="loading"?"Generando…":
    state==="copied"?"Copiado":
    state==="error"?"Error":
    "Copiar CV público"

  return(
    <div className="flex gap-2">

      <button
        onClick={onCopyLink}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
      >
        {label}
      </button>

      <button
        onClick={downloadQR}
        disabled={!publicUrl}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40"
      >
        Descargar QR
      </button>

    </div>
  )
}
