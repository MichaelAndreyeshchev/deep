import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude native modules from client bundle
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        duckdb: false,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Externalize native modules on server
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('duckdb');
    }
    
    return config;
  },
  transpilePackages: ['@vectorless/core', '@vectorless/db', '@vectorless/ui'],
};

export default nextConfig;
