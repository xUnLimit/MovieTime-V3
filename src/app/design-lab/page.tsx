import { notFound } from 'next/navigation';

import { DesignLab } from './DesignLab';

export const metadata = {
  title: 'Design Lab · MovieTime PTY',
  robots: { index: false, follow: false },
};

/** Ruta de revision visual solo para desarrollo: nunca se sirve en produccion. */
export default function DesignLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <DesignLab />;
}
