import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default function CompanyDashboardAlias() {
  redirect("/company/dashboard-v4");
}
