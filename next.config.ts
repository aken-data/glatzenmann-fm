import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn1.suno.ai" },
      { protocol: "https", hostname: "cdn2.suno.ai" },
    ],
  },
};

export default nextConfig;
