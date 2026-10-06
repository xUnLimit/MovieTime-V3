import { notFound } from 'next/navigation';

import { AutomatizacionesPreview } from './AutomatizacionesPreview';

export const metadata = {
  title: 'Automatizaciones Preview · MovieTime PTY',
  robots: { index: false, follow: false },
};

/** Automatizaciones (recorrido, respuestas, actividad y versiones) con datos sintéticos, para revisión visual. Solo desarrollo. */
export default function AutomatizacionesPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <AutomatizacionesPreview />;
}
