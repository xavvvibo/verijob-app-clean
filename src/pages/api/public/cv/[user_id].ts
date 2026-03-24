import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed", route: "/pages/api/public/cv/[user_id]" });
  }

  const userId = String(req.query.user_id || "").trim();
  if (!userId) {
    return res.status(400).json({ error: "missing_user_id", route: "/pages/api/public/cv/[user_id]" });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({
    error: "route_deprecated",
    details: "La resolución pública de CV por user_id queda deshabilitada. Usa el endpoint canónico por token público.",
    route: "/pages/api/public/cv/[user_id]",
    source_of_truth: "/api/public/candidate/[token]",
    candidate_id: userId,
  });
}
