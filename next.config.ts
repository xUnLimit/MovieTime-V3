import type { NextConfig } from 'next';
import { securityHeaders } from './src/platform/security/security-headers';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.60.9', '127.0.0.1', 'localhost'],
  compress: true,
  poweredByHeader: false,
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      { source: '/ventas/pedidos', destination: '/automatizaciones/pedidos', permanent: true },
      { source: '/ventas/cobros', destination: '/automatizaciones/cobros', permanent: true },
      { source: '/terceros/interesados', destination: '/automatizaciones/interesados', permanent: true },
      { source: '/configuracion/automatizacion', destination: '/automatizaciones/conexiones', permanent: true },
    ];
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
