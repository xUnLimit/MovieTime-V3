import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';

import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { themeInitScript } from '@/components/layout/theme-init-script';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { NotificationEventsInitializer } from '@/components/providers/NotificationEventsInitializer';
import { PwaBootstrap } from '@/components/pwa/PwaBootstrap';
import { Toaster } from '@/components/ui/sonner';
import { PendingWhatsAppToast } from '@/components/whatsapp/PendingWhatsAppToast';
import { siteConfig } from '@/platform/config';

import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', display: 'swap' });

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  title: 'MovieTime PTY - Sistema de Gestion',
  description: 'Sistema de gestion de servicios de streaming',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon',
  },
  appleWebApp: {
    capable: true,
    // La PWA de iOS dibuja bajo la barra de estado (hora/bateria) en lugar de dejar una franja
    // aparte; el contenido compensa con env(safe-area-inset-top).
    statusBarStyle: 'black-translucent',
    title: siteConfig.name,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: siteConfig.themeColorLight },
    { media: '(prefers-color-scheme: dark)', color: siteConfig.themeColor },
  ],
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  // ADR-0008: PWA interna app-like; compensar con UI legible y tap targets amplios.
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Required for Next to apply the per-request CSP nonce generated in proxy.ts.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="es"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          defaultTheme="dark"
          enableSystem
        >
          <QueryProvider>
            <AuthInitializer />
            <NotificationEventsInitializer />
            <PwaBootstrap />
            {children}
            <PendingWhatsAppToast />
            <Toaster position="bottom-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
