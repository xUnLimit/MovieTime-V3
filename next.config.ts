import type { NextConfig } from 'next';
import { securityHeaders } from './src/platform/security/security-headers';
import { legacyRedirects } from './src/platform/config/legacy-redirects';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.60.9', '127.0.0.1', 'localhost'],
  compress: true,
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  async redirects() {
    return legacyRedirects;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
