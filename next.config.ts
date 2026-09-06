import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
    staleTimes: {
      dynamic: 20,
      static: 30,
    },
  },
};

export default nextConfig;
