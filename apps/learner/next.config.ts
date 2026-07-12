import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages ship raw TS/TSX (no build step) — Next must transpile them.
  transpilePackages: ['@fundi/ui', '@fundi/types'],
};

export default nextConfig;
