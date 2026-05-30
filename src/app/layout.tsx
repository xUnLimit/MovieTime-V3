import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { NotificationEventsInitializer } from '@/components/providers/NotificationEventsInitializer';
import { PwaBootstrap } from '@/components/pwa/PwaBootstrap';
import { Toaster } from '@/components/ui/sonner';
import { PendingWhatsAppToast } from '@/components/whatsapp/PendingWhatsAppToast';
import { siteConfig } from '@/platform/config';

import './globals.css';

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
    statusBarStyle: 'black-translucent',
    title: siteConfig.name,
  },
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
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
  await headers();

  return (
    <html lang="es" className="dark" suppressHydrationWarning>
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
