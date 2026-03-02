import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Next.js 16 rule:
 * - Server Components: cookies are READ-ONLY (no set/remove)
 * - Route Handlers / Server Actions: cookies can be mutated
 */

export async function createServerComponentClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // IMPORTANT: do not set/remove in Server Components
        set() {},
        remove() {},
      },
    }
  );
}

export async function createRouteHandlerClient() {
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

// Backward-compatible aliases:
// - createClient(): historically used in Server Components
// - createServerSupabaseClient: used throughout app/(private)
export const createClient = createServerComponentClient;
export const createServerSupabaseClient = createServerComponentClient;
