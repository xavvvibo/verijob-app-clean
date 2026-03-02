"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function Test() {
  const [msg, setMsg] = useState("probando conexión...");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setMsg("❌ Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    try {
      createClient(url, key);
      setMsg("✅ Supabase conectado correctamente");
    } catch (e: any) {
      setMsg("❌ Error creando Supabase client: " + (e?.message ?? "desconocido"));
    }
  }, []);

  return <pre style={{ padding: 24 }}>{msg}</pre>;
}
