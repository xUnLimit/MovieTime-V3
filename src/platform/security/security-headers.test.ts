import { describe, expect, it } from 'vitest';

import { securityHeaders } from './security-headers';

describe('securityHeaders', () => {
  it('permite el microfono solo al propio origen y deniega camara y geolocalizacion', () => {
    const permissionsPolicy = securityHeaders.find(({ key }) => key === 'Permissions-Policy');

    expect(permissionsPolicy?.value).toBe('camera=(), microphone=(self), geolocation=()');
  });

  it('conserva las demas cabeceras de seguridad', () => {
    expect(Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]))).toEqual({
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'X-DNS-Prefetch-Control': 'off',
      'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
    });
  });
});
