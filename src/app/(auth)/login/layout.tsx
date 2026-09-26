import type { Viewport } from 'next';

import { siteConfig } from '@/platform/config';

// La pantalla de acceso permite ampliacion sin cambiar el viewport operativo.
export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  interactiveWidget: 'resizes-content',
};

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
