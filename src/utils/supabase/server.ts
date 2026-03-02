import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Canonical SSR Supabase client (Next 16 + App Router).
 * Use this in server components and route handlers.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

/**
 * Backward-compatible alias used in older pages.
 * TODO: migrate imports to createClient() and remove this alias later.
 */
export const createServerSupabaseClient = createClient;
