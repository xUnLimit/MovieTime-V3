'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/PageHeader';
import { ServicioForm } from '@/components/servicios/ServicioForm';
import { useServicioDetail } from '@/hooks/use-entity-detail';
import { isUuid, safeInternalPath } from '@/platform/utils/safety';

function EditarServicioPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const from = safeInternalPath(searchParams.get('from'), '/servicios');
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = isUuid(rawId) ? rawId : null;
  const { data: servicio, isLoading } = useServicioDetail(id);

  if (!id) {
    return (
      <div className="space-y-4">
        <PageHeader title="Servicio no encontrado" trail={[{ label: 'Editar' }]} />
        <p className="text-sm text-muted-foreground">El ID del servicio no es valido.</p>
        <Link prefetch={false} href="/servicios" className="text-primary hover:underline">
          Volver a Servicios
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Editar Servicio" trail={[{ label: 'Editar' }]} backTo={from} />

      {isLoading ? (
        <div className="bg-card border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">Cargando servicio...</p>
        </div>
      ) : servicio ? (
        <div className="bg-card border rounded-lg p-6">
          <ServicioForm servicio={servicio} returnTo={from} />
        </div>
      ) : (
        <div className="bg-card border rounded-lg p-6">
          <p className="text-sm text-muted-foreground">No se encontró el servicio solicitado.</p>
        </div>
      )}
    </div>
  );
}

export default function EditarServicioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Cargando...</div></div>}>
      <EditarServicioPageContent />
    </Suspense>
  );
}
