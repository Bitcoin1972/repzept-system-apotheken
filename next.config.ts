import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;
