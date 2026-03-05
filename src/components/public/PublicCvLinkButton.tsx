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

      const res=await fetch(`/api/verification/${verificationId}/public-link`,{method:"POST"})
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

    const rawQR=await QRCode.toString(publicUrl,{
      type:"svg",
      margin:0,
      width:300,
      errorCorrectionLevel:"H"
    })

    const inner=rawQR
      .replace(/^[\s\S]*?<svg[^>]*>/i,"")
      .replace(/<\/svg>\s*$/i,"")

    const date=today()

    const token=publicUrl.split("/v/")[1]||""
    const credId=await shortHash(token)

    const branded=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="660" viewBox="0 0 520 660">

<rect width="520" height="660" rx="28" fill="white"/>

<text x="40" y="60" font-size="20" font-weight="800" fill="#0f172a">VERIJOB</text>
<text x="40" y="86" font-size="13" fill="#475569">Credencial laboral verificable</text>

<rect x="40" y="120" width="440" height="440" rx="20" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>

<g transform="translate(110,190)">
${inner}
</g>

<image href="/favicon.svg" x="230" y="310" width="60" height="60"/>

<g transform="rotate(-30 260 330)">
<text x="260" y="330"
text-anchor="middle"
font-size="44"
font-weight="900"
fill="#0f172a"
opacity="0.07">
VERIJOB ${date}
</text>
</g>

<text x="40" y="610" font-size="12" fill="#0f172a">
Escanea para verificar en tiempo real
</text>

<text x="40" y="632" font-size="11" fill="#64748b">
Emitido: ${date}
</text>

<text x="40" y="650" font-size="11" fill="#64748b">
Credential ID: ${credId}
</text>

</svg>`

    const blob=new Blob([branded],{type:"image/svg+xml"})
    const url=URL.createObjectURL(blob)

    const a=document.createElement("a")
    a.href=url
    a.download="verijob_verified_qr.svg"

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
