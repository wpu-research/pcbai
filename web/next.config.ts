import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["pg"],
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./public/library/footprints/**/*"] },
};

export default nextConfig;
