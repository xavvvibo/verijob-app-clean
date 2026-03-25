import type { NextApiRequest, NextApiResponse } from "next";
import { buildDeprecatedPublicCvResponse } from "@/lib/public/deprecated-public-cv-response";

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
  return res.status(410).json(buildDeprecatedPublicCvResponse());
}
