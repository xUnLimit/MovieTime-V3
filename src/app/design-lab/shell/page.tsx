import { notFound } from 'next/navigation';

import { ShellPreview } from './ShellPreview';
import { SamplePage } from './SamplePage';

export const metadata = {
  title: 'Shell Preview · MovieTime PTY',
  robots: { index: false, follow: false },
};

/** Vista previa del shell real (sidebar + cabecera) con datos sinteticos. Solo desarrollo. */
export default function ShellPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <ShellPreview>
      <SamplePage />
    </ShellPreview>
  );
}
