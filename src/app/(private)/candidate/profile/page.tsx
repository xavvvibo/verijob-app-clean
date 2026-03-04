import { createClient } from "@/utils/supabase/server";
import ProfileSettingsClient from "@/components/candidate/profile/ProfileSettingsClient";

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    // El private layout debería cortar antes, pero por si acaso:
    return <div className="p-6">No autorizado</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, address_line1, address_line2, city, region, postal_code, country")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Perfil</h1>
        <p className="text-sm text-slate-600">Datos personales, cuenta y CV para extraer experiencias.</p>
      </div>

      <ProfileSettingsClient
        initialProfile={{
          id: user.id,
          email: user.email ?? null,
          full_name: (profile as any)?.full_name ?? null,
          phone: (profile as any)?.phone ?? null,
          address_line1: (profile as any)?.address_line1 ?? null,
          address_line2: (profile as any)?.address_line2 ?? null,
          city: (profile as any)?.city ?? null,
          region: (profile as any)?.region ?? null,
          postal_code: (profile as any)?.postal_code ?? null,
          country: (profile as any)?.country ?? null,
        }}
      />
    </div>
  );
}
