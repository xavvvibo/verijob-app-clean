import React from "react";
import LegacyCompanyDashboard from "./page.legacy";
import CompanyDashboardV4 from "../dashboard-v4/page";

export default function CompanyDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const uiParam = searchParams?.ui;
  const ui = Array.isArray(uiParam) ? uiParam[0] : uiParam;

  const flag = process.env.NEXT_PUBLIC_UI_V4 === "1";

  // Override safety:
  if (ui === "legacy") return <LegacyCompanyDashboard searchParams={searchParams} />;

  const useV4 = flag || ui === "v4";
  return useV4 ? <CompanyDashboardV4 /> : <LegacyCompanyDashboard searchParams={searchParams} />;
}
