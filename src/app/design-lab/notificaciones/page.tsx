import { notFound } from 'next/navigation';

import { NotificacionesPreview } from './NotificacionesPreview';

export const metadata = {
  title: 'Notificaciones Preview · MovieTime PTY',
  robots: { index: false, follow: false },
};

/** Tablas reales de Notificaciones con datos sinteticos, para revisar scroll y columnas. Solo desarrollo. */
export default function NotificacionesPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <NotificacionesPreview />;
}
