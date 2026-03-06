import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    route: "/pages/api/health",
    runtime: "pages-api-node",
    ts: new Date().toISOString(),
  });
}
