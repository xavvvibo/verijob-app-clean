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

async function loadLogo(){

  const res=await fetch("/verijob-tick.png")

  const buf=await res.arrayBuffer()

  const bytes=new Uint8Array(buf)

  let binary=""
  bytes.forEach(b=>binary+=String.fromCharCode(b))

  const b64=btoa(binary)

  return `data:image/png;base64,${b64}`

}

export default function PublicCvLinkButton({verificationId}:{verificationId:string}){

  const [publicUrl,setPublicUrl]=useState<string>("")

  async function copyLink(){

    const res=await fetch(`/api/verification/${verificationId}/public-link`,{
      method:"POST"
    })

    const json=await res.json()

    if(!res.ok||!json?.url) return

    setPublicUrl(json.url)

    await navigator.clipboard.writeText(json.url)

  }

  async function downloadQR(){

    if(!publicUrl) return

    const qr=await QRCode.toDataURL(publicUrl,{
      errorCorrectionLevel:"H",
      width:1200,
      margin:2
    })

    const logo=await loadLogo()

    const date=today()

    const token=publicUrl.split("/v/")[1]||""

    const credId=await shortHash(token)

    const svg=`<?xml version="1.0" encoding="UTF-8"?>

<svg xmlns="http://www.w3.org/2000/svg" width="520" height="700">

<rect width="520" height="700" rx="20" fill="#ffffff"/>

<text x="40" y="60" font-size="20" font-weight="700">VERIJOB</text>
<text x="40" y="85" font-size="13" fill="#64748b">Credencial laboral verificable</text>

<rect x="60" y="120" width="400" height="400" rx="18"
fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/>

<image href="${qr}" x="80" y="140" width="360" height="360"/>

<rect x="235" y="295" width="50" height="50" rx="14" fill="#ffffff"/>

<image href="${logo}" x="245" y="305" width="30" height="30"/>

<text x="40" y="570" font-size="12">
Escanea para verificar la credencial
</text>

<text x="40" y="595" font-size="11" fill="#64748b">
Emitido: ${date}
</text>

<text x="40" y="615" font-size="11" fill="#64748b">
Credential ID: ${credId}
</text>

</svg>`

    const blob=new Blob([svg],{type:"image/svg+xml"})

    const url=URL.createObjectURL(blob)

    const a=document.createElement("a")
    a.href=url
    a.download="verijob_qr.svg"
    a.click()

  }

  return(

    <div className="flex gap-2">

      <button
      onClick={copyLink}
      className="border rounded-lg px-3 py-2 text-sm">

      Copiar CV público

      </button>

      <button
      onClick={downloadQR}
      className="border rounded-lg px-3 py-2 text-sm">

      Descargar QR

      </button>

    </div>

  )

}
