import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not defined");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not defined");

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
