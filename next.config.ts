import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // data: URLs and local svgs fall back to regular <img> in SmartImage
  },
};

export default nextConfig;
