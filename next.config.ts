import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/sandbox/smoke": ["./sandbox/**/*"],
  },
};

export default nextConfig;
