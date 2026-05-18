import { NextResponse, type NextRequest } from 'next/server';

const STATIC_ASSET_PREFIX = '/_next/static/';

function normalizeHeaderValue(value: string): string {
  return value.replace(/\s{2,}/g, ' ').trim();
}

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `style-src 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    `style-src-elem 'self' ${isDevelopment ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    [
      "connect-src 'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://open.er-api.com',
      ...(isDevelopment ? ['ws://localhost:*', 'http://localhost:*'] : []),
    ].join(' '),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
  ];

  return normalizeHeaderValue(directives.join('; '));
}

function setStaticAssetCors(response: NextResponse, request: NextRequest): void {
  response.headers.set('Access-Control-Allow-Origin', request.nextUrl.origin);
  response.headers.set('Vary', 'Origin');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith(STATIC_ASSET_PREFIX) && pathname.endsWith('/')) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': request.nextUrl.origin,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        Vary: 'Origin',
      },
    });
  }

  if (pathname.startsWith(STATIC_ASSET_PREFIX)) {
    const response = NextResponse.next();
    setStaticAssetCors(response, request);
    return response;
  }

  const nonce = generateNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
