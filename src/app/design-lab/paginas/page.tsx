import { notFound } from 'next/navigation';

import { PaginasPreview } from './PaginasPreview';

export const metadata = {
  title: 'Paginas Preview · MovieTime PTY',
  robots: { index: false, follow: false },
};

/** Pantallas reales (Yappy, Mensajes) con datos sinteticos, para revisar scroll. Solo desarrollo. */
export default function PaginasPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <PaginasPreview />;
}
