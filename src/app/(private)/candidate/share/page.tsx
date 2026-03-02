import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CandidateSharePage() {
  return (
    <div>
      <h2 className="text-xl font-semibold">Compartir</h2>
      <p className="mt-2 text-sm text-gray-600">
        Genera un enlace público de tu perfil para enviarlo por WhatsApp o email.
      </p>

      <div className="mt-4 rounded-md border p-4">
        <div className="text-sm font-medium">Acción</div>
        <p className="mt-1 text-xs text-gray-600">
          El generador está en <b>/candidate/profile-share</b>. Lo mantenemos ahí para no romper nada.
        </p>

        <div className="mt-3">
          <Link className="rounded-md border px-4 py-2 text-sm inline-block" href="/candidate/profile-share">
            Ir a generar enlace
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-md border p-4">
        <div className="text-sm font-medium">Vista pública</div>
        <p className="mt-1 text-xs text-gray-600">
          El enlace público es <b>/p/[token]</b> (caduca en 7 días).
        </p>
      </div>
    </div>
  );
}
