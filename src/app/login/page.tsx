import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <img
              src="/brand/verijob-logo.svg"
              alt="Verijob"
              className="h-auto w-full max-w-[320px] object-contain md:max-w-[360px]"
            />
          </div>

          <Suspense fallback={null}>
            <LoginClient />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
