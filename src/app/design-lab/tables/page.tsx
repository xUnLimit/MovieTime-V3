import { notFound } from 'next/navigation';

import { TablesPreview } from './TablesPreview';

export const metadata = {
  title: 'Tables Preview · MovieTime PTY',
  robots: { index: false, follow: false },
};

/** Molde de tabla estandar con datos sinteticos, para revision visual. Solo desarrollo. */
export default function TablesPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <TablesPreview />;
}
