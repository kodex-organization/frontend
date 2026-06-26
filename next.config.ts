import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

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
};

export default nextConfig;
