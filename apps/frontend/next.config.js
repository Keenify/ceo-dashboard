/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle canvas module for Konva on server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('canvas');
    } else {
      // Only handle canvas fallback on client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
      };
    }

    return config;
  },
  experimental: {
    esmExternals: 'loose',
  },

};

module.exports = nextConfig; 