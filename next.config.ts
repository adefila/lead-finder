import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['xml2js'],
  // Private CRM: keep every page and response out of search engines.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default nextConfig;
