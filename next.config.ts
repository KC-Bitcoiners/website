import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath: process.env.BASE_PATH || "",
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Enable top-level await support
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };
    return config;
  },
};

export default nextConfig;
