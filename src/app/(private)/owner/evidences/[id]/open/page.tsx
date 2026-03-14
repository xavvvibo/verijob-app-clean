import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/utils/supabase/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export const dynamic = "force-dynamic";

const DEFAULT_BUCKET = "evidence";

export default async function OwnerEvidenceOpenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sessionClient = await createServerSupabaseClient();
  const { data: auth } = await sessionClient.auth.getUser();
  if (!auth?.user) redirect(`/login?next=/owner/evidences/${id}/open`);

  const { data: ownerProfile } = await sessionClient.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const ownerRole = String(ownerProfile?.role || "").toLowerCase();
  if (!["owner", "admin"].includes(ownerRole)) redirect("/dashboard?forbidden=1&from=owner");

  const admin = createServiceRoleClient();
  const evidenceRes = await admin
    .from("evidences")
    .select("id,storage_path,evidence_type,document_type,created_at")
    .eq("id", id)
    .maybeSingle();

  if (evidenceRes.error || !evidenceRes.data) notFound();
  const evidence = evidenceRes.data as any;
  const storagePath = String(evidence.storage_path || "").trim();

  if (!storagePath) {
    return (
      <main className="max-w-2xl p-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Esta evidencia no tiene un documento disponible para abrir ahora mismo.
          <div className="mt-4">
            <Link href="/owner/evidences" className="font-semibold underline">Volver a evidencias</Link>
          </div>
        </section>
      </main>
    );
  }

  const signed = await admin.storage.from(DEFAULT_BUCKET).createSignedUrl(storagePath, 60 * 5);
  if (signed.error || !signed.data?.signedUrl) {
    return (
      <main className="max-w-2xl p-6">
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          No se pudo generar una URL segura para este documento.
          <div className="mt-2 text-xs text-rose-800">Revisa si el archivo sigue disponible en almacenamiento o vuelve a intentarlo más tarde.</div>
          <div className="mt-4">
            <Link href="/owner/evidences" className="font-semibold underline">Volver a evidencias</Link>
          </div>
        </section>
      </main>
    );
  }

  redirect(signed.data.signedUrl);
}
