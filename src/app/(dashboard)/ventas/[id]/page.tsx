import { notFound } from 'next/navigation';

import { isUuid } from '@/lib/utils/safety';
import VentaDetalleClient from './VentaDetalleClient';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VentaDetallePage({ params }: PageProps) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  return <VentaDetalleClient id={id} />;
}
