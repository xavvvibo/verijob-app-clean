import React from "react";
import LegacyCandidateDashboard from "./page.legacy";
import CandidateDashboardV4 from "../dashboard-v4/page";

export default function CandidateDashboardPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const uiParam = searchParams?.ui;
  const ui = Array.isArray(uiParam) ? uiParam[0] : uiParam;

  const flag = process.env.NEXT_PUBLIC_UI_V4 === "1";

  // Override safety:
  if (ui === "legacy") return <LegacyCandidateDashboard searchParams={searchParams} />;

  const useV4 = flag || ui === "v4";
  return useV4 ? <CandidateDashboardV4 /> : <LegacyCandidateDashboard searchParams={searchParams} />;
}
