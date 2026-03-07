import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    vercel_env: process.env.VERCEL_ENV ?? null,
    git_commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    git_ref: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    git_msg: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    now: new Date().toISOString(),
    runtime: "pages-api-node",
    route: "/pages/api/version",
  });
}
