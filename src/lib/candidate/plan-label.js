export function getCandidatePlanLabel(planRaw) {
  const plan = String(planRaw || "").toLowerCase();
  if (plan.includes("proplus") || plan.includes("pro+")) return "CANDIDATO PRO+";
  if (plan.includes("pro")) return "CANDIDATO PRO";
  return "CANDIDATO FREE";
}
