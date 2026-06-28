import type { NextConfig } from "next";

// A stable id per deploy: the git SHA on Vercel, else a timestamp locally. It is
// baked into the bundle (NEXT_PUBLIC_BUILD_ID) and used to version the service
// worker cache, so every deploy invalidates the old cache automatically.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.GIT_COMMIT?.slice(0, 8) ||
  String(Date.now());

const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile in a parent dir confuses inference.
  turbopack: {
    root: __dirname,
  },
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
