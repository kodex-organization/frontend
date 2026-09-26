import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(frontendRoot, "..");

const envCandidates = [
  path.resolve(projectRoot, "private/env/frontend.env"),
  path.resolve(frontendRoot, ".env.local"),
  path.resolve(frontendRoot, ".env"),
];

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    loadEnv({ path: envPath });
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: frontendRoot,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

    if (!apiUrl) return [];

    const configuredPath = new URL(apiUrl).pathname.replace(/\/$/, "");
    const proxyPath = configuredPath && configuredPath !== "/"
      ? configuredPath
      : "/api/backend";

    return [
      {
        source: `${proxyPath}/:path*`,
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  // Source service worker file.
  swSrc: "src/app/sw.ts",
// Generated service worker file.
  swDest: "public/sw.js",
  // Automatically register the service worker.
  register: true,
  // Keep enabled in development for offline testing.
  disable: false,
});

export default withSerwist(nextConfig);