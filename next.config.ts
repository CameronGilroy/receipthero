import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['pdfjs-dist'],
  webpack: (config, options) => {
    // Handle PDF.js imports for Next.js compatibility
    if (!options.isServer) {
      // Client-side only PDF.js configuration
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist/build/pdf': require.resolve('pdfjs-dist/build/pdf.mjs'),
        'pdfjs-dist': require.resolve('pdfjs-dist'),
      };

      // Ignore the worker file since we'll configure it manually
      config.resolve.alias['pdfjs-dist/build/pdf.worker.entry'] = false;
    }

    return config;
  },
};

export default nextConfig;
