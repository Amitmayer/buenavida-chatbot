import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    staleTimes: {
      dynamic: 20,
      static: 30,
    },
  },
};

export default nextConfig;
