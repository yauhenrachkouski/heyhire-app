import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    browserDebugInfoInTerminal: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.licdn.com",
      },
      {
        protocol: "https",
        hostname: "cdn.brandfetch.io",
      },
    ],
  },
};

export default nextConfig;
