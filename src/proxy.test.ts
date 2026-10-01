import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

describe('proxy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('permite los canales locales solo en desarrollo', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const policy = proxy(new NextRequest('https://example.test/login')).headers.get('Content-Security-Policy');
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain('ws://localhost:*');
    expect(policy).not.toContain('upgrade-insecure-requests');
  });
  it('propaga un nonce unico y la CSP a la respuesta', () => {
    const response = proxy(new NextRequest('https://example.test/ventas'));
    const policy = response.headers.get('Content-Security-Policy');
    expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(response.headers.get('x-middleware-request-x-nonce')).toBeTruthy();
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
    expect(response.headers.get('Cache-Control')).toBeNull();
  });

  it('renueva el nonce por solicitud', () => {
    const first = proxy(new NextRequest('https://example.test/ventas'));
    const second = proxy(new NextRequest('https://example.test/ventas'));
    expect(first.headers.get('Content-Security-Policy')).not.toBe(second.headers.get('Content-Security-Policy'));
  });

  it('excluye API, recursos estaticos y prefetch del matcher', () => {
    expect(config.matcher[0].source).toContain('?!api|_next/static|_next/image');
    expect(config.matcher[0].missing).toEqual([
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ]);
  });
});
