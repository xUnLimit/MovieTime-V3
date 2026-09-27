import type { Metadata, Viewport } from 'next';

import { siteConfig } from '@/platform/config';

export const metadata: Metadata = {
  title: 'Política de privacidad - MovieTime PTY',
  description: 'Cómo MovieTime PTY trata los datos personales de sus clientes.',
};

// Pagina publica de lectura: permite ampliacion como la pantalla de acceso.
export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
