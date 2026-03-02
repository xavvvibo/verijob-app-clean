import { redirect } from "next/navigation";

type RequireOpts = {
  redirectTo?: string;     // dónde mandar si NO hay suscripción activa
  allowTrial?: boolean;    // por si luego metemos trials con status distinto (ahora false)
};

export async function requireActiveSubscription(
  supabase: any,
  userId: string,
  opts: RequireOpts = {}
) {
  const redirectTo = opts.redirectTo ?? "/company/upgrade";
  const allowTrial = opts.allowTrial ?? false;

  // Tomamos el registro más reciente del usuario. Ajusta el campo si tu esquema usa otra columna.
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // Si hay error de esquema/permisos, mejor cerrar acceso (fail-closed)
    redirect(redirectTo + "?reason=billing_error");
  }

  const status = (data?.status ?? "").toLowerCase();

  const isActive = status === "active";
  const isTrial = allowTrial && (status === "trialing" || status === "trial");

  if (!isActive && !isTrial) {
    redirect(redirectTo + "?reason=inactive");
  }
}
