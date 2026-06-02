import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.31.131.24', 'helping-poems-windsor-ons.trycloudflare.com', 'localhost', '63.183.212.153'],
  output: 'standalone',
  // 优化开发服务器配置
  webpack: (config, { dev, isServer }) => {
    if (dev && isServer) {
      // 限制 Webpack 并发编译数量
      config.optimization = {
        ...config.optimization,
        minimize: false,
      };
    }
    return config;
  },
  // Turbopack 配置
  experimental: {
    // 优化内存使用
    optimizeCss: true,
  },
};

export default nextConfig;



