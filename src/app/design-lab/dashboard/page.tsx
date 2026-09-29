import { notFound } from 'next/navigation';

import { DashboardPreview } from './DashboardPreview';

export const metadata = {
  title: 'Dashboard Preview · MovieTime PTY',
  robots: { index: false, follow: false },
};

/** Dashboard real con datos sinteticos, para revision visual. Solo desarrollo. */
export default function DashboardPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <DashboardPreview />;
}
