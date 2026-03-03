import { redirect } from "next/navigation";

export default function DashboardPage() {
  // El layout decide el destino final. Esto evita bucles.
  redirect("/dashboard");
}
