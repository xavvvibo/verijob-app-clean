import { createClient } from "@/utils/supabase/server";
import CandidateProfileIdentityClient from "./CandidateProfileIdentityClient";

export const dynamic = "force-dynamic";

export default async function CandidateProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return <div className="p-6">No autorizado</div>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, title, location, address_line1, address_line2, city, region, postal_code, country")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Perfil</h1>
        <p className="text-sm text-slate-600">Gestiona tus datos personales y de cuenta.</p>
      </div>

      <CandidateProfileIdentityClient
        initialProfile={{
          id: user.id,
          email: user.email ?? null,
          full_name: (profile as any)?.full_name ?? null,
          phone: (profile as any)?.phone ?? null,
          title: (profile as any)?.title ?? null,
          location: (profile as any)?.location ?? null,
          address_line1: (profile as any)?.address_line1 ?? null,
          address_line2: (profile as any)?.address_line2 ?? null,
          city: (profile as any)?.city ?? null,
          region: (profile as any)?.region ?? null,
          postal_code: (profile as any)?.postal_code ?? null,
          country: (profile as any)?.country ?? null,
          identity_type: null,
          identity_masked: null,
          has_identity: false,
        }}
      />
    </div>
  );
}
