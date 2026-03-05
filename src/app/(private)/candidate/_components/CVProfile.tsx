"use client"

import { useEffect, useState } from "react"

export default function CVProfile() {

  const [profile,setProfile]=useState<any>(null)

  useEffect(()=>{

    fetch("/api/candidate/profile")
      .then(r=>r.json())
      .then(d=>setProfile(d.profile))

  },[])

  if(!profile) return null

  return (

    <div className="card">

      <h3>CV Inteligente</h3>

      {profile.summary && (
        <p>{profile.summary}</p>
      )}

      <h4>Experiencia</h4>

      <ul>

        {profile.experiences?.map((e:any,i:number)=>(
          <li key={i}>
            <strong>{e.company}</strong> — {e.title}
          </li>
        ))}

      </ul>

    </div>

  )
}
