import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  distDir: "out",
  // Ensure static generation
  generateBuildId: async () => "build",
  // Optimize for static hosting
  assetPrefix: process.env.NODE_ENV === "production" ? "" : undefined,
};

export default nextConfig;
