import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

const nextConfig: NextConfig = {
  outputFileTracingRoot: rootDir,
  transpilePackages: [
    "@schichtwerk/types",
    "@schichtwerk/ui-tokens",
    "@schichtwerk/api-client",
  ],
};

export default nextConfig;
