import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.31.131.24', 'helping-poems-windsor-ons.trycloudflare.com', 'localhost', '63.183.212.153'],
  output: 'standalone',
  // Initialize proxy on startup
  experimental: {
    serverComponentsExternalPackages: ['undici'],
  },
};

export default nextConfig;



