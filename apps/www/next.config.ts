import path from "node:path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The docs compile registry/ source directly (via tsconfig paths), so the
  // bundler root must include the whole monorepo.
  turbopack: {
    root: monorepoRoot,
  },
  outputFileTracingRoot: monorepoRoot,
  async headers() {
    return [
      {
        // Registry JSON is fetched cross-origin by the shadcn CLI and coding agents.
        source: "/r/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
