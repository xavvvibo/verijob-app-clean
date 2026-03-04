import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function HomePage() {
  // /dashboard ya está protegido: si no hay sesión, el guard/middleware te llevará a /login
  redirect("/dashboard");
}
