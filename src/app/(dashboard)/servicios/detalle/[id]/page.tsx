import { notFound } from 'next/navigation';

import { isUuid } from '@/lib/utils/safety';

import ServicioDetalleClient from './ServicioDetalleClient';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string | string[] }>;
};

export default async function ServicioDetallePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const serviceId = id.trim();

  if (!isUuid(serviceId)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const fromParam = resolvedSearchParams?.from;
  const from = Array.isArray(fromParam) ? fromParam[0] ?? null : fromParam ?? null;

  return <ServicioDetalleClient id={serviceId} from={from} />;
}
