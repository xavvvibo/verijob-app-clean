"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"working" | "fail">("working");
  const [debug, setDebug] = useState("");

  const next = useMemo(() => searchParams.get("next") ?? "/dashboard", [searchParams]);
  const code = useMemo(() => searchParams.get("code"), [searchParams]);

  useEffect(() => {
    const run = async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const key =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_KEY ||
        "";

      const diag = [
        `has_code=${code ? "1" : "0"}`,
        `has_env_url=${url ? "1" : "0"}`,
        `has_env_key=${key ? "1" : "0"}`,
        `code_len=${code ? String(code.length) : "0"}`,
        `next=${encodeURIComponent(next)}`,
      ].join("&");

      if (!url || !key) {
        setDebug(`missing_env&${diag}`);
        setStatus("fail");
        return;
      }

      if (!code) {
        setDebug(`no_code&${diag}`);
        setStatus("fail");
        return;
      }

      const supabase = createClient(url, key);

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setDebug(`exchange_failed&err=${encodeURIComponent(error.message)}&${diag}`);
        setStatus("fail");
        return;
      }

      router.replace(next);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "fail") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-lg border border-gray-200 bg-white p-4 text-sm">
          <div className="font-medium mb-2">Auth callback: fallo</div>
          <div className="text-gray-600 mb-3">Copia este debug y pégamelo tal cual:</div>
          <pre className="rounded bg-gray-50 p-3 overflow-auto border border-gray-200">{debug}</pre>
          <div className="mt-4">
            <button
              className="rounded border px-3 py-2"
              onClick={() => router.replace(`/login?error=auth_failed&debug=${encodeURIComponent(debug)}`)}
            >
              Ir a login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-600">
      Verificando acceso…
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-gray-600">
          Verificando acceso…
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
