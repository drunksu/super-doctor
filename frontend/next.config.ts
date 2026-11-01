import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingRoot: path.resolve(process.cwd()),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
