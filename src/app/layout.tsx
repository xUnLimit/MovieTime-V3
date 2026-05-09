import type { Metadata, Viewport } from 'next';

import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { ThemeProvider } from '@/components/layout/ThemeProvider';
import { PwaBootstrap } from '@/components/pwa/PwaBootstrap';
import { Toaster } from '@/components/ui/sonner';
import { siteConfig } from '@/config';

import './globals.css';

export const metadata: Metadata = {
  applicationName: siteConfig.name,
  title: 'MovieTime PTY - Sistema de Gestion',
  description: 'Sistema de gestion de servicios de streaming',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthInitializer />
          <PwaBootstrap />
          {children}
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
