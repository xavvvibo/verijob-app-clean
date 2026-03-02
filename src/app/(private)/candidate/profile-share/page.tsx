import ShareProfileButton from "./ShareProfileButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CandidateProfileSharePage() {
  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Compartir perfil</h1>
      <p className="mt-2 text-sm text-gray-600">
        Genera un enlace público (caduca en 7 días) para compartir por WhatsApp o email.
      </p>
      <div className="mt-6">
        <ShareProfileButton />
      </div>
    </main>
  );
}
